import test from "node:test";
import assert from "node:assert/strict";
import { detectVersionChanges, finalizeReleaseMergePlan, formatReleaseMergePlan } from "../cli/services/mergeService.js";

test("detectVersionChanges finds semver bumps in diff lines", () => {
  const change = detectVersionChanges(`
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@
-  "version": "0.1.0",
+  "version": "0.2.0",
  "name": "gitxplain"
`);

  assert.equal(change.hasVersionChange, true);
  assert.deepEqual(change.from, ["0.1.0"]);
  assert.deepEqual(change.to, ["0.2.0"]);
});

test("detectVersionChanges ignores non-version diff lines", () => {
  const change = detectVersionChanges(`
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@
-Old copy
+New copy
`);

  assert.equal(change.hasVersionChange, false);
  assert.deepEqual(change.from, []);
  assert.deepEqual(change.to, []);
});

test("formatReleaseMergePlan renders detected release commits", () => {
  const plan = finalizeReleaseMergePlan({
    sourceBranch: "feature/release-notes",
    releaseBranch: "release",
    baseRef: "main",
    commits: [
      {
        sha: "abcdef123456",
        shortSha: "abcdef1",
        subject: "chore: bump package version",
        files: ["package.json"],
        versionChange: {
          from: ["0.1.0"],
          to: ["0.2.0"],
          hasVersionChange: true
        }
      }
    ],
    versionChanges: [{ from: ["0.1.0"], to: ["0.2.0"] }]
  });

  const output = formatReleaseMergePlan(plan);

  assert.match(output, /Release Merge Plan/);
  assert.match(output, /feature\/release-notes/);
  assert.match(output, /merge: release 0.1.0 -> 0.2.0/);
  assert.match(output, /package\.json/);
});
