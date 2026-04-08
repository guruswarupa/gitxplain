import test from "node:test";
import assert from "node:assert/strict";
import {
  detectVersionChanges,
  finalizeReleaseMergePlan,
  formatReleaseMergePlan,
  selectReleaseCommits
} from "../cli/services/mergeService.js";

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
    lastReleasedVersionSummary: "0.1.0 -> 0.1.1",
    latestSourceVersionSummary: "0.1.1 -> 0.2.0",
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
    startRef: "abcdef1",
    endRef: "abcdef1"
  });

  const output = formatReleaseMergePlan(plan);

  assert.match(output, /Release Merge Plan/);
  assert.match(output, /feature\/release-notes/);
  assert.match(output, /release: promote 0.1.1 -> 0.2.0/);
  assert.match(output, /package\.json/);
});

test("selectReleaseCommits picks commits after the last released version bump", () => {
  const sourceCommits = [
    {
      shortSha: "1111111",
      subject: "feat: first change",
      files: ["a.js"],
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "2222222",
      subject: "chore: bump 0.1.0 to 0.1.1",
      files: ["package.json"],
      versionChange: { from: ["0.1.0"], to: ["0.1.1"], hasVersionChange: true }
    },
    {
      shortSha: "3333333",
      subject: "feat: second change",
      files: ["b.js"],
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "4444444",
      subject: "chore: bump 0.1.1 to 0.2.0",
      files: ["package.json"],
      versionChange: { from: ["0.1.1"], to: ["0.2.0"], hasVersionChange: true }
    }
  ];

  const selection = selectReleaseCommits(sourceCommits, "0.1.0 -> 0.1.1");

  assert.equal(selection.latestSourceVersionSummary, "0.1.1 -> 0.2.0");
  assert.deepEqual(
    selection.commitsToApply.map((commit) => commit.shortSha),
    ["3333333", "4444444"]
  );
});
