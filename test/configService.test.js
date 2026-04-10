import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyConfigEnvironment,
  getProviderApiKeyField,
  getUserConfigPath,
  loadUserConfig,
  updateUserConfig
} from "../cli/services/configService.js";

test("getProviderApiKeyField maps supported providers", () => {
  assert.equal(getProviderApiKeyField("openai"), "OPENAI_API_KEY");
  assert.equal(getProviderApiKeyField("groq"), "GROQ_API_KEY");
  assert.equal(getProviderApiKeyField("openrouter"), "OPENROUTER_API_KEY");
  assert.equal(getProviderApiKeyField("gemini"), "GEMINI_API_KEY");
  assert.equal(getProviderApiKeyField("ollama"), "OLLAMA_API_KEY");
  assert.equal(getProviderApiKeyField("chutes"), "CHUTES_API_KEY");
  assert.equal(getProviderApiKeyField("unknown"), null);
});

test("applyConfigEnvironment loads env-style keys without overwriting existing env", () => {
  const originalProvider = process.env.LLM_PROVIDER;
  const originalApiKey = process.env.OPENAI_API_KEY;

  try {
    delete process.env.LLM_PROVIDER;
    process.env.OPENAI_API_KEY = "already-set";

    applyConfigEnvironment({
      LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "from-config",
      provider: "ignored"
    });

    assert.equal(process.env.LLM_PROVIDER, "openai");
    assert.equal(process.env.OPENAI_API_KEY, "already-set");
  } finally {
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }

    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  }
});

test("updateUserConfig persists user config in the home directory", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "gitxplain-config-"));
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;

  try {
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;

    const { configPath, config } = updateUserConfig({
      provider: "openai",
      OPENAI_API_KEY: "test-key"
    });

    assert.equal(configPath, path.join(tempHome, ".gitxplain", "config.json"));
    assert.deepEqual(config, {
      provider: "openai",
      OPENAI_API_KEY: "test-key"
    });
    assert.deepEqual(loadUserConfig(), config);
    assert.equal(getUserConfigPath(), configPath);
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
