import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("mobile chặn kéo thả sản phẩm và khu nhưng giữ điều khiển sắp xếp thay thế", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);

  const helperStart = app.indexOf("function isMobileLayout()");
  const laneRenderStart = app.indexOf("function renderAdminLane(");
  const laneRenderEnd = app.indexOf("function applyAdminUnassignedSearch", laneRenderStart);
  const laneDragStart = app.indexOf("function beginLaneDrag(event)");
  const laneDragEnd = app.indexOf("function positionLaneGhost", laneDragStart);
  const dragStart = app.indexOf("function beginDrag(event)");
  const dragEnd = app.indexOf("function positionGhost", dragStart);
  const renderStart = app.indexOf("function renderAdminProduct(");
  const renderEnd = app.indexOf("function renderAdminLane(", renderStart);
  const clickStart = app.indexOf('elements.adminBoard.addEventListener("click"');
  const clickEnd = app.indexOf('elements.adminBoard.addEventListener("input"', clickStart);
  const mobileStart = css.indexOf("@media (max-width: 760px)");
  const mobileEnd = css.indexOf("@media (max-width: 470px)", mobileStart);

  assert.ok(helperStart >= 0 && helperStart < dragStart, "guard mobile phải nằm trước beginDrag");
  assert.ok(laneRenderStart >= 0 && laneRenderEnd > laneRenderStart, "phải tìm thấy khối render khu");
  assert.ok(laneDragStart >= 0 && laneDragEnd > laneDragStart, "phải tìm thấy khối beginLaneDrag");
  assert.ok(dragStart >= 0 && dragEnd > dragStart, "phải tìm thấy khối beginDrag");
  assert.ok(renderStart >= 0 && renderEnd > renderStart, "phải tìm thấy khối render sản phẩm");
  assert.ok(clickStart >= 0 && clickEnd > clickStart, "phải tìm thấy click handler Quản trị");
  assert.ok(mobileStart >= 0 && mobileEnd > mobileStart, "phải tìm thấy media query mobile");

  const helperBlock = app.slice(helperStart, dragStart);
  const laneRenderBlock = app.slice(laneRenderStart, laneRenderEnd);
  const laneDragBlock = app.slice(laneDragStart, laneDragEnd);
  const dragBlock = app.slice(dragStart, dragEnd);
  const renderBlock = app.slice(renderStart, renderEnd);
  const clickBlock = app.slice(clickStart, clickEnd);
  const mobileBlock = css.slice(mobileStart, mobileEnd);

  assert.match(helperBlock, /matchMedia\?\.\("\(max-width: 760px\)"\)\?\.matches/);
  assert.match(dragBlock, /!handle\s*\|\|\s*isMobileLayout\(\)\s*\|\|\s*handle\.disabled/);
  assert.ok(
    dragBlock.indexOf("isMobileLayout()") < dragBlock.indexOf("event.preventDefault()"),
    "guard mobile phải chạy trước khi khóa pointer/scroll",
  );
  assert.match(dragBlock, /ghost\.classList\.add\("drag-ghost"\)/, "desktop vẫn giữ luồng kéo thả");
  assert.match(app, /addEventListener\("pointerdown", beginDrag\)/, "desktop vẫn đăng ký product drag");

  assert.match(laneDragBlock, /!handle\s*\|\|\s*isMobileLayout\(\)\s*\|\|\s*!state\.adminDraft/);
  assert.ok(
    laneDragBlock.indexOf("isMobileLayout()") < laneDragBlock.indexOf("event.preventDefault()"),
    "guard mobile phải chạy trước khi khóa pointer khi kéo khu",
  );
  assert.match(laneDragBlock, /ghost\.className\s*=\s*"lane-drag-ghost"/, "desktop vẫn giữ lane drag");
  assert.match(app, /addEventListener\("pointerdown", beginLaneDrag\)/, "desktop vẫn đăng ký lane drag");

  assert.match(laneRenderBlock, /class="lane-reorder-controls"/);
  assert.match(laneRenderBlock, /data-admin-action="lane-left"/);
  assert.match(laneRenderBlock, /data-admin-action="lane-right"/);
  assert.match(laneRenderBlock, /aria-label="Di chuyển \$\{escapeHtml\(label\)\} sang trái"/);
  assert.match(laneRenderBlock, /aria-label="Di chuyển \$\{escapeHtml\(label\)\} sang phải"/);
  assert.match(laneRenderBlock, /const canMoveLeft = areaIndex > 0/);
  assert.match(laneRenderBlock, /const canMoveRight = areaIndex >= 0/);
  assert.match(clickBlock, /\["lane-left", "lane-right"\]\.includes\(adminAction\)/);
  assert.match(clickBlock, /reorderArea\(area, nextIndex\)/);

  assert.match(mobileBlock, /\.admin-product\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(mobileBlock, /\.drag-handle\s*\{\s*display:\s*none;\s*\}/);
  assert.match(css.slice(0, mobileStart), /\.lane-reorder-controls\s*\{\s*display:\s*none;\s*\}/);
  assert.match(mobileBlock, /\.lane-drag-handle\s*\{\s*display:\s*none;\s*\}/);
  assert.match(mobileBlock, /\.lane-reorder-controls\s*\{[\s\S]*?display:\s*grid;/);

  assert.match(renderBlock, /class="area-select"/);
  assert.match(renderBlock, /data-admin-action="up"/);
  assert.match(renderBlock, /data-admin-action="down"/);
  assert.match(app, /Chọn khu trên thẻ sản phẩm để chuyển vào đây/);
  assert.match(html, /styles\.css\?v=74/);
  assert.match(html, /app\.js\?v=74/);
});
