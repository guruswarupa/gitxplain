import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnvFile(cwd = process.cwd()) {
  try {
    // Get the directory of the CLI installation
    const __filename = fileURLToPath(import.meta.url);
    const cliDir = path.dirname(__filename);
    const projectDir = path.dirname(path.dirname(cliDir));
    const envPath = path.join(projectDir, ".env");

    // Also check current working directory
    const cwdEnvPath = path.join(cwd, ".env");
    const finalEnvPath = fs.existsSync(envPath) ? envPath : (fs.existsSync(cwdEnvPath) ? cwdEnvPath : null);

    if (finalEnvPath && fs.existsSync(finalEnvPath)) {
      const envContent = fs.readFileSync(finalEnvPath, "utf8");
      envContent.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          const value = valueParts.join("=").replace(/^["']|["']$/g, "").trim();
          if (key && value && !process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch {
    // Silently ignore if .env file doesn't exist or can't be read
  }
}
