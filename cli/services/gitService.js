import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { ANSI, colorize } from "./colorSupport.js";

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

export function runGitCommandWithInputAndEnv(args, cwd, input, env) {
  try {
    return execFileSync("git", args, {
      cwd,
      input,
      env: {
        ...process.env,
        ...env
      },
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

export function listGitSubcommands() {
  let output;
  try {
    output = execFileSync("git", ["help", "-a"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("git is not installed or not available in PATH.");
    }

    const stderr = error.stderr?.toString().trim();
    throw new Error(stderr || "Unable to list git subcommands.");
  }

  return new Set(
    output
      .split("\n")
      .map((line) => line.match(/^\s{3}([a-z0-9][a-z0-9-]*)\s{2,}/i)?.[1] ?? null)
      .filter(Boolean)
  );
}

export function runNativeGitPassthrough(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 0;
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

export function gitPush(cwd, remote = null, branch = null, runner = runGitCommand) {
  const args = ["push"];

  if (remote) {
    args.push(remote);
  }

  if (branch) {
    args.push(branch);
  }

  return runner(args, cwd);
}

export function gitPull(cwd, remote = null, branch = null, runner = runGitCommand) {
  const args = ["pull"];

  if (remote) {
    args.push(remote);
  }

  if (branch) {
    args.push(branch);
  }

  return runner(args, cwd);
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

export function listTagTargets(cwd) {
  const result = runGitCommandUnchecked(["show-ref", "--tags", "-d"], cwd);
  if (result.exitCode !== 0) {
    return [];
  }

  const output = result.stdout;
  const tagTargets = new Map();

  for (const line of output.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
    const [sha, ref] = line.split(" ");
    if (!sha || !ref?.startsWith("refs/tags/")) {
      continue;
    }

    const rawTagName = ref.slice("refs/tags/".length);
    const isDereferenced = rawTagName.endsWith("^{}");
    const tagName = isDereferenced ? rawTagName.slice(0, -3) : rawTagName;
    const existing = tagTargets.get(tagName) ?? {};

    tagTargets.set(tagName, {
      tagName,
      tagSha: isDereferenced ? existing.tagSha ?? null : sha,
      targetSha: isDereferenced ? sha : existing.targetSha ?? sha
    });
  }

  return [...tagTargets.values()];
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

export function getRepositoryLog(cwd, limit = null, runner = runGitCommand) {
  const args = ["log", "--date=short", "--pretty=format:%h %ad %an %s"];

  if (limit != null) {
    args.splice(1, 0, `--max-count=${limit}`);
  }

  return runner(args, cwd);
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

export function getCommitMetadata(ref, cwd) {
  const output = runGitCommand(
    ["show", "-s", "--format=%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%B", ref],
    cwd
  );
  const [authorName = "", authorEmail = "", authorDate = "", committerName = "", committerEmail = "", committerDate = "", ...messageParts] =
    output.split("\u001f");

  return {
    authorName,
    authorEmail,
    authorDate,
    committerName,
    committerEmail,
    committerDate,
    message: messageParts.join("\u001f")
  };
}

export function listCommitsAfter(baseRef, headRef, cwd) {
  const output = runGitCommand(["rev-list", "--reverse", `${baseRef}..${headRef}`], cwd);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listCommitsAfterTopo(baseRef, headRef, cwd) {
  const output = runGitCommand(["rev-list", "--reverse", "--topo-order", `${baseRef}..${headRef}`], cwd);
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

export function gitResetHard(ref, cwd, runner = runGitCommand) {
  return runner(["reset", "--hard", ref], cwd);
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

export function gitCheckoutDetached(ref, cwd) {
  return runGitCommand(["checkout", "--detach", ref], cwd);
}

export function gitCreateBranch(branchName, startPoint, cwd) {
  return runGitCommand(["branch", branchName, startPoint], cwd);
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

export function gitForceBranch(branchName, ref, cwd) {
  return runGitCommand(["branch", "-f", branchName, ref], cwd);
}

export function gitRebaseRebaseMergesOnto(newBase, upstream, cwd, strategyOption = null) {
  const args = ["rebase", "--rebase-merges"];

  if (strategyOption) {
    args.push("-X", strategyOption);
  }

  args.push("--onto", newBase, upstream);
  return runGitCommand(args, cwd);
}

export function gitRebaseAbort(cwd) {
  const result = runGitCommandUnchecked(["rebase", "--abort"], cwd);
  return result.exitCode === 0;
}

export function gitRemoveCachedAll(cwd) {
  return runGitCommand(["rm", "-r", "--cached", "--ignore-unmatch", "."], cwd);
}

export function createEmptyRootCommit(message, cwd) {
  const emptyTree = runGitCommandWithInput(["mktree"], cwd, "");
  return runGitCommand(["commit-tree", emptyTree, "-m", message], cwd);
}

export function createCommitFromTree(treeSha, parentShas, metadata, cwd) {
  const args = ["commit-tree", treeSha];

  for (const parentSha of parentShas) {
    args.push("-p", parentSha);
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-commit-tree-"));
  const messagePath = path.join(tempDir, "message.txt");

  try {
    writeFileSync(messagePath, metadata.message.endsWith("\n") ? metadata.message : `${metadata.message}\n`, "utf8");
    args.push("-F", messagePath);

    return execFileSync("git", args, {
      cwd,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: metadata.authorName,
        GIT_AUTHOR_EMAIL: metadata.authorEmail,
        GIT_AUTHOR_DATE: metadata.authorDate,
        GIT_COMMITTER_NAME: metadata.committerName,
        GIT_COMMITTER_EMAIL: metadata.committerEmail,
        GIT_COMMITTER_DATE: metadata.committerDate
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    throw new Error(stderr || `Git command failed: git ${args.join(" ")}`);
  } finally {
    try {
      unlinkSync(messagePath);
    } catch {}
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
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

export function resolveStashRef(index = null) {
  if (index == null) {
    return "stash@{0}";
  }

  if (typeof index === "string" && /^stash@\{\d+\}$/.test(index.trim())) {
    return index.trim();
  }

  const parsed = Number.parseInt(String(index), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid stash index: ${index}`);
  }

  return `stash@{${parsed}}`;
}

export function gitStashPop(index, cwd) {
  const stashRef = resolveStashRef(index);
  return runGitCommand(["stash", "pop", "--index", stashRef], cwd);
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

function buildFileScopedDisplayRef(targetRef, filePath) {
  return `${targetRef} :: ${filePath}`;
}

function formatIsoDateFromUnixTimestamp(value) {
  const timestampMs = Number.parseInt(value, 10) * 1000;
  if (Number.isNaN(timestampMs)) {
    return "unknown-date";
  }

  return new Date(timestampMs).toISOString().slice(0, 10);
}

function parseBlamePorcelain(porcelain) {
  const records = [];
  const lines = porcelain.split("\n");
  let index = 0;

  while (index < lines.length) {
    const header = lines[index]?.trim();
    if (!header) {
      index += 1;
      continue;
    }

    const headerMatch = header.match(/^([0-9a-f]{7,40}|\^?[0-9a-f]{7,40})\s+\d+\s+(\d+)\s+(\d+)$/i);
    if (!headerMatch) {
      index += 1;
      continue;
    }

    const [, commitSha, finalLineRaw, lineCountRaw] = headerMatch;
    const record = {
      commitSha,
      finalLine: Number.parseInt(finalLineRaw, 10),
      lineCount: Number.parseInt(lineCountRaw, 10),
      author: "Unknown Author",
      authorMail: "",
      authorTime: "",
      summary: "",
      code: ""
    };

    index += 1;
    while (index < lines.length) {
      const line = lines[index];
      if (line.startsWith("\t")) {
        record.code = line.slice(1);
        index += 1;
        break;
      }

      if (line.startsWith("author ")) {
        record.author = line.slice("author ".length).trim();
      } else if (line.startsWith("author-mail ")) {
        record.authorMail = line.slice("author-mail ".length).trim();
      } else if (line.startsWith("author-time ")) {
        record.authorTime = line.slice("author-time ".length).trim();
      } else if (line.startsWith("summary ")) {
        record.summary = line.slice("summary ".length).trim();
      }

      index += 1;
    }

    records.push(record);
  }

  return records;
}

function buildBlameAnalysisDiff(filePath, records) {
  const byAuthor = new Map();

  for (const record of records) {
    const key = `${record.author}|${record.authorMail}`;
    const existing = byAuthor.get(key) ?? {
      author: record.author,
      authorMail: record.authorMail,
      lineCount: 0,
      commitShas: new Set(),
      summaries: new Set()
    };

    existing.lineCount += 1;
    existing.commitShas.add(record.commitSha);
    if (record.summary) {
      existing.summaries.add(record.summary);
    }
    byAuthor.set(key, existing);
  }

  const authorSection = [...byAuthor.values()]
    .sort((left, right) => right.lineCount - left.lineCount)
    .map(
      (entry) =>
        `- ${entry.author}${entry.authorMail ? ` ${entry.authorMail}` : ""}: ${entry.lineCount} line(s), ${entry.commitShas.size} commit(s), notable commits: ${[...entry.summaries].slice(0, 3).join("; ") || "n/a"}`
    )
    .join("\n");

  const lineSection = records
    .map((record) => {
      const endLine = record.finalLine + record.lineCount - 1;
      const lineLabel = record.lineCount > 1 ? `L${record.finalLine}-L${endLine}` : `L${record.finalLine}`;
      const shortSha = record.commitSha.replace(/^\^/, "").slice(0, 8);
      const authorDate = formatIsoDateFromUnixTimestamp(record.authorTime);
      return `${lineLabel} | ${record.author} | ${authorDate} | ${shortSha} | ${record.summary || "no summary"} | ${record.code}`;
    })
    .join("\n");

  return [`Blame summary for ${filePath}`, "", "Authors:", authorSection || "- none", "", "Line annotations:", lineSection].join("\n");
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

export function fetchBlameData(filePath, cwd, runner = runGitCommand) {
  const porcelain = runner(["blame", "--line-porcelain", "--", filePath], cwd);
  const records = parseBlamePorcelain(porcelain);
  const authorCount = new Set(records.map((record) => `${record.author}|${record.authorMail}`)).size;

  return {
    analysisType: "blame",
    targetRef: `blame:${filePath}`,
    displayRef: filePath,
    commitId: null,
    commitCount: records.length,
    commits: [],
    commitMessage: `Blame analysis for ${filePath}`,
    diff: buildBlameAnalysisDiff(filePath, records),
    filesChanged: [filePath],
    stats: `${records.length} line annotation${records.length === 1 ? "" : "s"} across ${authorCount} author${authorCount === 1 ? "" : "s"}`
  };
}

export function fetchStashData(stashRef = null, cwd, filePath = null, runner = runGitCommand) {
  const resolvedStashRef = resolveStashRef(stashRef);
  const fileArgs = filePath ? ["--", filePath] : [];
  const commitMessage = runner(["log", "-1", "--pretty=format:%gs", resolvedStashRef], cwd);
  const diff = runner(["stash", "show", "-p", resolvedStashRef, ...fileArgs], cwd);
  const filesChangedRaw = runner(["stash", "show", "--name-only", resolvedStashRef, ...fileArgs], cwd);
  const statsRaw = runner(["stash", "show", "--stat", resolvedStashRef, ...fileArgs], cwd);

  return {
    analysisType: "stash",
    targetRef: resolvedStashRef,
    displayRef: filePath ? buildFileScopedDisplayRef(resolvedStashRef, filePath) : resolvedStashRef,
    commitId: resolvedStashRef,
    commitCount: 1,
    commits: [{ hash: resolvedStashRef, subject: commitMessage, body: commitMessage }],
    commitMessage: commitMessage || `Stash entry ${resolvedStashRef}`,
    diff,
    filesChanged: parseFilesChanged(filesChangedRaw),
    stats: parseStatsLine(statsRaw)
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

function fetchSingleCommitFileData(commitId, filePath, cwd, runner) {
  const commitMessage = runner(["log", "-1", "--pretty=format:%B", commitId], cwd);
  const diff = runner(["diff", `${commitId}^!`, "--", filePath], cwd);
  const filesChangedRaw = runner(["show", "--pretty=format:", "--name-only", commitId, "--", filePath], cwd);
  const statsRaw = runner(["show", "--stat", "--oneline", "--format=%h %s", commitId, "--", filePath], cwd);
  const subject = runner(["log", "-1", "--pretty=format:%s", commitId], cwd);

  return {
    analysisType: "commit",
    targetRef: commitId,
    displayRef: buildFileScopedDisplayRef(commitId, filePath),
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

function fetchRangeFileData(rangeRef, filePath, cwd, runner) {
  const diff = runner(["diff", rangeRef, "--", filePath], cwd);
  const filesChangedRaw = runner(["diff", "--name-only", rangeRef, "--", filePath], cwd);
  const statsRaw = runner(["diff", "--stat", rangeRef, "--", filePath], cwd);
  const commitLogRaw = runner(
    ["log", "--reverse", "--pretty=format:%H%x1f%s%x1f%B", rangeRef, "--", filePath],
    cwd
  );

  const commits = parseCommitLog(commitLogRaw);
  if (commits.length === 0) {
    throw new Error(`No commits found in range ${rangeRef} for file ${filePath}`);
  }

  return {
    analysisType: "range",
    targetRef: rangeRef,
    displayRef: buildFileScopedDisplayRef(rangeRef, filePath),
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

export function fetchCommitDataForFile(targetRef, filePath, cwd, runner = runGitCommand) {
  return isRangeRef(targetRef)
    ? fetchRangeFileData(targetRef, filePath, cwd, runner)
    : fetchSingleCommitFileData(targetRef, filePath, cwd, runner);
}
