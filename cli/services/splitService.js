import process from "node:process";
import {
  getCommitParents,
  getCurrentHeadSha,
  gitCherryPick,
  gitCherryPickAbort,
  gitCherryPickNoCommit,
  gitAddFiles,
  gitCommit,
  gitResetHard,
  gitUnstageAll,
  hasStagedChanges,
  isAncestorCommit,
  isWorkingTreeClean,
  listCommitsAfter,
  resolveTreeSha,
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

function validateUniqueFileAssignments(commits) {
  const seenFiles = new Map();

  for (const commit of commits) {
    for (const file of commit.files) {
      const previousOrder = seenFiles.get(file);
      if (previousOrder != null) {
        throw new Error(
          `Failed to parse split plan: file "${file}" appears in both commit ${previousOrder} and commit ${commit.order}.`
        );
      }

      seenFiles.set(file, commit.order);
    }
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
  validateUniqueFileAssignments(parsed.commits);

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

function buildRecoveryMessage(originalHeadSha) {
  return [
    "Split execution failed. To recover:",
    `- Find the original HEAD in \`git reflog\` (expected SHA: ${originalHeadSha})`,
    `- Restore it with \`git reset --hard ${originalHeadSha}\``
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

function sortPlanCommits(plan) {
  return [...plan.commits].sort((left, right) => left.order - right.order);
}

export function executeSplit(plan, commitId, cwd) {
  const targetSha = resolveCommitSha(commitId, cwd);
  const originalHeadSha = getCurrentHeadSha(cwd);
  const originalHeadTreeSha = resolveTreeSha("HEAD", cwd);
  const orderedCommits = sortPlanCommits(plan);

  try {
    if (!isWorkingTreeClean(cwd)) {
      const dirtySummary = getDirtyWorkingTreeSummary(cwd);
      throw new Error(
        dirtySummary
          ? `Working tree must be clean before executing a split.\nUncommitted changes:\n${dirtySummary}`
          : "Working tree must be clean before executing a split."
      );
    }

    if (!isAncestorCommit(targetSha, originalHeadSha, cwd)) {
      throw new Error(`Commit ${commitId} is not reachable from the current HEAD.`);
    }

    const parents = getCommitParents(targetSha, cwd);
    if (parents.length !== 1) {
      throw new Error("Only non-merge commits can be split automatically.");
    }

    const [parentSha] = parents;
    const commitsToReplay = listCommitsAfter(targetSha, originalHeadSha, cwd);

    for (const replayCommit of commitsToReplay) {
      if (getCommitParents(replayCommit, cwd).length !== 1) {
        throw new Error(
          "Automatic split currently supports linear history only. Rebase merge commits manually first."
        );
      }
    }

    gitResetHard(parentSha, cwd);
    gitCherryPickNoCommit(targetSha, cwd);

    for (const commit of orderedCommits) {
      gitUnstageAll(cwd);
      gitAddFiles(commit.files, cwd);

      if (!hasStagedChanges(cwd)) {
        throw new Error(
          `Split plan execution failed: commit ${commit.order} (${commit.message}) does not stage any new changes.`
        );
      }

      gitCommit(commit.message, cwd);
    }

    for (const replayCommit of commitsToReplay) {
      gitCherryPick(replayCommit, cwd);
    }

    const rewrittenHeadTreeSha = resolveTreeSha("HEAD", cwd);
    if (rewrittenHeadTreeSha !== originalHeadTreeSha) {
      throw new Error(
        "Split verification failed: the rewritten HEAD tree does not match the original HEAD tree."
      );
    }
  } catch (error) {
    gitCherryPickAbort(cwd);
    runGitCommandUnchecked(["reset", "--hard", originalHeadSha], cwd);
    console.error(error.message);
    console.error(buildRecoveryMessage(originalHeadSha));
    throw new Error("Split execution aborted.");
  }
}
