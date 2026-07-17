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

test("Quản trị cấu hình mẫu copy xuyên suốt UI, draft, lưu và nội dung clipboard", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);

  const textareaTag = html.match(/<textarea\b[^>]*id="sales-copy-template"[^>]*>/)?.[0] || "";
  assert.ok(textareaTag, "phải có textarea chỉnh mẫu copy");
  assert.match(textareaTag, /maxlength="4000"/);
  assert.match(textareaTag, /aria-describedby="sales-copy-template-help sales-copy-template-error"/);
  assert.match(html, /id="sales-copy-template-error"[^>]*role="alert"[^>]*hidden/);
  assert.match(html, /<pre id="sales-copy-template-preview"><\/pre>/);
  assert.match(html, /id="reset-sales-copy-template"/);
  assert.match(
    html,
    /id="sales-copy-template-title"[^>]*>MẪU FORM BÁO CÁO KHÁCH MUA HÀNG<\/p>/,
  );
  assert.doesNotMatch(html, /Nội dung copy ở Chi tiết bán hàng/);
  assert.doesNotMatch(
    html,
    /Tùy chỉnh form được sao chép khi bấm nút copy của từng khách hàng\./,
  );
  const inventoryCardIndex = html.indexOf('id="inventory-report-template-card"');
  const adminBoardIndex = html.indexOf('id="admin-board"');
  const salesCardIndex = html.indexOf('id="sales-copy-template-card"');
  assert.ok(
    adminBoardIndex >= 0 && adminBoardIndex < salesCardIndex && salesCardIndex < inventoryCardIndex,
    "mẫu kho phải nằm cuối, ngay dưới mẫu khách mua hàng",
  );
  for (const token of ["date", "phone", "customer", "staff", "products"]) {
    assert.ok(html.includes(`<code>{{${token}}}</code>`), `phần trợ giúp phải mô tả {{${token}}}`);
  }
  assert.match(
    html,
    /Khi <code>\{\{products\}\}<\/code> nằm riêng một dòng, khoảng trắng đặt trước biến sẽ được áp dụng trước dấu <code>\+<\/code> của mọi sản phẩm\./,
  );

  for (const selector of [
    ".admin-template-card",
    ".admin-template-field textarea",
    ".admin-template-help",
    ".admin-template-error",
    ".admin-template-preview",
  ]) {
    assert.ok(css.includes(`${selector} {`), `phải có style cho ${selector}`);
  }
  const mobileCss = sourceBlock(css, "@media (max-width: 760px)", "@media (max-width: 470px)", "CSS mobile");
  assert.match(mobileCss, /\.admin-template-card\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(mobileCss, /\.admin-template-preview\s*\{\s*grid-row:\s*auto;/);

  for (const mapping of [
    'salesCopyTemplateCard: $("#sales-copy-template-card")',
    'salesCopyTemplate: $("#sales-copy-template")',
    'salesCopyTemplateError: $("#sales-copy-template-error")',
    'salesCopyTemplatePreview: $("#sales-copy-template-preview")',
    'resetSalesCopyTemplate: $("#reset-sales-copy-template")',
  ]) {
    assert.ok(app.includes(mapping), `elements phải ánh xạ ${mapping}`);
  }

  const stateBlock = sourceBlock(app, "const state = {", "let adminAssignedRevealTimer", "state");
  assert.match(stateBlock, /salesCopyTemplate:\s*DEFAULT_SALES_COPY_TEMPLATE/);

  const normalizeBootstrapBlock = sourceBlock(
    app,
    "function normalizeBootstrap(payload)",
    "async function loadBootstrap",
    "normalizeBootstrap",
  );
  assert.match(
    normalizeBootstrapBlock,
    /salesCopyTemplate:\s*normalizeSalesCopyTemplate\(payload\?\.salesCopyTemplate\)/,
  );

  const loadBootstrapBlock = sourceBlock(
    app,
    "async function loadBootstrap(",
    "function hasPendingCountSaves",
    "loadBootstrap",
  );
  assert.match(loadBootstrapBlock, /state\.salesCopyTemplate\s*=\s*normalized\.salesCopyTemplate/);

  const ensureDraftBlock = sourceBlock(
    app,
    "function ensureAdminDraft()",
    "function syncAdminDraftWithProducts",
    "ensureAdminDraft",
  );
  assert.match(ensureDraftBlock, /if \(!state\.ready\) return/);
  assert.match(
    ensureDraftBlock,
    /salesCopyTemplate:\s*state\.salesCopyTemplate\s*\|\|\s*DEFAULT_SALES_COPY_TEMPLATE/,
  );

  const cloneDraftBlock = sourceBlock(
    app,
    "function cloneAdminDraft(",
    "function captureAdminState",
    "cloneAdminDraft",
  );
  assert.match(cloneDraftBlock, /salesCopyTemplate:\s*draft\.salesCopyTemplate/);

  const saveBlock = sourceBlock(app, "async function saveConfig()", "function bindEvents()", "saveConfig");
  assert.match(saveBlock, /if \(!state\.ready \|\| !state\.adminDraft/);
  assert.match(saveBlock, /validateSalesCopyTemplate\(state\.adminDraft\.salesCopyTemplate\)/);
  assert.match(saveBlock, /salesCopyTemplate:\s*state\.adminDraft\.salesCopyTemplate/);
  assert.match(
    saveBlock,
    /state\.salesCopyTemplate\s*=\s*normalizeSalesCopyTemplate\(payload\?\.salesCopyTemplate\s*\?\?\s*body\.salesCopyTemplate\)/,
  );
  assert.match(
    saveBlock,
    /state\.configSaving\s*=\s*false;[\s\S]*?renderSalesCopyTemplateEditor\(\)/,
    "sau khi lưu phải render lại editor để trạng thái nút khôi phục không bị kẹt",
  );

  const copyBlock = sourceBlock(
    app,
    "function customerSalesCopyText(",
    "async function writeClipboardText",
    "customerSalesCopyText",
  );
  assert.match(copyBlock, /template\s*=\s*state\.salesCopyTemplate/);
  assert.match(copyBlock, /fillSalesCopyTemplate\(normalizeSalesCopyTemplate\(template\)/);
  assert.match(copyBlock, /`\+ \$\{product\.name\} x \$\{formatQuantity\(product\.quantity\)\}`/);
  assert.doesNotMatch(copyBlock, /`\s+\+ \$\{product\.name\}/);
  assert.match(copyBlock, /\n\s*products,\s*\n/);
  const handleCopyBlock = sourceBlock(
    app,
    "async function handleSalesCopy(event)",
    "function renderSummary",
    "handleSalesCopy",
  );
  assert.match(
    handleCopyBlock,
    /writeClipboardText\(customerSalesCopyText\(customerGroup,\s*staffGroup\.staff\)\)/,
  );

  const formatterBlock = sourceBlock(
    app,
    "function fillSalesCopyTemplate(",
    "function validateInventoryReportTemplate(",
    "fillSalesCopyTemplate",
  );
  assert.equal(
    formatterBlock.match(/\.replace\(/g)?.length || 0,
    1,
    "formatter chỉ được replace một lượt để giá trị chèn vào không bị diễn giải lại như template",
  );
  assert.ok(formatterBlock.includes("/(^|\\n)([ \\t]*){{products}}|{{(date|phone|customer|staff|products)}}/g"));
  assert.match(formatterBlock, /productText[\s\S]*?\.split\("\\n"\)[\s\S]*?`\$\{indent\}\$\{line\}`/);

  const fillTemplate = Function(`"use strict"; ${formatterBlock}; return fillSalesCopyTemplate;`)();
  const productValues = {
    date: "17/07/2026",
    phone: "0797509509",
    products: "+ Sản phẩm A x 1\n+ Sản phẩm B x 2",
  };
  assert.equal(
    fillTemplate("{{date}} - {{phone}} - Dạ em bán:\n    {{products}}\nĐã xuất.", productValues),
    "17/07/2026 - 0797509509 - Dạ em bán:\n    + Sản phẩm A x 1\n    + Sản phẩm B x 2\nĐã xuất.",
  );
  assert.equal(
    fillTemplate("{{products}}", productValues),
    "+ Sản phẩm A x 1\n+ Sản phẩm B x 2",
    "không đặt khoảng trắng thì dấu + phải sát lề trái",
  );
  assert.equal(
    fillTemplate("  {{products}}", productValues),
    "  + Sản phẩm A x 1\n  + Sản phẩm B x 2",
    "hai khoảng trắng phải được áp dụng cho mọi dòng sản phẩm",
  );

  const editorBlock = sourceBlock(
    app,
    "function renderSalesCopyTemplateEditor(",
    "function beginSalesCopyTemplateEdit",
    "renderSalesCopyTemplateEditor",
  );
  assert.match(editorBlock, /salesCopyTemplateError\.textContent\s*=\s*validation\.error/);
  assert.match(editorBlock, /salesCopyTemplatePreview\.textContent\s*=\s*customerSalesCopyText\(/);
  assert.doesNotMatch(editorBlock, /salesCopyTemplate(?:Error|Preview)\.innerHTML/);

  const beginEditBlock = sourceBlock(
    app,
    "function beginSalesCopyTemplateEdit()",
    "function updateSalesCopyTemplateDraft",
    "beginSalesCopyTemplateEdit",
  );
  assert.match(beginEditBlock, /previous:\s*captureAdminState\(\),\s*committed:\s*false/);

  const updateDraftBlock = sourceBlock(
    app,
    "function updateSalesCopyTemplateDraft()",
    "function resetSalesCopyTemplate",
    "updateSalesCopyTemplateDraft",
  );
  assert.match(updateDraftBlock, /!editSession\.committed/);
  assert.equal(
    updateDraftBlock.match(/state\.adminHistory\.push\(/g)?.length || 0,
    1,
    "mỗi phiên nhập chỉ có một điểm hoàn tác",
  );
  assert.ok(
    updateDraftBlock.indexOf("state.adminHistory.push(editSession.previous)") <
      updateDraftBlock.indexOf("editSession.committed = true"),
    "phải đánh dấu checkpoint đã ghi ngay sau lần push đầu tiên",
  );
  assert.match(updateDraftBlock, /renderSalesCopyTemplateEditor\(\{\s*syncInput:\s*false\s*\}\)/);

  const resetBlock = sourceBlock(
    app,
    "function resetSalesCopyTemplate()",
    "function renderInventoryReportTemplateEditor",
    "resetSalesCopyTemplate",
  );
  assert.match(resetBlock, /const previous = captureAdminState\(\)/);
  assert.match(resetBlock, /state\.adminDraft\.salesCopyTemplate\s*=\s*DEFAULT_SALES_COPY_TEMPLATE/);
  assert.match(resetBlock, /commitAdminChange\(previous\)/);

  const bindBlock = sourceBlock(app, "function bindEvents()", "function init()", "bindEvents");
  assert.match(bindBlock, /salesCopyTemplate\.addEventListener\("focus",\s*beginSalesCopyTemplateEdit\)/);
  assert.match(bindBlock, /salesCopyTemplate\.addEventListener\("input",\s*updateSalesCopyTemplateDraft\)/);
  assert.match(bindBlock, /salesCopyTemplateEditSession\s*=\s*null/);
  assert.match(bindBlock, /resetSalesCopyTemplate\.addEventListener\("click",\s*resetSalesCopyTemplate\)/);

  assert.match(html, /href="\/styles\.css\?v=75"/);
  assert.match(html, /src="\/app\.js\?v=75"/);
});
