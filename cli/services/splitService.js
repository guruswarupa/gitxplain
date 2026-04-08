import process from "node:process";
import {
  deletePaths,
  getCommitParents,
  getCurrentBranchName,
  getCurrentHeadSha,
  gitCherryPick,
  gitCherryPickAbort,
  gitCherryPickNoCommit,
  gitAddFiles,
  gitCreateBranch,
  gitCheckout,
  gitCheckoutDetached,
  gitCheckoutOrphan,
  gitCommit,
  gitDeleteBranch,
  gitForceBranch,
  gitRemoveCachedAll,
  gitRebaseAbort,
  gitRebaseRebaseMergesOnto,
  gitResetHard,
  gitUnstageAll,
  hasStagedChanges,
  isAncestorCommit,
  isWorkingTreeClean,
  listCommitsAfter,
  listFilesInRef,
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

function sortPlanCommits(plan) {
  return [...plan.commits].sort((left, right) => left.order - right.order);
}

function normalizeSplitPlan(plan) {
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
            `Duplicate file assignments were removed from later split groups: ${[...new Set(dedupedFiles)].join(", ")}.`
          ]
        : []
  };
}

function getPlanFiles(plan) {
  return [...new Set(sortPlanCommits(plan).flatMap((commit) => commit.files))];
}

function summarizeFileKinds(files) {
  if (files.every((file) => file.startsWith("test/") || file.endsWith(".test.js"))) {
    return {
      message: "test: include remaining test updates",
      description: "Captures remaining test file changes that were not assigned to an earlier split group."
    };
  }

  if (files.every((file) => file.startsWith("docs/") || file.toLowerCase() === "readme.md")) {
    return {
      message: "docs: include remaining documentation updates",
      description: "Captures remaining documentation changes that were not assigned to an earlier split group."
    };
  }

  return {
    message: "chore: include remaining commit changes",
    description: "Captures files from the original commit that were not assigned to an earlier split group."
  };
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

  return normalizeSplitPlan(parsed);
}

