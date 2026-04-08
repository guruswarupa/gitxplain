import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReleaseWindows,
  detectVersionChanges,
  finalizeReleaseMergePlan,
  formatReleaseMergePlan,
  selectReleaseWindows
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

test("detectVersionChanges reads Android Gradle app versions", () => {
  const change = detectVersionChanges(`
diff --git a/android/app/build.gradle b/android/app/build.gradle
--- a/android/app/build.gradle
+++ b/android/app/build.gradle
@@
-        versionCode 14
-        versionName "1.4.0"
+        versionCode 15
+        versionName "1.5.0"
`);

  assert.equal(change.hasVersionChange, true);
  assert.deepEqual(change.from, ["14", "1.4.0"]);
  assert.deepEqual(change.to, ["15", "1.5.0"]);
  assert.equal(change.releaseVersion, "1.5.0");
});

test("detectVersionChanges ignores Gradle wrapper distribution versions", () => {
  const change = detectVersionChanges(`
diff --git a/android/gradle/wrapper/gradle-wrapper.properties b/android/gradle/wrapper/gradle-wrapper.properties
--- a/android/gradle/wrapper/gradle-wrapper.properties
+++ b/android/gradle/wrapper/gradle-wrapper.properties
@@
-distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
+distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip
`);

  assert.equal(change.hasVersionChange, false);
  assert.deepEqual(change.from, []);
  assert.deepEqual(change.to, []);
  assert.equal(change.releaseVersion, null);
});

test("buildReleaseWindows groups commits by release version and merges repeated bumps", () => {
  const sourceCommits = [
    {
      shortSha: "1111111",
      subject: "docs: start release work",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "2222222",
      subject: "feat: finish release 0.1.1",
      releaseVersion: "0.1.1",
      versionChange: { from: ["0.1.0"], to: ["0.1.1"], hasVersionChange: true }
    },
    {
      shortSha: "3333333",
      subject: "fix: follow-up for 0.1.1",
      releaseVersion: "0.1.1",
      versionChange: { from: ["0.1.1"], to: ["0.1.1"], hasVersionChange: false }
    },
    {
      shortSha: "4444444",
      subject: "feat: start release 0.1.2",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "5555555",
      subject: "chore: bump to 0.1.2",
      releaseVersion: "0.1.2",
      versionChange: { from: ["0.1.1"], to: ["0.1.2"], hasVersionChange: true }
    }
  ];

  const windows = buildReleaseWindows(sourceCommits);

  assert.equal(windows.length, 2);
  assert.equal(windows[0].version, "0.1.1");
  assert.deepEqual(windows[0].commits.map((commit) => commit.shortSha), ["1111111", "2222222", "3333333", "4444444"]);
  assert.equal(windows[1].version, "0.1.2");
  assert.deepEqual(windows[1].commits.map((commit) => commit.shortSha), ["5555555"]);
});

test("selectReleaseWindows skips versions already released", () => {
  const sourceCommits = [
    {
      shortSha: "1111111",
      subject: "docs: start release work",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "2222222",
      subject: "chore: bump to 0.1.1",
      releaseVersion: "0.1.1",
      versionChange: { from: ["0.1.0"], to: ["0.1.1"], hasVersionChange: true }
    },
    {
      shortSha: "3333333",
      subject: "feat: follow-up",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "4444444",
      subject: "chore: bump to 0.1.2",
      releaseVersion: "0.1.2",
      versionChange: { from: ["0.1.1"], to: ["0.1.2"], hasVersionChange: true }
    }
  ];

  const releaseCommits = [
    {
      subject: "release 0.1.1",
      releaseVersion: null
    }
  ];

  const selection = selectReleaseWindows(sourceCommits, releaseCommits);

  assert.deepEqual(selection.releasedVersions, ["0.1.1"]);
  assert.equal(selection.windows.length, 1);
  assert.equal(selection.windows[0].version, "0.1.2");
  assert.deepEqual(selection.windows[0].commits.map((commit) => commit.shortSha), ["4444444"]);
});

test("selectReleaseWindows returns all windows when no versions were released yet", () => {
  const sourceCommits = [
    {
      shortSha: "1111111",
      subject: "docs: prep 0.1.1",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "2222222",
      subject: "chore: bump to 0.1.1",
      releaseVersion: "0.1.1",
      versionChange: { from: ["0.1.0"], to: ["0.1.1"], hasVersionChange: true }
    },
    {
      shortSha: "3333333",
      subject: "docs: prep 0.1.2",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "4444444",
      subject: "chore: bump to 0.1.2",
      releaseVersion: "0.1.2",
      versionChange: { from: ["0.1.1"], to: ["0.1.2"], hasVersionChange: true }
    }
  ];

  const selection = selectReleaseWindows(sourceCommits, []);

  assert.equal(selection.windows.length, 2);
  assert.deepEqual(selection.windows.map((window) => window.version), ["0.1.1", "0.1.2"]);
});

test("selectReleaseWindows picks only the latest unreleased version when some exist already", () => {
  const sourceCommits = [
    {
      shortSha: "1111111",
      subject: "prep 0.1.1",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "2222222",
      subject: "bump 0.1.1",
      releaseVersion: "0.1.1",
      versionChange: { from: ["0.1.0"], to: ["0.1.1"], hasVersionChange: true }
    },
    {
      shortSha: "3333333",
      subject: "prep 0.1.2",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "4444444",
      subject: "bump 0.1.2",
      releaseVersion: "0.1.2",
      versionChange: { from: ["0.1.1"], to: ["0.1.2"], hasVersionChange: true }
    },
    {
      shortSha: "5555555",
      subject: "prep 0.1.3",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      shortSha: "6666666",
      subject: "bump 0.1.3",
      releaseVersion: "0.1.3",
      versionChange: { from: ["0.1.2"], to: ["0.1.3"], hasVersionChange: true }
    }
  ];

  const releaseCommits = [{ subject: "release 0.1.1", releaseVersion: null }];
  const selection = selectReleaseWindows(sourceCommits, releaseCommits);

  assert.equal(selection.windows.length, 1);
  assert.equal(selection.windows[0].version, "0.1.3");
});

test("formatReleaseMergePlan renders release commit plan", () => {
  const plan = finalizeReleaseMergePlan({
    sourceBranch: "main",
    releaseBranch: "release",
    baseRef: "release",
    releasedVersions: ["0.1.1"],
    latestDetectedVersion: "0.1.2",
    windows: [
      {
        version: "0.1.2",
        startRef: "3333333",
        endRef: "4444444",
        commits: [
          {
            shortSha: "3333333",
            subject: "feat: follow-up",
            versionChange: { from: [], to: [], hasVersionChange: false }
          },
          {
            shortSha: "4444444",
            subject: "chore: bump to 0.1.2",
            versionChange: { from: ["0.1.1"], to: ["0.1.2"], hasVersionChange: true }
          }
        ]
      }
    ]
  });

  const output = formatReleaseMergePlan(plan);

  assert.match(output, /Release Merge Plan/);
  assert.match(output, /release 0\.1\.2/);
  assert.match(output, /Commit Range: 3333333\.\.4444444/);
  assert.match(output, /Version: 0\.1\.1 -> 0\.1\.2/);
});
