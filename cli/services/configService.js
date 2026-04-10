import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ENV_CONFIG_KEYS = new Set([
  "LLM_PROVIDER",
  "LLM_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_BASE_URL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "GROQ_BASE_URL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_SITE_URL",
  "OPENROUTER_APP_NAME",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_BASE_URL",
  "OLLAMA_API_KEY",
  "OLLAMA_MODEL",
  "OLLAMA_BASE_URL",
  "CHUTES_API_KEY",
  "CHUTES_MODEL",
  "CHUTES_BASE_URL"
]);

const PROVIDER_API_KEY_FIELDS = {
  openai: "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  gemini: "GEMINI_API_KEY",
  ollama: "OLLAMA_API_KEY",
  chutes: "CHUTES_API_KEY"
};

function readJsonConfig(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse config file ${filePath}: ${error.message}`);
  }
}

export function getUserConfigPath() {
  return path.join(os.homedir(), ".gitxplain", "config.json");
}

export function loadUserConfig() {
  return readJsonConfig(getUserConfigPath());
}

export function loadConfig(cwd) {
  const userConfigPath = getUserConfigPath();
  const projectConfigPath = path.join(cwd, ".gitxplainrc");
  const projectJsonConfigPath = path.join(cwd, ".gitxplainrc.json");

  return {
    ...readJsonConfig(userConfigPath),
    ...readJsonConfig(projectConfigPath),
    ...readJsonConfig(projectJsonConfigPath)
  };
}

export function applyConfigEnvironment(config) {
  for (const [key, value] of Object.entries(config)) {
    if (!ENV_CONFIG_KEYS.has(key)) {
      continue;
    }

    if (typeof value === "string" && value !== "" && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getProviderApiKeyField(provider) {
  const normalized = provider?.toLowerCase();
  return normalized ? PROVIDER_API_KEY_FIELDS[normalized] ?? null : null;
}

export function writeUserConfig(nextConfig) {
  const configPath = getUserConfigPath();
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return configPath;
}

export function updateUserConfig(updates) {
  const currentConfig = loadUserConfig();
  const nextConfig = { ...currentConfig, ...updates };
  const configPath = writeUserConfig(nextConfig);
  return { configPath, config: nextConfig };
}
