import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SessionManager, credentialsMatch } from "../src/lib/session.mjs";
import {
  createDataStore,
  DataStore,
  ReadOnlyDataStore,
  RedisDataStore,
  writeJsonAtomic,
} from "../src/lib/store.mjs";

class FakeRedis {
  constructor() {
    this.strings = new Map();
    this.hashes = new Map();
  }

  async set(key, value) {
    this.strings.set(key, value);
    return "OK";
  }

  async eval(script, [key], args) {
    if (script.includes("khopheu:get-config")) {
      if (!this.strings.has(key)) this.strings.set(key, args[0]);
      return this.strings.get(key);
    }

    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map();
      const seedOffset = script.includes("khopheu:patch-count") ? 4 : 0;
      for (let index = seedOffset; index < args.length; index += 2) {
        hash.set(args[index], args[index + 1]);
      }
      this.hashes.set(key, hash);
    }

    if (script.includes("khopheu:get-counts")) return [...hash].flat();
    if (!script.includes("khopheu:patch-count")) throw new Error("Lua script không được hỗ trợ trong test.");

    const [sku, actual, checksExpected, expectedActual] = args;
    const current = hash.has(sku) ? hash.get(sku) : "null";
    if (checksExpected === "1" && current !== expectedActual) return ["conflict", current];
    hash.set(sku, actual);
    return ["ok", ...[...hash].flat()];
  }
}

test("writeJsonAtomic thay thế file đã tồn tại và dọn file tạm", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "khopheu-atomic-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "data.json");

  await writeJsonAtomic(filePath, { version: 1 });
  await writeJsonAtomic(filePath, { version: 2 });

  assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), { version: 2 });
  assert.deepEqual(await readdir(directory), ["data.json"]);
});

test("writeJsonAtomic copy-overwrite khi Windows chặn mọi thao tác rename", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "khopheu-copy-fallback-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "data.json");
  await writeJsonAtomic(filePath, { version: 1 });

  let renameCalls = 0;
  const denyRename = async () => {
    renameCalls += 1;
    const error = new Error("Volume không cho phép rename");
    error.code = "EPERM";
    throw error;
  };
  await writeJsonAtomic(filePath, { version: 2 }, { renameFile: denyRename });

  assert.equal(renameCalls, 2);
  assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), { version: 2 });
  assert.deepEqual(await readdir(directory), ["data.json"]);
});

test("DataStore tuần tự hóa patch đồng thời và luôn ghi JSON hợp lệ", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "khopheu-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const countsPath = join(directory, "counts.json");
  await writeJsonAtomic(countsPath, {
    "2026-07-14": { "SKU-EXISTING": 9 },
  });
  const store = new DataStore({
    configPath: join(directory, "config.json"),
    countsPath,
  });

  await Promise.all([
    store.patchCount("2026-07-14", "SKU-A", 1),
    store.patchCount("2026-07-14", "SKU-B", 2),
  ]);
  assert.deepEqual(await store.getCounts("2026-07-14"), {
    "SKU-EXISTING": 9,
    "SKU-A": 1,
    "SKU-B": 2,
  });
  const persisted = await readFile(countsPath, "utf8");
  assert.doesNotThrow(() => JSON.parse(persisted));

  await assert.rejects(
    store.patchCount("2026-07-14", "SKU-A", 3, { expectedActual: 0 }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "COUNT_CONFLICT");
      assert.deepEqual(error.details, { currentActual: 1 });
      return true;
    },
  );
  assert.equal((await store.getCounts("2026-07-14"))["SKU-A"], 1);

  await store.patchCount("2026-07-14", "SKU-A", 3, { expectedActual: 1 });
  assert.equal((await store.getCounts("2026-07-14"))["SKU-A"], 3);

  assert.deepEqual(await store.getCounts("2026-07-15"), {});
  await store.patchCount("2026-07-15", "SKU-A", 7, { expectedActual: null });
  assert.deepEqual(await store.getCounts("2026-07-15"), { "SKU-A": 7 });
  assert.equal((await store.getCounts("2026-07-14"))["SKU-A"], 3);
  assert.deepEqual(await readdir(directory), ["counts.json"]);
});

