import test from "node:test";
import assert from "node:assert/strict";
import { buildBootSessionArgs, parseArgs } from "../cli/index.js";
import { getBootHelpText } from "../cli/services/chatService.js";

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
  assert.equal(helpParsed.example, false);

  const exampleParsed = parseArgs(["node", "gitxplain", "example"]);
  assert.equal(exampleParsed.example, true);
  assert.equal(exampleParsed.commitRef, null);

  const exampleFlagParsed = parseArgs(["node", "gitxplain", "--example"]);
  assert.equal(exampleFlagParsed.example, true);
  assert.equal(exampleFlagParsed.commitRef, null);

  const hookParsed = parseArgs(["node", "gitxplain", "install-hook", "post-commit"]);
  assert.equal(hookParsed.installHook, true);
  assert.equal(hookParsed.hookName, "post-commit");
});

test("parseArgs handles GitHub connect flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "--connect-github", "github_pat_test"]);

  assert.equal(parsed.connectGitHub, true);
  assert.equal(parsed.connectToken, "github_pat_test");
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

test("parseArgs handles merge flag execution", () => {
  const parsed = parseArgs(["node", "gitxplain", "--merge", "--execute"]);

  assert.equal(parsed.mode, "merge");
  assert.equal(parsed.merge, true);
  assert.equal(parsed.execute, true);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles merge subcommand", () => {
  const parsed = parseArgs(["node", "gitxplain", "merge"]);

  assert.equal(parsed.mergeCommand, true);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.mode, null);
});

test("parseArgs handles tag flag execution", () => {
  const parsed = parseArgs(["node", "gitxplain", "--tag", "--execute"]);

  assert.equal(parsed.mode, "tag");
  assert.equal(parsed.tag, true);
  assert.equal(parsed.execute, true);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles tag subcommand", () => {
  const parsed = parseArgs(["node", "gitxplain", "tag"]);

  assert.equal(parsed.tagCommand, true);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.mode, null);
});

test("parseArgs handles repository log subcommand", () => {
  const parsed = parseArgs(["node", "gitxplain", "log"]);

  assert.equal(parsed.logCommand, true);
  assert.equal(parsed.log, false);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.mode, null);
});

test("parseArgs handles repository log flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "--log"]);

  assert.equal(parsed.logCommand, false);
  assert.equal(parsed.log, true);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.mode, "log");
});

test("parseArgs handles repository status subcommand", () => {
  const parsed = parseArgs(["node", "gitxplain", "status"]);

  assert.equal(parsed.statusCommand, true);
  assert.equal(parsed.status, false);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.mode, null);
});

test("parseArgs handles repository status flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "--status"]);

  assert.equal(parsed.statusCommand, false);
  assert.equal(parsed.status, true);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.mode, "status");
});

test("parseArgs handles pipeline subcommand", () => {
  const parsed = parseArgs(["node", "gitxplain", "pipeline"]);

  assert.equal(parsed.pipelineCommand, true);
  assert.equal(parsed.commitRef, null);
  assert.equal(parsed.nativeGitCommand, false);
});

test("parseArgs handles pipeline flag", () => {
  const parsed = parseArgs(["node", "gitxplain", "--pipeline"]);

  assert.equal(parsed.pipelineCommand, true);
  assert.equal(parsed.mode, "pipeline");
  assert.equal(parsed.commitRef, null);
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

test("parseArgs handles commit subcommand and flag", () => {
  const commandParsed = parseArgs(["node", "gitxplain", "commit"]);
  assert.equal(commandParsed.commitCommand, true);
  assert.equal(commandParsed.commitRef, null);

  const flagParsed = parseArgs(["node", "gitxplain", "--commit", "--execute"]);
  assert.equal(flagParsed.mode, "commit");
  assert.equal(flagParsed.execute, true);
});

test("buildBootSessionArgs preserves provider/model and username in the correct slots", () => {
  const sessionArgs = buildBootSessionArgs(
    {
      token: "ghp_test",
      user: { login: "guruswarupa" }
    },
    { name: "Guru Swarupa" },
    {
      provider: "groq",
      model: "llama-3.3-70b-versatile"
    }
  );

  assert.deepEqual(sessionArgs, {
    token: "ghp_test",
    providerOverride: "groq",
    modelOverride: "llama-3.3-70b-versatile",
    username: "Guru Swarupa"
  });
});

test("getBootHelpText lists interactive boot commands", () => {
  const helpText = getBootHelpText();

  assert.match(helpText, /Available commands:/);
  assert.match(helpText, /help\s+Show this command list/);
  assert.match(helpText, /repos\s+Select a GitHub repository and commit for analysis/);
  assert.match(helpText, /issues\s+Summarize open issues for the selected repository/);
  assert.match(helpText, /status\s+Review local uncommitted git diff/);
  assert.match(helpText, /download\s+Download the selected repository at the selected commit/);
  assert.match(helpText, /clear\s+Reset the current chat history/);
  assert.match(helpText, /exit\s+Close the interactive session/);
});
