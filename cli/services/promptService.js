import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPT_DIR = path.resolve(__dirname, "../../prompts");

const PROMPT_FILES = {
  full: "master.txt",
  summary: "summary.txt",
  issues: "issue.txt",
  fix: "junior.txt",
  impact: "impact.txt"
};

function fillTemplate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, value);
  }, template);
}

export function buildPrompt(mode, commitData) {
  const filename = PROMPT_FILES[mode] ?? PROMPT_FILES.full;
  const template = readFileSync(path.join(PROMPT_DIR, filename), "utf8");

  return fillTemplate(template, {
    commit_message: commitData.commitMessage,
    files_changed: commitData.filesChanged.join("\n"),
    stats: commitData.stats,
    diff: commitData.diff
  });
}
