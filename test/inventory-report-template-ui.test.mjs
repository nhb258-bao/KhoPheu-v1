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

const INVENTORY_TEMPLATE_TOKENS = [
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

test("Quản trị cấu hình mẫu báo cáo kho xuyên suốt UI, draft, lưu và nội dung xuất", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);

  const textareaTag = html.match(/<textarea\b[^>]*id="inventory-report-template"[^>]*>/)?.[0] || "";
  assert.ok(textareaTag, "phải có textarea chỉnh mẫu báo cáo kho");
  assert.match(textareaTag, /rows="22"/);
  assert.match(textareaTag, /maxlength="8000"/);
  assert.match(
    textareaTag,
    /aria-describedby="inventory-report-template-help inventory-report-template-error"/,
  );
  assert.match(
    html,
    /id="inventory-report-template-title"[^>]*>MẪU FORM BÁO CÁO KHO CUỐI CA<\/p>/,
  );
  assert.match(html, /id="inventory-report-template-error"[^>]*role="alert"[^>]*hidden/);
  assert.match(html, /<pre id="inventory-report-template-preview"><\/pre>/);
  assert.match(html, /id="reset-inventory-report-template"/);
  assert.equal(INVENTORY_TEMPLATE_TOKENS.length, 13);
  for (const token of INVENTORY_TEMPLATE_TOKENS) {
    assert.ok(html.includes(`<code>{{${token}}}</code>`), `phần trợ giúp phải mô tả {{${token}}}`);
  }

  const inventoryCardIndex = html.indexOf('id="inventory-report-template-card"');
  const adminBoardIndex = html.indexOf('id="admin-board"');
  const salesCardIndex = html.indexOf('id="sales-copy-template-card"');
  assert.ok(
    adminBoardIndex >= 0 && adminBoardIndex < salesCardIndex && salesCardIndex < inventoryCardIndex,
    "mẫu kho phải nằm cuối, ngay dưới mẫu khách mua hàng",
  );
  assert.ok(
    css.includes(".inventory-report-template-card .admin-template-field textarea {"),
    "textarea báo cáo dài phải có kích thước riêng",
  );

  for (const mapping of [
    'inventoryReportTemplateCard: $("#inventory-report-template-card")',
    'inventoryReportTemplate: $("#inventory-report-template")',
    'inventoryReportTemplateError: $("#inventory-report-template-error")',
    'inventoryReportTemplatePreview: $("#inventory-report-template-preview")',
    'resetInventoryReportTemplate: $("#reset-inventory-report-template")',
  ]) {
    assert.ok(app.includes(mapping), `elements phải ánh xạ ${mapping}`);
  }

  const tokenConstantBlock = sourceBlock(
    app,
    "const INVENTORY_REPORT_TEMPLATE_TOKENS = [",
    "const INVENTORY_REPORT_TEMPLATE_TOKEN_SET",
    "INVENTORY_REPORT_TEMPLATE_TOKENS",
  );
  for (const token of INVENTORY_TEMPLATE_TOKENS) {
    assert.match(tokenConstantBlock, new RegExp(`"${token}"`));
  }

  const stateBlock = sourceBlock(app, "const state = {", "let adminAssignedRevealTimer", "state");
  assert.match(stateBlock, /inventoryReportTemplate:\s*DEFAULT_INVENTORY_REPORT_TEMPLATE/);

  const normalizeBootstrapBlock = sourceBlock(
    app,
    "function normalizeBootstrap(payload)",
    "async function loadBootstrap",
    "normalizeBootstrap",
  );
  assert.match(
    normalizeBootstrapBlock,
    /inventoryReportTemplate:\s*normalizeInventoryReportTemplate\(payload\?\.inventoryReportTemplate\)/,
  );

  const loadBootstrapBlock = sourceBlock(
    app,
    "async function loadBootstrap(",
    "function hasPendingCountSaves",
    "loadBootstrap",
  );
  assert.match(
    loadBootstrapBlock,
    /state\.inventoryReportTemplate\s*=\s*normalized\.inventoryReportTemplate/,
  );

  const ensureDraftBlock = sourceBlock(
    app,
    "function ensureAdminDraft()",
    "function syncAdminDraftWithProducts",
    "ensureAdminDraft",
  );
  assert.match(
    ensureDraftBlock,
    /inventoryReportTemplate:\s*state\.inventoryReportTemplate\s*\|\|\s*DEFAULT_INVENTORY_REPORT_TEMPLATE/,
  );

  const cloneDraftBlock = sourceBlock(
    app,
    "function cloneAdminDraft(",
    "function captureAdminState",
    "cloneAdminDraft",
  );
  assert.match(cloneDraftBlock, /inventoryReportTemplate:\s*draft\.inventoryReportTemplate/);

  const formatterBlock = sourceBlock(
    app,
    "function fillInventoryReportTemplate(",
    "function formatFetchedAt",
    "fillInventoryReportTemplate",
  );
  assert.match(formatterBlock, /\.split\("\\n"\)/, "formatter phải xử lý theo từng dòng");
  assert.match(formatterBlock, /\.flatMap\(\(line\)\s*=>/);
  assert.match(formatterBlock, /const standaloneToken\s*=\s*\/\^\(\[ \\t\]\*\)\{\{/);
  assert.match(formatterBlock, /if \(!replacement\) return \[\];/);
  assert.match(formatterBlock, /replacement\.split\("\\n"\)\.map\(/);
  assert.match(formatterBlock, /line\.replace\(tokenPattern,/);

  const builderBlock = sourceBlock(
    app,
    "function buildInventoryReportLines(",
    "function inventoryReportPlainText",
    "buildInventoryReportLines",
  );
  assert.match(
    builderBlock,
    /template\s*=\s*state\.inventoryReportTemplate/,
    "báo cáo thực tế phải dùng mẫu đã lưu trong state",
  );
  assert.match(builderBlock, /fillInventoryReportTemplate\(/);
  assert.match(builderBlock, /normalizeInventoryReportTemplate\(template\)/);
  assert.match(builderBlock, /inventoryReportTemplateValues\(\)/);

  const editorBlock = sourceBlock(
    app,
    "function renderInventoryReportTemplateEditor(",
    "function beginInventoryReportTemplateEdit",
    "renderInventoryReportTemplateEditor",
  );
  assert.match(editorBlock, /inventoryReportTemplateError\.textContent\s*=\s*validation\.error/);
  assert.match(editorBlock, /inventoryReportTemplatePreview\.textContent\s*=\s*validation\.error/);
  assert.match(editorBlock, /inventoryReportPlainText\(buildInventoryReportLines\(validation\.value\)\)/);
  assert.doesNotMatch(editorBlock, /inventoryReportTemplate(?:Error|Preview)\.innerHTML/);

  const beginEditBlock = sourceBlock(
    app,
    "function beginInventoryReportTemplateEdit()",
    "function updateInventoryReportTemplateDraft",
    "beginInventoryReportTemplateEdit",
  );
  assert.match(beginEditBlock, /previous:\s*captureAdminState\(\),\s*committed:\s*false/);

  const updateDraftBlock = sourceBlock(
    app,
    "function updateInventoryReportTemplateDraft()",
    "function resetInventoryReportTemplate",
    "updateInventoryReportTemplateDraft",
  );
  assert.match(updateDraftBlock, /!editSession\.committed/);
  assert.equal(
    updateDraftBlock.match(/state\.adminHistory\.push\(/g)?.length || 0,
    1,
    "mỗi phiên nhập mẫu báo cáo kho chỉ có một điểm hoàn tác",
  );
  assert.ok(
    updateDraftBlock.indexOf("state.adminHistory.push(editSession.previous)") <
      updateDraftBlock.indexOf("editSession.committed = true"),
    "checkpoint phải được ghi trước khi đánh dấu phiên nhập đã commit",
  );
  assert.match(
    updateDraftBlock,
    /renderInventoryReportTemplateEditor\(\{\s*syncInput:\s*false\s*\}\)/,
  );

  const resetBlock = sourceBlock(
    app,
    "function resetInventoryReportTemplate()",
    "function setConfigDirty",
    "resetInventoryReportTemplate",
  );
  assert.match(resetBlock, /const previous = captureAdminState\(\)/);
  assert.match(
    resetBlock,
    /state\.adminDraft\.inventoryReportTemplate\s*=\s*DEFAULT_INVENTORY_REPORT_TEMPLATE/,
  );
  assert.match(resetBlock, /commitAdminChange\(previous\)/);

  const dirtyBlock = sourceBlock(app, "function setConfigDirty(", "function setAdminConfigBusy", "setConfigDirty");
  assert.match(
    dirtyBlock,
    /validateInventoryReportTemplate\(state\.adminDraft\.inventoryReportTemplate\)\.error/,
  );

  const busyBlock = sourceBlock(app, "function setAdminConfigBusy(", "function undoAdminConfig", "setAdminConfigBusy");
  assert.match(busyBlock, /elements\.inventoryReportTemplateCard\.inert\s*=\s*busy/);
  assert.match(busyBlock, /inventoryReportTemplateCard\.classList\.toggle\("is-saving",\s*busy\)/);
  assert.match(busyBlock, /inventoryReportTemplateCard\.setAttribute\("aria-busy",\s*String\(busy\)\)/);

  const renderBoardBlock = sourceBlock(app, "function renderAdminBoard()", "function moveProduct", "renderAdminBoard");
  assert.match(renderBoardBlock, /elements\.inventoryReportTemplateCard\.hidden\s*=\s*false/);
  assert.match(renderBoardBlock, /renderInventoryReportTemplateEditor\(\)/);

  const saveBlock = sourceBlock(app, "async function saveConfig()", "function bindEvents()", "saveConfig");
  assert.match(
    saveBlock,
    /validateInventoryReportTemplate\(state\.adminDraft\.inventoryReportTemplate\)/,
  );
  assert.match(saveBlock, /elements\.inventoryReportTemplate\.focus\(\)/);
  assert.match(saveBlock, /inventoryReportTemplate:\s*state\.adminDraft\.inventoryReportTemplate/);
  assert.match(
    saveBlock,
    /state\.inventoryReportTemplate\s*=\s*normalizeInventoryReportTemplate\([\s\S]*?payload\?\.inventoryReportTemplate\s*\?\?\s*body\.inventoryReportTemplate/,
  );
  assert.match(
    saveBlock,
    /state\.configSaving\s*=\s*false;[\s\S]*?renderInventoryReportTemplateEditor\(\)/,
    "sau khi lưu phải render lại editor để trạng thái nút khôi phục không bị kẹt",
  );

  const bindBlock = sourceBlock(app, "function bindEvents()", "function init()", "bindEvents");
  assert.match(
    bindBlock,
    /inventoryReportTemplate\.addEventListener\("focus",\s*beginInventoryReportTemplateEdit\)/,
  );
  assert.match(
    bindBlock,
    /inventoryReportTemplate\.addEventListener\("input",\s*updateInventoryReportTemplateDraft\)/,
  );
  assert.match(bindBlock, /inventoryReportTemplateEditSession\s*=\s*null/);
  assert.match(
    bindBlock,
    /resetInventoryReportTemplate\.addEventListener\("click",\s*resetInventoryReportTemplate\)/,
  );

  assert.match(html, /href="\/styles\.css\?v=75"/);
  assert.match(html, /src="\/app\.js\?v=75"/);
});
