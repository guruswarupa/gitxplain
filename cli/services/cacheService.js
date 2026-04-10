import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_FILES = 200;

function getCacheDir() {
  return path.join(os.homedir(), ".gitxplain", "cache");
}

export function getCacheDirectory() {
  return getCacheDir();
}

export function createCacheKey(parts) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(parts));
  return hash.digest("hex");
}

function getCachePath(cacheKey) {
  return path.join(getCacheDir(), `${cacheKey}.json`);
}

function listCacheEntries() {
  const dir = getCacheDir();
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const filePath = path.join(dir, name);
      const stats = statSync(filePath);
      return {
        filePath,
        mtimeMs: stats.mtimeMs
      };
    })
    .sort((left, right) => left.mtimeMs - right.mtimeMs);
}

function isExpired(mtimeMs) {
  return Date.now() - mtimeMs > CACHE_TTL_MS;
}

function pruneCache() {
  const entries = listCacheEntries();

  for (const entry of entries.filter((item) => isExpired(item.mtimeMs))) {
    try {
      unlinkSync(entry.filePath);
    } catch {
      // Best-effort cleanup only.
    }
  }

  const remaining = listCacheEntries();
  const overflowCount = Math.max(0, remaining.length - MAX_CACHE_FILES);
  for (const entry of remaining.slice(0, overflowCount)) {
    try {
      unlinkSync(entry.filePath);
    } catch {
      // Best-effort cleanup only.
    }
  }
}

export function readCache(cacheKey) {
  const filePath = getCachePath(cacheKey);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const stats = statSync(filePath);
    if (isExpired(stats.mtimeMs)) {
      unlinkSync(filePath);
      return null;
    }

    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function writeCache(cacheKey, value) {
  const dir = getCacheDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getCachePath(cacheKey), JSON.stringify(value, null, 2), "utf8");
  pruneCache();
}

export function clearCache() {
  const dir = getCacheDir();
  const entries = listCacheEntries();

  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }

  return entries.length;
}
