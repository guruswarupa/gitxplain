import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ANSI = {
  reset: "\u001b[0m",
  green: "\u001b[32m",
  red: "\u001b[31m"
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

export function runGitCommand(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    throw new Error(stderr || `Git command failed: git ${args.join(" ")}`);
  }
}

export function runGitCommandWithInput(args, cwd, input) {
  try {
    return execFileSync("git", args, {
      cwd,
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    throw new Error(stderr || `Git command failed: git ${args.join(" ")}`);
  }
}

export function runGitCommandUnchecked(args, cwd) {
  try {
    return {
      stdout: execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }).trim(),
      stderr: "",
      exitCode: 0
    };
  } catch (error) {
    return {
      stdout: error.stdout?.toString().trim() ?? "",
      stderr: error.stderr?.toString().trim() ?? "",
      exitCode: error.status ?? 1
    };
  }
}

export function isGitRepository(cwd) {
  try {
    return runGitCommand(["rev-parse", "--is-inside-work-tree"], cwd) === "true";
  } catch {
    return false;
  }
}

function parseFilesChanged(raw) {
  return raw
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

function parseStatsLine(statsRaw) {
  return (
    statsRaw
      .split("\n")
      .map((line) => line.trim())
      .find((line) => /changed|insertions?\(\+\)|deletions?\(-\)/.test(line)) ??
    "No change statistics available."
  );
}

function parseCommitLog(logRaw) {
  return logRaw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, subject, body = ""] = line.split("\u001f");
      return { hash, subject, body };
    });
}

function buildCommitMessage(commits) {
  return commits
    .map((commit) => `${commit.hash.slice(0, 7)} ${commit.subject}${commit.body ? `\n${commit.body}` : ""}`)
    .join("\n\n");
}

function isRangeRef(ref) {
  return ref.includes("..");
}

