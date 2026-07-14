import { readFile } from "node:fs/promises";

export function parseEnv(text) {
  const result = Object.create(null);

  for (const sourceLine of String(text).replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    result[key] = value;
  }

  return result;
}

export async function loadEnvFile(filePath, target = process.env) {
  try {
    const values = parseEnv(await readFile(filePath, "utf8"));
    for (const [key, value] of Object.entries(values)) {
      if (target[key] === undefined) target[key] = value;
    }
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function integerSetting(env, key, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${key} phải là số nguyên trong khoảng ${min}..${max}.`);
  }
  return value;
}

function sheetId(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("GOOGLE_SHEET_ID không hợp lệ.");
  }
  return value;
}

export function settingsFromEnv(env = process.env) {
  return Object.freeze({
    port: integerSetting(env, "PORT", 4173, { min: 1, max: 65_535 }),
    host: env.HOST?.trim() || "0.0.0.0",
    googleSheetId: sheetId(
      env.GOOGLE_SHEET_ID?.trim() || "1_xllCT3z7gdlRTK_MtCC4v_Q9Iakl_HLorVy3iBNvJw",
    ),
    inventorySheetGid: String(env.INVENTORY_SHEET_GID || "2074240367").trim(),
    salesSheetGid: String(env.SALES_SHEET_GID || "1647334696").trim(),
    adminUsername: env.ADMIN_USERNAME ?? "admin",
    adminPassword: env.ADMIN_PASSWORD ?? "admin123",
    sessionSecret: env.SESSION_SECRET || "",
    cacheTtlMs: integerSetting(env, "CACHE_TTL_MS", 60_000, {
      min: 0,
      max: 24 * 60 * 60 * 1_000,
    }),
  });
}
