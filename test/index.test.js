import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { main, parseArgs } from "../cli/index.js";

test("parseArgs handles commit mode and provider overrides", () => {
  const parsed = parseArgs([
    "node",
    "gitxplain",
    "HEAD~1",
    "--summary",
    "--provider",
    "groq",
    "--model",
    "llama-3.3-70b-versatile",
    "--clipboard",
    "--verbose"
  ]);

  assert.equal(parsed.commitRef, "HEAD~1");
  assert.equal(parsed.mode, "summary");
  assert.equal(parsed.provider, "groq");
  assert.equal(parsed.model, "llama-3.3-70b-versatile");
  assert.equal(parsed.clipboard, true);
  assert.equal(parsed.verbose, true);
});

test("parseArgs handles branch analysis without explicit base", () => {
  const parsed = parseArgs(["node", "gitxplain", "--branch", "--review"]);

  assert.equal(parsed.hasBranchFlag, true);
  assert.equal(parsed.branchBase, null);
  assert.equal(parsed.mode, "review");
});

test("parseArgs treats direct native git subcommands as passthrough", () => {
  const parsed = parseArgs(["node", "gitxplain", "branch", "-a"], {
    gitSubcommands: new Set(["branch", "checkout", "worktree"])
  });

  assert.equal(parsed.nativeGitCommand, true);
  assert.deepEqual(parsed.nativeGitArgs, ["branch", "-a"]);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs treats git wrapper commands as passthrough", () => {
  const parsed = parseArgs(["node", "gitxplain", "git", "worktree", "list"], {
    gitSubcommands: new Set(["worktree"])
  });

  assert.equal(parsed.nativeGitCommand, true);
  assert.deepEqual(parsed.nativeGitArgs, ["worktree", "list"]);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles help and install-hook commands", () => {
  const helpParsed = parseArgs(["node", "gitxplain", "help"]);
  assert.equal(helpParsed.help, true);

  const hookParsed = parseArgs(["node", "gitxplain", "install-hook", "post-commit"]);
  assert.equal(hookParsed.installHook, true);
  assert.equal(hookParsed.hookName, "post-commit");
});

test("parseArgs handles version flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "--version"]);

  assert.equal(parsed.version, true);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles cost and interactive flags", () => {
  const parsed = parseArgs(["node", "gitxplain", "HEAD", "--split", "--interactive", "--cost"]);

  assert.equal(parsed.cost, true);
  assert.equal(parsed.interactive, true);
});

test("parseArgs handles config set commands", () => {
  const parsed = parseArgs(["node", "gitxplain", "config", "set", "api-key", "secret-token", "--provider", "openai"]);

  assert.equal(parsed.configCommand, true);
  assert.equal(parsed.configAction, "set");
  assert.equal(parsed.configKey, "api-key");
  assert.equal(parsed.configValue, "secret-token");
  assert.equal(parsed.provider, "openai");
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles cache clear commands", () => {
  const parsed = parseArgs(["node", "gitxplain", "cache", "clear"]);

  assert.equal(parsed.cacheCommand, true);
  assert.equal(parsed.cacheAction, "clear");
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles cache stats commands", () => {
  const parsed = parseArgs(["node", "gitxplain", "cache", "stats"]);

  assert.equal(parsed.cacheCommand, true);
  assert.equal(parsed.cacheAction, "stats");
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles empty invocation", () => {
  const parsed = parseArgs(["node", "gitxplain"]);

  assert.equal(parsed.help, false);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.mode, null);
});

test("parseArgs handles split execution flags", () => {
  const parsed = parseArgs(["node", "gitxplain", "HEAD", "--split", "--execute", "--dry-run"]);

  assert.equal(parsed.commitRef, "HEAD");
  assert.equal(parsed.mode, "split");
  assert.equal(parsed.execute, true);
  assert.equal(parsed.dryRun, true);
});

test("parseArgs handles no-cache flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "HEAD", "--summary", "--no-cache"]);

  assert.equal(parsed.commitRef, "HEAD");
  assert.equal(parsed.noCache, true);
});

test("parseArgs handles blame mode with a file path", () => {
  const parsed = parseArgs(["node", "gitxplain", "--blame", "cli/index.js", "--markdown"]);

  assert.equal(parsed.mode, "blame");
  assert.equal(parsed.blameFile, "cli/index.js");
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.format, "markdown");
});

