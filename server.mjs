import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFileSync, settingsFromEnv } from "./src/lib/env.mjs";
import {
  VIETNAM_TIME_ZONE,
  dateInTimeZone,
  decorateProducts,
  isIsoDate,
  parseSalesRows,
  salesForDate,
  validateConfig,
  validateCountPatch,
} from "./src/lib/domain.mjs";
import { AppError, badRequest, methodNotAllowed, notFound, unauthorized } from "./src/lib/errors.mjs";
import { GoogleSheetsService } from "./src/lib/sheets.mjs";
import { credentialsMatch, SessionManager } from "./src/lib/session.mjs";
import { DataStore } from "./src/lib/store.mjs";
import {
  buildStockBalance,
  parseWarehouseWorkbook,
  STOCK_UPLOAD_LIMIT,
} from "./src/lib/workbook.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function securityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendJson(response, status, value, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(body);
}

async function readJson(request, limit = 64 * 1024) {
  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Yêu cầu phải dùng Content-Type application/json.");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new AppError(413, "BODY_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
    chunks.push(chunk);
  }

  if (size === 0) throw badRequest("Nội dung JSON không được để trống.");
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw badRequest("JSON không hợp lệ.");
  }
}

async function readXlsx(request, limit = STOCK_UPLOAD_LIMIT) {
  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  const xlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (!contentType.startsWith(xlsxType)) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Chỉ hỗ trợ tải lên file Excel có đuôi .xlsx.");
  }

  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new AppError(413, "BODY_TOO_LARGE", "File Excel vượt quá giới hạn 8 MB.");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new AppError(413, "BODY_TOO_LARGE", "File Excel vượt quá giới hạn 8 MB.");
    chunks.push(chunk);
  }
  if (size === 0) throw badRequest("File Excel không được để trống.");
  return Buffer.concat(chunks);
}

function onlyMethod(request, expected) {
  if (request.method !== expected) {
    const error = methodNotAllowed(`Endpoint này chỉ hỗ trợ ${expected}.`);
    error.allow = expected;
    throw error;
  }
}

function requestIsSecure(request) {
  return Boolean(request.socket.encrypted) || request.headers["x-forwarded-proto"] === "https";
}

function parseRefresh(value) {
  if (value === null || value === "" || value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  throw badRequest("refresh chỉ nhận 0, 1, false hoặc true.");
}

function latestTimestamp(...values) {
  const timestamps = values.map(Date.parse).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function sessionResponse(session) {
  return session
    ? { authenticated: true, username: session.username }
    : { authenticated: false };
}

async function serveStatic(request, response, url, publicRoot) {
  if (request.method !== "GET" && request.method !== "HEAD") throw methodNotAllowed();

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw badRequest("Đường dẫn không hợp lệ.");
  }
  if (pathname.includes("\0") || pathname.includes("\\")) throw badRequest("Đường dẫn không hợp lệ.");

  const segments = pathname.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) throw notFound();

  const root = resolve(publicRoot);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = resolve(root, relativePath);
  const relation = relative(root, filePath);
  if (relation.startsWith("..") || relation.includes(`..${sep}`) || resolve(filePath) === resolve(ROOT, "data")) {
    throw notFound();
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
      fileStat = await stat(filePath);
    }
  } catch (error) {
    const wantsHtml = String(request.headers.accept || "").includes("text/html");
    if (error?.code !== "ENOENT" || !wantsHtml || extname(relativePath)) throw notFound();
    filePath = join(root, "index.html");
    try {
      fileStat = await stat(filePath);
    } catch {
      throw notFound("Frontend chưa được tạo trong thư mục public.");
    }
  }

  if (!fileStat.isFile()) throw notFound();
  const etag = `W/\"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}\"`;
  if (request.headers["if-none-match"] === etag) {
    response.writeHead(304, { ETag: etag });
    response.end();
    return;
  }

  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": MIME_TYPES.get(extension) || "application/octet-stream",
    "Content-Length": fileStat.size,
    "Last-Modified": fileStat.mtime.toUTCString(),
    ETag: etag,
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on("error", (error) => response.destroy(error));
  stream.pipe(response);
}

