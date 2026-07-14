import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStockBalance,
  extractWarehouseSheet,
  parseWarehouseWorkbook,
} from "../src/lib/workbook.mjs";

// Workbook XLSX tối thiểu gồm sheet Notes và sheet KHO ĐÀ NẴNG.
// Fixture được giữ dạng base64 để test không phụ thuộc Excel, Python hay thư viện ghi XLSX.
const VALID_XLSX_BASE64 =
  "UEsDBBQAAAAIAC4S71wgOnD8BAEAALUCAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLWSS07DMBCGr2J5i2KnXSCEknTBYwksygEGZ5JY8Uset6S3x0kLC1QqIcFqZM//+GS52kzWsD1G0t7VfCVKztAp32rX1/x1+1jccEYJXAvGO6z5AYlvmmp7CEgsex3VfEgp3EpJakALJHxAlzedjxZSPsZeBlAj9CjXZXktlXcJXSrSnMGb6h472JnEHqZ8feSIaIizu6Nw7qo5hGC0gpT3cu/aby3FqUFk56KhQQe6ygIuzzbMm58LTr7n/DBRt8heIKYnsFklJyPffRzfvB/F5ZAzlL7rtMLWq53NFkEhIrQ0ICZrxDKFBe0+uS/0L2KSy1j9MchX/i851v/NIZdv13wAUEsDBBQAAAAIAC4S71yY2uuLrwAAACcBAAALAAAAX3JlbHMvLnJlbHOFz00KwjAQBeCrhNnbtC5EpGk3InQr9QAxnf7QJBOSqO3tzdKK4HKYme/xynoxmj3Rh4msgCLLgaFV1E12EHBrL7sjsBCl7aQmiwJWDFBX5RW1jOkljJMLLBk2CBhjdCfOgxrRyJCRQ5s2PXkjYxr9wJ1UsxyQ7/P8wP2nAVuTNZ0A33QFsHZ1Kfe/TX0/KTyTehi08UfE10WSpR8wClg0f5Gf70RzllDgVck3Bas3UEsDBBQAAAAIAC4S71yfzLOO3wAAAF0BAAAPAAAAeGwvd29ya2Jvb2sueG1sjZC5bsMwDIZfRaABb41sDUnqK0vRNijgLu0DqDYdC7FEQ1Svt6+aA0i2TLw//mS1+bGT+ELPhlwN+SIDga6j3rhdDe9vj3drEBy06/VEDmv4RYZNU32T338Q7UUcd1zDGMJcSMndiFbzgmZ0sTKQtzrE0O8kzx51zyNisJNUWbaUVhsHR0Lhb2HQMJgOH6j7tOjCEeJx0iGK59HMDE112MAnK5y2UXRLIcoWh9S2j2eC8IWJjt/2Ocjr5pfnV5EmaqXKNMnvVSnaNFmtl1nZPl0g1AVC/SPkebE8/6b5A1BLAwQUAAAACAAuEu9cPtyXOLsAAAC1AQAAGgAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzvZBNC8IwDIb/SsndZdtBRKxeRNhV5g8oXfbBtrY09WP/3iIoDgbePIUk5Hkfsjs8xkHcyHNnjYQsSUGQ0bbqTCPhUp5WGxAclKnUYA1JmIjhsN+daVAhnnDbORaRYVhCG4LbIrJuaVScWEcmbmrrRxVi6xt0SveqIczTdI3+mwFzpigqCb6oMhDl5GLub7at607T0errSCYsRODd+p5bohChyjcUJHxGjK+SJZEKuCyT/1kmf8vg7N37J1BLAwQUAAAACAAuEu9cL+TbaK8AAADqAAAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbE2O3YoCMQxGX6Xkfs24F8uytJUF8QXUBygz0SlO06GJf29v9EK8SEhOOOHzq1uZ3IWa5MoBlosOHHFfh8zHAPvd5usXnGjiIU2VKcCdBFbRX2s7yUikznyWAKPq/Ico/UglyaLOxHY51FaS2tqOKHOjNLykMuF31/1gSZkh+hdbJ03Rt3p1zXIY7Z/D/xKcBsg8ZaatNuNZote457PQ4FGjxyfB3sps6x/v8J0zPgBQSwMEFAAAAAgALhLvXBH6MLb0AAAAxgEAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0Mi54bWx9kV1rwyAUhv+KWOhda5LC0q3G0rHtZttNP36AJGeNNB6DHtLt38/kInSw9ELQV57nvKjcftuGdeCDcVjwdJlwBli6yuC54Kfj22LNWSCNlW4cQsF/IPCtklfnL6EGIBZ5DAWvidonIUJZg9Vh6VrAePPlvNUUj/4sQutBVwNkG5ElyYOw2iBXcsheNGklvbsyH3vEtOw3u5QzKrjBxiAcyMfcBCVJ7aF1nqQgJUWfiDKuSI+KbFRkE4rP+SzL8g07vJ/+egbseQo7zmf5+jHdILvU7k6B1VhgNWGKgxf7193Hf9N7ulO5FN2tWtw8lRj/QP0CUEsBAhQAFAAAAAgALhLvXCA6cPwEAQAAtQIAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAUAAAACAAuEu9cmNrri68AAAAnAQAACwAAAAAAAAAAAAAAAAA1AQAAX3JlbHMvLnJlbHNQSwECFAAUAAAACAAuEu9cn8yzjt8AAABdAQAADwAAAAAAAAAAAAAAAAANAgAAeGwvd29ya2Jvb2sueG1sUEsBAhQAFAAAAAgALhLvXD7clzi7AAAAtQEAABoAAAAAAAAAAAAAAAAAGQMAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAhQAFAAAAAgALhLvXC/k22ivAAAA6gAAABgAAAAAAAAAAAAAAAAADAQAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbFBLAQIUABQAAAAIAC4S71wR+jC29AAAAMYBAAAYAAAAAAAAAAAAAAAAAPEEAAB4bC93b3Jrc2hlZXRzL3NoZWV0Mi54bWxQSwUGAAAAAAYABgCLAQAAGwYAAAAA";

