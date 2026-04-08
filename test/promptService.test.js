import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "../cli/services/promptService.js";

const commitData = {
  analysisType: "commit",
  commitMessage: "Fix null token handling",
  filesChanged: ["src/auth.js"],
  stats: "1 file changed, 4 insertions(+), 1 deletion(-)",
  diff: Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join("\n")
};

test("buildPrompt truncates long diffs and reports metadata", () => {
  const { prompt, promptMeta } = buildPrompt("full", commitData, { maxDiffLines: 3 });

  assert.match(prompt, /Diff truncated: kept 3 of 10 lines/);
  assert.equal(promptMeta.truncated, true);
  assert.equal(promptMeta.keptDiffLines, 3);
  assert.equal(promptMeta.diffLineCount, 10);
});

test("buildPrompt adds range prelude for commit ranges", () => {
  const { prompt } = buildPrompt(
    "summary",
    {
      ...commitData,
      analysisType: "range",
      commitCount: 2,
      commits: [
        { hash: "1234567", subject: "First change" },
        { hash: "89abcde", subject: "Second change" }
      ]
    },
    { maxDiffLines: 20 }
  );

  assert.match(prompt, /This analysis covers a range of commits/);
  assert.match(prompt, /Commit Count: 2/);
});
