import test from "node:test";
import assert from "node:assert/strict";

import { parseCsv } from "../src/lib/csv.mjs";
import {
  DEFAULT_INVENTORY_REPORT_TEMPLATE,
  DEFAULT_SALES_COPY_TEMPLATE,
  decorateProducts,
  isIsoDate,
  normalizeText,
  parseInventoryRows,
  parseSalesRows,
  parseSheetDate,
  salesForDate,
  validateConfig,
  validateCountPatch,
} from "../src/lib/domain.mjs";

test("parseCsv xử lý dấu nháy, dấu phẩy và xuống dòng trong ô", () => {
  const rows = parseCsv('\uFEFF"A, B","SKU1","ghi ""chú""\n2"\r\n"C","SKU2",""\r\n');
  assert.deepEqual(rows, [
    ["A, B", "SKU1", 'ghi "chú"\n2'],
    ["C", "SKU2", ""],
  ]);
});

test("parser ngày hiểu định dạng Google/VN/ISO và kiểm tra ngày thật", () => {
  assert.equal(parseSheetDate("14/07/2026 21:30:05"), "2026-07-14");
  assert.equal(parseSheetDate("Date(2026, 6, 14, 10, 0, 0)"), "2026-07-14");
  assert.equal(parseSheetDate("2026-07-14"), "2026-07-14");
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("2024-02-29"), true);
});

test("inventory A/B/E, sales nhiều dòng và matching không dấu", () => {
  const products = parseInventoryRows([
    ["VX SS304 Inox T1", "pvn4279", "x", "x", "5"],
    ["PTS N15 Inox", "PTS672", "x", "x", "1.000"],
  ]);
  assert.deepEqual(products, [
    { name: "VX SS304 Inox T1", sku: "PVN4279", standardQty: 5 },
    { name: "PTS N15 Inox", sku: "PTS672", standardQty: 1000 },
  ]);
  assert.deepEqual(parseInventoryRows([
    ["Thiếu số lượng chuẩn", "SKU-NULL", "x", "x", ""],
    ["Số lượng chuẩn lỗi", "SKU-INVALID", "x", "x", "không rõ"],
    ["Số lượng chuẩn âm", "SKU-NEGATIVE", "x", "x", "-2"],
  ]), [
    { name: "Thiếu số lượng chuẩn", sku: "SKU-NULL", standardQty: null },
    { name: "Số lượng chuẩn lỗi", sku: "SKU-INVALID", standardQty: null },
    { name: "Số lượng chuẩn âm", sku: "SKU-NEGATIVE", standardQty: null },
  ]);
  assert.equal(normalizeText("Đà Nẵng"), "da nang");

  const allSales = parseSalesRows([
    [
      "14/07/2026 18:00:00",
      "VX SS304 Inox T1\npts672",
      "2\n3",
      "Khách A",
      "0900000000",
      "Nhân viên",
      "Ghi chú",
    ],
  ], products);
  const sales = salesForDate(allSales, "2026-07-14");
  assert.equal(sales.length, 2);
  assert.deepEqual(sales.map(({ matchedSku, quantity }) => [matchedSku, quantity]), [
    ["PVN4279", 2],
    ["PTS672", 3],
  ]);
  assert.deepEqual(
    sales.map(({ customer, phone, staff }) => ({ customer, phone, staff })),
    [
      { customer: "Khách A", phone: "0900000000", staff: "Nhân viên" },
      { customer: "Khách A", phone: "0900000000", staff: "Nhân viên" },
    ],
  );

  const decorated = decorateProducts(products, sales, {
    areas: ["A", "B"],
    assignments: { PVN4279: { area: "A", order: 0 } },
  });
  assert.deepEqual(
    decorated.map(({ sku, area, soldToday, soldQty }) => ({ sku, area, soldToday, soldQty })),
    [
      { sku: "PVN4279", area: "A", soldToday: true, soldQty: 2 },
      { sku: "PTS672", area: "", soldToday: true, soldQty: 3 },
    ],
  );
});

