import readExcelFile from "read-excel-file/node";

import { normalizeSku, normalizeText, parseSheetNumber } from "./domain.mjs";
import { AppError } from "./errors.mjs";

export const STOCK_UPLOAD_LIMIT = 8 * 1024 * 1024;
const LEGACY_TARGET_SHEETS = new Set(["kho da nang", "showroom da nang"]);
const TARGET_COLUMN_GROUP = "showroom da nang";
const HEADER_SCAN_LIMIT = 50;
const GROUP_SUBHEADER_DEPTH = 10;
const HEADER_CONTEXT_DEPTH = 10;
const MAX_ROWS = 50_000;
const SKU_HEADERS = new Set([
  "sku",
  "ma sku",
  "ma hang",
  "ma hang hoa",
  "ma san pham",
  "ma sp",
  "ma vat tu",
]);

function workbookError(message, details) {
  return new AppError(422, "INVALID_WORKBOOK", message, details);
}

function isTargetColumnGroup(value) {
  const normalized = normalizeText(value);
  return normalized === TARGET_COLUMN_GROUP || normalized.startsWith(`${TARGET_COLUMN_GROUP} `);
}

function findFlatHeader(data) {
  const scanLength = Math.min(data.length, HEADER_SCAN_LIMIT);
  for (let rowIndex = 0; rowIndex < scanLength; rowIndex += 1) {
    const row = Array.isArray(data[rowIndex]) ? data[rowIndex] : [];
    const normalized = row.map(normalizeText);
    const skuColumn = normalized.findIndex((value) => SKU_HEADERS.has(value));
    const stockColumn = normalized.findIndex((value) => value === "ton kho");
    if (skuColumn >= 0 && stockColumn >= 0 && skuColumn !== stockColumn) {
      return {
        rowIndex,
        skuHeaderRow: rowIndex,
        stockHeaderRow: rowIndex,
        skuColumn,
        stockColumn,
        mode: "sheet",
      };
    }
  }
  return null;
}

function validateSheetSize(target) {
  const data = Array.isArray(target?.data) ? target.data : [];
  const sheetLabel = String(target?.sheet || "dữ liệu");
  if (data.length > MAX_ROWS) {
    throw workbookError(`Sheet ${sheetLabel} vượt quá ${MAX_ROWS.toLocaleString("vi-VN")} dòng.`);
  }
}

function maxColumnCount(data) {
  return data.reduce((maximum, row) => Math.max(maximum, Array.isArray(row) ? row.length : 0), 0);
}

// read-excel-file chỉ giữ giá trị ở ô trên-trái của vùng merge. Vì vậy biên phải
// của nhóm SHOWROOM được suy ra từ ô không rỗng tiếp theo trên cùng hàng tiêu đề.
function groupEndColumn(data, rowIndex, groupColumn) {
  const row = Array.isArray(data[rowIndex]) ? data[rowIndex] : [];
  const maximum = maxColumnCount(data);
  const groupLabel = normalizeText(row[groupColumn]);
  for (let column = groupColumn + 1; column < maximum; column += 1) {
    const value = normalizeText(row[column]);
    if (value && value !== groupLabel) return column - 1;
  }
  return Math.max(groupColumn, maximum - 1);
}

function groupedHeaderCandidates(sheet, sheetIndex) {
  const data = Array.isArray(sheet?.data) ? sheet.data : [];
  const scanLength = Math.min(data.length, HEADER_SCAN_LIMIT);
  const candidates = [];
  let sizeValidated = false;

  for (let groupRow = 0; groupRow < scanLength; groupRow += 1) {
    const row = Array.isArray(data[groupRow]) ? data[groupRow] : [];
    for (let groupColumn = 0; groupColumn < row.length; groupColumn += 1) {
      if (!isTargetColumnGroup(row[groupColumn])) continue;
      if (!sizeValidated) {
        validateSheetSize(sheet);
        sizeValidated = true;
      }

      const groupEnd = groupEndColumn(data, groupRow, groupColumn);
      const lastSubheaderRow = Math.min(scanLength - 1, groupRow + GROUP_SUBHEADER_DEPTH);
      for (let stockHeaderRow = groupRow + 1; stockHeaderRow <= lastSubheaderRow; stockHeaderRow += 1) {
        const stockRow = Array.isArray(data[stockHeaderRow]) ? data[stockHeaderRow] : [];
        for (let stockColumn = groupColumn; stockColumn <= groupEnd; stockColumn += 1) {
          if (normalizeText(stockRow[stockColumn]) !== "ton kho") continue;

          const firstSkuRow = Math.max(0, groupRow - HEADER_CONTEXT_DEPTH);
          for (let skuHeaderRow = firstSkuRow; skuHeaderRow <= stockHeaderRow; skuHeaderRow += 1) {
            const skuRow = Array.isArray(data[skuHeaderRow]) ? data[skuHeaderRow] : [];
            for (let skuColumn = 0; skuColumn < skuRow.length; skuColumn += 1) {
              if (!SKU_HEADERS.has(normalizeText(skuRow[skuColumn])) || skuColumn === stockColumn) continue;
              candidates.push({
                sheet,
                sheetIndex,
                rowIndex: Math.max(skuHeaderRow, stockHeaderRow),
                skuHeaderRow,
                stockHeaderRow,
                skuColumn,
                stockColumn,
                groupRow,
                groupColumn,
                mode: "showroom-column",
              });
            }
          }
        }
      }
    }
  }

  const unique = new Map();
  candidates.forEach((candidate) => {
    const key = [
      candidate.sheetIndex,
      candidate.rowIndex,
      candidate.skuColumn,
      candidate.stockColumn,
      candidate.groupRow,
      candidate.groupColumn,
    ].join(":");
    if (!unique.has(key)) unique.set(key, candidate);
  });
  return Array.from(unique.values());
}