export function reconcileSplitPlan(plan, filesChanged) {
  const commitFiles = [...new Set(filesChanged)];
  const commitFileSet = new Set(commitFiles);
  const plannedFiles = getPlanFiles(plan);
  const extraFiles = plannedFiles.filter((file) => !commitFileSet.has(file));
  const missingFiles = commitFiles.filter((file) => !plannedFiles.includes(file));
  const warnings = [...(plan.warnings ?? [])];
  let commits = sortPlanCommits(plan).map((commit) => ({ ...commit, files: [...commit.files] }));

  if (extraFiles.length > 0) {
    warnings.push(`Files not present in the target commit were removed from the split plan: ${extraFiles.join(", ")}.`);
    commits = commits
      .map((commit) => ({
        ...commit,
        files: commit.files.filter((file) => !extraFiles.includes(file))
      }))
      .filter((commit) => commit.files.length > 0);
  }

  if (missingFiles.length > 0) {
    const fallback = summarizeFileKinds(missingFiles);
    warnings.push(`Missing files were added to a final fallback split group: ${missingFiles.join(", ")}.`);
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

export function formatSplitPlan(plan) {
  const lines = [
    colorize("Split Plan", ANSI.bold + ANSI.cyan),
    `${colorize("Original Summary:", ANSI.bold + ANSI.cyan)} ${plan.original_summary}`,
    `${colorize("Reason To Split:", ANSI.bold + ANSI.cyan)} ${plan.reason_to_split ?? "Already atomic"}`
  ];

  for (const warning of plan.warnings ?? []) {
    lines.push(`${colorize("Warning:", ANSI.bold + ANSI.yellow)} ${warning}`);
  }

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

export function validateSplitExecutionTarget(
  commitId,
  cwd,
  helpers = {
    resolveCommitSha,
    getCurrentHeadSha,
    getCommitParents,
    isAncestorCommit
  }
) {
  const targetSha = helpers.resolveCommitSha(commitId, cwd);
  const currentHeadSha = helpers.getCurrentHeadSha(cwd);

  if (!helpers.isAncestorCommit(targetSha, currentHeadSha, cwd)) {
    throw new Error(`Commit ${commitId} is not reachable from the current HEAD.`);
  }

  const parents = helpers.getCommitParents(targetSha, cwd);
  if (parents.length > 1) {
    throw new Error("Automatic split execution only supports non-merge commits.");
  }

  return {
    targetSha,
    currentHeadSha,
    parentSha: parents[0] ?? null,
    isHeadTarget: targetSha === currentHeadSha
  };
}

function createTempRootSplitBranchName() {
  return `gitxplain-split-root-${Date.now()}`;
}

function createTempReplayBranchName() {
  return `gitxplain-split-replay-${Date.now()}`;
}

function restoreOriginalPointer(originalBranch, originalHeadSha, cwd) {
  if (originalBranch === "HEAD") {
    gitCheckoutDetached(originalHeadSha, cwd);
    return;
  }

  gitCheckout(originalBranch, cwd);
  gitResetHard(originalHeadSha, cwd);
}

function finalizeRootSplitBranch(tempBranch, originalBranch, rewrittenHeadSha, cwd) {
  if (originalBranch === "HEAD") {
    gitCheckoutDetached(rewrittenHeadSha, cwd);
    gitDeleteBranch(tempBranch, cwd);
    return;
  }

  gitForceBranch(originalBranch, rewrittenHeadSha, cwd);
  gitCheckout(originalBranch, cwd);
  gitDeleteBranch(tempBranch, cwd);
}

function replayDescendantsOntoSplitTip(
  replayBranch,
  splitTipSha,
  targetSha,
  originalHeadSha,
  expectedTreeSha,
  cwd
) {
  const strategies = [null, "theirs", "ours"];
  let lastError = null;

  for (const strategy of strategies) {
    gitCheckout(replayBranch, cwd);
    gitResetHard(originalHeadSha, cwd);

    try {
      gitRebaseRebaseMergesOnto(splitTipSha, targetSha, cwd, strategy);
      const replayedTreeSha = resolveTreeSha("HEAD", cwd);

      if (replayedTreeSha === expectedTreeSha) {
        return getCurrentHeadSha(cwd);
      }

      lastError = new Error(
        `Replay strategy ${strategy ?? "default"} completed, but the rewritten HEAD tree did not match the original HEAD tree.`
      );
    } catch (error) {
      lastError = error;
    }

    gitRebaseAbort(cwd);
  }

  throw lastError ?? new Error("Failed to replay descendant commits after split.");
}

export function executeSplit(plan, commitId, cwd) {
  const { targetSha, currentHeadSha, parentSha } = validateSplitExecutionTarget(commitId, cwd);
  const originalHeadSha = currentHeadSha;
  const originalHeadTreeSha = resolveTreeSha("HEAD", cwd);
  const orderedCommits = sortPlanCommits(plan);
  const originalBranch = getCurrentBranchName(cwd);
  let rootSplitTempBranch = null;
  let rootSplitOriginalBranch = null;
  let replayTempBranch = null;

  try {
    if (!isWorkingTreeClean(cwd)) {
      const dirtySummary = getDirtyWorkingTreeSummary(cwd);
      throw new Error(
        dirtySummary
          ? `Working tree must be clean before executing a split.\nUncommitted changes:\n${dirtySummary}`
          : "Working tree must be clean before executing a split."
      );
    }

    const commitsToReplay = listCommitsAfter(targetSha, originalHeadSha, cwd);
    replayTempBranch = createTempReplayBranchName();
    gitCreateBranch(replayTempBranch, originalHeadSha, cwd);

    if (parentSha == null) {
      const tempBranch = createTempRootSplitBranchName();
      const originalHeadFiles = listFilesInRef("HEAD", cwd);
      rootSplitOriginalBranch = originalBranch;
      rootSplitTempBranch = tempBranch;

      gitCheckoutOrphan(tempBranch, cwd);
      gitRemoveCachedAll(cwd);
      deletePaths(originalHeadFiles, cwd);
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
    } else {
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
    }

    const splitTipSha = getCurrentHeadSha(cwd);

    if (commitsToReplay.length > 0) {
      const rewrittenReplayHeadSha = replayDescendantsOntoSplitTip(
        replayTempBranch,
        splitTipSha,
        targetSha,
        originalHeadSha,
        originalHeadTreeSha,
        cwd
      );

      if (rootSplitTempBranch) {
        finalizeRootSplitBranch(rootSplitTempBranch, rootSplitOriginalBranch, rewrittenReplayHeadSha, cwd);
      } else {
        if (originalBranch !== "HEAD") {
          gitForceBranch(originalBranch, rewrittenReplayHeadSha, cwd);
          gitCheckout(originalBranch, cwd);
        } else {
          gitCheckoutDetached(rewrittenReplayHeadSha, cwd);
        }
      }
    } else if (rootSplitTempBranch) {
      finalizeRootSplitBranch(rootSplitTempBranch, rootSplitOriginalBranch, splitTipSha, cwd);
    } else if (originalBranch === "HEAD") {
      gitCheckoutDetached(splitTipSha, cwd);
    }

    const rewrittenHeadTreeSha = resolveTreeSha("HEAD", cwd);
    if (rewrittenHeadTreeSha !== originalHeadTreeSha) {
      throw new Error(
        "Split verification failed: the rewritten HEAD tree does not match the original HEAD tree."
      );
    }
  } catch (error) {
    gitCherryPickAbort(cwd);
    gitRebaseAbort(cwd);

    try {
      if (rootSplitTempBranch) {
        restoreOriginalPointer(rootSplitOriginalBranch ?? "HEAD", originalHeadSha, cwd);
        gitDeleteBranch(rootSplitTempBranch, cwd);
      } else if (replayTempBranch) {
        restoreOriginalPointer(originalBranch, originalHeadSha, cwd);
      } else {
        runGitCommandUnchecked(["reset", "--hard", originalHeadSha], cwd);
      }
    } catch {
      runGitCommandUnchecked(["reset", "--hard", originalHeadSha], cwd);
    }

    console.error(error.message);
    console.error(buildRecoveryMessage(originalHeadSha));
    throw new Error("Split execution aborted.");
  } finally {
    if (replayTempBranch) {
      try {
        const currentBranch = getCurrentBranchName(cwd);
        if (currentBranch !== replayTempBranch) {
          gitDeleteBranch(replayTempBranch, cwd);
        }
      } catch {
        // Best-effort cleanup for the temporary replay branch.
      }
    }
  }
}
