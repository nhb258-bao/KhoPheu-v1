import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../public/manifest.json", import.meta.url);

test("PWA mở tab Tổng quan khi khởi chạy từ màn hình chính", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.start_url, "/#overview");
});