test("extractWarehouseSheet tìm sheet/header, chuẩn hóa SKU và cô lập dòng lỗi hoặc trùng", () => {
  const workbook = extractWarehouseSheet([
    { sheet: "Giới thiệu", data: [["Không dùng"]] },
    {
      sheet: "  KHO ĐÀ NẴNG  ",
      data: [
        ["Báo cáo tồn kho"],
        ["STT", "Mã SKU", "Tên sản phẩm", "Tồn kho"],
        [1, " sku-a ", "Sản phẩm A", "5"],
        [2, "SKU-B", "Sản phẩm B", 3],
        [3, "sku-b", "Sản phẩm B bị lặp", 4],
        [4, "SKU-C", "Sản phẩm C", "không có số"],
        [5, "SKU-ONLY-FILE", "Chỉ có trong file", 0],
        [6, "", "Dòng trống SKU", 99],
        [7, "Mã SKU", "Dòng tiêu đề lặp", "Tồn kho"],
      ],
    },
  ]);

  assert.equal(workbook.sheetName, "  KHO ĐÀ NẴNG  ");
  assert.equal(workbook.headerRow, 2);
  assert.deepEqual(Array.from(workbook.stockBySku), [
    ["SKU-A", { quantity: 5, row: 3 }],
    ["SKU-ONLY-FILE", { quantity: 0, row: 7 }],
  ]);
  assert.deepEqual(Array.from(workbook.presentSkus), ["SKU-A", "SKU-B", "SKU-C", "SKU-ONLY-FILE"]);
  assert.deepEqual(workbook.duplicateSkus, [{ sku: "SKU-B", rows: [4, 5] }]);
  assert.deepEqual(workbook.invalidRows, [{ row: 6, sku: "SKU-C" }]);
});

test("extractWarehouseSheet báo lỗi rõ khi thiếu sheet, thiếu header hoặc không có SKU dữ liệu", () => {
  assert.throws(
    () => extractWarehouseSheet([{ sheet: "Kho Hà Nội", data: [["SKU", "Tồn kho"]] }]),
    (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.code, "INVALID_WORKBOOK");
      assert.deepEqual(error.details.availableSheets, ["Kho Hà Nội"]);
      return true;
    },
  );

  assert.throws(
    () => extractWarehouseSheet([{ sheet: "KHO DA NANG", data: [["Mã SKU", "Số lượng"]] }]),
    (error) => error.status === 422 && error.code === "INVALID_WORKBOOK",
  );

  assert.throws(
    () => extractWarehouseSheet([{ sheet: "KHO ĐÀ NẴNG", data: [["SKU", "Tồn kho"], ["", 10]] }]),
    (error) => error.status === 422 && error.code === "INVALID_WORKBOOK",
  );
});

test("extractWarehouseSheet chọn Tồn kho thuộc nhóm merged SHOWROOM ĐÀ NẴNG trên sheet tên tùy ý", () => {
  const workbook = extractWarehouseSheet([
    {
      sheet: "Báo cáo tổng hợp tháng 7",
      data: [
        [
          "Mã SKU",
          "Tên sản phẩm",
          "KHO TỔNG",
          null,
          "SHOWROOM ĐÀ NẴNG",
          null,
          "KHO HỒ CHÍ MINH",
          null,
        ],
        [null, null, "Tồn kho", "Đang giữ", "Tồn kho", "Đang giữ", "Tồn kho", "Đang giữ"],
        ["SKU-A", "Sản phẩm A", 100, 4, 7, 1, 50, 2],
        [" sku-b ", "Sản phẩm B", 200, 5, 0, 0, 80, 3],
      ],
    },
  ]);

  assert.equal(workbook.sheetName, "Báo cáo tổng hợp tháng 7");
  assert.equal(workbook.headerRow, 2);
  assert.equal(workbook.skuHeaderRow, 1);
  assert.equal(workbook.stockHeaderRow, 2);
  assert.equal(workbook.warehouseColumn, "SHOWROOM ĐÀ NẴNG > Tồn kho");
  assert.deepEqual(Array.from(workbook.stockBySku), [
    ["SKU-A", { quantity: 7, row: 3 }],
    ["SKU-B", { quantity: 0, row: 4 }],
  ]);
});

