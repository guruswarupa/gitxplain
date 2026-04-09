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
  impact: "impact.txt",
  lines: "lines.txt",
  review: "review.txt",
  security: "security.txt"
};

function fillTemplate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, value);
  }, template);
}

function truncateDiff(diff, maxDiffLines) {
  const diffLines = diff.split("\n");

  if (diffLines.length <= maxDiffLines) {
    return {
      diff,
      truncated: false,
      diffLineCount: diffLines.length,
      keptDiffLines: diffLines.length,
      warning: null
    };
  }

  const keptLines = diffLines.slice(0, maxDiffLines);
  return {
    diff: `${keptLines.join("\n")}\n\n[Diff truncated: kept ${maxDiffLines} of ${diffLines.length} lines.]`,
    truncated: true,
    diffLineCount: diffLines.length,
    keptDiffLines: maxDiffLines,
    warning: `Diff truncated to ${maxDiffLines} of ${diffLines.length} lines before sending to the model.`
  };
}

function buildRangePrelude(commitData) {
  if (commitData.analysisType !== "range") {
    return "";
  }

  return [
    "This analysis covers a range of commits rather than a single commit.",
    "Treat the output like a changelog or release summary when appropriate.",
    `Commit Count: ${commitData.commitCount}`,
    `Commit List:\n${commitData.commits.map((commit) => `- ${commit.hash.slice(0, 7)} ${commit.subject}`).join("\n")}`,
    ""
  ].join("\n");
}

export function buildPrompt(mode, commitData, options = {}) {
  const filename = PROMPT_FILES[mode] ?? PROMPT_FILES.full;
  const template = readFileSync(path.join(PROMPT_DIR, filename), "utf8");
  const truncation = truncateDiff(commitData.diff, options.maxDiffLines ?? 800);
  const prompt = fillTemplate(`${buildRangePrelude(commitData)}${template}`, {
    commit_message: commitData.commitMessage,
    files_changed: commitData.filesChanged.join("\n"),
    stats: commitData.stats,
    diff: truncation.diff
  });

  return {
    prompt,
    promptMeta: {
      truncated: truncation.truncated,
      diffLineCount: truncation.diffLineCount,
      keptDiffLines: truncation.keptDiffLines,
      warnings: truncation.warning ? [truncation.warning] : []
    }
  };
}