test("parseArgs handles conflict mode", () => {
  const parsed = parseArgs(["node", "gitxplain", "--conflict", "--diff", "src/auth.js"]);

  assert.equal(parsed.mode, "conflict");
  assert.equal(parsed.diffFile, "src/auth.js");
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles stash mode with an explicit stash ref", () => {
  const parsed = parseArgs(["node", "gitxplain", "--stash", "stash@{2}", "--diff", "cli/index.js"]);

  assert.equal(parsed.mode, "stash");
  assert.equal(parsed.stashRef, "stash@{2}");
  assert.equal(parsed.diffFile, "cli/index.js");
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles diff filtering for commit analysis", () => {
  const parsed = parseArgs(["node", "gitxplain", "HEAD~1", "--summary", "--diff", "cli/index.js"]);

  assert.equal(parsed.commitRef, "HEAD~1");
  assert.equal(parsed.mode, "summary");
  assert.equal(parsed.diffFile, "cli/index.js");
});

test("parseArgs handles changelog and PR-focused modes", () => {
  const changelogParsed = parseArgs(["node", "gitxplain", "HEAD~5..HEAD", "--changelog"]);
  assert.equal(changelogParsed.mode, "changelog");
  assert.equal(changelogParsed.commitRef, "HEAD~5..HEAD");

  const prParsed = parseArgs(["node", "gitxplain", "--branch", "main", "--pr-description"]);
  assert.equal(prParsed.mode, "pr-description");
  assert.equal(prParsed.branchBase, "main");
});

test("parseArgs handles refactor and test-suggest modes", () => {
  const refactorParsed = parseArgs(["node", "gitxplain", "HEAD", "--refactor"]);
  assert.equal(refactorParsed.mode, "refactor");

  const testSuggestParsed = parseArgs(["node", "gitxplain", "HEAD", "--test-suggest"]);
  assert.equal(testSuggestParsed.mode, "test-suggest");
});

test("parseArgs handles merge flag execution", () => {
  const parsed = parseArgs(["node", "gitxplain", "--merge", "--execute"]);

  assert.equal(parsed.mode, "merge");
  assert.equal(parsed.merge, true);
  assert.equal(parsed.execute, true);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs treats merge subcommand as native git passthrough", () => {
  const parsed = parseArgs(["node", "gitxplain", "merge"]);

  assert.equal(parsed.nativeGitCommand, true);
  assert.deepEqual(parsed.nativeGitArgs, ["merge"]);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles tag flag execution", () => {
  const parsed = parseArgs(["node", "gitxplain", "--tag", "--execute"]);

  assert.equal(parsed.mode, "tag");
  assert.equal(parsed.tag, true);
  assert.equal(parsed.execute, true);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs treats tag subcommand as native git passthrough", () => {
  const parsed = parseArgs(["node", "gitxplain", "tag"]);

  assert.equal(parsed.nativeGitCommand, true);
  assert.deepEqual(parsed.nativeGitArgs, ["tag"]);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles release status flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "--release", "status"]);

  assert.equal(parsed.releaseCommand, true);
  assert.equal(parsed.releaseAction, "status");
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.release, true);
});

test("parseArgs treats repository log subcommand as native git passthrough", () => {
  const parsed = parseArgs(["node", "gitxplain", "log"]);

  assert.equal(parsed.nativeGitCommand, true);
  assert.deepEqual(parsed.nativeGitArgs, ["log"]);
  assert.equal(parsed.log, false);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles repository log flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "--log"]);

  assert.equal(parsed.log, true);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.mode, "log");
});

test("parseArgs treats repository status subcommand as native git passthrough", () => {
  const parsed = parseArgs(["node", "gitxplain", "status"]);

  assert.equal(parsed.nativeGitCommand, true);
  assert.deepEqual(parsed.nativeGitArgs, ["status"]);
  assert.equal(parsed.status, false);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles repository status flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "--status"]);

  assert.equal(parsed.status, true);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.mode, "status");
});

