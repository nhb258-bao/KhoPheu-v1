import { copyFile, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { Redis } from "@upstash/redis";

import { AppError } from "./errors.mjs";

const REPLACE_RENAME_ERRORS = new Set(["EPERM", "EACCES", "EEXIST", "ENOTEMPTY"]);
const COPY_FALLBACK_ERRORS = new Set(["EPERM", "EACCES"]);
const REDIS_CONFIG_KEY = "khopheu:v1:config";
const REDIS_COUNTS_PREFIX = "khopheu:v1:counts:";
const NULL_COUNT = "null";
const GET_CONFIG_SCRIPT = `
-- khopheu:get-config
local current = redis.call("GET", KEYS[1])
if current then return current end
redis.call("SET", KEYS[1], ARGV[1], "NX")
return redis.call("GET", KEYS[1])
`;
const GET_COUNTS_SCRIPT = `
-- khopheu:get-counts
if redis.call("EXISTS", KEYS[1]) == 0 then
  for index = 1, #ARGV, 2 do
    redis.call("HSET", KEYS[1], ARGV[index], ARGV[index + 1])
  end
end
return redis.call("HGETALL", KEYS[1])
`;
const PATCH_COUNT_SCRIPT = `
-- khopheu:patch-count
if redis.call("EXISTS", KEYS[1]) == 0 then
  for index = 5, #ARGV, 2 do
    redis.call("HSET", KEYS[1], ARGV[index], ARGV[index + 1])
  end
end

local current = redis.call("HGET", KEYS[1], ARGV[1])
if not current then current = "${NULL_COUNT}" end
if ARGV[3] == "1" and current ~= ARGV[4] then
  return { "conflict", current }
end

redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
local result = redis.call("HGETALL", KEYS[1])
table.insert(result, 1, "ok")
return result
`;

function temporarySibling(filePath, extension) {
  return `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.${extension}`;
}

async function renameReplacing(sourcePath, destinationPath, operations = {}) {
  const renameFile = operations.renameFile ?? rename;
  const copyFileContents = operations.copyFileContents ?? copyFile;
  const openFile = operations.openFile ?? open;
  const removeFile = operations.removeFile ?? rm;
  let initialError;
  try {
    await renameFile(sourcePath, destinationPath);
    return;
  } catch (error) {
    if (!REPLACE_RENAME_ERRORS.has(error?.code)) throw error;
    initialError = error;
  }

  const backupPath = temporarySibling(destinationPath, "bak");
  try {
    await renameFile(destinationPath, backupPath);
  } catch (backupError) {
    if (COPY_FALLBACK_ERRORS.has(backupError?.code)) {
      // Some Windows volumes/ACLs allow overwriting contents but reject rename/delete.
      // Copying the already-fsynced temp file is therefore a best-effort, non-atomic fallback.
      let destinationHandle;
      try {
        await copyFileContents(sourcePath, destinationPath);
        destinationHandle = await openFile(destinationPath, "r+");
        await destinationHandle.sync();
        return;
      } catch (copyError) {
        throw new AggregateError(
          [initialError, backupError, copyError],
          `Không thể thay hoặc ghi đè file: ${destinationPath}`,
          { cause: copyError },
        );
      } finally {
        await destinationHandle?.close().catch(() => {});
      }
    }
    throw new AggregateError(
      [initialError, backupError],
      `Không thể tạo bản sao dự phòng trước khi thay file: ${destinationPath}`,
      { cause: initialError },
    );
  }

  try {
    await renameFile(sourcePath, destinationPath);
  } catch (replacementError) {
    try {
      await renameFile(backupPath, destinationPath);
    } catch (restoreError) {
      const error = new AggregateError(
        [replacementError, restoreError],
        `Không thể thay file và cũng không thể khôi phục bản cũ. Backup còn tại: ${backupPath}`,
        { cause: replacementError },
      );
      error.code = "ATOMIC_RESTORE_FAILED";
      error.backupPath = backupPath;
      throw error;
    }
    throw replacementError;
  }

  try {
    await removeFile(backupPath, { force: true });
  } catch (firstCleanupError) {
    try {
      await removeFile(backupPath, { force: true });
    } catch {
      throw firstCleanupError;
    }
  }
}

export async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return structuredClone(fallback);
    if (error instanceof SyntaxError) {
      throw new Error(`File JSON không hợp lệ: ${filePath}`, { cause: error });
    }
    throw error;
  }
}

export async function writeJsonAtomic(filePath, value, replacementOperations) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = temporarySibling(filePath, "tmp");
  let handle;

  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await renameReplacing(temporaryPath, filePath, replacementOperations);
  } finally {
    await handle?.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function encodeCount(value) {
  return value === null || value === undefined ? NULL_COUNT : String(value);
}

function decodeCount(value) {
  if (value === null || value === undefined || String(value) === NULL_COUNT) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > 999_999) {
    throw new Error(`Dữ liệu số đếm trong Redis không hợp lệ: ${value}`);
  }
  return number;
}

function countArguments(counts) {
  return Object.entries(objectOrEmpty(counts)).flatMap(([sku, value]) => [sku, encodeCount(value)]);
}

function countsFromRedis(value) {
  const result = {};
  const entries = Array.isArray(value)
    ? Array.from({ length: Math.floor(value.length / 2) }, (_, index) => [value[index * 2], value[index * 2 + 1]])
    : Object.entries(objectOrEmpty(value));
  for (const [sku, actual] of entries) {
    if (typeof sku === "string" && sku) result[sku] = decodeCount(actual);
  }
  return result;
}