export function createApplication({
  settings,
  store,
  sheets,
  sessions,
  publicRoot = join(ROOT, "public"),
  parseWorkbook = parseWarehouseWorkbook,
}) {
  return async function application(request, response) {
    securityHeaders(response);

    try {
      const url = new URL(request.url || "/", "http://localhost");
      const { pathname } = url;

      if (pathname === "/api/bootstrap") {
        onlyMethod(request, "GET");
        const date = url.searchParams.get("date") || dateInTimeZone(new Date(), VIETNAM_TIME_ZONE);
        if (!isIsoDate(date)) throw badRequest("date phải có định dạng YYYY-MM-DD hợp lệ.");
        const refresh = parseRefresh(url.searchParams.get("refresh"));

        const [inventoryResult, salesResult, rawConfig, counts] = await Promise.all([
          sheets.getInventory({ refresh }),
          sheets.getSalesRows({ refresh }),
          store.getConfig(),
          store.getCounts(date),
        ]);
        const config = validateConfig(rawConfig);
        const allSales = parseSalesRows(salesResult.data, inventoryResult.data);
        const sales = salesForDate(allSales, date).map((sale) => ({
          dateTime: sale.dateTime,
          productName: sale.productName,
          quantity: sale.quantity,
          customer: sale.customer,
          phone: sale.phone,
          staff: sale.staff,
          matchedSku: sale.matchedSku,
        }));
        const products = decorateProducts(inventoryResult.data, sales, config);

        sendJson(response, 200, {
          date,
          products,
          sales,
          areas: config.areas,
          salesCopyTemplate: config.salesCopyTemplate,
          inventoryReportTemplate: config.inventoryReportTemplate,
          counts,
          source: {
            inventory: inventoryResult.source,
            sales: salesResult.source,
            fetchedAt: latestTimestamp(inventoryResult.fetchedAt, salesResult.fetchedAt),
          },
        });
        return;
      }

      if (pathname === "/api/stock-balance") {
        onlyMethod(request, "POST");
        const file = await readXlsx(request);
        const [inventoryResult, workbook] = await Promise.all([
          sheets.getInventory({ refresh: true }),
          parseWorkbook(file),
        ]);
        const balance = buildStockBalance(inventoryResult.data, workbook);
        sendJson(response, 200, {
          ...balance,
          source: {
            inventory: inventoryResult.source,
            fetchedAt: inventoryResult.fetchedAt || null,
          },
          analyzedAt: new Date().toISOString(),
        });
        return;
      }

      if (pathname === "/api/session") {
        onlyMethod(request, "GET");
        sendJson(response, 200, sessionResponse(sessions.read(request.headers.cookie)));
        return;
      }

      if (pathname === "/api/login") {
        onlyMethod(request, "POST");
        const body = await readJson(request);
        if (!credentialsMatch(body?.username, body?.password, settings.adminUsername, settings.adminPassword)) {
          throw new AppError(401, "INVALID_CREDENTIALS", "Tên đăng nhập hoặc mật khẩu không đúng.");
        }
        const token = sessions.create(settings.adminUsername);
        sendJson(
          response,
          200,
          { authenticated: true, username: settings.adminUsername },
          { "Set-Cookie": sessions.cookie(token, { secure: requestIsSecure(request) }) },
        );
        return;
      }

      if (pathname === "/api/logout") {
        onlyMethod(request, "POST");
        sessions.destroy(request.headers.cookie);
        sendJson(
          response,
          200,
          { authenticated: false },
          { "Set-Cookie": sessions.cookie("", { secure: requestIsSecure(request), clear: true }) },
        );
        return;
      }

      if (pathname === "/api/config") {
        onlyMethod(request, "PUT");
        if (!sessions.read(request.headers.cookie)) throw unauthorized();
        const body = await readJson(request);
        let configValue = body;
        const templateKeys = ["salesCopyTemplate", "inventoryReportTemplate"];
        const missingTemplateKeys =
          body && typeof body === "object" && !Array.isArray(body)
            ? templateKeys.filter((key) => !Object.prototype.hasOwnProperty.call(body, key))
            : [];
        if (missingTemplateKeys.length) {
          const currentConfig = await store.getConfig();
          configValue = { ...body };
          for (const key of missingTemplateKeys) configValue[key] = currentConfig?.[key];
        }
        const config = validateConfig(configValue);
        await store.putConfig(config);
        sendJson(response, 200, config);
        return;
      }

      const countRoute = /^\/api\/counts\/(\d{4}-\d{2}-\d{2})$/.exec(pathname);
      if (countRoute) {
        onlyMethod(request, "PATCH");
        const date = countRoute[1];
        if (!isIsoDate(date)) throw badRequest("Ngày đếm không hợp lệ.");
        const patch = validateCountPatch(await readJson(request));
        const today = dateInTimeZone(new Date(), VIETNAM_TIME_ZONE);
        if (date !== today) {
          throw new AppError(
            409,
            "COUNT_DATE_CONFLICT",
            "Phiên đếm không còn thuộc ngày hiện tại.",
            { currentDate: today },
          );
        }

        const inventory = await sheets.getInventory();
        if (!inventory.data.some((product) => product.sku === patch.sku)) {
          throw badRequest(`SKU ${patch.sku} không tồn tại trong danh mục.`);
        }

        const options = Object.prototype.hasOwnProperty.call(patch, "expectedActual")
          ? { expectedActual: patch.expectedActual }
          : undefined;
        const counts = await store.patchCount(date, patch.sku, patch.actual, options);
        sendJson(response, 200, { date, sku: patch.sku, actual: patch.actual, counts });
        return;
      }

      if (pathname.startsWith("/api/")) throw notFound("API không tồn tại.");
      await serveStatic(request, response, url, publicRoot);
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }

      const known = error instanceof AppError;
      if (!known) console.error("[server]", error);
      const status = known ? error.status : 500;
      const headers = error?.allow ? { Allow: error.allow } : {};
      const message = known ? error.message : "Máy chủ gặp lỗi ngoài dự kiến.";
      const payload = {
        message,
        error: {
          code: known ? error.code : "INTERNAL_ERROR",
          message,
          ...(known && error.details !== undefined ? { details: error.details } : {}),
        },
      };
      sendJson(response, status, payload, headers);
    }
  };
}

