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
  security: "security.txt",
  split: "split.txt",
  commit: "commit.txt",
  changelog: "changelog.txt",
  refactor: "refactor.txt",
  "test-suggest": "test-suggest.txt",
  "pr-description": "pr-description.txt",
  blame: "blame.txt",
  stash: "stash.txt",
  conflict: "conflict.txt"
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

function isDiffMetadataLine(line) {
  return (
    line.startsWith("diff --git ") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("@@ ")
  );
}

function stripCommentPrefix(line) {
  return line.replace(/^(?:\/\/+|\/\*+|\*+\/?|\#+|<!--|-->|;+)/, "").trim();
}

function isCommentLikeLine(line) {
  const trimmed = line.trim();

  if (trimmed === "") {
    return true;
  }

  if (/^(?:\/\/+|\/\*+|\*+\/?|\#+|<!--|-->|;+)/.test(trimmed)) {
    return true;
  }

  return false;
}

function classifyDiff(diff) {
  const addedOrRemovedLines = diff
    .split("\n")
    .filter((line) => (line.startsWith("+") || line.startsWith("-")) && !isDiffMetadataLine(line))
    .map((line) => line.slice(1));

  if (addedOrRemovedLines.length === 0) {
    return {
      summary: "No content changes detected beyond diff metadata."
    };
  }

  const nonCommentLines = addedOrRemovedLines.filter((line) => {
    if (isCommentLikeLine(line)) {
      return false;
    }

    return stripCommentPrefix(line) !== "";
  });

  if (nonCommentLines.length === 0) {
    return {
      summary:
        "All changed lines appear to be comments or whitespace. Treat this as a non-behavioral documentation/annotation update unless the diff proves otherwise."
    };
  }

  return {
    summary: "Changed lines include executable or data content. Do not assume the edit is comments-only."
  };
}

export function buildPrompt(mode, commitData, options = {}) {
  const filename = PROMPT_FILES[mode] ?? PROMPT_FILES.full;
  const template = readFileSync(path.join(PROMPT_DIR, filename), "utf8");
  const truncation = truncateDiff(commitData.diff, options.maxDiffLines ?? 800);
  const diffClassification = classifyDiff(truncation.diff);
  const prompt = fillTemplate(`${buildRangePrelude(commitData)}${template}`, {
    commit_message: commitData.commitMessage,
    files_changed: commitData.filesChanged.join("\n"),
    stats: commitData.stats,
    diff: truncation.diff,
    change_hints: diffClassification.summary
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