test("RedisDataStore giữ cấu hình và số đếm qua cold start, đồng thời chặn xung đột", async () => {
  const redis = new FakeRedis();
  const firstFallback = {
    async getConfig() { return { areas: ["Khu A"], assignments: {} }; },
    async getCounts(date) { return date === "2026-07-16" ? { "SKU-A": 1 } : {}; },
  };
  const firstStore = new RedisDataStore({ redis, fallbackStore: firstFallback });

  assert.deepEqual(await firstStore.getConfig(), { areas: ["Khu A"], assignments: {} });
  assert.deepEqual(await firstStore.getCounts("2026-07-16"), { "SKU-A": 1 });
  await firstStore.putConfig({ areas: ["Khu B"], assignments: { "SKU-A": { area: "Khu B", order: 0 } } });
  assert.deepEqual(
    await firstStore.patchCount("2026-07-16", "SKU-B", 2, { expectedActual: null }),
    { "SKU-A": 1, "SKU-B": 2 },
  );

  const coldStartStore = new RedisDataStore({
    redis,
    fallbackStore: {
      async getConfig() { return { areas: ["Dữ liệu cũ"], assignments: {} }; },
      async getCounts() { return {}; },
    },
  });
  assert.deepEqual(await coldStartStore.getConfig(), {
    areas: ["Khu B"],
    assignments: { "SKU-A": { area: "Khu B", order: 0 } },
  });
  assert.deepEqual(await coldStartStore.getCounts("2026-07-16"), { "SKU-A": 1, "SKU-B": 2 });

  await assert.rejects(
    coldStartStore.patchCount("2026-07-16", "SKU-A", 3, { expectedActual: 0 }),
    (error) => error.code === "COUNT_CONFLICT" && error.details.currentActual === 1,
  );
  await coldStartStore.patchCount("2026-07-16", "SKU-A", 3, { expectedActual: 1 });
  await coldStartStore.patchCount("2026-07-16", "SKU-A", null, { expectedActual: 3 });
  assert.deepEqual(await firstStore.getCounts("2026-07-16"), { "SKU-A": null, "SKU-B": 2 });
});

test("createDataStore không thử ghi filesystem chỉ đọc khi Vercel chưa kết nối Redis", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "khopheu-readonly-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createDataStore({
    configPath: join(directory, "config.json"),
    countsPath: join(directory, "counts.json"),
    env: { VERCEL: "1" },
  });
  assert.ok(store instanceof ReadOnlyDataStore);
  await assert.rejects(
    store.patchCount("2026-07-16", "SKU-A", 1),
    (error) => error.status === 503 && error.code === "PERSISTENT_STORE_NOT_CONFIGURED",
  );

  let credentials;
  const redisStore = createDataStore({
    configPath: join(directory, "config.json"),
    countsPath: join(directory, "counts.json"),
    env: {
      VERCEL: "1",
      UPSTASH_REDIS_REST_URL: "https://redis.example",
      UPSTASH_REDIS_REST_TOKEN: "secret",
    },
    redisFactory(value) {
      credentials = value;
      return new FakeRedis();
    },
  });
  assert.ok(redisStore instanceof RedisDataStore);
  assert.deepEqual(credentials, { url: "https://redis.example", token: "secret" });
});

test("session cookie được ký, hết hiệu lực khi logout và credentials so sánh đúng", () => {
  const sessions = new SessionManager({ secret: "test-secret", ttlMs: 60_000 });
  const token = sessions.create("admin");
  const header = `khopheu_session=${token}`;
  assert.equal(sessions.read(header)?.username, "admin");
  assert.equal(sessions.read(`${header}x`), null);
  sessions.destroy(header);
  assert.equal(sessions.read(header), null);
  assert.equal(credentialsMatch("admin", "admin123", "admin", "admin123"), true);
  assert.equal(credentialsMatch("admin", "wrong", "admin", "admin123"), false);
});
