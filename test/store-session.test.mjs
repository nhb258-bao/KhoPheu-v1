import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SessionManager, credentialsMatch } from "../src/lib/session.mjs";
import { DataStore, writeJsonAtomic } from "../src/lib/store.mjs";

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