function scoreCandidate(candidate) {
  const data = Array.isArray(candidate.sheet?.data) ? candidate.sheet.data : [];
  let skuRows = 0;
  let numericRows = 0;
  for (let rowIndex = candidate.rowIndex + 1; rowIndex < data.length; rowIndex += 1) {
    const row = Array.isArray(data[rowIndex]) ? data[rowIndex] : [];
    const rawSku = row[candidate.skuColumn];
    const sku = normalizeSku(rawSku);
    if (!sku || SKU_HEADERS.has(normalizeText(rawSku))) continue;
    skuRows += 1;
    if (parseSheetNumber(row[candidate.stockColumn]) !== null) numericRows += 1;
  }
  return { numericRows, skuRows };
}

function inspectHeaderLabels(sheets) {
  const result = { groupFound: false, stockFound: false, skuFound: false };
  for (const sheet of sheets) {
    const data = Array.isArray(sheet?.data) ? sheet.data : [];
    const scanLength = Math.min(data.length, HEADER_SCAN_LIMIT);
    for (let rowIndex = 0; rowIndex < scanLength; rowIndex += 1) {
      const row = Array.isArray(data[rowIndex]) ? data[rowIndex] : [];
      for (const cell of row) {
        const normalized = normalizeText(cell);
        if (isTargetColumnGroup(cell)) result.groupFound = true;
        if (normalized === "ton kho") result.stockFound = true;
        if (SKU_HEADERS.has(normalized)) result.skuFound = true;
      }
    }
  }
  return result;
}

function extractCandidate(target, header) {
  validateSheetSize(target);
  const data = Array.isArray(target.data) ? target.data : [];
  const stockBySku = new Map();
  const presentSkus = new Set();
  const rowNumbersBySku = new Map();
  const invalidRows = [];

  for (let rowIndex = header.rowIndex + 1; rowIndex < data.length; rowIndex += 1) {
    const row = Array.isArray(data[rowIndex]) ? data[rowIndex] : [];
    const rawSku = row[header.skuColumn];
    const sku = normalizeSku(rawSku);
    if (!sku || SKU_HEADERS.has(normalizeText(rawSku))) continue;

    const rowNumber = rowIndex + 1;
    presentSkus.add(sku);
    const skuRows = rowNumbersBySku.get(sku) || [];
    skuRows.push(rowNumber);
    rowNumbersBySku.set(sku, skuRows);

    const quantity = parseSheetNumber(row[header.stockColumn]);
    if (quantity === null) {
      invalidRows.push({ row: rowNumber, sku });
      continue;
    }
    if (!stockBySku.has(sku)) stockBySku.set(sku, { quantity, row: rowNumber });
  }

  const duplicateSkus = Array.from(rowNumbersBySku, ([sku, rows]) => ({ sku, rows }))
    .filter((item) => item.rows.length > 1);
  duplicateSkus.forEach(({ sku }) => stockBySku.delete(sku));

  if (presentSkus.size === 0) return null;

  return {
    sheetName: String(target.sheet),
    headerRow: header.rowIndex + 1,
    skuHeaderRow: header.skuHeaderRow + 1,
    stockHeaderRow: header.stockHeaderRow + 1,
    warehouseColumn: header.mode === "showroom-column" ? "SHOWROOM ĐÀ NẴNG > Tồn kho" : "Tồn kho",
    stockBySku,
    presentSkus,
    duplicateSkus,
    invalidRows,
  };
}

