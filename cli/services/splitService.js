import process from "node:process";
import {
  getCurrentHeadSha,
  gitAddFiles,
  gitCommit,
  gitResetSoft,
  gitUnstageAll,
  isWorkingTreeClean,
  runGitCommandUnchecked,
  resolveCommitSha
} from "./gitService.js";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  cyan: "\u001b[36m",
  yellow: "\u001b[33m",
  green: "\u001b[32m"
};

function supportsColor() {
  return Boolean(process.stdout?.isTTY) && process.env.NO_COLOR == null;
}

function colorize(text, color) {
  if (!supportsColor()) {
    return text;
  }

  return `${color}${text}${ANSI.reset}`;
}

function extractJsonPayload(explanation) {
  const fencedMatch = explanation.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const startIndex = explanation.indexOf("{");
  const endIndex = explanation.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error("Failed to parse split plan: no JSON object found in model response.");
  }

  return explanation.slice(startIndex, endIndex + 1);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validateCommitEntry(entry, index) {
  if (typeof entry !== "object" || entry == null || Array.isArray(entry)) {
    throw new Error(`Failed to parse split plan: commit ${index + 1} must be an object.`);
  }

  if (!Number.isInteger(entry.order)) {
    throw new Error(`Failed to parse split plan: commit ${index + 1} is missing a numeric order.`);
  }

  if (!isNonEmptyString(entry.message)) {
    throw new Error(`Failed to parse split plan: commit ${index + 1} is missing a message.`);
  }

  if (!Array.isArray(entry.files) || !entry.files.every(isNonEmptyString)) {
    throw new Error(`Failed to parse split plan: commit ${index + 1} must include a files array.`);
  }

  if (!isNonEmptyString(entry.description)) {
    throw new Error(`Failed to parse split plan: commit ${index + 1} is missing a description.`);
  }
}

export function parseSplitPlan(explanation) {
  let parsed;

  try {
    parsed = JSON.parse(extractJsonPayload(explanation));
  } catch (error) {
    throw new Error(`Failed to parse split plan JSON: ${error.message}`);
  }

  if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) {
    throw new Error("Failed to parse split plan: top-level JSON must be an object.");
  }

  if (!Object.hasOwn(parsed, "original_summary") || typeof parsed.original_summary !== "string") {
    throw new Error("Failed to parse split plan: missing original_summary string.");
  }

  if (
    !Object.hasOwn(parsed, "reason_to_split") ||
    (parsed.reason_to_split !== null && typeof parsed.reason_to_split !== "string")
  ) {
    throw new Error("Failed to parse split plan: reason_to_split must be a string or null.");
  }

  if (!Array.isArray(parsed.commits)) {
    throw new Error("Failed to parse split plan: commits must be an array.");
  }

  parsed.commits.forEach(validateCommitEntry);

  return parsed;
}

export function formatSplitPlan(plan) {
  const lines = [
    colorize("Split Plan", ANSI.bold + ANSI.cyan),
    `${colorize("Original Summary:", ANSI.bold + ANSI.cyan)} ${plan.original_summary}`,
    `${colorize("Reason To Split:", ANSI.bold + ANSI.cyan)} ${plan.reason_to_split ?? "Already atomic"}`
  ];

  if (plan.commits.length === 0) {
    lines.push(colorize("No split recommended.", ANSI.green));
    return lines.join("\n");
  }

  for (const commit of [...plan.commits].sort((left, right) => left.order - right.order)) {
    lines.push("");
    lines.push(colorize(`${commit.order}. ${commit.message}`, ANSI.bold + ANSI.yellow));
    lines.push(`${colorize("Files:", ANSI.bold + ANSI.cyan)} ${commit.files.join(", ")}`);
    lines.push(`${colorize("Why:", ANSI.bold + ANSI.cyan)} ${commit.description}`);
  }

  return lines.join("\n");
}

function buildRecoveryMessage(originalSha) {
  return [
    "Split execution failed. To recover:",
    `- Find the original commit in \`git reflog\` (expected SHA: ${originalSha})`,
    `- Restore it with \`git reset --hard ${originalSha}\``
  ].join("\n");
}

function getDirtyWorkingTreeSummary(cwd) {
  const result = runGitCommandUnchecked(["status", "--short"], cwd);
  if (result.exitCode !== 0 || result.stdout === "") {
    return null;
  }

  return result.stdout
    .split("\n")
    .filter(Boolean)
    .slice(0, 10)
    .join("\n");
}

export function executeSplit(plan, commitId, cwd) {
  const originalSha = resolveCommitSha(commitId, cwd);

  try {
    if (!isWorkingTreeClean(cwd)) {
      const dirtySummary = getDirtyWorkingTreeSummary(cwd);
      throw new Error(
        dirtySummary
          ? `Working tree must be clean before executing a split.\nUncommitted changes:\n${dirtySummary}`
          : "Working tree must be clean before executing a split."
      );
    }

    const headSha = getCurrentHeadSha(cwd);
    if (headSha !== originalSha) {
      throw new Error(
        `Can only split the current HEAD commit. Move ${commitId} to HEAD first with an interactive rebase.`
      );
    }

    gitResetSoft(cwd);

    for (const commit of [...plan.commits].sort((left, right) => left.order - right.order)) {
      gitUnstageAll(cwd);
      gitAddFiles(commit.files, cwd);
      gitCommit(commit.message, cwd);
    }
  } catch (error) {
    console.error(error.message);
    console.error(buildRecoveryMessage(originalSha));
    throw new Error("Split execution aborted.");
  }
}
