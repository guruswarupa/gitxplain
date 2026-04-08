import { execFileSync } from "node:child_process";

function runGitCommand(args, cwd) {
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

export function isGitRepository(cwd) {
  try {
    return runGitCommand(["rev-parse", "--is-inside-work-tree"], cwd) === "true";
  } catch {
    return false;
  }
}

export function fetchCommitData(commitId, cwd) {
  const commitMessage = runGitCommand(["log", "-1", "--pretty=format:%B", commitId], cwd);
  const diff = runGitCommand(["diff", `${commitId}^!`], cwd);
  const filesChangedRaw = runGitCommand(["show", "--pretty=format:", "--name-only", commitId], cwd);
  const statsRaw = runGitCommand(["show", "--stat", "--oneline", "--format=%h %s", commitId], cwd);

  const filesChanged = filesChangedRaw
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);

  const statsLine = statsRaw
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /changed|insertions?\(\+\)|deletions?\(-\)/.test(line));

  return {
    commitId,
    commitMessage,
    diff,
    filesChanged,
    stats: statsLine ?? "No change statistics available."
  };
}
