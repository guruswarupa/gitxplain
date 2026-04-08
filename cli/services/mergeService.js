import process from "node:process";
import {
  getCurrentBranchName,
  getCurrentHeadSha,
  getDefaultBaseRef,
  getMergeBase,
  gitCheckout,
  gitCheckoutNewBranch,
  gitDeleteBranch,
  gitMerge,
  gitMergeAbort,
  gitResetHard,
  isWorkingTreeClean,
  localBranchExists,
  listCommitsAfter,
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

function detectVersionChanges(diff) {
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

function summarizeVersionPair(change) {
  const fromText = change.from.join(", ");
  const toText = change.to.join(", ");
  return `${fromText} -> ${toText}`;
}

function buildMergeMessage(plan) {
  const versionLabel =
    plan.versionChanges.length > 0
      ? summarizeVersionPair(plan.versionChanges[0])
      : `${plan.commits.length} release commit${plan.commits.length === 1 ? "" : "s"}`;

  return `merge: release ${versionLabel}`;
}

export function buildReleaseMergePlan(cwd) {
  const currentBranch = getCurrentBranchName(cwd);
  if (currentBranch === RELEASE_BRANCH) {
    throw new Error(`Already on "${RELEASE_BRANCH}". Switch to a source branch before running --merge.`);
  }

  const releaseExists = localBranchExists(RELEASE_BRANCH, cwd);
  const baseRef = releaseExists ? RELEASE_BRANCH : getDefaultBaseRef(cwd);
  const mergeBase = getMergeBase(baseRef, "HEAD", cwd);
  const commitShas = listCommitsAfter(mergeBase, "HEAD", cwd);

  const commits = commitShas
    .map((sha) => {
      const diff = getCommitDiff(sha, cwd);
      const versionChange = detectVersionChanges(diff);
      return {
        sha,
        subject: getCommitSubject(sha, cwd),
        files: getCommitFiles(sha, cwd),
        versionChange
      };
    })
    .filter((commit) => commit.versionChange.hasVersionChange);

  return {
    releaseBranch: RELEASE_BRANCH,
    sourceBranch: currentBranch,
    baseRef,
    releaseExists,
    mergeBase,
    commits: commits.map((commit) => ({
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      subject: commit.subject,
      files: commit.files,
      versionChange: commit.versionChange
    })),
    versionChanges: unique(
      commits.map((commit) => summarizeVersionPair(commit.versionChange))
    ).map((summary) => {
      const [fromText, toText] = summary.split(" -> ");
      return {
        from: fromText.split(", ").filter(Boolean),
        to: toText.split(", ").filter(Boolean)
      };
    }),
    mergeMessage: null
  };
}

export function finalizeReleaseMergePlan(plan) {
  return {
    ...plan,
    mergeMessage: buildMergeMessage(plan)
  };
}

export function formatReleaseMergePlan(plan) {
  const lines = [
    colorize("Release Merge Plan", ANSI.bold + ANSI.cyan),
    `${colorize("Source Branch:", ANSI.bold + ANSI.cyan)} ${plan.sourceBranch}`,
    `${colorize("Target Branch:", ANSI.bold + ANSI.cyan)} ${plan.releaseBranch}`,
    `${colorize("Comparison Base:", ANSI.bold + ANSI.cyan)} ${plan.baseRef}`,
    `${colorize("Merge Commit:", ANSI.bold + ANSI.cyan)} ${plan.mergeMessage}`
  ];

  if (plan.commits.length === 0) {
    lines.push(colorize("No release-version commits detected. No merge recommended.", ANSI.green));
    return lines.join("\n");
  }

  lines.push(`${colorize("Detected Version Changes:", ANSI.bold + ANSI.cyan)} ${plan.versionChanges.map(summarizeVersionPair).join("; ")}`);

  for (const commit of plan.commits) {
    lines.push("");
    lines.push(colorize(`${commit.shortSha} ${commit.subject}`, ANSI.bold + ANSI.yellow));
    lines.push(`${colorize("Versions:", ANSI.bold + ANSI.cyan)} ${summarizeVersionPair(commit.versionChange)}`);
    lines.push(`${colorize("Files:", ANSI.bold + ANSI.cyan)} ${commit.files.join(", ")}`);
  }

  return lines.join("\n");
}

function buildRecoveryMessage({ originalBranch, originalReleaseSha, createdReleaseBranch }) {
  const lines = ["Release merge failed. Recovery steps:"];

  if (createdReleaseBranch) {
    lines.push(`- Return to ${originalBranch} with \`git checkout ${originalBranch}\``);
    lines.push(`- Delete the temporary release branch with \`git branch -D ${RELEASE_BRANCH}\``);
    return lines.join("\n");
  }

  lines.push(`- Reset ${RELEASE_BRANCH} back to ${originalReleaseSha} with \`git reset --hard ${originalReleaseSha}\``);
  lines.push(`- Return to ${originalBranch} with \`git checkout ${originalBranch}\``);
  return lines.join("\n");
}

export function executeReleaseMerge(plan, cwd) {
  if (plan.commits.length === 0) {
    throw new Error("No release-version commits detected. Nothing to merge.");
  }

  if (!isWorkingTreeClean(cwd)) {
    throw new Error("Working tree must be clean before executing a release merge.");
  }

  const originalBranch = getCurrentBranchName(cwd);
  const originalHeadSha = getCurrentHeadSha(cwd);
  const releaseExists = localBranchExists(RELEASE_BRANCH, cwd);
  const originalReleaseSha = releaseExists ? resolveCommitSha(RELEASE_BRANCH, cwd) : null;

  try {
    if (releaseExists) {
      gitCheckout(RELEASE_BRANCH, cwd);
    } else {
      gitCheckoutNewBranch(RELEASE_BRANCH, plan.baseRef, cwd);
    }

    gitMerge(plan.sourceBranch, cwd, plan.mergeMessage);
  } catch (error) {
    gitMergeAbort(cwd);

    try {
      if (!releaseExists) {
        gitCheckout(originalBranch, cwd);
        gitDeleteBranch(RELEASE_BRANCH, cwd);
      } else {
        gitResetHard(originalReleaseSha, cwd);
        gitCheckout(originalBranch, cwd);
      }
    } catch {
      // Preserve the original failure while still printing recovery guidance below.
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
    throw new Error("Release merge did not create any new history on the release branch.");
  }
}

export { RELEASE_BRANCH, detectVersionChanges };
