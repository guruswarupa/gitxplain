import { execFileSync } from "node:child_process";

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

export function gitResetSoft(cwd) {
  return runGitCommand(["reset", "--soft", "HEAD~1"], cwd);
}

export function gitUnstageAll(cwd) {
  return runGitCommand(["reset", "HEAD", "--", "."], cwd);
}

export function gitAddFiles(files, cwd) {
  return runGitCommand(["add", ...files], cwd);
}

export function gitCommit(message, cwd) {
  return runGitCommand(["commit", "-m", message], cwd);
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
