import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearCache,
  createCacheKey,
  getCacheDirectory,
  readCache,
  writeCache
} from "../cli/services/cacheService.js";

test("writeCache and readCache round-trip values", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "gitxplain-cache-home-"));
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;

  try {
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;

    const cacheKey = createCacheKey({ prompt: "summary", ref: "HEAD" });
    const value = {
      explanation: "Hello from cache",
      responseMeta: { provider: "openai", model: "gpt-4.1-mini", cacheHit: false, latencyMs: 12 }
    };

    writeCache(cacheKey, value);

    assert.deepEqual(readCache(cacheKey), value);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }

    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("clearCache removes cached files and returns deleted entry count", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "gitxplain-cache-clear-"));
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;

  try {
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;

    writeCache(createCacheKey({ prompt: "one" }), { explanation: "1", responseMeta: { provider: "openai", model: "m", cacheHit: false, latencyMs: 1 } });
    writeCache(createCacheKey({ prompt: "two" }), { explanation: "2", responseMeta: { provider: "openai", model: "m", cacheHit: false, latencyMs: 1 } });

    const deletedCount = clearCache();

    assert.equal(deletedCount, 2);
    assert.equal(fs.existsSync(getCacheDirectory()), false);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }

    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
