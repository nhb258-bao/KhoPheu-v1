import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("popup cân bằng kho có đúng 5 cột SR ĐN - CRM và giao diện gọn", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  const dialogStart = html.indexOf('id="lookup-balance-dialog"');
  const dialog = html.slice(dialogStart, html.indexOf("</dialog>", dialogStart));
  const headers = Array.from(dialog.matchAll(/<th scope="col">([^<]+)<\/th>/g), (match) => match[1]);
  assert.deepEqual(headers, ["Tên sản phẩm", "Mã SKU", "SR ĐN", "CRM", "Chênh lệch"]);
  assert.match(html, /<p id="lookup-file-help">Chỉ hỗ trợ file \.xlsx tối đa 8 MB<\/p>/);
  assert.match(html, /<small>Showroom Đà Nẵng<\/small>/);
  assert.doesNotMatch(html, /Cân bằng tồn kho|Đối chiếu SKU và số lượng giữa file Excel/);
  assert.match(dialog, /<h2 id="lookup-balance-title">BẢNG CÂN BẰNG KHO<\/h2>/);
  assert.match(dialog, /<dt>Tổng mã SKU<\/dt>/);
  assert.doesNotMatch(dialog, /lookup-balance-file-name|lookup-balance-warning/);
  assert.doesNotMatch(app, /lookupBalanceFileName|lookupBalanceWarning|SKU chỉ có trong Excel/);
  assert.match(css, /\.lookup-balance-table th\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\);/);
  assert.match(dialog, /id="lookup-balance-close"[\s\S]*?aria-label="Đóng bảng cân bằng kho"/);
  assert.match(dialog, /href="#i-x"/);
  assert.match(css, /\.lookup-balance-modal\s*\{[\s\S]*?1080px/);
  assert.match(css, /@media \(min-width: 761px\)\s*\{\s*\.modal\.lookup-balance-modal\s*\{[\s\S]*?1080px/);
  assert.match(css, /\.lookup-balance-close-x\s*\{[\s\S]*?color:\s*#fff;[\s\S]*?background:\s*var\(--danger\);/);
  assert.match(css, /\.lookup-balance-table th:nth-child\(n \+ 3\):nth-child\(-n \+ 5\),[\s\S]*?text-align:\s*center;/);
  assert.match(css, /\.lookup-balance-body\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?touch-action:\s*pan-x pan-y;/);
  assert.match(css, /\.lookup-balance-modal\s*\{[\s\S]*?height:\s*calc\(100dvh - 18px\);[\s\S]*?max-height:\s*none;/);
  assert.match(css, /\.lookup-balance-table-scroll\s*\{[\s\S]*?overflow-x:\s*auto;[\s\S]*?overflow-y:\s*hidden;[\s\S]*?overscroll-behavior-y:\s*auto;/);
  assert.match(css, /--header-height:\s*106px;/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?--header-height:\s*100px;/);
  assert.match(css, /\.sync-indicator #sync-label\s*\{\s*display:\s*inline;/);
  assert.match(css, /grid-template-areas:\s*"heading progress stats"\s*"heading action stats"\s*"sales sales sales";/);
  assert.match(css, /\.lookup-balance-table\s*\{[\s\S]*?width:\s*max-content;/);
  assert.match(css, /\.lookup-balance-table\s*\{[\s\S]*?min-width:\s*100%;/);
  assert.doesNotMatch(css, /\.lookup-balance-table\s*\{[^}]*min-width:\s*(?:680|720)px;/);
  assert.match(css, /\.lookup-balance-table th:first-child,[\s\S]*?width:\s*1%;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /\.lookup-balance-table th:first-child,[\s\S]*?width:\s*clamp\(150px, 43vw, 190px\);[\s\S]*?white-space:\s*normal;/);
  assert.match(css, /tr\.is-imbalanced/);

  const renderStart = app.indexOf("function renderLookupBalance(payload)");
  const renderEnd = app.indexOf("function openLookupBalanceDialog()", renderStart);
  const renderBlock = app.slice(renderStart, renderEnd);
  assert.equal((renderBlock.match(/<td\b/g) || []).length, 5);
  assert.match(renderBlock, /row\?\.srDnQty \?\? row\?\.sheetQty/);
  assert.match(renderBlock, /row\?\.crmQty \?\? row\?\.fileQty/);
  assert.match(renderBlock, /difference !== null && difference !== 0/);
  assert.match(renderBlock, /<tr\$\{rowClass\}>/);
});