function redisCredentials(env) {
  return {
    url: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || "",
    token: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || "",
  };
}

export class DataStore {
  #queue = Promise.resolve();

  constructor({ configPath, countsPath }) {
    this.configPath = configPath;
    this.countsPath = countsPath;
  }

  async getConfig() {
    return readJsonFile(this.configPath, { areas: ["A", "B", "C"], assignments: {} });
  }

  async putConfig(config) {
    return this.#write(async () => {
      await writeJsonAtomic(this.configPath, config);
      return config;
    });
  }

  async getCounts(date) {
    const allCounts = objectOrEmpty(await readJsonFile(this.countsPath, {}));
    return objectOrEmpty(allCounts[date]);
  }

  async patchCount(date, sku, actual, options = {}) {
    return this.#write(async () => {
      const allCounts = objectOrEmpty(await readJsonFile(this.countsPath, {}));
      const currentDateCounts = objectOrEmpty(allCounts[date]);
      const currentActual = Object.prototype.hasOwnProperty.call(currentDateCounts, sku)
        ? currentDateCounts[sku]
        : null;
      if (
        Object.prototype.hasOwnProperty.call(options, "expectedActual") &&
        !Object.is(currentActual, options.expectedActual)
      ) {
        throw new AppError(
          409,
          "COUNT_CONFLICT",
          "Số lượng đã được thay đổi trên thiết bị khác.",
          { currentActual },
        );
      }

      const dateCounts = { ...currentDateCounts, [sku]: actual };
      const next = { ...allCounts, [date]: dateCounts };
      await writeJsonAtomic(this.countsPath, next);
      return dateCounts;
    });
  }

  #write(operation) {
    const result = this.#queue.then(operation, operation);
    this.#queue = result.catch(() => {});
    return result;
  }
}

export class RedisDataStore {
  constructor({ redis, fallbackStore }) {
    this.redis = redis;
    this.fallbackStore = fallbackStore;
  }

  async getConfig() {
    const fallback = await this.fallbackStore.getConfig();
    const stored = await this.redis.eval(GET_CONFIG_SCRIPT, [REDIS_CONFIG_KEY], [JSON.stringify(fallback)]);
    if (typeof stored !== "string") return objectOrEmpty(stored);
    try {
      return objectOrEmpty(JSON.parse(stored));
    } catch (error) {
      throw new Error("Cấu hình lưu trong Redis không phải JSON hợp lệ.", { cause: error });
    }
  }

  async putConfig(config) {
    await this.redis.set(REDIS_CONFIG_KEY, JSON.stringify(config));
    return config;
  }

  async getCounts(date) {
    const fallback = await this.fallbackStore.getCounts(date);
    const stored = await this.redis.eval(
      GET_COUNTS_SCRIPT,
      [`${REDIS_COUNTS_PREFIX}${date}`],
      countArguments(fallback),
    );
    return countsFromRedis(stored);
  }

  async patchCount(date, sku, actual, options = {}) {
    const fallback = await this.fallbackStore.getCounts(date);
    const checksExpected = Object.prototype.hasOwnProperty.call(options, "expectedActual");
    const result = await this.redis.eval(
      PATCH_COUNT_SCRIPT,
      [`${REDIS_COUNTS_PREFIX}${date}`],
      [
        sku,
        encodeCount(actual),
        checksExpected ? "1" : "0",
        encodeCount(options.expectedActual),
        ...countArguments(fallback),
      ],
    );
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Redis không trả kết quả cập nhật số đếm hợp lệ.");
    }
    if (result[0] === "conflict") {
      throw new AppError(
        409,
        "COUNT_CONFLICT",
        "Số lượng đã được thay đổi trên thiết bị khác.",
        { currentActual: decodeCount(result[1]) },
      );
    }
    if (result[0] !== "ok") throw new Error("Redis không xác nhận cập nhật số đếm.");
    return countsFromRedis(result.slice(1));
  }
}

export class ReadOnlyDataStore {
  constructor({ fallbackStore }) {
    this.fallbackStore = fallbackStore;
  }

  getConfig() {
    return this.fallbackStore.getConfig();
  }

  getCounts(date) {
    return this.fallbackStore.getCounts(date);
  }

  async putConfig() {
    throw new AppError(
      503,
      "PERSISTENT_STORE_NOT_CONFIGURED",
      "Chưa kết nối Upstash Redis với dự án Vercel nên không thể lưu cấu hình.",
    );
  }

  async patchCount() {
    throw new AppError(
      503,
      "PERSISTENT_STORE_NOT_CONFIGURED",
      "Chưa kết nối Upstash Redis với dự án Vercel nên không thể lưu số đếm.",
    );
  }
}

export function createDataStore({ configPath, countsPath, env = process.env, redisFactory } = {}) {
  const fallbackStore = new DataStore({ configPath, countsPath });
  const credentials = redisCredentials(env);
  if (credentials.url && credentials.token) {
    const redis = redisFactory
      ? redisFactory(credentials)
      : new Redis({
          ...credentials,
          automaticDeserialization: false,
          readYourWrites: true,
        });
    return new RedisDataStore({ redis, fallbackStore });
  }

  if (env.VERCEL || credentials.url || credentials.token) {
    return new ReadOnlyDataStore({ fallbackStore });
  }
  return fallbackStore;
}