test("extractWarehouseSheet nhận Mã hàng và header Tồn kho nhiều tầng", () => {
  const workbook = extractWarehouseSheet([
    {
      sheet: "Worksheet",
      data: [
        ["Mã hàng", "Tên hàng", "SHOWROOM ĐÀ NẴNG - Chi nhánh", null, "KHO KHÁC"],
        [null, null, "Số lượng", null, "Số lượng"],
        [null, null, "Khả dụng", null, "Khả dụng"],
        [null, null, "Chi tiết", null, "Chi tiết"],
        [null, null, "Tồn kho", "Đang giao", "Tồn kho"],
        ["PTS-001", "Sản phẩm", 12, 2, 999],
      ],
    },
  ]);

  assert.equal(workbook.warehouseColumn, "SHOWROOM ĐÀ NẴNG > Tồn kho");
  assert.deepEqual(Array.from(workbook.stockBySku), [["PTS-001", { quantity: 12, row: 6 }]]);
});

test("extractWarehouseSheet không tính các ô trống giữ chỗ vào giới hạn dữ liệu", () => {
  const data = Array.from({ length: 1_100 }, (_, rowIndex) => {
    const row = Array(101).fill(null);
    if (rowIndex === 0) {
      row[0] = "Mã SKU";
      row[99] = "SHOWROOM ĐÀ NẴNG";
    } else if (rowIndex === 1) {
      row[99] = "Tồn kho";
    } else {
      row[0] = `SKU-${rowIndex}`;
      row[99] = rowIndex;
    }
    return row;
  });

  const workbook = extractWarehouseSheet([{ sheet: "Worksheet", data }]);

  assert.equal(workbook.presentSkus.size, 1_098);
  assert.deepEqual(workbook.stockBySku.get("SKU-1099"), { quantity: 1_099, row: 1_100 });
});

test("extractWarehouseSheet vẫn giới hạn số dòng cần xử lý", () => {
  const data = Array.from({ length: 50_001 }, (_, rowIndex) =>
    rowIndex === 0 ? ["SKU", "Tồn kho"] : [],
  );

  assert.throws(
    () => extractWarehouseSheet([{ sheet: "KHO ĐÀ NẴNG", data }]),
    (error) => error.status === 422 && error.code === "INVALID_WORKBOOK" && /50\.000/.test(error.message),
  );
});

test("extractWarehouseSheet không nhận Tồn kho ở nhóm kế bên SHOWROOM ĐÀ NẴNG", () => {
  assert.throws(
    () => extractWarehouseSheet([
      {
        sheet: "Xuất kho ERP",
        data: [
          ["SKU", "SHOWROOM ĐÀ NẴNG", null, "KHO HỒ CHÍ MINH", null],
          [null, "Khả dụng", "Đang giữ", "Tồn kho", "Đang giao"],
          ["SKU-A", 7, 1, 99, 0],
        ],
      },
    ]),
    (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.code, "INVALID_WORKBOOK");
      assert.deepEqual(error.details.availableSheets, ["Xuất kho ERP"]);
      return true;
    },
  );
});

test("extractWarehouseSheet từ chối khi hai vùng SHOWROOM ĐÀ NẴNG có điểm phù hợp ngang nhau", () => {
  const makeSheet = (sheet, sku, quantity) => ({
    sheet,
    data: [
      ["Mã SKU", "SHOWROOM ĐÀ NẴNG", null, "KHO KHÁC"],
      [null, "Tồn kho", "Đang giữ", "Tồn kho"],
      [sku, quantity, 0, 999],
    ],
  });

  assert.throws(
    () => extractWarehouseSheet([
      makeSheet("Bảng thứ nhất", "SKU-A", 2),
      makeSheet("Bảng thứ hai", "SKU-B", 3),
    ]),
    (error) => error.status === 422 && error.code === "INVALID_WORKBOOK",
  );
});

