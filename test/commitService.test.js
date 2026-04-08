import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  executeCommitPlan,
  formatCommitPlan,
  parseCommitPlan,
  reconcileCommitPlan
} from "../cli/services/commitService.js";

function run(commandArgs, cwd) {
  return execFileSync("git", commandArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function createRepoFixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), "gitxplain-commit-plan-"));
  run(["init"], cwd);
  run(["config", "user.name", "Gitxplain Test"], cwd);
  run(["config", "user.email", "gitxplain@example.com"], cwd);
  writeFileSync(path.join(cwd, "tracked.txt"), "base\n", "utf8");
  run(["add", "tracked.txt"], cwd);
  run(["commit", "-m", "base"], cwd);
  return cwd;
}

test("parseCommitPlan parses valid JSON", () => {
  const plan = parseCommitPlan(`{
    "working_tree_summary": "Adds validation logic and tests.",
    "reason_to_commit": "The implementation and tests should be committed separately.",
    "commits": [
      {
        "order": 1,
        "message": "feat: add validation helper",
        "files": ["src/validation.js"],
        "description": "Adds the validation helper."
      }
    ]
  }`);

  assert.equal(plan.working_tree_summary, "Adds validation logic and tests.");
  assert.equal(plan.commits[0].message, "feat: add validation helper");
});

test("parseCommitPlan parses fenced JSON", () => {
  const plan = parseCommitPlan(`\`\`\`json
{
  "working_tree_summary": "No meaningful changes detected",
  "reason_to_commit": null,
  "commits": []
}
\`\`\``);

  assert.equal(plan.reason_to_commit, null);
  assert.deepEqual(plan.commits, []);
});

test("parseCommitPlan throws on invalid JSON", () => {
  assert.throws(() => parseCommitPlan("{broken json}"), /Failed to parse commit plan JSON/);
});

test("parseCommitPlan deduplicates files across commit groups", () => {
  const plan = parseCommitPlan(`{
    "working_tree_summary": "Adds validation logic and tests.",
    "reason_to_commit": "Separate implementation and tests.",
    "commits": [
      {
        "order": 1,
        "message": "feat: add validation helper",
        "files": ["src/validation.js", "test/validation.test.js"],
        "description": "Adds implementation."
      },
      {
        "order": 2,
        "message": "test: add validation coverage",
        "files": ["test/validation.test.js"],
        "description": "Adds tests."
      }
    ]
  }`);

  assert.deepEqual(plan.commits[0].files, ["src/validation.js", "test/validation.test.js"]);
  assert.equal(plan.commits.length, 1);
  assert.match(plan.warnings[0], /Duplicate file assignments were removed/);
});

test("formatCommitPlan renders the expected sections", () => {
  const output = formatCommitPlan({
    working_tree_summary: "Adds validation logic and tests.",
    reason_to_commit: "The implementation and tests should be committed separately.",
    warnings: ["Duplicate file assignments were removed from later commit groups: src/validation.js."],
    commits: [
      {
        order: 1,
        message: "feat: add validation helper",
        files: ["src/validation.js"],
        description: "Adds the validation helper."
      }
    ]
  });

  assert.match(output, /Commit Plan/);
  assert.match(output, /Working Tree Summary:/);
  assert.match(output, /Reason To Commit:/);
  assert.match(output, /Warning:/);
  assert.match(output, /1\. feat: add validation helper/);
});

test("reconcileCommitPlan adds missing files to a fallback commit", () => {
  const cwd = createRepoFixture();
  writeFileSync(path.join(cwd, "tracked.txt"), "base\nupdated\n", "utf8");
  writeFileSync(path.join(cwd, "extra.txt"), "new file\n", "utf8");

  const plan = reconcileCommitPlan(
    {
      working_tree_summary: "Updates tracked file and adds extra file.",
      reason_to_commit: "Split changes.",
      commits: [
        {
          order: 1,
          message: "feat: update tracked file",
          files: ["tracked.txt"],
          description: "Updates only the tracked file."
        }
      ]
    },
    cwd
  );

  assert.equal(plan.commits.length, 2);
  assert.deepEqual(plan.commits[1].files, ["extra.txt"]);
  assert.match(plan.commits[1].message, /include remaining working tree changes/);
  assert.match(plan.warnings[0], /Missing files were added to a final fallback commit/);
});

test("executeCommitPlan refuses plans that do not cover all changed files", () => {
  const cwd = createRepoFixture();
  writeFileSync(path.join(cwd, "tracked.txt"), "base\nupdated\n", "utf8");
  writeFileSync(path.join(cwd, "extra.txt"), "new file\n", "utf8");

  assert.throws(
    () =>
      executeCommitPlan(
        {
          working_tree_summary: "Updates tracked file and adds extra file.",
          reason_to_commit: "Split changes.",
          commits: [
            {
              order: 1,
              message: "feat: update tracked file",
              files: ["tracked.txt"],
              description: "Updates only the tracked file."
            }
          ]
        },
        cwd
      ),
    /Commit plan must cover each changed file exactly once\. Missing files: extra\.txt/
  );

  assert.match(run(["status", "--short"], cwd), /tracked\.txt/);
  assert.match(run(["status", "--short"], cwd), /extra\.txt/);
});
