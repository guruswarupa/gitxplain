import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

function getCacheDir() {
  return path.join(os.homedir(), ".gitxplain", "cache");
}

export function createCacheKey(parts) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(parts));
  return hash.digest("hex");
}

function getCachePath(cacheKey) {
  return path.join(getCacheDir(), `${cacheKey}.json`);
}

export function readCache(cacheKey) {
  const filePath = getCachePath(cacheKey);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function writeCache(cacheKey, value) {
  const dir = getCacheDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getCachePath(cacheKey), JSON.stringify(value, null, 2), "utf8");
}
