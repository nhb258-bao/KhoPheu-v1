import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function sourceBlock(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `phải tìm thấy phần bắt đầu ${label}`);
  assert.ok(end > start, `phải tìm thấy phần kết thúc ${label}`);
  return source.slice(start, end);
}

test("Chi tiết bán hàng hiển thị SKU nhưng nội dung copy khách hàng vẫn không có SKU", async () => {
  const [app, css, html] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  ]);

  const groupBlock = sourceBlock(app, "function groupTodaySales()", "function renderSalesDetails()", "groupTodaySales");
  assert.ok(groupBlock.includes('sku: String(sale.matchedSku || "").trim()'));

  const renderBlock = sourceBlock(
    app,
    "function renderSalesDetails()",
    "function customerSalesCopyText(",
    "renderSalesDetails",
  );
  assert.ok(renderBlock.includes('<h4>Khách hàng ${escapeHtml(customerGroup.customer)}'));
  assert.doesNotMatch(renderBlock, /aria-hidden="true">−/);
  assert.ok(renderBlock.includes("product.sku ?"));
  assert.ok(renderBlock.includes("( SKU: ${escapeHtml(product.sku)} )"));
  assert.ok(renderBlock.includes('class="sales-product-sku"'));

  const copyBlock = sourceBlock(
    app,
    "function customerSalesCopyText(",
    "async function writeClipboardText",
    "customerSalesCopyText",
  );
  assert.match(copyBlock, /`\+ \$\{product\.name\} x \$\{formatQuantity\(product\.quantity\)\}`/);
  assert.doesNotMatch(copyBlock, /product\.sku|SKU:/);

  assert.match(
    css,
    /\.sales-customer-group h4\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?gap:\s*0;/,
  );
  assert.match(css, /\.sales-product-sku\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(html, /href="\/styles\.css\?v=75"/);
  assert.match(html, /src="\/app\.js\?v=75"/);
});