test("buildStockBalance phân loại cân bằng, dư, thiếu và các trường hợp không thể đối chiếu", () => {
  const workbook = {
    sheetName: "KHO ĐÀ NẴNG",
    headerRow: 3,
    stockBySku: new Map([
      ["SKU-BALANCED", { quantity: 5, row: 4 }],
      ["SKU-EXCESS", { quantity: 8, row: 5 }],
      ["SKU-SHORTAGE", { quantity: 1, row: 6 }],
      ["SKU-INVALID-SHEET", { quantity: 7, row: 7 }],
      ["SKU-ONLY-FILE", { quantity: 11, row: 12 }],
    ]),
    presentSkus: new Set([
      "SKU-BALANCED",
      "SKU-EXCESS",
      "SKU-SHORTAGE",
      "SKU-DUPLICATE",
      "SKU-INVALID-FILE",
      "SKU-INVALID-SHEET",
      "SKU-ONLY-FILE",
    ]),
    duplicateSkus: [{ sku: "SKU-DUPLICATE", rows: [8, 9] }],
    invalidRows: [{ row: 10, sku: "SKU-INVALID-FILE" }],
  };
  const products = [
    { sku: "sku-balanced", name: "F Cân bằng", standardQty: 5 },
    { sku: "SKU-EXCESS", name: "B Dư", standardQty: 5 },
    { sku: "SKU-SHORTAGE", name: "A Thiếu", standardQty: 4 },
    { sku: "SKU-DUPLICATE", name: "C Trùng SKU", standardQty: 3 },
    { sku: "SKU-INVALID-FILE", name: "D Sai tồn kho", standardQty: 2 },
    { sku: "SKU-INVALID-SHEET", name: "E Sai cột E", standardQty: null },
    { sku: "SKU-MISSING", name: "G Thiếu trong file", standardQty: 1 },
  ];

  const result = buildStockBalance(products, workbook);

  assert.deepEqual(result.summary, {
    total: 7,
    balanced: 1,
    excess: 1,
    shortage: 1,
    unmatched: 4,
  });
  assert.deepEqual(
    result.rows.map(({ sku, status, reason, fileQty, difference }) => ({ sku, status, reason, fileQty, difference })),
    [
      { sku: "SKU-EXCESS", status: "shortage", reason: null, fileQty: 8, difference: -3 },
      { sku: "SKU-SHORTAGE", status: "excess", reason: null, fileQty: 1, difference: 3 },
      { sku: "SKU-DUPLICATE", status: "unmatched", reason: "duplicate-file-sku", fileQty: null, difference: null },
      { sku: "SKU-INVALID-FILE", status: "unmatched", reason: "invalid-file-quantity", fileQty: null, difference: null },
      { sku: "SKU-INVALID-SHEET", status: "unmatched", reason: "invalid-sheet-quantity", fileQty: null, difference: null },
      { sku: "SKU-MISSING", status: "unmatched", reason: "missing-in-file", fileQty: null, difference: null },
      { sku: "SKU-BALANCED", status: "balanced", reason: null, fileQty: 5, difference: 0 },
    ],
  );
  assert.deepEqual(result.warnings, {
    missingInFile: ["SKU-MISSING"],
    unknownInFile: ["SKU-ONLY-FILE"],
    invalidRows: [{ row: 10, sku: "SKU-INVALID-FILE" }],
    duplicateSkus: [{ sku: "SKU-DUPLICATE", rows: [8, 9] }],
  });
  assert.deepEqual(
    result.rows.find((row) => row.sku === "SKU-BALANCED"),
    {
      sku: "SKU-BALANCED",
      name: "F Cân bằng",
      sheetQty: 5,
      fileQty: 5,
      srDnQty: 5,
      crmQty: 5,
      difference: 0,
      status: "balanced",
      reason: null,
    },
  );
});

test("parseWarehouseWorkbook từ chối dữ liệu không mang chữ ký ZIP/XLSX và file ZIP hỏng", async () => {
  await assert.rejects(
    parseWarehouseWorkbook(Buffer.from("not-an-xlsx")),
    (error) => error.status === 422 && error.code === "INVALID_WORKBOOK",
  );
  await assert.rejects(
    parseWarehouseWorkbook(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])),
    (error) => error.status === 422 && error.code === "INVALID_WORKBOOK",
  );
});

test("parseWarehouseWorkbook đọc được workbook XLSX thật và chọn đúng sheet KHO ĐÀ NẴNG", async () => {
  const workbook = await parseWarehouseWorkbook(Buffer.from(VALID_XLSX_BASE64, "base64"));

  assert.equal(workbook.sheetName, "KHO ĐÀ NẴNG");
  assert.equal(workbook.headerRow, 2);
  assert.deepEqual(Array.from(workbook.stockBySku), [["SKU-REAL", { quantity: 7, row: 3 }]]);
  assert.deepEqual(Array.from(workbook.presentSkus), ["SKU-REAL"]);
  assert.deepEqual(workbook.duplicateSkus, []);
  assert.deepEqual(workbook.invalidRows, []);
});
