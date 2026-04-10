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

test("buildPrompt flags comment-only diffs as non-behavioral", () => {
  const { prompt } = buildPrompt(
    "commit",
    {
      ...commitData,
      analysisType: "workingTree",
      commitMessage: "Uncommitted working tree changes",
      filesChanged: ["cli/services/configService.js"],
      diff: [
        "diff --git a/cli/services/configService.js b/cli/services/configService.js",
        "index c4508b6..de4d996 100644",
        "--- a/cli/services/configService.js",
        "+++ b/cli/services/configService.js",
        "@@ -14,6 +14,7 @@ function readJsonConfig(filePath) {",
        "+// Load configuration with the following precedence:"
      ].join("\n")
    },
    { maxDiffLines: 20 }
  );

  assert.match(prompt, /All changed lines appear to be comments or whitespace/);
  assert.match(prompt, /prefer `docs:` or `chore:` wording instead of `feat:`\/`fix:`/);
});

test("buildPrompt loads new prompt modes", () => {
  const refactorPrompt = buildPrompt("refactor", commitData, { maxDiffLines: 20 }).prompt;
  const changelogPrompt = buildPrompt("changelog", commitData, { maxDiffLines: 20 }).prompt;
  const blamePrompt = buildPrompt("blame", commitData, { maxDiffLines: 20 }).prompt;
  const stashPrompt = buildPrompt("stash", commitData, { maxDiffLines: 20 }).prompt;

  assert.match(refactorPrompt, /Review this change for refactoring opportunities/);
  assert.match(changelogPrompt, /Generate release notes in a conventional-changelog style/);
  assert.match(blamePrompt, /Analyze this git blame report for a file/);
  assert.match(stashPrompt, /Explain the contents of this Git stash entry/);
});
