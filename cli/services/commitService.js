import process from "node:process";
import {
  deletePaths,
  fetchWorkingTreeData,
  getCurrentHeadSha,
  gitAddAll,
  gitAddFiles,
  gitCommit,
  gitResetHard,
  gitStashApply,
  gitStashDrop,
  gitStashPush,
  gitUnstageAll,
  getLatestStashRef,
  hasStagedChanges,
  isWorkingTreeClean,
  pathExistsInRef,
  resolveTreeSha,
  writeCurrentIndexTree
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
    throw new Error("Failed to parse commit plan: no JSON object found in model response.");
  }

  return explanation.slice(startIndex, endIndex + 1);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validateCommitEntry(entry, index) {
  if (typeof entry !== "object" || entry == null || Array.isArray(entry)) {
    throw new Error(`Failed to parse commit plan: commit ${index + 1} must be an object.`);
  }

  if (!Number.isInteger(entry.order)) {
    throw new Error(`Failed to parse commit plan: commit ${index + 1} is missing a numeric order.`);
  }

  if (!isNonEmptyString(entry.message)) {
    throw new Error(`Failed to parse commit plan: commit ${index + 1} is missing a message.`);
  }

  if (!Array.isArray(entry.files) || !entry.files.every(isNonEmptyString)) {
    throw new Error(`Failed to parse commit plan: commit ${index + 1} must include a files array.`);
  }

  if (!isNonEmptyString(entry.description)) {
    throw new Error(`Failed to parse commit plan: commit ${index + 1} is missing a description.`);
  }
}

function validateUniqueFileAssignments(commits, errorPrefix) {
  const seenFiles = new Map();

  for (const commit of commits) {
    for (const file of commit.files) {
      const previousOrder = seenFiles.get(file);
      if (previousOrder != null) {
        throw new Error(
          `${errorPrefix}: file "${file}" appears in both commit ${previousOrder} and commit ${commit.order}.`
        );
      }

      seenFiles.set(file, commit.order);
    }
  }
}

function normalizeCommitPlan(plan) {
  const seenFiles = new Set();
  const normalizedCommits = [];
  const dedupedFiles = [];

  for (const commit of sortPlanCommits(plan)) {
    const files = [];

    for (const file of commit.files) {
      if (seenFiles.has(file)) {
        dedupedFiles.push(file);
        continue;
      }

      seenFiles.add(file);
      files.push(file);
    }

    if (files.length === 0) {
      continue;
    }

    normalizedCommits.push({
      ...commit,
      files
    });
  }

  return {
    ...plan,
    commits: normalizedCommits.map((commit, index) => ({
      ...commit,
      order: index + 1
    })),
    warnings:
      dedupedFiles.length > 0
        ? [
            `Duplicate file assignments were removed from later commit groups: ${[...new Set(dedupedFiles)].join(", ")}.`
          ]
        : []
  };
}

function sortPlanCommits(plan) {
  return [...plan.commits].sort((left, right) => left.order - right.order);
}

function getPlanFiles(plan) {
  return [...new Set(sortPlanCommits(plan).flatMap((commit) => commit.files))];
}

function summarizeFileKinds(files) {
  if (files.every((file) => file.startsWith("test/") || file.endsWith(".test.js"))) {
    return {
      message: "test: include remaining test updates",
      description: "Captures remaining test file changes that were not assigned to an earlier commit."
    };
  }

  if (files.every((file) => file.startsWith("docs/") || file.toLowerCase() === "readme.md")) {
    return {
      message: "docs: include remaining documentation updates",
      description: "Captures remaining documentation changes that were not assigned to an earlier commit."
    };
  }

  return {
    message: "chore: include remaining working tree changes",
    description: "Captures files that were changed in the working tree but were not assigned to an earlier commit group."
  };
}

function buildCoverageDetails(plan, cwd) {
  const workingTreeData = fetchWorkingTreeData(cwd);
  const changedFiles = new Set(workingTreeData.filesChanged);
  const plannedFiles = new Set(getPlanFiles(plan));

  return {
    changedFiles: workingTreeData.filesChanged,
    missingFiles: [...changedFiles].filter((file) => !plannedFiles.has(file)),
    extraFiles: [...plannedFiles].filter((file) => !changedFiles.has(file))
  };
}

export function reconcileCommitPlan(plan, cwd) {
  const { missingFiles, extraFiles } = buildCoverageDetails(plan, cwd);
  const warnings = [...(plan.warnings ?? [])];
  let commits = sortPlanCommits(plan).map((commit) => ({ ...commit, files: [...commit.files] }));

  if (extraFiles.length > 0) {
    warnings.push(`Files not present in the working tree were removed from the plan: ${extraFiles.join(", ")}.`);
    commits = commits
      .map((commit) => ({
        ...commit,
        files: commit.files.filter((file) => !extraFiles.includes(file))
      }))
      .filter((commit) => commit.files.length > 0);
  }

  if (missingFiles.length > 0) {
    const fallback = summarizeFileKinds(missingFiles);
    warnings.push(`Missing files were added to a final fallback commit: ${missingFiles.join(", ")}.`);
    commits.push({
      order: commits.length + 1,
      message: fallback.message,
      files: missingFiles,
      description: fallback.description
    });
  }

  return {
    ...plan,
    commits: commits.map((commit, index) => ({ ...commit, order: index + 1 })),
    warnings
  };
}

