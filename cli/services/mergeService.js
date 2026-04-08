import process from "node:process";
import {
  getCurrentBranchName,
  getCurrentHeadSha,
  getDefaultBaseRef,
  getMergeBase,
  gitCheckout,
  gitCheckoutNewBranch,
  gitCherryPickNoCommit,
  gitCherryPickAbort,
  gitCommit,
  gitDeleteBranch,
  gitResetHard,
  isWorkingTreeClean,
  listBranchCommits,
  listCommitsAfter,
  localBranchExists,
  resolveCommitSha,
  runGitCommand
} from "./gitService.js";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  cyan: "\u001b[36m",
  yellow: "\u001b[33m",
  green: "\u001b[32m"
};

const RELEASE_BRANCH = "release";
const VERSION_PATTERN = /\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?\b/g;

function supportsColor() {
  return Boolean(process.stdout?.isTTY) && process.env.NO_COLOR == null;
}

function colorize(text, color) {
  if (!supportsColor()) {
    return text;
  }

  return `${color}${text}${ANSI.reset}`;
}

function unique(values) {
  return [...new Set(values)];
}

function extractVersions(line) {
  return unique(line.match(VERSION_PATTERN) ?? []);
}

function stripDiffPrefix(line) {
  return line.slice(1).trim();
}

export function detectVersionChanges(diff) {
  const removedVersions = [];
  const addedVersions = [];

  for (const line of diff.split("\n")) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith("-")) {
      removedVersions.push(...extractVersions(stripDiffPrefix(line)));
      continue;
    }

    if (line.startsWith("+")) {
      addedVersions.push(...extractVersions(stripDiffPrefix(line)));
    }
  }

  const removed = unique(removedVersions);
  const added = unique(addedVersions);
  const from = removed.filter((version) => !added.includes(version));
  const to = added.filter((version) => !removed.includes(version));

  return {
    from,
    to,
    hasVersionChange: from.length > 0 && to.length > 0
  };
}

function getCommitSubject(ref, cwd) {
  return runGitCommand(["log", "-1", "--pretty=format:%s", ref], cwd);
}

function getCommitFiles(ref, cwd) {
  const output = runGitCommand(["show", "--pretty=format:", "--name-only", ref], cwd);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCommitDiff(ref, cwd) {
  return runGitCommand(["show", "--format=", ref], cwd);
}

function inspectCommit(sha, cwd) {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    subject: getCommitSubject(sha, cwd),
    files: getCommitFiles(sha, cwd),
    versionChange: detectVersionChanges(getCommitDiff(sha, cwd))
  };
}

function summarizeVersionPair(change) {
  return `${change.from.join(", ")} -> ${change.to.join(", ")}`;
}

function getLatestVersionSummary(commits) {
  const latest = [...commits].reverse().find((commit) => commit.versionChange.hasVersionChange) ?? null;
  return latest ? summarizeVersionPair(latest.versionChange) : null;
}

function findLastVersionSummaryIndex(commits, targetSummary) {
  if (!targetSummary) {
    return -1;
  }

  for (let index = commits.length - 1; index >= 0; index -= 1) {
    const commit = commits[index];
    if (!commit.versionChange.hasVersionChange) {
      continue;
    }

    if (summarizeVersionPair(commit.versionChange) === targetSummary) {
      return index;
    }
  }

  return -1;
}

export function selectReleaseCommits(sourceCommits, lastReleasedVersionSummary = null) {
  const latestSourceVersionIndex = [...sourceCommits]
    .map((commit, index) => ({ commit, index }))
    .reverse()
    .find(({ commit }) => commit.versionChange.hasVersionChange)?.index ?? -1;

  const latestSourceVersionSummary =
    latestSourceVersionIndex === -1 ? null : summarizeVersionPair(sourceCommits[latestSourceVersionIndex].versionChange);
  const lastReleasedIndex = findLastVersionSummaryIndex(sourceCommits, lastReleasedVersionSummary);
  const startIndex = lastReleasedIndex + 1;
  const endIndex = sourceCommits.length - 1;

  if (startIndex > endIndex) {
    return {
      commitsToApply: [],
      latestSourceVersionSummary,
      lastReleasedVersionSummary,
      startIndex: -1,
      endIndex
    };
  }

  return {
    commitsToApply: sourceCommits.slice(startIndex, endIndex + 1),
    latestSourceVersionSummary,
    lastReleasedVersionSummary,
    startIndex,
    endIndex
  };
}

function buildReleaseMessage(plan) {
  return plan.latestSourceVersionSummary
    ? `release: promote ${plan.latestSourceVersionSummary}`
    : `release: sync ${plan.sourceBranch}`;
}

