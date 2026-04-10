import test from "node:test";
import assert from "node:assert/strict";
import { getProviderConfig } from "../cli/services/aiService.js";

test("getProviderConfig supports anthropic", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  const originalModel = process.env.ANTHROPIC_MODEL;

  try {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.ANTHROPIC_MODEL = "claude-3-5-haiku-latest";

    const config = getProviderConfig("anthropic", null);
    assert.equal(config.provider, "anthropic");
    assert.equal(config.apiKey, "anthropic-key");
    assert.equal(config.model, "claude-3-5-haiku-latest");
  } finally {
    if (originalApiKey == null) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }

    if (originalModel == null) {
      delete process.env.ANTHROPIC_MODEL;
    } else {
      process.env.ANTHROPIC_MODEL = originalModel;
    }
  }
});

test("getProviderConfig supports mistral and azure-openai", () => {
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalAzureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const originalAzureBaseUrl = process.env.AZURE_OPENAI_BASE_URL;
  const originalAzureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  try {
    process.env.MISTRAL_API_KEY = "mistral-key";
    process.env.AZURE_OPENAI_API_KEY = "azure-key";
    process.env.AZURE_OPENAI_BASE_URL = "https://demo.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt4o-mini";

    const mistral = getProviderConfig("mistral", null);
    const azure = getProviderConfig("azure-openai", null);

    assert.equal(mistral.provider, "mistral");
    assert.equal(mistral.apiKey, "mistral-key");
    assert.equal(azure.provider, "azure-openai");
    assert.equal(azure.apiKey, "azure-key");
    assert.equal(azure.baseUrl, "https://demo.openai.azure.com");
    assert.equal(azure.deployment, "gpt4o-mini");
  } finally {
    if (originalMistralApiKey == null) {
      delete process.env.MISTRAL_API_KEY;
    } else {
      process.env.MISTRAL_API_KEY = originalMistralApiKey;
    }

    if (originalAzureApiKey == null) {
      delete process.env.AZURE_OPENAI_API_KEY;
    } else {
      process.env.AZURE_OPENAI_API_KEY = originalAzureApiKey;
    }

    if (originalAzureBaseUrl == null) {
      delete process.env.AZURE_OPENAI_BASE_URL;
    } else {
      process.env.AZURE_OPENAI_BASE_URL = originalAzureBaseUrl;
    }

    if (originalAzureDeployment == null) {
      delete process.env.AZURE_OPENAI_DEPLOYMENT;
    } else {
      process.env.AZURE_OPENAI_DEPLOYMENT = originalAzureDeployment;
    }
  }
});