export function getDefaultBaseRef(cwd) {
  for (const candidate of ["main", "master", "origin/main", "origin/master"]) {
    try {
      runGitCommand(["rev-parse", "--verify", candidate], cwd);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("Could not detect a default base branch. Pass --branch <base-ref> explicitly.");
}

export function buildBranchRange(baseRef, cwd) {
  const mergeBase = runGitCommand(["merge-base", baseRef, "HEAD"], cwd);
  return `${mergeBase}..HEAD`;
}

export function isWorkingTreeClean(cwd) {
  const result = runGitCommandUnchecked(["status", "--porcelain"], cwd);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Unable to determine working tree status.");
  }

  return result.stdout === "";
}

export function resolveCommitSha(ref, cwd) {
  return runGitCommand(["rev-parse", ref], cwd);
}

export function getCurrentHeadSha(cwd) {
  return runGitCommand(["rev-parse", "HEAD"], cwd);
}

export function getCurrentBranchName(cwd) {
  return runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

export function resolveTreeSha(ref, cwd, runner = runGitCommand) {
  return runner(["rev-parse", `${ref}^{tree}`], cwd);
}

export function getMergeBase(leftRef, rightRef, cwd) {
  return runGitCommand(["merge-base", leftRef, rightRef], cwd);
}

export function pathExistsInRef(ref, filePath, cwd) {
  const result = runGitCommandUnchecked(["cat-file", "-e", `${ref}:${filePath}`], cwd);
  return result.exitCode === 0;
}

export function gitResetSoft(cwd) {
  return runGitCommand(["reset", "--soft", "HEAD~1"], cwd);
}

export function gitUnstageAll(cwd) {
  return runGitCommand(["reset", "HEAD", "--", "."], cwd);
}

export function gitAddFiles(files, cwd) {
  return runGitCommand(["add", ...files], cwd);
}

export function gitRestoreStaged(files, cwd) {
  return runGitCommand(["restore", "--staged", "--", ...files], cwd);
}

export function deletePaths(files, cwd) {
  for (const file of files) {
    const targetPath = path.resolve(cwd, file);

    if (targetPath === cwd || !targetPath.startsWith(`${cwd}${path.sep}`)) {
      throw new Error(`Refusing to delete path outside the repository: ${file}`);
    }

    rmSync(targetPath, { recursive: true, force: true });
  }
}

export function gitCommit(message, cwd) {
  return runGitCommand(["commit", "-m", message], cwd);
}

export function gitCreateAnnotatedTag(tagName, ref, message, cwd) {
  return runGitCommand(["tag", "-a", tagName, ref, "-m", message], cwd);
}

export function gitDeleteTag(tagName, cwd) {
  return runGitCommand(["tag", "-d", tagName], cwd);
}

export function listTags(cwd) {
  const output = runGitCommand(["tag", "--list"], cwd);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function hasStagedChanges(cwd) {
  const result = runGitCommandUnchecked(["diff", "--cached", "--quiet"], cwd);

  if (result.exitCode === 0) {
    return false;
  }

  if (result.exitCode === 1) {
    return true;
  }

  throw new Error(result.stderr || "Unable to determine whether staged changes exist.");
}

export function gitAddAll(cwd) {
  return runGitCommand(["add", "--all"], cwd);
}

export function getRepositoryLog(cwd, limit = 20, runner = runGitCommand) {
  return runner(
    ["log", `--max-count=${limit}`, "--date=short", "--pretty=format:%h %ad %an %s"],
    cwd
  );
}

function describeStatusCode(code, area) {
  const normalized = code === " " ? "" : code;

  if (normalized === "") {
    return null;
  }

  const labels = {
    M: area === "index" ? "staged modification" : "unstaged modification",
    A: area === "index" ? "staged new file" : "added in working tree",
    D: area === "index" ? "staged deletion" : "unstaged deletion",
    R: area === "index" ? "staged rename" : "unstaged rename",
    C: area === "index" ? "staged copy" : "unstaged copy",
    U: "merge conflict",
    "?": "untracked"
  };

  return labels[normalized] ?? `${area === "index" ? "index" : "working tree"} change (${normalized})`;
}

function colorizeStatusLabel(label) {
  if (label.startsWith("staged ")) {
    return colorize(label, ANSI.green);
  }

  if (
    label.startsWith("unstaged ") ||
    label.includes("untracked") ||
    label.includes("conflict") ||
    label.includes("change (")
  ) {
    return colorize(label, ANSI.red);
  }

  if (label === "clean") {
    return colorize(label, ANSI.green);
  }

  return label;
}

function formatStatusEntry(line) {
  if (!line) {
    return null;
  }

  if (line.startsWith("?? ")) {
    return `- ${line.slice(3)}: ${colorizeStatusLabel("untracked")}`;
  }

  if (line.startsWith("## ")) {
    return line.slice(3);
  }

  const indexCode = line[0];
  const worktreeCode = line[1];
  const path = line.slice(3).trim();
  const statuses = [
    describeStatusCode(indexCode, "index"),
    describeStatusCode(worktreeCode, "worktree")
  ].filter(Boolean);

  if (statuses.length === 0) {
    return `- ${path}: ${colorizeStatusLabel("clean")}`;
  }

  return `- ${path}: ${statuses.map((status) => colorizeStatusLabel(status)).join(", ")}`;
}

export function getRepositoryStatus(cwd, runner = runGitCommand) {
  const raw = runner(["status", "--short", "--branch"], cwd);

  if (!raw) {
    return "Working tree is clean.";
  }

  const lines = raw.split("\n").filter(Boolean);
  const branchLine = lines.find((line) => line.startsWith("## ")) ?? null;
  const entries = lines
    .filter((line) => !line.startsWith("## "))
    .map((line) => formatStatusEntry(line))
    .filter(Boolean);

  if (entries.length === 0) {
    return branchLine ? `${branchLine.slice(3)}\n\nWorking tree is clean.` : "Working tree is clean.";
  }

  return [branchLine ? branchLine.slice(3) : null, "", "Changes:", ...entries].filter(Boolean).join("\n");
}

export function getCommitParents(ref, cwd) {
  const output = runGitCommand(["show", "-s", "--format=%P", ref], cwd);
  return output
    .split(" ")
    .map((parent) => parent.trim())
    .filter(Boolean);
}

export function listCommitsAfter(baseRef, headRef, cwd) {
  const output = runGitCommand(["rev-list", "--reverse", `${baseRef}..${headRef}`], cwd);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listBranchCommits(ref, cwd) {
  const output = runGitCommand(["rev-list", "--reverse", ref], cwd);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listFilesInRef(ref, cwd) {
  const output = runGitCommand(["ls-tree", "-r", "--name-only", ref], cwd);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isAncestorCommit(ancestorRef, descendantRef, cwd) {
  const result = runGitCommandUnchecked(["merge-base", "--is-ancestor", ancestorRef, descendantRef], cwd);

  if (result.exitCode === 0) {
    return true;
  }

  if (result.exitCode === 1) {
    return false;
  }

  throw new Error(result.stderr || "Unable to determine commit ancestry.");
}

export function gitResetHard(ref, cwd) {
  return runGitCommand(["reset", "--hard", ref], cwd);
}

export function gitCherryPickNoCommit(ref, cwd) {
  return runGitCommand(["cherry-pick", "--no-commit", ref], cwd);
}

export function gitCherryPick(ref, cwd) {
  return runGitCommand(["cherry-pick", ref], cwd);
}

export function gitCherryPickRecordSource(ref, cwd) {
  return runGitCommand(["cherry-pick", "-x", ref], cwd);
}

export function gitMerge(ref, cwd, message = null) {
  const args = message == null ? ["merge", "--no-ff", ref] : ["merge", "--no-ff", ref, "-m", message];
  return runGitCommand(args, cwd);
}

export function gitCherryPickAbort(cwd) {
  const result = runGitCommandUnchecked(["cherry-pick", "--abort"], cwd);
  return result.exitCode === 0;
}

export function gitMergeAbort(cwd) {
  const result = runGitCommandUnchecked(["merge", "--abort"], cwd);
  return result.exitCode === 0;
}

export function localBranchExists(branchName, cwd) {
  const result = runGitCommandUnchecked(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], cwd);
  return result.exitCode === 0;
}

export function gitCheckout(ref, cwd) {
  return runGitCommand(["checkout", ref], cwd);
}

export function gitCheckoutNewBranch(branchName, startPoint, cwd) {
  return runGitCommand(["checkout", "-b", branchName, startPoint], cwd);
}

export function gitCheckoutOrphan(branchName, cwd) {
  return runGitCommand(["checkout", "--orphan", branchName], cwd);
}

export function gitDeleteBranch(branchName, cwd) {
  return runGitCommand(["branch", "-D", branchName], cwd);
}

export function gitRemoveCachedAll(cwd) {
  return runGitCommand(["rm", "-r", "--cached", "--ignore-unmatch", "."], cwd);
}

export function createEmptyRootCommit(message, cwd) {
  const emptyTree = runGitCommandWithInput(["mktree"], cwd, "");
  return runGitCommand(["commit-tree", emptyTree, "-m", message], cwd);
}

export function writeCurrentIndexTree(cwd) {
  return runGitCommand(["write-tree"], cwd);
}

export function gitStashPush(message, cwd) {
  return runGitCommand(["stash", "push", "--include-untracked", "--message", message], cwd);
}

export function gitStashApply(stashRef, cwd) {
  return runGitCommand(["stash", "apply", "--index", stashRef], cwd);
}

export function gitStashDrop(stashRef, cwd) {
  return runGitCommand(["stash", "drop", stashRef], cwd);
}

export function getLatestStashRef(cwd) {
  const output = runGitCommand(["stash", "list", "--format=%gd"], cwd);
  return output.split("\n").map((line) => line.trim()).find(Boolean) ?? null;
}

function getUncheckedCommandOutput(args, cwd) {
  const result = runGitCommandUnchecked(args, cwd);
  if (result.exitCode !== 0 && result.stderr) {
    return result.stdout;
  }

  return result.stdout;
}

function parseUniqueFiles(...groups) {
  return [...new Set(groups.flatMap((group) => group.split("\n").map((line) => line.trim()).filter(Boolean)))];
}

export function fetchWorkingTreeData(cwd) {
  const stagedDiff = getUncheckedCommandOutput(["diff", "--cached"], cwd);
  const unstagedDiff = getUncheckedCommandOutput(["diff"], cwd);
  const trackedFiles = getUncheckedCommandOutput(["diff", "--name-only", "HEAD"], cwd);
  const untrackedFiles = getUncheckedCommandOutput(["ls-files", "--others", "--exclude-standard"], cwd);
  const trackedStats = getUncheckedCommandOutput(["diff", "--stat", "HEAD"], cwd);

  const untrackedList = untrackedFiles
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const untrackedDiff = untrackedList
    .map((file) => {
      const result = runGitCommandUnchecked(["diff", "--no-index", "--", "/dev/null", file], cwd);
      return result.stdout;
    })
    .filter(Boolean)
    .join("\n");

  const filesChanged = parseUniqueFiles(trackedFiles, untrackedFiles);
  const diff = [stagedDiff, unstagedDiff, untrackedDiff].filter(Boolean).join("\n").trim();
  const trackedStatsLine = parseStatsLine(trackedStats);
  const untrackedStatsLine =
    untrackedList.length > 0
      ? `${untrackedList.length} untracked file${untrackedList.length === 1 ? "" : "s"}`
      : null;

  return {
    analysisType: "workingTree",
    targetRef: "working-tree",
    displayRef: "working-tree",
    commitId: null,
    commitCount: 0,
    commits: [],
    commitMessage: "Uncommitted working tree changes",
    diff,
    filesChanged,
    stats: [trackedStatsLine, untrackedStatsLine].filter(Boolean).join("; ")
  };
}

function fetchSingleCommitData(commitId, cwd, runner) {
  const commitMessage = runner(["log", "-1", "--pretty=format:%B", commitId], cwd);
  const diff = runner(["diff", `${commitId}^!`], cwd);
  const filesChangedRaw = runner(["show", "--pretty=format:", "--name-only", commitId], cwd);
  const statsRaw = runner(["show", "--stat", "--oneline", "--format=%h %s", commitId], cwd);
  const subject = runner(["log", "-1", "--pretty=format:%s", commitId], cwd);

  return {
    analysisType: "commit",
    targetRef: commitId,
    displayRef: commitId,
    commitId,
    commitCount: 1,
    commits: [{ hash: commitId, subject, body: commitMessage }],
    commitMessage,
    diff,
    filesChanged: parseFilesChanged(filesChangedRaw),
    stats: parseStatsLine(statsRaw)
  };
}

function fetchRangeData(rangeRef, cwd, runner) {
  const diff = runner(["diff", rangeRef], cwd);
  const filesChangedRaw = runner(["diff", "--name-only", rangeRef], cwd);
  const statsRaw = runner(["diff", "--stat", rangeRef], cwd);
  const commitLogRaw = runner(
    ["log", "--reverse", "--pretty=format:%H%x1f%s%x1f%B", rangeRef],
    cwd
  );

  const commits = parseCommitLog(commitLogRaw);
  if (commits.length === 0) {
    throw new Error(`No commits found in range ${rangeRef}`);
  }

  return {
    analysisType: "range",
    targetRef: rangeRef,
    displayRef: rangeRef,
    commitId: null,
    commitCount: commits.length,
    commits,
    commitMessage: buildCommitMessage(commits),
    diff,
    filesChanged: parseFilesChanged(filesChangedRaw),
    stats: parseStatsLine(statsRaw)
  };
}

export function fetchCommitData(targetRef, cwd, runner = runGitCommand) {
  return isRangeRef(targetRef)
    ? fetchRangeData(targetRef, cwd, runner)
    : fetchSingleCommitData(targetRef, cwd, runner);
}
