import test from "node:test";
import assert from "node:assert/strict";
import { formatSplitPlan, parseSplitPlan, validateSplitExecutionTarget } from "../cli/services/splitService.js";

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

test("formatSplitPlan renders the expected sections", () => {
  const output = formatSplitPlan({
    original_summary: "Added validation and tests.",
    reason_to_split: "The change mixes app logic and test coverage.",
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
  assert.match(output, /1\. feat: add validation helper/);
  assert.match(output, /Files: src\/validation\.js/);
  assert.match(output, /Why: Adds the helper implementation\./);
});

test("validateSplitExecutionTarget rejects non-HEAD commits", () => {
  assert.throws(
    () =>
      validateSplitExecutionTarget("abc123", "/tmp", {
        resolveCommitSha: () => "abc123",
        getCurrentHeadSha: () => "def456",
        getCommitParents: () => ["parent123"]
      }),
    /supports only the current HEAD commit/
  );
});

test("validateSplitExecutionTarget rejects merge commits", () => {
  assert.throws(
    () =>
      validateSplitExecutionTarget("abc123", "/tmp", {
        resolveCommitSha: () => "abc123",
        getCurrentHeadSha: () => "abc123",
        getCommitParents: () => ["parent1", "parent2"]
      }),
    /supports non-merge commits/
  );
});
