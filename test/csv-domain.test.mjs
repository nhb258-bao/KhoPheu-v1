import test from "node:test";
import assert from "node:assert/strict";

import { parseCsv } from "../src/lib/csv.mjs";
import {
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
