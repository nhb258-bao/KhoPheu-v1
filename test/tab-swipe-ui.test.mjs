import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("tổng quan dùng nội dung mới và hỗ trợ vuốt ngang giữa bốn tab", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /<p id="progress-hint">Hãy kiểm tra kho SR trước khi kết ca<\/p>/);
  assert.match(app, /"Hãy kiểm tra kho SR trước khi kết ca"/);
  assert.doesNotMatch(`${html}\n${app}`, /Bắt đầu từ khu gần bạn nhất\./);
  assert.match(app, /const TAB_ORDER = \["overview", "count", "lookup", "admin"\];/);
  assert.match(app, /const TAB_NAMES = new Set\(TAB_ORDER\);/);
  assert.match(app, /mainContent: \$\("#main-content"\)/);

  const horizontalStart = app.indexOf("function isInsideHorizontalScroller(target)");
  const swipeStart = app.indexOf("function beginTabSwipe(event)");
  const swipeEnd = app.indexOf("function endTabSwipe(event)");
  const cancelStart = app.indexOf("function cancelTabSwipe()");
  const activateStart = app.indexOf("function activateTab(");
  const bindStart = app.indexOf("function bindEvents()");
  const bindEnd = app.indexOf("function init()", bindStart);

  assert.ok(horizontalStart >= 0 && swipeStart > horizontalStart, "phải có kiểm tra vùng cuộn ngang trước swipe");
  assert.ok(swipeEnd > swipeStart && cancelStart > swipeEnd && activateStart > cancelStart, "phải có đủ vòng đời swipe");
  assert.ok(bindStart >= 0 && bindEnd > bindStart, "phải tìm thấy bindEvents");

  const horizontalBlock = app.slice(horizontalStart, swipeStart);
  const startBlock = app.slice(swipeStart, swipeEnd);
  const endBlock = app.slice(swipeEnd, cancelStart);
  const bindBlock = app.slice(bindStart, bindEnd);

  assert.match(horizontalBlock, /\["auto", "scroll", "overlay"\]\.includes\(overflowX\)/);
  assert.match(horizontalBlock, /element\.scrollWidth > element\.clientWidth \+ 1/);
  assert.match(startBlock, /event\.touches\.length !== 1/);
  assert.match(startBlock, /!isMobileLayout\(\)/);
  assert.match(startBlock, /state\.drag \|\| state\.laneDrag/);
  assert.match(startBlock, /target\.closest\(TAB_SWIPE_INTERACTIVE_SELECTOR\)/);
  assert.match(startBlock, /isInsideHorizontalScroller\(target\)/);
  assert.match(startBlock, /const edgeMargin = 24/);
  assert.match(endBlock, /Math\.min\(96, Math\.max\(56, window\.innerWidth \* 0\.16\)\)/);
  assert.match(endBlock, /elapsed > 900/);
  assert.match(endBlock, /Math\.abs\(deltaX\) <= Math\.abs\(deltaY\) \* 1\.25/);
  assert.match(endBlock, /currentIndex \+ \(deltaX < 0 \? 1 : -1\)/);
  assert.match(endBlock, /nextIndex < 0 \|\| nextIndex >= TAB_ORDER\.length/);
  assert.match(endBlock, /activateTab\(TAB_ORDER\[nextIndex\]\)/);
  assert.match(endBlock, /elements\.tabs\[nextIndex\]\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(`${startBlock}\n${endBlock}`, /preventDefault\(/);

  for (const selector of ["a", "button", "dialog", "input", "label", "select", "textarea", "[contenteditable]", "[role='button']", "[role='tab']"]) {
    assert.ok(app.includes(selector), `phải bỏ qua vùng tương tác ${selector}`);
  }
  assert.match(bindBlock, /addEventListener\("touchstart", beginTabSwipe, \{ passive: true \}\)/);
  assert.match(bindBlock, /addEventListener\("touchend", endTabSwipe, \{ passive: true \}\)/);
  assert.match(bindBlock, /addEventListener\("touchcancel", cancelTabSwipe, \{ passive: true \}\)/);
  assert.match(html, /styles\.css\?v=69/);
  assert.match(html, /app\.js\?v=69/);
});
