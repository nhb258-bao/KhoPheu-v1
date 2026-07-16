import { badRequest } from "./errors.mjs";

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

export const DEFAULT_SALES_COPY_TEMPLATE = [
  "{{date}} - {{phone}} - Dạ em bán:",
  "{{products}}",
  "Dạ em đã xuất File và CRM.",
].join("\n");

export const DEFAULT_INVENTORY_REPORT_TEMPLATE = [
  "Báo cáo kho PTS ngày {{date}}",
  "Số lượng bán PTS: {{ptsSold}}",
  "{{ptsSoldProducts}}",
  "=> SL PTS còn lại: PTS: {{ptsRemaining}}",
  "",
  "Số lượng bán Chân thoát: {{drainSold}}",
  "{{drainSoldProducts}}",
  "=> SL Chân thoát còn lại:",
  "{{drainRemaining}}",
  "",
  "Số lượng bán VX: {{vxSold}}",
  "{{vxSoldProducts}}",
  "=> SL VX còn lại:",
  "{{vxRemaining}}",
  "",
  "Số lượng bán Van Chia Nước: {{valveSold}}",
  "{{valveSoldProducts}}",
  "=> SL Van chia nước còn lại:",
  "{{valveRemaining}}",
  "",
  "=> Số lượng ĐỦ",
].join("\n");

const SALES_COPY_TEMPLATE_MAX_LENGTH = 4_000;
const SALES_COPY_TEMPLATE_TOKENS = new Set(["date", "phone", "customer", "staff", "products"]);
const INVENTORY_REPORT_TEMPLATE_MAX_LENGTH = 8_000;
const INVENTORY_REPORT_TEMPLATE_TOKENS = new Set([
  "date",
  "ptsSold",
  "ptsSoldProducts",
  "ptsRemaining",
  "drainSold",
  "drainSoldProducts",
  "drainRemaining",
  "vxSold",
  "vxSoldProducts",
  "vxRemaining",
  "valveSold",
  "valveSoldProducts",
  "valveRemaining",
]);

export function cleanText(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

export function normalizeText(value) {
  return cleanText(value)
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/gu, "d")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

export function normalizeSku(value) {
  return cleanText(value).toUpperCase();
}

export function parseSheetNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = cleanText(value).replace(/[\s\u00A0]/gu, "");
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text.replace(/[^0-9.,+-]/gu, "");
  if (!/[0-9]/.test(text)) return null;
  const commaIndex = text.lastIndexOf(",");
  const dotIndex = text.lastIndexOf(".");

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimal = commaIndex > dotIndex ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    text = text.replace(thousands, "").replace(decimal, ".");
  } else if (commaIndex >= 0) {
    text = /^[-+]?\d{1,3}(,\d{3})+$/.test(text)
      ? text.replace(/,/g, "")
      : text.replace(",", ".");
  } else if (dotIndex >= 0 && /^[-+]?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }

  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

function isoDateFromParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function dateInTimeZone(date = new Date(), timeZone = VIETNAM_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  return Boolean(match && isoDateFromParts(match[1], match[2], match[3]) === value);
}

export function parseSheetDate(value, timeZone = VIETNAM_TIME_ZONE) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : dateInTimeZone(value, timeZone);
  }

  const text = cleanText(value);
  if (!text) return null;

  const googleDate = /^Date\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})/i.exec(text);
  if (googleDate) {
    return isoDateFromParts(googleDate[1], Number(googleDate[2]) + 1, googleDate[3]);
  }

  const vietnamese = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:\s|T|$)/.exec(text);
  if (vietnamese) return isoDateFromParts(vietnamese[3], vietnamese[2], vietnamese[1]);

  const exactIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (exactIso) return isoDateFromParts(exactIso[1], exactIso[2], exactIso[3]);

  const localIsoDateTime = /^(\d{4})-(\d{2})-(\d{2})[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.exec(text);
  if (localIsoDateTime) {
    return isoDateFromParts(localIsoDateTime[1], localIsoDateTime[2], localIsoDateTime[3]);
  }

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial >= 1 && serial <= 2_958_465) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
      return dateInTimeZone(date, "UTC");
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : dateInTimeZone(parsed, timeZone);
}

export function parseInventoryRows(rows) {
  const products = [];
  const seen = new Set();

  for (const row of rows) {
    const name = cleanText(row[0]);
    const sku = normalizeSku(row[1]);
    if (!name || !sku || seen.has(normalizeText(sku))) continue;

    const standardQty = parseSheetNumber(row[4]);
    products.push({
      name,
      sku,
      standardQty: standardQty !== null && standardQty >= 0 ? standardQty : null,
    });
    seen.add(normalizeText(sku));
  }

  return products;
}

