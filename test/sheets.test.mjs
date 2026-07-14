import test from "node:test";
import assert from "node:assert/strict";

import { GoogleSheetsService } from "../src/lib/sheets.mjs";

test("GoogleSheetsService gom cache miss và refresh đồng thời theo từng nguồn", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    await new Promise((resolve) => setImmediate(resolve));
    return new Response('"Sản phẩm","SKU-1","","","5"\n', {
      status: 200,
      headers: { "content-type": "text/csv" },
    });
  };
  const service = new GoogleSheetsService({
    sheetId: "sheet-id",
    inventoryGid: "1",
    salesGid: "2",
    cacheTtlMs: 60_000,
    fetchImpl,
  });

  const firstPair = await Promise.all([
    service.getInventory(),
    service.getInventory(),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(firstPair[0].data, [{ name: "Sản phẩm", sku: "SKU-1", standardQty: 5 }]);
  assert.equal(firstPair[0].source, "network");
  assert.equal(firstPair[1].source, "network");

  const cached = await service.getInventory();
  assert.equal(calls, 1);
  assert.equal(cached.source, "cache");

  const refreshedPair = await Promise.all([
    service.getInventory({ refresh: true }),
    service.getInventory({ refresh: true }),
  ]);
  assert.equal(calls, 2);
  assert.equal(refreshedPair[0].source, "network");
  assert.equal(refreshedPair[1].source, "network");
});
