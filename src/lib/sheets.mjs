import { parseCsv } from "./csv.mjs";
import { AppError } from "./errors.mjs";
import { parseInventoryRows } from "./domain.mjs";

export function googleGvizUrl({ sheetId, gid, range }) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
  url.searchParams.set("tqx", "out:csv");
  url.searchParams.set("gid", String(gid));
  url.searchParams.set("range", range);
  return url;
}

async function fetchCsv(fetchImpl, url, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: "text/csv,text/plain;q=0.9,*/*;q=0.1",
        "user-agent": "KhoPheu/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Google Sheets phản hồi HTTP ${response.status}.`);

    const text = await response.text();
    if (/^\s*</.test(text) || /<!doctype\s+html/i.test(text)) {
      throw new Error("Google Sheets không trả về CSV; hãy kiểm tra quyền chia sẻ của bảng tính.");
    }
    return parseCsv(text);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Google Sheets phản hồi quá thời gian.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class GoogleSheetsService {
  #cache = new Map();
  #inflight = new Map();

  constructor({ sheetId, inventoryGid, salesGid, cacheTtlMs = 60_000, fetchImpl = fetch }) {
    this.sheetId = sheetId;
    this.inventoryGid = inventoryGid;
    this.salesGid = salesGid;
    this.cacheTtlMs = cacheTtlMs;
    this.fetchImpl = fetchImpl;
  }

  getInventory(options = {}) {
    return this.#cached(
      "inventory",
      () => fetchCsv(
        this.fetchImpl,
        googleGvizUrl({ sheetId: this.sheetId, gid: this.inventoryGid, range: "A2:E" }),
      ).then((rows) => {
        const products = parseInventoryRows(rows);
        if (products.length === 0) throw new Error("Sheet kiểm tra số lượng không có sản phẩm hợp lệ.");
        return products;
      }),
      options.refresh,
    );
  }

  getSalesRows(options = {}) {
    return this.#cached(
      "sales",
      () => fetchCsv(
        this.fetchImpl,
        googleGvizUrl({ sheetId: this.sheetId, gid: this.salesGid, range: "A2:G" }),
      ),
      options.refresh,
    );
  }

  async #cached(key, loader, refresh = false) {
    const cached = this.#cache.get(key);
    const now = Date.now();
    if (!refresh && cached && now - cached.timestamp <= this.cacheTtlMs) {
      return { data: cached.data, source: "cache", fetchedAt: cached.fetchedAt };
    }

    const existingRequest = this.#inflight.get(key);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      try {
        const data = await loader();
        const timestamp = Date.now();
        const entry = { data, timestamp, fetchedAt: new Date(timestamp).toISOString() };
        this.#cache.set(key, entry);
        return { data, source: "network", fetchedAt: entry.fetchedAt };
      } catch (error) {
        if (cached) {
          return { data: cached.data, source: "stale-cache", fetchedAt: cached.fetchedAt };
        }
        throw new AppError(
          502,
          "SHEETS_UNAVAILABLE",
          "Không thể đọc dữ liệu từ Google Sheets.",
          { source: key, reason: error?.message || "Unknown error" },
        );
      }
    })();
    this.#inflight.set(key, request);

    try {
      return await request;
    } finally {
      if (this.#inflight.get(key) === request) this.#inflight.delete(key);
    }
  }
}