export function createProductMatcher(products) {
  const aliases = new Map();
  for (const product of products) {
    const normalizedSku = normalizeText(product.sku);
    const normalizedName = normalizeText(product.name);
    if (normalizedSku && !aliases.has(normalizedSku)) aliases.set(normalizedSku, product.sku);
    if (normalizedName && !aliases.has(normalizedName)) aliases.set(normalizedName, product.sku);
  }

  return (value) => aliases.get(normalizeText(value)) ?? null;
}

function lines(value) {
  const result = String(value ?? "")
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);
  return result.length > 0 ? result : [""];
}

export function parseSalesRows(rows, products) {
  const matchProduct = createProductMatcher(products);
  const sales = [];

  for (const row of rows) {
    const dateTimes = lines(row[0]);
    const productNames = lines(row[1]);
    const quantities = lines(row[2]);
    const itemCount = Math.max(productNames.length, quantities.length);

    for (let index = 0; index < itemCount; index += 1) {
      const dateTime = dateTimes[index] || dateTimes[0] || "";
      const productName = productNames[index] || productNames[0] || "";
      if (!dateTime || !productName) continue;

      sales.push({
        sheetDate: parseSheetDate(dateTime),
        dateTime,
        productName,
        quantity: parseSheetNumber(quantities[index] ?? quantities[0]) ?? 0,
        customer: cleanText(row[3]),
        phone: cleanText(row[4]),
        staff: cleanText(row[5]),
        note: String(row[6] ?? "").trim(),
        matchedSku: matchProduct(productName),
      });
    }
  }

  return sales;
}

export function salesForDate(sales, date) {
  return sales
    .filter((sale) => sale.sheetDate === date)
    .map(({ sheetDate: _sheetDate, ...sale }) => sale);
}

export function decorateProducts(products, sales, config) {
  const soldSkus = new Set();
  const soldQuantity = new Map();
  const assignments = config?.assignments ?? {};
  const validAreas = new Set(config?.areas ?? []);

  for (const sale of sales) {
    if (!sale.matchedSku) continue;
    soldSkus.add(sale.matchedSku);
    soldQuantity.set(
      sale.matchedSku,
      (soldQuantity.get(sale.matchedSku) ?? 0) + (Number(sale.quantity) || 0),
    );
  }

  return products.map((product, sheetOrder) => {
    const assignment = assignments[product.sku];
    const area = assignment && validAreas.has(assignment.area) ? assignment.area : "";
    const order = Number.isSafeInteger(assignment?.order) ? assignment.order : sheetOrder;
    return {
      ...product,
      area,
      order,
      soldToday: soldSkus.has(product.sku),
      soldQty: soldQuantity.get(product.sku) ?? 0,
    };
  });
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateSalesCopyTemplate(value) {
  const rawTemplate = value === undefined ? DEFAULT_SALES_COPY_TEMPLATE : value;
  if (typeof rawTemplate !== "string") {
    throw badRequest("Mẫu sao chép bán hàng phải là chuỗi.");
  }

  const normalizedTemplate = rawTemplate.replace(/\r\n?/gu, "\n");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalizedTemplate)) {
    throw badRequest("Mẫu sao chép bán hàng chứa ký tự điều khiển không hợp lệ.");
  }

  const template = normalizedTemplate.trim();
  if (!template || template.length > SALES_COPY_TEMPLATE_MAX_LENGTH) {
    throw badRequest("Mẫu sao chép bán hàng phải có từ 1 đến 4000 ký tự.");
  }

  let productsTokenCount = 0;
  for (const match of template.matchAll(/\{\{([^{}]*)\}\}/gu)) {
    const token = match[1];
    if (!SALES_COPY_TEMPLATE_TOKENS.has(token)) {
      throw badRequest(`Biến mẫu không được hỗ trợ: ${match[0]}.`);
    }
    if (token === "products") productsTokenCount += 1;
  }
  const templateWithoutTokens = template.replace(/\{\{[^{}]*\}\}/gu, "");
  if (templateWithoutTokens.includes("{{") || templateWithoutTokens.includes("}}")) {
    throw badRequest("Cú pháp biến trong mẫu sao chép bán hàng không hợp lệ.");
  }
  if (productsTokenCount !== 1) {
    throw badRequest("Mẫu sao chép bán hàng phải chứa {{products}} đúng một lần.");
  }

  return template;
}

