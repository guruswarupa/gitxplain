import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildReleaseTagPlan,
  buildReleaseMergePlan,
  buildReleaseWindows,
  detectVersionChanges,
  executeReleaseMerge,
  finalizeReleaseMergePlan,
  finalizeReleaseTagPlan,
  formatReleaseMergePlan,
  formatReleaseTagPlan,
  selectReleaseTags,
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

test("selectReleaseTags maps each unreleased version to the release window end commit", () => {
  const sourceCommits = [
    {
      sha: "1111111111111111111111111111111111111111",
      shortSha: "1111111",
      subject: "docs: prep 0.1.1",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      sha: "2222222222222222222222222222222222222222",
      shortSha: "2222222",
      subject: "bump 0.1.1",
      releaseVersion: "0.1.1",
      versionChange: { from: ["0.1.0"], to: ["0.1.1"], hasVersionChange: true }
    },
    {
      sha: "3333333333333333333333333333333333333333",
      shortSha: "3333333",
      subject: "follow-up for 0.1.1",
      releaseVersion: null,
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      sha: "4444444444444444444444444444444444444444",
      shortSha: "4444444",
      subject: "bump 0.1.2",
      releaseVersion: "0.1.2",
      versionChange: { from: ["0.1.1"], to: ["0.1.2"], hasVersionChange: true }
    }
  ];

  const selection = selectReleaseTags(sourceCommits, ["0.1.1"]);

  assert.deepEqual(selection.taggedVersions, ["0.1.1"]);
  assert.equal(selection.tags.length, 1);
  assert.equal(selection.tags[0].tagName, "0.1.2");
  assert.equal(selection.tags[0].targetSha, "4444444444444444444444444444444444444444");
  assert.equal(selection.tags[0].targetShortSha, "4444444");
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

test("formatReleaseTagPlan renders release tag targets", () => {
  const plan = finalizeReleaseTagPlan({
    sourceBranch: "main",
    baseRef: "release",
    taggedVersions: ["0.1.1"],
    latestDetectedVersion: "0.1.2",
    tags: [
      {
        tagName: "0.1.2",
        version: "0.1.2",
        startRef: "3333333",
        endRef: "4444444",
        targetShortSha: "4444444",
        targetSubject: "chore: bump to 0.1.2",
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

  const output = formatReleaseTagPlan(plan);

  assert.match(output, /Release Tag Plan/);
  assert.match(output, /tag 0\.1\.2/);
  assert.match(output, /Target Commit: 4444444 chore: bump to 0\.1\.2/);
});

test("executeReleaseMerge creates an orphan release branch without an initialization commit", () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-release-"));
  const runGit = (...args) =>
    execFileSync("git", args, {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();

  try {
    runGit("init", "-b", "main");
    runGit("config", "user.name", "Test User");
    runGit("config", "user.email", "test@example.com");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.0" }, null, 2)}\n`);
    runGit("add", "package.json");
    runGit("commit", "-m", "chore: scaffold app");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.1" }, null, 2)}\n`);
    runGit("commit", "-am", "chore: bump version to 0.1.1");

    const plan = finalizeReleaseMergePlan(buildReleaseMergePlan(repoDir));
    executeReleaseMerge(plan, repoDir);

    const releaseSubjects = runGit("log", "--format=%s", "release")
      .split("\n")
      .filter(Boolean);

    assert.deepEqual(releaseSubjects, ["release 0.1.1", "release 0.1.0"]);
    assert.equal(releaseSubjects.includes("chore: initialize release branch"), false);

    let hasMergeBase = true;
    try {
      runGit("merge-base", "main", "release");
    } catch {
      hasMergeBase = false;
    }

    assert.equal(hasMergeBase, false);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("buildReleaseTagPlan works when release is disconnected from main", () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-tag-"));
  const runGit = (...args) =>
    execFileSync("git", args, {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();

  try {
    runGit("init", "-b", "main");
    runGit("config", "user.name", "Test User");
    runGit("config", "user.email", "test@example.com");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.0" }, null, 2)}\n`);
    runGit("add", "package.json");
    runGit("commit", "-m", "chore: scaffold app");
    runGit("tag", "-a", "0.1.0", "-m", "release 0.1.0");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.1" }, null, 2)}\n`);
    runGit("commit", "-am", "chore: bump version to 0.1.1");

    const mergePlan = finalizeReleaseMergePlan(buildReleaseMergePlan(repoDir));
    executeReleaseMerge(mergePlan, repoDir);
    runGit("checkout", "main");

    const tagPlan = finalizeReleaseTagPlan(buildReleaseTagPlan(repoDir));

    assert.equal(tagPlan.releaseExists, true);
    assert.equal(tagPlan.mergeBase, null);
    assert.deepEqual(tagPlan.taggedVersions, ["0.1.0"]);
    assert.deepEqual(tagPlan.tags.map((tag) => tag.tagName), ["0.1.1"]);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});