export function extractWarehouseSheet(sheets) {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw workbookError("File Excel không có sheet dữ liệu.");
  }

  // Giữ tương thích với định dạng cũ có sheet kho riêng và header phẳng.
  const flatTargets = sheets.filter((sheet) => LEGACY_TARGET_SHEETS.has(normalizeText(sheet?.sheet)));
  for (const target of flatTargets) {
    const data = Array.isArray(target.data) ? target.data : [];
    const header = findFlatHeader(data);
    if (!header) continue;
    const result = extractCandidate(target, header);
    if (result) return result;
  }

  // Định dạng xuất kho thực tế: tên sheet tùy ý, SHOWROOM ĐÀ NẴNG là nhóm
  // cột merge và Tồn kho là cột con ở hàng ngay dưới.
  const candidates = sheets.flatMap((sheet, sheetIndex) => groupedHeaderCandidates(sheet, sheetIndex));
  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate) }))
    .filter(({ score }) => score.skuRows > 0)
    .sort(
      (a, b) =>
        b.score.numericRows - a.score.numericRows ||
        b.score.skuRows - a.score.skuRows ||
        a.candidate.sheetIndex - b.candidate.sheetIndex ||
        a.candidate.rowIndex - b.candidate.rowIndex,
    );

  if (scored.length > 1) {
    const first = scored[0];
    const second = scored[1];
    if (first.score.numericRows === second.score.numericRows && first.score.skuRows === second.score.skuRows) {
      throw workbookError(
        "Tìm thấy nhiều vùng SHOWROOM ĐÀ NẴNG có dữ liệu giống nhau. Vui lòng chỉ giữ một bảng cần đối chiếu trong file Excel.",
      );
    }
  }

  if (scored.length) {
    const selected = scored[0].candidate;
    const result = extractCandidate(selected.sheet, selected);
    if (result) return result;
  }

  const diagnostics = inspectHeaderLabels(sheets);
  let message =
    "Đã tìm thấy các tiêu đề liên quan nhưng không xác định được Tồn kho thuộc nhóm SHOWROOM ĐÀ NẴNG hoặc không có dữ liệu mã sản phẩm bên dưới.";
  if (!diagnostics.groupFound) {
    message = "Không nhận diện được tiêu đề nhóm SHOWROOM ĐÀ NẴNG trong 50 hàng đầu của file Excel.";
  } else if (!diagnostics.stockFound) {
    message = "Đã tìm thấy SHOWROOM ĐÀ NẴNG nhưng không nhận diện được cột con Tồn kho.";
  } else if (!diagnostics.skuFound) {
    message = "Đã tìm thấy SHOWROOM ĐÀ NẴNG và Tồn kho nhưng không nhận diện được cột mã sản phẩm (SKU/Mã SKU/Mã hàng).";
  }
  throw workbookError(message, {
    availableSheets: sheets.map((sheet) => String(sheet?.sheet || "")).filter(Boolean),
    diagnostics,
  });
}

export async function parseWarehouseWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw workbookError("File tải lên không phải định dạng Excel .xlsx hợp lệ.");
  }

  let sheets;
  try {
    sheets = await readExcelFile(buffer);
  } catch {
    throw workbookError("Không thể đọc file Excel. Hãy kiểm tra lại file .xlsx.");
  }
  return extractWarehouseSheet(sheets);
}

export function buildStockBalance(products, workbook) {
  const inventoryProducts = Array.isArray(products) ? products : [];
  const inventorySkus = new Set(inventoryProducts.map((product) => normalizeSku(product?.sku)).filter(Boolean));
  const duplicateSkuSet = new Set(workbook.duplicateSkus.map((item) => item.sku));
  const invalidSkuSet = new Set(workbook.invalidRows.map((item) => item.sku));

  const rows = inventoryProducts.map((product) => {
    const sku = normalizeSku(product?.sku);
    const sheetQty = Number.isFinite(product?.standardQty) ? product.standardQty : null;
    const fileEntry = workbook.stockBySku.get(sku);
    let status = "unmatched";
    let reason = "missing-in-file";
    let fileQty = null;
    let difference = null;

    if (sheetQty === null) {
      reason = "invalid-sheet-quantity";
    } else if (duplicateSkuSet.has(sku)) {
      reason = "duplicate-file-sku";
    } else if (invalidSkuSet.has(sku)) {
      reason = "invalid-file-quantity";
    } else if (fileEntry) {
      fileQty = fileEntry.quantity;
      difference = Number((sheetQty - fileQty).toFixed(6));
      status = difference === 0 ? "balanced" : difference > 0 ? "excess" : "shortage";
      reason = null;
    }

    return {
      sku,
      name: String(product?.name || ""),
      sheetQty,
      fileQty,
      srDnQty: sheetQty,
      crmQty: fileQty,
      difference,
      status,
      reason,
    };
  });

  const statusOrder = { shortage: 0, excess: 1, unmatched: 2, balanced: 3 };
  rows.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      a.name.localeCompare(b.name, "vi") ||
      a.sku.localeCompare(b.sku),
  );

  const summary = rows.reduce(
    (result, row) => {
      result.total += 1;
      result[row.status] += 1;
      return result;
    },
    { total: 0, balanced: 0, excess: 0, shortage: 0, unmatched: 0 },
  );

  return {
    sheetName: workbook.sheetName,
    headerRow: workbook.headerRow,
    skuHeaderRow: workbook.skuHeaderRow,
    stockHeaderRow: workbook.stockHeaderRow,
    warehouseColumn: workbook.warehouseColumn,
    summary,
    rows,
    warnings: {
      missingInFile: rows.filter((row) => row.reason === "missing-in-file").map((row) => row.sku),
      unknownInFile: Array.from(workbook.presentSkus).filter((sku) => !inventorySkus.has(sku)),
      invalidRows: workbook.invalidRows,
      duplicateSkus: workbook.duplicateSkus,
    },
  };
}