function validatePlanCoverage(plan, cwd) {
  const { missingFiles, extraFiles } = buildCoverageDetails(plan, cwd);

  if (missingFiles.length === 0 && extraFiles.length === 0) {
    return;
  }

  const details = [];
  if (missingFiles.length > 0) {
    details.push(`Missing files: ${missingFiles.join(", ")}`);
  }

  if (extraFiles.length > 0) {
    details.push(`Unexpected files: ${extraFiles.join(", ")}`);
  }

  throw new Error(`Commit plan must cover each changed file exactly once. ${details.join(". ")}`);
}

function getFilesAbsentFromRef(files, ref, cwd) {
  return files.filter((file) => !pathExistsInRef(ref, file, cwd));
}

function buildRecoveryMessage(originalHeadSha, stashRef) {
  const lines = [
    "Commit execution failed. To recover:",
    `- Reset back to the original HEAD with \`git reset --hard ${originalHeadSha}\``
  ];

  if (stashRef) {
    lines.push(`- Reapply your original working tree with \`git stash apply --index ${stashRef}\``);
  }

  return lines.join("\n");
}

export function parseCommitPlan(explanation) {
  let parsed;

  try {
    parsed = JSON.parse(extractJsonPayload(explanation));
  } catch (error) {
    throw new Error(`Failed to parse commit plan JSON: ${error.message}`);
  }

  if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) {
    throw new Error("Failed to parse commit plan: top-level JSON must be an object.");
  }

  if (!Object.hasOwn(parsed, "working_tree_summary") || typeof parsed.working_tree_summary !== "string") {
    throw new Error("Failed to parse commit plan: missing working_tree_summary string.");
  }

  if (
    !Object.hasOwn(parsed, "reason_to_commit") ||
    (parsed.reason_to_commit !== null && typeof parsed.reason_to_commit !== "string")
  ) {
    throw new Error("Failed to parse commit plan: reason_to_commit must be a string or null.");
  }

  if (!Array.isArray(parsed.commits)) {
    throw new Error("Failed to parse commit plan: commits must be an array.");
  }

  parsed.commits.forEach(validateCommitEntry);
  return normalizeCommitPlan(parsed);
}

export function formatCommitPlan(plan) {
  const lines = [
    colorize("Commit Plan", ANSI.bold + ANSI.cyan),
    `${colorize("Working Tree Summary:", ANSI.bold + ANSI.cyan)} ${plan.working_tree_summary}`,
    `${colorize("Reason To Commit:", ANSI.bold + ANSI.cyan)} ${plan.reason_to_commit ?? "No commit needed"}`
  ];

  if (plan.warnings?.length) {
    lines.push(...plan.warnings.map((warning) => `${colorize("Warning:", ANSI.bold + ANSI.yellow)} ${warning}`));
  }

  if (plan.commits.length === 0) {
    lines.push(colorize("No commit recommended.", ANSI.green));
    return lines.join("\n");
  }

  for (const commit of sortPlanCommits(plan)) {
    lines.push("");
    lines.push(colorize(`${commit.order}. ${commit.message}`, ANSI.bold + ANSI.yellow));
    lines.push(`${colorize("Files:", ANSI.bold + ANSI.cyan)} ${commit.files.join(", ")}`);
    lines.push(`${colorize("Why:", ANSI.bold + ANSI.cyan)} ${commit.description}`);
  }

  return lines.join("\n");
}

export function executeCommitPlan(plan, cwd) {
  if (isWorkingTreeClean(cwd)) {
    throw new Error("Working tree is already clean. Nothing to commit.");
  }

  validatePlanCoverage(plan, cwd);

  const originalHeadSha = getCurrentHeadSha(cwd);
  const newFiles = getFilesAbsentFromRef(getPlanFiles(plan), originalHeadSha, cwd);
  let stashRef = null;

  try {
    gitStashPush("gitxplain-autocommit-backup", cwd);
    stashRef = getLatestStashRef(cwd);

    if (!stashRef) {
      throw new Error("Failed to create a backup stash before committing.");
    }

    gitStashApply(stashRef, cwd);
    gitAddAll(cwd);
    const expectedTreeSha = writeCurrentIndexTree(cwd);
    gitUnstageAll(cwd);

    for (const commit of sortPlanCommits(plan)) {
      gitAddFiles(commit.files, cwd);

      if (!hasStagedChanges(cwd)) {
        throw new Error(
          `Commit plan execution failed: commit ${commit.order} (${commit.message}) does not stage any new changes.`
        );
      }

      gitCommit(commit.message, cwd);
    }

    const finalHeadTreeSha = resolveTreeSha("HEAD", cwd);
    if (finalHeadTreeSha !== expectedTreeSha) {
      throw new Error(
        "Commit verification failed: the rewritten HEAD tree does not match the original working tree."
      );
    }

    gitStashDrop(stashRef, cwd);
  } catch (error) {
    gitResetHard(originalHeadSha, cwd);

    if (newFiles.length > 0) {
      try {
        deletePaths(newFiles, cwd);
      } catch {
        console.error("Failed to remove temporary untracked files created during commit execution.");
      }
    }

    if (stashRef) {
      try {
        gitStashApply(stashRef, cwd);
      } catch {
        console.error("Failed to automatically restore the original working tree from the backup stash.");
      }
    }

    console.error(error.message);
    console.error(buildRecoveryMessage(originalHeadSha, stashRef));
    throw new Error("Commit execution aborted.");
  }
}