export function createDefaultApplication() {
  loadEnvFileSync(join(ROOT, ".env"));
  const settings = settingsFromEnv();
  const sessionSecret = settings.sessionSecret || randomBytes(32).toString("hex");
  const store = new DataStore({
    configPath: join(ROOT, "data", "config.json"),
    countsPath: join(ROOT, "data", "counts.json"),
  });
  const sheets = new GoogleSheetsService({
    sheetId: settings.googleSheetId,
    inventoryGid: settings.inventorySheetGid,
    salesGid: settings.salesSheetGid,
    cacheTtlMs: settings.cacheTtlMs,
  });
  const sessions = new SessionManager({ secret: sessionSecret });
  return { application: createApplication({ settings, store, sheets, sessions }), settings };
}

export function startServer() {
  const { application, settings } = createDefaultApplication();
  const server = createServer(application);
  server.listen(settings.port, settings.host, () => {
    console.log(`Kho Phễu đang chạy tại http://localhost:${settings.port}`);
  });
  return server;
}

// Vercel imports the detected server entrypoint instead of necessarily running it
// as process.argv[1]. Start during module initialization so the platform can capture
// server.listen(); Node's test runner imports this module only for its exported helpers.
if (!process.env.NODE_TEST_CONTEXT) {
  try {
    startServer();
  } catch (error) {
    console.error("Không thể khởi động máy chủ:", error);
    throw error;
  }
}
