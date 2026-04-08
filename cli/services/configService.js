import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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

export function loadConfig(cwd) {
  const homeDir = os.homedir();
  const userConfigPath = path.join(homeDir, ".gitxplain", "config.json");
  const projectConfigPath = path.join(cwd, ".gitxplainrc");
  const projectJsonConfigPath = path.join(cwd, ".gitxplainrc.json");

  return {
    ...readJsonConfig(userConfigPath),
    ...readJsonConfig(projectConfigPath),
    ...readJsonConfig(projectJsonConfigPath)
  };
}
