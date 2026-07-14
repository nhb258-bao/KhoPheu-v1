import { copyFile, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";

import { AppError } from "./errors.mjs";

const REPLACE_RENAME_ERRORS = new Set(["EPERM", "EACCES", "EEXIST", "ENOTEMPTY"]);
const COPY_FALLBACK_ERRORS = new Set(["EPERM", "EACCES"]);

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