test("validation cấu hình và số đếm trả dữ liệu đã chuẩn hóa", () => {
  const config = validateConfig({
    areas: [" A ", "B"],
    assignments: { pvn4279: { area: "a", order: 2 } },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(config)), {
    areas: ["A", "B"],
    assignments: { PVN4279: { area: "A", order: 2 } },
    salesCopyTemplate: DEFAULT_SALES_COPY_TEMPLATE,
    inventoryReportTemplate: DEFAULT_INVENTORY_REPORT_TEMPLATE,
  });
  assert.deepEqual(validateCountPatch({ sku: " pvn4279 ", actual: 0 }), {
    sku: "PVN4279",
    actual: 0,
  });
  assert.deepEqual(validateCountPatch({ sku: "pvn4279", actual: 999_999, expectedActual: null }), {
    sku: "PVN4279",
    actual: 999_999,
    expectedActual: null,
  });
  assert.throws(() => validateCountPatch({ sku: "PVN4279", actual: -1 }), /không âm/);
  assert.throws(() => validateCountPatch({ sku: "PVN4279", actual: 1.5 }), /số nguyên/);
  assert.throws(() => validateCountPatch({ sku: "PVN4279", actual: 1_000_000 }), /999999/);
  assert.throws(
    () => validateCountPatch({ sku: "PVN4279", actual: 1, expectedActual: 1.5 }),
    /kỳ vọng.*số nguyên/i,
  );
});

test("validation mẫu sao chép giữ định dạng và chỉ nhận placeholder được hỗ trợ", () => {
  const baseConfig = { areas: ["A"], assignments: {} };
  const customTemplate = [
    "  {{date}} - {{phone}} - {{customer}} - {{staff}}\r\n",
    "\t{{products}}  ",
  ].join("");
  assert.equal(
    validateConfig({ ...baseConfig, salesCopyTemplate: customTemplate }).salesCopyTemplate,
    "{{date}} - {{phone}} - {{customer}} - {{staff}}\n\t{{products}}",
  );

  const maximumTemplate = `{{products}}${"x".repeat(4_000 - "{{products}}".length)}`;
  assert.equal(
    validateConfig({ ...baseConfig, salesCopyTemplate: maximumTemplate }).salesCopyTemplate.length,
    4_000,
  );

  assert.throws(
    () => validateConfig({ ...baseConfig, salesCopyTemplate: null }),
    /phải là chuỗi/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, salesCopyTemplate: "   \r\n\t" }),
    /1 đến 4000/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, salesCopyTemplate: `${maximumTemplate}x` }),
    /1 đến 4000/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, salesCopyTemplate: "{{products}}\u000b" }),
    /ký tự điều khiển/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, salesCopyTemplate: "{{products}}\n{{unknown}}" }),
    /không được hỗ trợ/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, salesCopyTemplate: "{{products}}\n{{customer" }),
    /cú pháp biến/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, salesCopyTemplate: "Không có danh sách sản phẩm" }),
    /\{\{products\}\} đúng một lần/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, salesCopyTemplate: "{{products}}\n{{products}}" }),
    /\{\{products\}\} đúng một lần/i,
  );
});

test("validation mẫu báo cáo kho chuẩn hóa nội dung và bắt buộc mỗi placeholder đúng một lần", () => {
  const baseConfig = { areas: ["A"], assignments: {} };
  const tokens = [
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
  ];
  const tokenText = tokens.map((token) => `{{${token}}}`).join("\n");
  const customTemplate = `  ${tokenText.replace(/\n/g, "\r\n")}  `;

  assert.equal(
    validateConfig({ ...baseConfig, inventoryReportTemplate: customTemplate }).inventoryReportTemplate,
    tokenText,
  );
  assert.equal(
    validateConfig({ ...baseConfig, inventoryReportTemplate: `${tokenText}\nGhi chú: {nội bộ}` })
      .inventoryReportTemplate,
    `${tokenText}\nGhi chú: {nội bộ}`,
  );
  assert.equal(
    validateConfig(baseConfig).inventoryReportTemplate,
    DEFAULT_INVENTORY_REPORT_TEMPLATE,
  );

  const maximumTemplate = `${tokenText}${"x".repeat(8_000 - tokenText.length)}`;
  assert.equal(
    validateConfig({ ...baseConfig, inventoryReportTemplate: maximumTemplate }).inventoryReportTemplate.length,
    8_000,
  );

  assert.throws(
    () => validateConfig({ ...baseConfig, inventoryReportTemplate: null }),
    /phải là chuỗi/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, inventoryReportTemplate: " \r\n\t " }),
    /1 đến 8000/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, inventoryReportTemplate: `${maximumTemplate}x` }),
    /1 đến 8000/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, inventoryReportTemplate: `${tokenText}\u000b` }),
    /ký tự điều khiển/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, inventoryReportTemplate: `${tokenText}\n{{unknown}}` }),
    /không được hỗ trợ/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, inventoryReportTemplate: `${tokenText}\n{{broken` }),
    /cú pháp biến/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, inventoryReportTemplate: tokenText.replace("{{date}}", "ngày") }),
    /\{\{date\}\} đúng một lần/i,
  );
  assert.throws(
    () => validateConfig({ ...baseConfig, inventoryReportTemplate: `${tokenText}\n{{date}}` }),
    /\{\{date\}\} đúng một lần/i,
  );
});
