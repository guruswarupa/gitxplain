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
