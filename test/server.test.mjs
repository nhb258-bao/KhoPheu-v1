import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { createApplication } from "../app.mjs";
import {
  DEFAULT_INVENTORY_REPORT_TEMPLATE,
  DEFAULT_SALES_COPY_TEMPLATE,
  dateInTimeZone,
  VIETNAM_TIME_ZONE,
} from "../src/lib/domain.mjs";
import { AppError } from "../src/lib/errors.mjs";
import { SessionManager } from "../src/lib/session.mjs";

test("API bootstrap, count, login và config tuân theo contract", async (t) => {
  const today = dateInTimeZone(new Date(), VIETNAM_TIME_ZONE);
  const [year, month, day] = today.split("-");
  const saleDateTime = `${day}/${month}/${year} 18:50:40`;
  let savedConfig = {
    areas: ["A", "B", "C"],
    assignments: { PVN4279: { area: "A", order: 0 } },
  };
  let counts = {};
  const store = {
    async getConfig() { return savedConfig; },
    async putConfig(value) { savedConfig = value; return value; },
    async getCounts() { return counts; },
    async patchCount(_date, sku, actual, options = {}) {
      const currentActual = Object.prototype.hasOwnProperty.call(counts, sku) ? counts[sku] : null;
      if (
        Object.prototype.hasOwnProperty.call(options, "expectedActual") &&
        !Object.is(currentActual, options.expectedActual)
      ) {
        throw new AppError(409, "COUNT_CONFLICT", "Xung đột số lượng.", { currentActual });
      }
      counts = { ...counts, [sku]: actual };
      return counts;
    },
  };
  const sheets = {
    async getInventory() {
      return {
        data: [{ name: "VX SS304 Inox T1", sku: "PVN4279", standardQty: 5 }],
        source: "network",
        fetchedAt: "2026-07-14T10:00:00.000Z",
      };
    },
    async getSalesRows() {
      return {
        data: [[saleDateTime, "VX SS304 Inox T1", "2", "Khách A", "0900000000", "NV", "note"]],
        source: "cache",
        fetchedAt: "2026-07-14T10:00:00.000Z",
      };
    },
  };
  const settings = { adminUsername: "admin", adminPassword: "admin123" };
  const sessions = new SessionManager({ secret: "server-test" });
  const server = createServer(createApplication({ settings, store, sheets, sessions }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const bootstrapResponse = await fetch(`${base}/api/bootstrap?date=${today}`);
  assert.equal(bootstrapResponse.status, 200);
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.products[0].soldToday, true);
  assert.equal(bootstrap.products[0].soldQty, 2);
  assert.deepEqual(bootstrap.sales[0], {
    dateTime: saleDateTime,
    productName: "VX SS304 Inox T1",
    quantity: 2,
    customer: "Khách A",
    phone: "0900000000",
    staff: "NV",
    matchedSku: "PVN4279",
  });
  assert.equal("note" in bootstrap.sales[0], false);
  assert.deepEqual(bootstrap.counts, {});
  assert.equal(bootstrap.salesCopyTemplate, DEFAULT_SALES_COPY_TEMPLATE);
  assert.equal(bootstrap.inventoryReportTemplate, DEFAULT_INVENTORY_REPORT_TEMPLATE);

  const countResponse = await fetch(`${base}/api/counts/${today}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sku: "pvn4279", actual: 4, expectedActual: null }),
  });
  assert.equal(countResponse.status, 200);
  assert.equal((await countResponse.json()).counts.PVN4279, 4);

  const conflictResponse = await fetch(`${base}/api/counts/${today}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sku: "PVN4279", actual: 3, expectedActual: null }),
  });
  assert.equal(conflictResponse.status, 409);
  const conflict = await conflictResponse.json();
  assert.equal(conflict.error.code, "COUNT_CONFLICT");
  assert.equal(conflict.error.details.currentActual, 4);

  const legacyCountResponse = await fetch(`${base}/api/counts/${today}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sku: "PVN4279", actual: 5 }),
  });
  assert.equal(legacyCountResponse.status, 200);
  assert.equal((await legacyCountResponse.json()).counts.PVN4279, 5);

  const unknownSkuResponse = await fetch(`${base}/api/counts/${today}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sku: "KHONG-TON-TAI", actual: 1 }),
  });
  assert.equal(unknownSkuResponse.status, 400);

  const staleDateResponse = await fetch(`${base}/api/counts/2000-01-01`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sku: "PVN4279", actual: 1 }),
  });
  assert.equal(staleDateResponse.status, 409);
  assert.equal((await staleDateResponse.json()).error.details.currentDate, today);

  const denied = await fetch(`${base}/api/config`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(savedConfig),
  });
  assert.equal(denied.status, 401);

  const login = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";", 1)[0];
  const customSalesCopyTemplate = [
    "{{date}} - {{phone}} - Dạ em bán:",
    "  {{products}}",
    "Khách hàng: {{customer}} - Nhân viên: {{staff}}",
  ].join("\n");
  const customInventoryReportTemplate = DEFAULT_INVENTORY_REPORT_TEMPLATE.replace(
    "Báo cáo kho PTS",
    "BÁO CÁO KHO CUỐI CA PTS",
  );
  const newConfig = {
    areas: ["X"],
    assignments: { PVN4279: { area: "X", order: 1 } },
    salesCopyTemplate: customSalesCopyTemplate,
    inventoryReportTemplate: customInventoryReportTemplate,
  };
  const saved = await fetch(`${base}/api/config`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(newConfig),
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), newConfig);

  const refreshedBootstrap = await fetch(`${base}/api/bootstrap?date=${today}`);
  assert.equal(refreshedBootstrap.status, 200);
  const refreshedBootstrapPayload = await refreshedBootstrap.json();
  assert.equal(refreshedBootstrapPayload.salesCopyTemplate, customSalesCopyTemplate);
  assert.equal(refreshedBootstrapPayload.inventoryReportTemplate, customInventoryReportTemplate);

  const invalidTemplate = await fetch(`${base}/api/config`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ ...newConfig, salesCopyTemplate: "{{products}} {{unknown}}" }),
  });
  assert.equal(invalidTemplate.status, 400);
  assert.equal(savedConfig.salesCopyTemplate, customSalesCopyTemplate);

  const invalidInventoryTemplate = await fetch(`${base}/api/config`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      ...newConfig,
      inventoryReportTemplate: customInventoryReportTemplate.replace("{{date}}", "{{unknown}}"),
    }),
  });
  assert.equal(invalidInventoryTemplate.status, 400);
  assert.equal(savedConfig.inventoryReportTemplate, customInventoryReportTemplate);

  const legacyConfig = { areas: ["Y"], assignments: { PVN4279: { area: "Y", order: 0 } } };
  const legacySaved = await fetch(`${base}/api/config`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(legacyConfig),
  });
  assert.equal(legacySaved.status, 200);
  assert.deepEqual(await legacySaved.json(), {
    ...legacyConfig,
    salesCopyTemplate: customSalesCopyTemplate,
    inventoryReportTemplate: customInventoryReportTemplate,
  });
  assert.equal(savedConfig.salesCopyTemplate, customSalesCopyTemplate);
  assert.equal(savedConfig.inventoryReportTemplate, customInventoryReportTemplate);

  const updatedSalesCopyTemplate = "Báo khách: {{products}}";
  const salesOnlyConfig = {
    areas: ["Z"],
    assignments: { PVN4279: { area: "Z", order: 0 } },
    salesCopyTemplate: updatedSalesCopyTemplate,
  };
  const salesOnlySaved = await fetch(`${base}/api/config`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(salesOnlyConfig),
  });
  assert.equal(salesOnlySaved.status, 200);
  assert.deepEqual(await salesOnlySaved.json(), {
    ...salesOnlyConfig,
    inventoryReportTemplate: customInventoryReportTemplate,
  });

  const updatedInventoryReportTemplate = customInventoryReportTemplate.replace(
    "BÁO CÁO KHO CUỐI CA PTS",
    "BÁO CÁO TỒN KHO PTS",
  );
  const inventoryOnlyConfig = {
    areas: ["W"],
    assignments: { PVN4279: { area: "W", order: 0 } },
    inventoryReportTemplate: updatedInventoryReportTemplate,
  };
  const inventoryOnlySaved = await fetch(`${base}/api/config`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(inventoryOnlyConfig),
  });
  assert.equal(inventoryOnlySaved.status, 200);
  assert.deepEqual(await inventoryOnlySaved.json(), {
    ...inventoryOnlyConfig,
    salesCopyTemplate: updatedSalesCopyTemplate,
  });
  assert.equal(savedConfig.salesCopyTemplate, updatedSalesCopyTemplate);
  assert.equal(savedConfig.inventoryReportTemplate, updatedInventoryReportTemplate);

  const session = await fetch(`${base}/api/session`, { headers: { cookie } });
  assert.deepEqual(await session.json(), { authenticated: true, username: "admin" });
});
