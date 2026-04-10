import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendUsageRecord,
  clearUsageLog,
  estimateCostUsd,
  getUsageLogFile,
  getUsageStats,
  normalizeUsageMetrics,
  resolvePricing
} from "../cli/services/usageService.js";

test("normalizeUsageMetrics handles OpenAI and Gemini style usage payloads", () => {
  assert.deepEqual(
    normalizeUsageMetrics({ prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 }),
    { inputTokens: 10, outputTokens: 4, totalTokens: 14 }
  );

  assert.deepEqual(
    normalizeUsageMetrics({ promptTokenCount: 8, candidatesTokenCount: 3, totalTokenCount: 11 }),
    { inputTokens: 8, outputTokens: 3, totalTokens: 11 }
  );
});

test("resolvePricing reads configured token pricing from env", () => {
  const originalInput = process.env.OPENAI_INPUT_COST_PER_MTOK;
  const originalOutput = process.env.OPENAI_OUTPUT_COST_PER_MTOK;

  try {
    process.env.OPENAI_INPUT_COST_PER_MTOK = "0.15";
    process.env.OPENAI_OUTPUT_COST_PER_MTOK = "0.60";

    assert.deepEqual(resolvePricing({ provider: "openai", model: "gpt-4.1-mini" }), {
      inputPerMillion: 0.15,
      outputPerMillion: 0.60
    });
  } finally {
    if (originalInput == null) {
      delete process.env.OPENAI_INPUT_COST_PER_MTOK;
    } else {
      process.env.OPENAI_INPUT_COST_PER_MTOK = originalInput;
    }

    if (originalOutput == null) {
      delete process.env.OPENAI_OUTPUT_COST_PER_MTOK;
    } else {
      process.env.OPENAI_OUTPUT_COST_PER_MTOK = originalOutput;
    }
  }
});

test("estimateCostUsd computes cost from token counts", () => {
  const cost = estimateCostUsd(
    { prompt_tokens: 1000, completion_tokens: 500 },
    { inputPerMillion: 1, outputPerMillion: 2 }
  );

  assert.equal(cost, 0.002);
});

test("usage log persists cumulative stats across records", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "gitxplain-usage-"));
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;

  try {
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;

    appendUsageRecord({
      provider: "openai",
      model: "gpt-4.1-mini",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      latencyMs: 120,
      estimatedCostUsd: 0.0001
    });
    appendUsageRecord({
      provider: "anthropic",
      model: "claude-3-5-haiku-latest",
      usage: { input_tokens: 4, output_tokens: 6 },
      latencyMs: 95,
      estimatedCostUsd: 0.0002
    });

    const stats = getUsageStats();

    assert.equal(stats.requestCount, 2);
    assert.equal(stats.inputTokens, 14);
    assert.equal(stats.outputTokens, 11);
    assert.equal(stats.totalTokens, 25);
    assert.equal(stats.estimatedCostUsd, 0.00030000000000000003);
    assert.equal(fs.existsSync(getUsageLogFile()), true);
    assert.equal(clearUsageLog(), 2);
  } finally {
    if (originalHome == null) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalUserProfile == null) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }

    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
