import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";

import { createApplication } from "../server.mjs";
import { AppError } from "../src/lib/errors.mjs";
import { STOCK_UPLOAD_LIMIT } from "../src/lib/workbook.mjs";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function startTestServer({ sheets, parseWorkbook }) {
  const application = createApplication({
    settings: { adminUsername: "admin", adminPassword: "secret" },
    store: {},
    sheets,
    sessions: { read() { return null; } },
    parseWorkbook,
  });
  const server = createServer(application);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    server,
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function rawHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, options, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: response.statusCode,
          headers: response.headers,
          payload: text ? JSON.parse(text) : null,
        });
      });
    });
    request.on("error", reject);
    request.end(options.body);
  });
}

test("POST /api/stock-balance đọc body nhị phân, refresh tồn kho và trả contract cân bằng", async (t) => {
  const received = {};
  const sheets = {
    async getInventory(options) {
      received.inventoryOptions = options;
      return {
        data: [
          { name: "Sản phẩm thiếu", sku: "SKU-1", standardQty: 5 },
          { name: "Sản phẩm cân bằng", sku: "SKU-2", standardQty: 2 },
        ],
        source: "network",
        fetchedAt: "2026-07-15T03:00:00.000Z",
      };
    },
  };
  const parseWorkbook = async (buffer) => {
    received.buffer = buffer;
    return {
      sheetName: "KHO ĐÀ NẴNG",
      headerRow: 2,
      stockBySku: new Map([
        ["SKU-1", { quantity: 3, row: 3 }],
        ["SKU-2", { quantity: 2, row: 4 }],
      ]),
      presentSkus: new Set(["SKU-1", "SKU-2"]),
      duplicateSkus: [],
      invalidRows: [],
    };
  };
  const fixture = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
  const testServer = await startTestServer({ sheets, parseWorkbook });
  t.after(testServer.close);

  const response = await fetch(`${testServer.base}/api/stock-balance`, {
    method: "POST",
    headers: { "content-type": XLSX_MIME },
    body: fixture,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(received.inventoryOptions, { refresh: true });
  assert.deepEqual(received.buffer, fixture);
  assert.equal(payload.sheetName, "KHO ĐÀ NẴNG");
  assert.deepEqual(payload.summary, { total: 2, balanced: 1, excess: 1, shortage: 0, unmatched: 0 });
  assert.deepEqual(payload.source, { inventory: "network", fetchedAt: "2026-07-15T03:00:00.000Z" });
  assert.equal(Number.isNaN(Date.parse(payload.analyzedAt)), false);
  assert.deepEqual(
    payload.rows.map(({ sku, status, difference }) => ({ sku, status, difference })),
    [
      { sku: "SKU-1", status: "excess", difference: 2 },
      { sku: "SKU-2", status: "balanced", difference: 0 },
    ],
  );
});

test("POST /api/stock-balance chặn sai method, MIME, body trống và Content-Length quá giới hạn", async (t) => {
  let parserCalls = 0;
  let inventoryCalls = 0;
  const testServer = await startTestServer({
    sheets: {
      async getInventory() {
        inventoryCalls += 1;
        return { data: [], source: "network", fetchedAt: null };
      },
    },
    async parseWorkbook() {
      parserCalls += 1;
      throw new Error("Không được gọi parser trong các trường hợp này");
    },
  });
  t.after(testServer.close);

  const wrongMethod = await fetch(`${testServer.base}/api/stock-balance`);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");

  const wrongMime = await fetch(`${testServer.base}/api/stock-balance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(wrongMime.status, 415);
  assert.equal((await wrongMime.json()).error.code, "UNSUPPORTED_MEDIA_TYPE");

  const empty = await fetch(`${testServer.base}/api/stock-balance`, {
    method: "POST",
    headers: { "content-type": XLSX_MIME },
    body: Buffer.alloc(0),
  });
  assert.equal(empty.status, 400);
  assert.equal((await empty.json()).error.code, "BAD_REQUEST");

  const tooLarge = await rawHttpRequest(`${testServer.base}/api/stock-balance`, {
    method: "POST",
    headers: {
      "content-type": XLSX_MIME,
      "content-length": String(STOCK_UPLOAD_LIMIT + 1),
      connection: "close",
    },
  });
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.payload.error.code, "BODY_TOO_LARGE");
  assert.equal(parserCalls, 0);
  assert.equal(inventoryCalls, 0);
});

test("POST /api/stock-balance giữ nguyên lỗi workbook 422 từ parser", async (t) => {
  const testServer = await startTestServer({
    sheets: {
      async getInventory() {
        return { data: [], source: "network", fetchedAt: null };
      },
    },
    async parseWorkbook() {
      throw new AppError(422, "INVALID_WORKBOOK", "Thiếu sheet KHO ĐÀ NẴNG.", {
        availableSheets: ["Sheet1"],
      });
    },
  });
  t.after(testServer.close);

  const response = await fetch(`${testServer.base}/api/stock-balance`, {
    method: "POST",
    headers: { "content-type": XLSX_MIME },
    body: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  });
  const payload = await response.json();

  assert.equal(response.status, 422);
  assert.deepEqual(payload.error, {
    code: "INVALID_WORKBOOK",
    message: "Thiếu sheet KHO ĐÀ NẴNG.",
    details: { availableSheets: ["Sheet1"] },
  });
});