export function buildReleaseMergePlan(cwd) {
  const sourceBranch = getCurrentBranchName(cwd);
  if (sourceBranch === RELEASE_BRANCH) {
    throw new Error(`Already on "${RELEASE_BRANCH}". Switch to a source branch before running --merge.`);
  }

  const releaseExists = localBranchExists(RELEASE_BRANCH, cwd);
  const baseRef = releaseExists ? RELEASE_BRANCH : getDefaultBaseRef(cwd);
  const mergeBase = getMergeBase(baseRef, "HEAD", cwd);
  const sourceCommitShas = listCommitsAfter(mergeBase, "HEAD", cwd);
  const sourceCommits = sourceCommitShas.map((sha) => inspectCommit(sha, cwd));
  const releaseCommits = releaseExists ? listBranchCommits(RELEASE_BRANCH, cwd).map((sha) => inspectCommit(sha, cwd)) : [];
  const lastReleasedVersionSummary = getLatestVersionSummary(releaseCommits);
  const selection = selectReleaseCommits(sourceCommits, lastReleasedVersionSummary);

  return {
    releaseBranch: RELEASE_BRANCH,
    sourceBranch,
    baseRef,
    mergeBase,
    releaseExists,
    lastReleasedVersionSummary,
    latestSourceVersionSummary: selection.latestSourceVersionSummary,
    commits: selection.commitsToApply,
    startRef: selection.commitsToApply[0]?.shortSha ?? null,
    endRef: selection.commitsToApply.at(-1)?.shortSha ?? null,
    createFromRef: releaseExists ? RELEASE_BRANCH : mergeBase,
    releaseMessage: null
  };
}

export function finalizeReleaseMergePlan(plan) {
  return {
    ...plan,
    releaseMessage: plan.latestSourceVersionSummary ? buildReleaseMessage(plan) : null
  };
}

export function formatReleaseMergePlan(plan) {
  const lines = [
    colorize("Release Merge Plan", ANSI.bold + ANSI.cyan),
    `${colorize("Source Branch:", ANSI.bold + ANSI.cyan)} ${plan.sourceBranch}`,
    `${colorize("Target Branch:", ANSI.bold + ANSI.cyan)} ${plan.releaseBranch}`,
    `${colorize("Base Ref:", ANSI.bold + ANSI.cyan)} ${plan.baseRef}`,
    `${colorize("Last Released Version:", ANSI.bold + ANSI.cyan)} ${plan.lastReleasedVersionSummary ?? "none"}`,
    `${colorize("Latest Source Version:", ANSI.bold + ANSI.cyan)} ${plan.latestSourceVersionSummary ?? "none"}`
  ];

  if (plan.commits.length === 0) {
    lines.push(colorize("No unreleased commits detected. Nothing to merge.", ANSI.green));
    return lines.join("\n");
  }

  lines.push(`${colorize("Commit Range:", ANSI.bold + ANSI.cyan)} ${plan.startRef}..${plan.endRef}`);
  lines.push(`${colorize("Release Commit:", ANSI.bold + ANSI.cyan)} ${plan.releaseMessage}`);

  for (const commit of plan.commits) {
    lines.push("");
    lines.push(colorize(`${commit.shortSha} ${commit.subject}`, ANSI.bold + ANSI.yellow));
    if (commit.versionChange.hasVersionChange) {
      lines.push(`${colorize("Version:", ANSI.bold + ANSI.cyan)} ${summarizeVersionPair(commit.versionChange)}`);
    }
    lines.push(`${colorize("Files:", ANSI.bold + ANSI.cyan)} ${commit.files.join(", ")}`);
  }

  return lines.join("\n");
}

function buildRecoveryMessage({ originalBranch, originalReleaseSha, createdReleaseBranch }) {
  const lines = ["Release promotion failed. Recovery steps:"];

  if (createdReleaseBranch) {
    lines.push(`- Return to ${originalBranch} with \`git checkout ${originalBranch}\``);
    lines.push(`- Delete the temporary ${RELEASE_BRANCH} branch with \`git branch -D ${RELEASE_BRANCH}\``);
    return lines.join("\n");
  }

  lines.push(`- Reset ${RELEASE_BRANCH} back to ${originalReleaseSha} with \`git reset --hard ${originalReleaseSha}\``);
  lines.push(`- Return to ${originalBranch} with \`git checkout ${originalBranch}\``);
  return lines.join("\n");
}

export function executeReleaseMerge(plan, cwd) {
  if (plan.commits.length === 0) {
    throw new Error("No unreleased commits detected. Nothing to merge.");
  }

  if (!isWorkingTreeClean(cwd)) {
    throw new Error("Working tree must be clean before executing a release merge.");
  }

  const originalBranch = getCurrentBranchName(cwd);
  const releaseExists = localBranchExists(RELEASE_BRANCH, cwd);
  const originalReleaseSha = releaseExists ? resolveCommitSha(RELEASE_BRANCH, cwd) : null;
  const originalHeadSha = getCurrentHeadSha(cwd);

  try {
    if (releaseExists) {
      gitCheckout(RELEASE_BRANCH, cwd);
    } else {
      gitCheckoutNewBranch(RELEASE_BRANCH, plan.createFromRef, cwd);
    }

    for (const commit of plan.commits) {
      gitCherryPickNoCommit(commit.sha, cwd);
    }

    gitCommit(plan.releaseMessage, cwd);
  } catch (error) {
    gitCherryPickAbort(cwd);

    try {
      if (releaseExists) {
        gitResetHard(originalReleaseSha, cwd);
        gitCheckout(originalBranch, cwd);
      } else {
        gitCheckout(originalBranch, cwd);
        gitDeleteBranch(RELEASE_BRANCH, cwd);
      }
    } catch {
      // Keep the original error and show recovery guidance.
    }

    console.error(error.message);
    console.error(
      buildRecoveryMessage({
        originalBranch,
        originalReleaseSha,
        createdReleaseBranch: !releaseExists
      })
    );
    throw new Error("Release merge aborted.");
  }

  const updatedReleaseSha = getCurrentHeadSha(cwd);
  if (updatedReleaseSha === originalHeadSha) {
    throw new Error("Release merge did not create any new commits.");
  }
}

export { RELEASE_BRANCH };
