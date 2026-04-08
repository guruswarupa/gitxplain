import process from "node:process";
import {
  createEmptyRootCommit,
  getCurrentBranchName,
  getCurrentHeadSha,
  getDefaultBaseRef,
  getMergeBase,
  gitCheckout,
  gitCheckoutNewBranch,
  gitCherryPickAbort,
  gitCherryPickNoCommit,
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
const RELEASE_SUBJECT_PATTERN = /^release\s+(.+)$/i;

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

function getReleaseVersion(change) {
  return change.to.at(-1) ?? null;
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
  const subject = getCommitSubject(sha, cwd);
  const versionChange = detectVersionChanges(getCommitDiff(sha, cwd));

  return {
    sha,
    shortSha: sha.slice(0, 7),
    subject,
    files: getCommitFiles(sha, cwd),
    versionChange,
    releaseVersion: getReleaseVersion(versionChange)
  };
}

function summarizeVersionPair(change) {
  return `${change.from.join(", ")} -> ${change.to.join(", ")}`;
}

function getReleasedVersions(releaseCommits) {
  const explicitVersions = releaseCommits
    .map((commit) => commit.subject.match(RELEASE_SUBJECT_PATTERN)?.[1]?.trim() ?? null)
    .filter(Boolean);

  const fallbackVersions = releaseCommits
    .map((commit) => commit.releaseVersion)
    .filter(Boolean);

  return new Set([...explicitVersions, ...fallbackVersions]);
}

export function buildReleaseWindows(sourceCommits) {
  const windows = [];
  let windowStartIndex = 0;
  let activeVersion = null;

  for (let index = 0; index < sourceCommits.length; index += 1) {
    const commit = sourceCommits[index];
    if (!commit.releaseVersion) {
      continue;
    }

    if (activeVersion == null) {
      activeVersion = commit.releaseVersion;
      continue;
    }

    if (commit.releaseVersion === activeVersion) {
      continue;
    }

    const previousIndex = index - 1;
    windows.push({
      version: activeVersion,
      commits: sourceCommits.slice(windowStartIndex, previousIndex + 1),
      startRef: sourceCommits[windowStartIndex]?.shortSha ?? null,
      endRef: sourceCommits[previousIndex]?.shortSha ?? null
    });
    windowStartIndex = index;
    activeVersion = commit.releaseVersion;
  }

  if (activeVersion != null) {
    windows.push({
      version: activeVersion,
      commits: sourceCommits.slice(windowStartIndex),
      startRef: sourceCommits[windowStartIndex]?.shortSha ?? null,
      endRef: sourceCommits.at(-1)?.shortSha ?? null
    });
  }

  return windows;
}

export function selectReleaseWindows(sourceCommits, releaseCommits = []) {
  const windows = buildReleaseWindows(sourceCommits);
  const releasedVersions = getReleasedVersions(releaseCommits);
  const unreleasedWindows = windows.filter((window) => !releasedVersions.has(window.version));

  const selectedWindows =
    releasedVersions.size === 0
      ? unreleasedWindows
      : unreleasedWindows.length > 0
        ? [unreleasedWindows.at(-1)]
        : [];

  return {
    windows: selectedWindows,
    releasedVersions: [...releasedVersions],
    latestDetectedVersion: windows.at(-1)?.version ?? null
  };
}

export function buildReleaseMergePlan(cwd) {
  const sourceBranch = getCurrentBranchName(cwd);
  if (sourceBranch === RELEASE_BRANCH) {
    throw new Error(`Already on "${RELEASE_BRANCH}". Switch to a source branch before running --merge.`);
  }

  const releaseExists = localBranchExists(RELEASE_BRANCH, cwd);
  const baseRef = releaseExists ? RELEASE_BRANCH : getDefaultBaseRef(cwd);
  const mergeBase = releaseExists ? getMergeBase(baseRef, "HEAD", cwd) : null;
  const sourceCommitShas = releaseExists ? listCommitsAfter(mergeBase, "HEAD", cwd) : listBranchCommits("HEAD", cwd);
  const sourceCommits = sourceCommitShas.map((sha) => inspectCommit(sha, cwd));
  const releaseCommits = releaseExists ? listBranchCommits(RELEASE_BRANCH, cwd).map((sha) => inspectCommit(sha, cwd)) : [];
  const selection = selectReleaseWindows(sourceCommits, releaseCommits);

  return {
    releaseBranch: RELEASE_BRANCH,
    sourceBranch,
    baseRef,
    mergeBase,
    releaseExists,
    releasedVersions: selection.releasedVersions,
    latestDetectedVersion: selection.latestDetectedVersion,
    windows: selection.windows,
    createFromRef: releaseExists ? RELEASE_BRANCH : null
  };
}

export function finalizeReleaseMergePlan(plan) {
  return {
    ...plan,
    totalCommits: plan.windows.reduce((count, window) => count + window.commits.length, 0)
  };
}

export function formatReleaseMergePlan(plan) {
  const lines = [
    colorize("Release Merge Plan", ANSI.bold + ANSI.cyan),
    `${colorize("Source Branch:", ANSI.bold + ANSI.cyan)} ${plan.sourceBranch}`,
    `${colorize("Target Branch:", ANSI.bold + ANSI.cyan)} ${plan.releaseBranch}`,
    `${colorize("Base Ref:", ANSI.bold + ANSI.cyan)} ${plan.baseRef}`,
    `${colorize("Released Versions:", ANSI.bold + ANSI.cyan)} ${
      plan.releasedVersions.length > 0 ? plan.releasedVersions.join(", ") : "none"
    }`,
    `${colorize("Latest Detected Version:", ANSI.bold + ANSI.cyan)} ${plan.latestDetectedVersion ?? "none"}`
  ];

  if (plan.windows.length === 0) {
    lines.push(colorize("No unreleased release commits detected. Nothing to merge.", ANSI.green));
    return lines.join("\n");
  }

  for (const window of plan.windows) {
    lines.push("");
    lines.push(colorize(`release ${window.version}`, ANSI.bold + ANSI.yellow));
    lines.push(`${colorize("Commit Range:", ANSI.bold + ANSI.cyan)} ${window.startRef}..${window.endRef}`);

    for (const commit of window.commits) {
      lines.push(`${colorize(commit.shortSha, ANSI.bold + ANSI.cyan)} ${commit.subject}`);
      if (commit.versionChange.hasVersionChange) {
        lines.push(`  ${colorize("Version:", ANSI.bold + ANSI.cyan)} ${summarizeVersionPair(commit.versionChange)}`);
      }
    }
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
  if (plan.windows.length === 0) {
    throw new Error("No unreleased release commits detected. Nothing to merge.");
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
      const emptyRootCommit = createEmptyRootCommit("chore: initialize release branch", cwd);
      gitCheckoutNewBranch(RELEASE_BRANCH, emptyRootCommit, cwd);
    }

    for (const window of plan.windows) {
      for (const commit of window.commits) {
        gitCherryPickNoCommit(commit.sha, cwd);
      }

      gitCommit(`release ${window.version}`, cwd);
    }
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
      // Preserve original failure and print recovery guidance below.
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