function validateInventoryReportTemplate(value) {
  const rawTemplate = value === undefined ? DEFAULT_INVENTORY_REPORT_TEMPLATE : value;
  if (typeof rawTemplate !== "string") {
    throw badRequest("Mẫu báo cáo kho cuối ca phải là chuỗi.");
  }

  const normalizedTemplate = rawTemplate.replace(/\r\n?/gu, "\n");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalizedTemplate)) {
    throw badRequest("Mẫu báo cáo kho cuối ca chứa ký tự điều khiển không hợp lệ.");
  }

  const template = normalizedTemplate.trim();
  if (!template || template.length > INVENTORY_REPORT_TEMPLATE_MAX_LENGTH) {
    throw badRequest("Mẫu báo cáo kho cuối ca phải có từ 1 đến 8000 ký tự.");
  }

  const tokenCounts = new Map(Array.from(INVENTORY_REPORT_TEMPLATE_TOKENS, (token) => [token, 0]));
  for (const match of template.matchAll(/\{\{([^{}]*)\}\}/gu)) {
    const token = match[1];
    if (!INVENTORY_REPORT_TEMPLATE_TOKENS.has(token)) {
      throw badRequest(`Biến mẫu báo cáo kho không được hỗ trợ: ${match[0]}.`);
    }
    tokenCounts.set(token, tokenCounts.get(token) + 1);
  }

  const templateWithoutTokens = template.replace(/\{\{[^{}]*\}\}/gu, "");
  if (templateWithoutTokens.includes("{{") || templateWithoutTokens.includes("}}")) {
    throw badRequest("Cú pháp biến trong mẫu báo cáo kho cuối ca không hợp lệ.");
  }

  for (const [token, count] of tokenCounts) {
    if (count !== 1) {
      throw badRequest(`Mẫu báo cáo kho cuối ca phải chứa {{${token}}} đúng một lần.`);
    }
  }

  return template;
}

export function validateConfig(value) {
  if (!plainObject(value) || !Array.isArray(value.areas) || !plainObject(value.assignments)) {
    throw badRequest("Cấu hình phải gồm areas và assignments.");
  }
  if (value.areas.length < 1 || value.areas.length > 50) {
    throw badRequest("Danh sách khu phải có từ 1 đến 50 mục.");
  }

  const areas = [];
  const areaSet = new Set();
  for (const rawArea of value.areas) {
    const area = cleanText(rawArea);
    if (!area || area.length > 50) throw badRequest("Tên khu không hợp lệ.");
    const key = normalizeText(area);
    if (areaSet.has(key)) throw badRequest(`Khu bị trùng: ${area}.`);
    areaSet.add(key);
    areas.push(area);
  }

  const canonicalAreas = new Map(areas.map((area) => [normalizeText(area), area]));
  const assignmentEntries = Object.entries(value.assignments);
  if (assignmentEntries.length > 10_000) throw badRequest("Có quá nhiều sản phẩm trong cấu hình.");

  const assignments = Object.create(null);
  for (const [rawSku, assignment] of assignmentEntries) {
    const sku = normalizeSku(rawSku);
    if (!sku || sku.length > 100 || !plainObject(assignment)) {
      throw badRequest(`Cấu hình SKU không hợp lệ: ${rawSku}.`);
    }
    const area = canonicalAreas.get(normalizeText(assignment.area));
    if (!area) throw badRequest(`Khu của SKU ${sku} không tồn tại.`);
    if (!Number.isSafeInteger(assignment.order) || assignment.order < 0 || assignment.order > 1_000_000) {
      throw badRequest(`Thứ tự của SKU ${sku} không hợp lệ.`);
    }
    assignments[sku] = { area, order: assignment.order };
  }

  const salesCopyTemplate = validateSalesCopyTemplate(value.salesCopyTemplate);
  const inventoryReportTemplate = validateInventoryReportTemplate(value.inventoryReportTemplate);
  return { areas, assignments, salesCopyTemplate, inventoryReportTemplate };
}

export function validateCountPatch(value) {
  if (!plainObject(value)) throw badRequest("Dữ liệu đếm không hợp lệ.");
  const sku = normalizeSku(value.sku);
  if (!sku || sku.length > 100) throw badRequest("SKU không hợp lệ.");

  const actual = value.actual;
  if (actual !== null && (!Number.isSafeInteger(actual) || actual < 0 || actual > 999_999)) {
    throw badRequest("Số lượng thực tế phải là số nguyên không âm từ 0 đến 999999 hoặc null.");
  }

  const result = { sku, actual: actual === 0 ? 0 : actual };
  if (Object.prototype.hasOwnProperty.call(value, "expectedActual")) {
    const expectedActual = value.expectedActual;
    if (
      expectedActual !== null &&
      (!Number.isSafeInteger(expectedActual) || expectedActual < 0 || expectedActual > 999_999)
    ) {
      throw badRequest("Số lượng kỳ vọng phải là số nguyên không âm từ 0 đến 999999 hoặc null.");
    }
    result.expectedActual = expectedActual === 0 ? 0 : expectedActual;
  }

  return result;
}

export { VIETNAM_TIME_ZONE };
