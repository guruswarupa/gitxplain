import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../cli/index.js";

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

test("parseArgs handles help and install-hook commands", () => {
  const helpParsed = parseArgs(["node", "gitxplain", "help"]);
  assert.equal(helpParsed.help, true);

  const hookParsed = parseArgs(["node", "gitxplain", "install-hook", "post-commit"]);
  assert.equal(hookParsed.installHook, true);
  assert.equal(hookParsed.hookName, "post-commit");
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

test("parseArgs handles add command with multiple paths", () => {
  const parsed = parseArgs(["node", "gitxplain", "add", "README.md", "cli/index.js"]);

  assert.equal(parsed.addCommand, true);
  assert.deepEqual(parsed.actionPaths, ["README.md", "cli/index.js"]);
  assert.equal(parsed.commitRef, null);
});

test("parseArgs handles remove command", () => {
  const parsed = parseArgs(["node", "gitxplain", "remove", "README.md"]);

  assert.equal(parsed.removeCommand, true);
  assert.deepEqual(parsed.actionPaths, ["README.md"]);
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

test("parseArgs handles commit subcommand and flag", () => {
  const commandParsed = parseArgs(["node", "gitxplain", "commit"]);
  assert.equal(commandParsed.commitCommand, true);
  assert.equal(commandParsed.commitRef, null);

  const flagParsed = parseArgs(["node", "gitxplain", "--commit", "--execute"]);
  assert.equal(flagParsed.mode, "commit");
  assert.equal(flagParsed.execute, true);
});