test("parseArgs treats pipeline subcommand as a commit ref without the flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "pipeline"]);

  assert.equal(parsed.pipelineCommand, false);
  assert.equal(parsed.commitRef, "pipeline");
  assert.equal(parsed.nativeGitCommand, false);
});

test("parseArgs handles pipeline flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "--pipeline"]);

  assert.equal(parsed.pipelineCommand, true);
  assert.equal(parsed.mode, "pipeline");
  assert.equal(parsed.commitRef, null);
});

test("main routes --pipeline without falling back to help", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-main-pipeline-"));
  const originalCwd = process.cwd;
  const originalLog = console.log;
  const originalError = console.error;
  const logs = [];
  const errors = [];

  try {
    execFileSync("git", ["init"], {
      cwd: tempDir,
      stdio: ["ignore", "ignore", "ignore"]
    });

    process.cwd = () => tempDir;
    console.log = (...args) => {
      logs.push(args.join(" "));
    };
    console.error = (...args) => {
      errors.push(args.join(" "));
    };

    const result = await main(["node", "gitxplain", "--pipeline"]);

    assert.equal(result, 1);
    assert.equal(logs.some((line) => line.includes("Usage:")), false);
    assert.equal(logs.some((line) => line.includes("No supported Node, Python, Go, Rust, or Gradle project files were detected.")), true);
    assert.deepEqual(errors, []);
  } finally {
    process.cwd = originalCwd;
    console.log = originalLog;
    console.error = originalError;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("parseArgs handles add command with multiple paths", () => {
  const parsed = parseArgs(["node", "gitxplain", "add", "README.md", "cli/index.js"]);

  assert.equal(parsed.addCommand, true);
  assert.deepEqual(parsed.actionPaths, ["README.md", "cli/index.js"]);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles remove command", () => {
  const parsed = parseArgs(["node", "gitxplain", "remove", "README.md"]);

  assert.equal(parsed.removeCommand, true);
  assert.equal(parsed.removeHardCommand, false);
  assert.deepEqual(parsed.actionPaths, ["README.md"]);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles remove hard command", () => {
  const parsed = parseArgs(["node", "gitxplain", "remove", "hard"]);

  assert.equal(parsed.removeCommand, true);
  assert.equal(parsed.removeHardCommand, true);
  assert.deepEqual(parsed.actionPaths, []);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles del command", () => {
  const parsed = parseArgs(["node", "gitxplain", "del", "scratch.txt"]);

  assert.equal(parsed.deleteCommand, true);
  assert.deepEqual(parsed.actionPaths, ["scratch.txt"]);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles pop command with numeric stash index", () => {
  const parsed = parseArgs(["node", "gitxplain", "pop", "2"]);

  assert.equal(parsed.popCommand, true);
  assert.equal(parsed.stashIndex, "2");
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles pop command without an explicit stash index", () => {
  const parsed = parseArgs(["node", "gitxplain", "pop"]);

  assert.equal(parsed.popCommand, true);
  assert.equal(parsed.stashIndex, null);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles push command with optional remote and branch", () => {
  const parsed = parseArgs(["node", "gitxplain", "push", "origin", "main"]);

  assert.equal(parsed.pushCommand, true);
  assert.equal(parsed.pushRemote, "origin");
  assert.equal(parsed.pushBranch, "main");
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles bin command", () => {
  const parsed = parseArgs(["node", "gitxplain", "bin"]);

  assert.equal(parsed.binCommand, true);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles pull command with optional remote and branch", () => {
  const parsed = parseArgs(["node", "gitxplain", "pull", "origin", "main"]);

  assert.equal(parsed.pullCommand, true);
  assert.equal(parsed.pullRemote, "origin");
  assert.equal(parsed.pullBranch, "main");
  assert.equal(parsed.commitRef, null);
});

test("parseArgs treats commit subcommand as native git passthrough and keeps --commit mode", () => {
  const commandParsed = parseArgs(["node", "gitxplain", "commit"]);
  assert.equal(commandParsed.nativeGitCommand, true);
  assert.deepEqual(commandParsed.nativeGitArgs, ["commit"]);
  assert.equal(commandParsed.commitRef, null);

  const flagParsed = parseArgs(["node", "gitxplain", "--commit", "--execute"]);
  assert.equal(flagParsed.mode, "commit");
  assert.equal(flagParsed.execute, true);
});
