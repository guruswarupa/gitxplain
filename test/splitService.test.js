import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSplitPlan,
  parseSplitPlan,
  reconcileSplitPlan,
  validateSplitExecutionTarget
} from "../cli/services/splitService.js";

test("parseSplitPlan parses valid JSON", () => {
  const plan = parseSplitPlan(`{
    "original_summary": "Added validation and tests.",
    "reason_to_split": "Feature logic and tests should be separated.",
    "commits": [
      {
        "order": 1,
        "message": "feat: add validation helper",
        "files": ["src/validation.js"],
        "description": "Adds the reusable validation helper."
      }
    ]
  }`);

  assert.equal(plan.original_summary, "Added validation and tests.");
  assert.equal(plan.commits[0].message, "feat: add validation helper");
});

test("parseSplitPlan parses JSON wrapped in markdown fences", () => {
  const plan = parseSplitPlan(`\`\`\`json
{
  "original_summary": "Added validation and tests.",
  "reason_to_split": null,
  "commits": []
}
\`\`\``);

  assert.equal(plan.reason_to_split, null);
  assert.deepEqual(plan.commits, []);
});

test("parseSplitPlan throws on invalid JSON", () => {
  assert.throws(() => parseSplitPlan("{not valid json}"), /Failed to parse split plan JSON/);
});

test("parseSplitPlan supports empty commits when no split is needed", () => {
  const plan = parseSplitPlan(`{
    "original_summary": "Refined a single helper.",
    "reason_to_split": null,
    "commits": []
  }`);

  assert.equal(plan.original_summary, "Refined a single helper.");
  assert.equal(plan.commits.length, 0);
});

test("parseSplitPlan deduplicates files across split groups", () => {
  const plan = parseSplitPlan(`{
    "original_summary": "Adds validation and tests.",
    "reason_to_split": "Separate implementation and tests.",
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

test("reconcileSplitPlan removes extra files and adds missing commit files", () => {
  const plan = reconcileSplitPlan(
    {
      original_summary: "Initial commit",
      reason_to_split: "Separate docs and code.",
      warnings: [],
      commits: [
        {
          order: 1,
          message: "feat: add code",
          files: ["src/app.js", ".npmignore"],
          description: "Adds code."
        }
      ]
    },
    ["src/app.js", "README.md"]
  );

  assert.deepEqual(plan.commits[0].files, ["src/app.js"]);
  assert.deepEqual(plan.commits[1].files, ["README.md"]);
  assert.match(plan.warnings[0], /Files not present in the target commit were removed/);
  assert.match(plan.warnings[1], /Missing files were added to a final fallback split group/);
});

test("formatSplitPlan renders the expected sections", () => {
  const output = formatSplitPlan({
    original_summary: "Added validation and tests.",
    reason_to_split: "The change mixes app logic and test coverage.",
    warnings: ["Duplicate file assignments were removed from later split groups: test/validation.test.js."],
    commits: [
      {
        order: 1,
        message: "feat: add validation helper",
        files: ["src/validation.js"],
        description: "Adds the helper implementation."
      },
      {
        order: 2,
        message: "test: cover validation helper",
        files: ["test/validation.test.js"],
        description: "Adds focused test coverage."
      }
    ]
  });

  assert.match(output, /Split Plan/);
  assert.match(output, /Original Summary:/);
  assert.match(output, /Reason To Split:/);
  assert.match(output, /Warning:/);
  assert.match(output, /1\. feat: add validation helper/);
  assert.match(output, /Files: src\/validation\.js/);
  assert.match(output, /Why: Adds the helper implementation\./);
});

test("validateSplitExecutionTarget allows reachable non-HEAD commits", () => {
  const result = validateSplitExecutionTarget("abc123", "/tmp", {
    resolveCommitSha: () => "abc123",
    getCurrentHeadSha: () => "def456",
    getCommitParents: () => ["parent123"],
    isAncestorCommit: () => true
  });

  assert.equal(result.targetSha, "abc123");
  assert.equal(result.currentHeadSha, "def456");
  assert.equal(result.parentSha, "parent123");
  assert.equal(result.isHeadTarget, false);
});

test("validateSplitExecutionTarget rejects commits outside HEAD history", () => {
  assert.throws(
    () =>
      validateSplitExecutionTarget("abc123", "/tmp", {
        resolveCommitSha: () => "abc123",
        getCurrentHeadSha: () => "def456",
        getCommitParents: () => ["parent123"],
        isAncestorCommit: () => false
      }),
    /not reachable from the current HEAD/
  );
});

test("validateSplitExecutionTarget rejects merge commits", () => {
  assert.throws(
    () =>
      validateSplitExecutionTarget("abc123", "/tmp", {
        resolveCommitSha: () => "abc123",
        getCurrentHeadSha: () => "abc123",
        getCommitParents: () => ["parent1", "parent2"],
        isAncestorCommit: () => true
      }),
    /supports non-merge commits/
  );
});
