import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildReleaseTagPlan,
  buildReleaseMergePlan,
  buildReleaseStatus,
  buildReleaseWindows,
  detectVersionChanges,
  executeReleaseMerge,
  executeReleaseTagPlan,
  finalizeReleaseMergePlan,
  finalizeReleaseTagPlan,
  formatReleaseMergePlan,
  formatReleaseStatus,
  formatReleaseTagPlan,
  selectReleaseTags,
  selectReleaseTagsFromReleaseCommits,
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

test("selectReleaseWindows keeps all unreleased versions in order when some exist already", () => {
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

  assert.equal(selection.windows.length, 2);
  assert.deepEqual(selection.windows.map((window) => window.version), ["0.1.2", "0.1.3"]);
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
  assert.equal(selection.tags[0].tagName, "v0.1.2");
  assert.equal(selection.tags[0].targetSha, "4444444444444444444444444444444444444444");
  assert.equal(selection.tags[0].targetShortSha, "4444444");
});

test("selectReleaseTags keeps direct version jumps without inventing intermediate tags", () => {
  const sourceCommits = [
    {
      sha: "1111111111111111111111111111111111111111",
      shortSha: "1111111",
      subject: "chore: bump version to 0.1.5",
      releaseVersion: "0.1.5",
      versionChange: { from: ["0.1.4"], to: ["0.1.5"], hasVersionChange: true }
    },
    {
      sha: "2222222222222222222222222222222222222222",
      shortSha: "2222222",
      subject: "chore: bump version to 0.1.7",
      releaseVersion: "0.1.7",
      versionChange: { from: ["0.1.5"], to: ["0.1.7"], hasVersionChange: true }
    }
  ];

  const selection = selectReleaseTags(sourceCommits, ["0.1.5"]);

  assert.deepEqual(selection.taggedVersions, ["0.1.5"]);
  assert.equal(selection.latestDetectedVersion, "0.1.7");
  assert.deepEqual(selection.tags.map((tag) => tag.tagName), ["v0.1.7"]);
  assert.equal(selection.tags[0].targetShortSha, "2222222");
});

test("selectReleaseTags keeps only the latest window for repeated versions", () => {
  const sourceCommits = [
    {
      sha: "1111111111111111111111111111111111111111",
      shortSha: "1111111",
      subject: "bump 0.1.0",
      releaseVersion: "0.1.0",
      versionChange: { from: [], to: ["0.1.0"], hasVersionChange: false }
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
      subject: "reset to 0.1.0",
      releaseVersion: "0.1.0",
      versionChange: { from: ["0.1.2"], to: ["0.1.0"], hasVersionChange: true }
    },
    {
      sha: "4444444444444444444444444444444444444444",
      shortSha: "4444444",
      subject: "bump 0.1.2 again",
      releaseVersion: "0.1.2",
      versionChange: { from: ["0.1.0"], to: ["0.1.2"], hasVersionChange: true }
    }
  ];

  const selection = selectReleaseTags(sourceCommits, []);

  assert.deepEqual(selection.tags.map((tag) => tag.tagName), ["v0.1.1", "v0.1.0", "v0.1.2"]);
  assert.deepEqual(selection.tags.map((tag) => tag.targetShortSha), ["2222222", "3333333", "4444444"]);
});

test("selectReleaseTags moves an existing tag when the latest commit for that version changed", () => {
  const sourceCommits = [
    {
      sha: "1111111111111111111111111111111111111111",
      shortSha: "1111111",
      subject: "bump 0.1.8",
      releaseVersion: "0.1.8",
      versionChange: { from: ["0.1.7"], to: ["0.1.8"], hasVersionChange: true }
    },
    {
      sha: "2222222222222222222222222222222222222222",
      shortSha: "2222222",
      subject: "docs for 0.1.8",
      releaseVersion: "0.1.8",
      versionChange: { from: [], to: [], hasVersionChange: false }
    }
  ];

  const selection = selectReleaseTags(sourceCommits, ["0.1.8"], [
    {
      tagName: "0.1.8",
      targetSha: "1111111111111111111111111111111111111111"
    }
  ]);

  assert.deepEqual(selection.taggedVersions, ["0.1.8"]);
  assert.deepEqual(selection.tags.map((tag) => tag.tagName), ["0.1.8"]);
  assert.equal(selection.tags[0].needsMove, true);
  assert.equal(selection.tags[0].targetShortSha, "2222222");
});

test("selectReleaseTagsFromReleaseCommits maps each untagged release commit to a tag", () => {
  const releaseCommits = [
    {
      sha: "1111111111111111111111111111111111111111",
      shortSha: "1111111",
      subject: "release 0.1.2",
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      sha: "2222222222222222222222222222222222222222",
      shortSha: "2222222",
      subject: "release 0.1.1",
      versionChange: { from: [], to: [], hasVersionChange: false }
    },
    {
      sha: "3333333333333333333333333333333333333333",
      shortSha: "3333333",
      subject: "release 0.1.0",
      versionChange: { from: [], to: [], hasVersionChange: false }
    }
  ];

  const selection = selectReleaseTagsFromReleaseCommits(releaseCommits, ["0.1.1"]);

  assert.deepEqual(selection.taggedVersions, ["0.1.1"]);
  assert.equal(selection.latestDetectedVersion, "0.1.0");
  assert.deepEqual(selection.tags.map((tag) => tag.tagName), ["v0.1.2", "v0.1.0"]);
  assert.equal(selection.tags[0].targetSha, "1111111111111111111111111111111111111111");
  assert.equal(selection.tags[1].targetSha, "3333333333333333333333333333333333333333");
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
        tagName: "v0.1.2",
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
  assert.match(output, /tag v0\.1\.2/);
  assert.match(output, /Target Commit: 4444444 chore: bump to 0\.1\.2/);
});

test("formatReleaseStatus renders release health sections", () => {
  const output = formatReleaseStatus({
    sourceBranch: "main",
    releaseBranch: "release",
    currentBranch: "main",
    health: "needs attention",
    latestSourceVersion: "0.1.3",
    latestReleaseVersion: "0.1.2",
    latestTaggedVersion: "0.1.1",
    unmergedVersions: ["0.1.3"],
    missingTagVersions: ["v0.1.2"],
    drift: {
      summary: "main and release do not share a merge base. This is expected when the release branch is orphaned.",
      sourceOnlyCount: 4,
      releaseOnlyCount: 3
    },
    mergePlan: {
      windows: [{ version: "0.1.3", startRef: "aaaaaaa", endRef: "bbbbbbb" }]
    },
    tagPlan: {
      tags: [{ tagName: "v0.1.2", targetShortSha: "ccccccc", targetSubject: "release 0.1.2" }]
    },
    nextRecommendedAction: "Run `gitxplain --merge --execute` first, then `gitxplain --tag --execute` to finish tagging release commits."
  });

  assert.match(output, /Release Status/);
  assert.match(output, /Overall: needs attention/);
  assert.match(output, /Unmerged Version Bumps/);
  assert.match(output, /0\.1\.3 \(aaaaaaa\.\.bbbbbbb\)/);
  assert.match(output, /Missing Release Tags/);
  assert.match(output, /v0\.1\.2 -> ccccccc release 0\.1\.2/);
  assert.match(output, /Branch Drift/);
  assert.match(output, /Next Recommended Action:/);
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

test("executeReleaseMerge applies every unreleased window onto an existing release branch", () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-release-existing-"));
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

    let plan = finalizeReleaseMergePlan(buildReleaseMergePlan(repoDir));
    executeReleaseMerge(plan, repoDir);
    runGit("checkout", "main");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.2" }, null, 2)}\n`);
    runGit("commit", "-am", "chore: bump version to 0.1.2");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.3" }, null, 2)}\n`);
    runGit("commit", "-am", "chore: bump version to 0.1.3");

    plan = finalizeReleaseMergePlan(buildReleaseMergePlan(repoDir));

    assert.deepEqual(plan.windows.map((window) => window.version), ["0.1.2", "0.1.3"]);

    executeReleaseMerge(plan, repoDir);

    const releaseSubjects = runGit("log", "--format=%s", "release")
      .split("\n")
      .filter(Boolean);

    assert.deepEqual(releaseSubjects, ["release 0.1.3", "release 0.1.2", "release 0.1.1", "release 0.1.0"]);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("executeReleaseMerge can advance a legacy release branch whose tree no longer matches main", () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-release-legacy-"));
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

    writeFileSync(
      path.join(repoDir, "package.json"),
      `${JSON.stringify({ name: "gitxplain", version: "0.1.1", scripts: { test: "node --test" } }, null, 2)}\n`
    );
    runGit("commit", "-am", "chore: bump version to 0.1.1");

    writeFileSync(
      path.join(repoDir, "package.json"),
      `${JSON.stringify({ name: "gitxplain", version: "0.1.2", scripts: { test: "node --test", lint: "node --check cli/index.js" } }, null, 2)}\n`
    );
    writeFileSync(path.join(repoDir, "README.md"), "release notes for 0.1.2\n");
    runGit("add", "package.json", "README.md");
    runGit("commit", "-m", "chore: bump version to 0.1.2");

    runGit("checkout", "--orphan", "release");
    runGit("rm", "-r", "--cached", "--ignore-unmatch", ".");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.0" }, null, 2)}\n`);
    runGit("add", "package.json");
    runGit("commit", "-m", "release 0.1.0");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.1" }, null, 2)}\n`);
    runGit("commit", "-am", "release 0.1.1");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.2" }, null, 2)}\n`);
    runGit("commit", "-am", "release 0.1.2");
    runGit("clean", "-fd");
    runGit("checkout", "main");

    writeFileSync(
      path.join(repoDir, "package.json"),
      `${JSON.stringify(
        {
          name: "gitxplain",
          version: "0.1.3",
          scripts: {
            test: "node --test",
            lint: "node --check cli/index.js && node --check cli/services/pipelineService.js"
          }
        },
        null,
        2
      )}\n`
    );
    writeFileSync(path.join(repoDir, "README.md"), "release notes for 0.1.3\n");
    mkdirSync(path.join(repoDir, "cli"), { recursive: true });
    writeFileSync(path.join(repoDir, "cli/index.js"), "console.log('0.1.3');\n");
    runGit("add", "package.json", "README.md", "cli/index.js");
    runGit("commit", "-m", "chore: bump version to 0.1.3");

    const sourceHeadSha = runGit("rev-parse", "HEAD");
    const plan = finalizeReleaseMergePlan(buildReleaseMergePlan(repoDir));
    executeReleaseMerge(plan, repoDir);

    assert.equal(runGit("rev-parse", "--abbrev-ref", "HEAD"), "release");
    assert.equal(runGit("show", "release:package.json"), runGit("show", `${sourceHeadSha}:package.json`));
    assert.equal(runGit("show", "release:README.md"), runGit("show", `${sourceHeadSha}:README.md`));
    assert.equal(runGit("show", "release:cli/index.js"), runGit("show", `${sourceHeadSha}:cli/index.js`));

    const releaseSubjects = runGit("log", "--format=%s", "release")
      .split("\n")
      .filter(Boolean);

    assert.deepEqual(releaseSubjects, ["release 0.1.3", "release 0.1.2", "release 0.1.1", "release 0.1.0"]);
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
    assert.deepEqual(tagPlan.tags.map((tag) => tag.tagName), ["v0.1.1"]);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("buildReleaseTagPlan works without a release branch", () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-tag-no-release-"));
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

    const tagPlan = finalizeReleaseTagPlan(buildReleaseTagPlan(repoDir));

    assert.equal(tagPlan.releaseExists, false);
    assert.equal(tagPlan.baseRef, "HEAD");
    assert.equal(tagPlan.latestDetectedVersion, "0.1.1");
    assert.equal(tagPlan.latestTaggedVersion, "0.1.0");
    assert.deepEqual(tagPlan.tags.map((tag) => tag.tagName), ["v0.1.1"]);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("buildReleaseStatus reports missing tags and unmerged versions for an orphan release branch", () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-release-status-"));
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

    const firstMergePlan = finalizeReleaseMergePlan(buildReleaseMergePlan(repoDir));
    executeReleaseMerge(firstMergePlan, repoDir);
    runGit("tag", "-a", "0.1.1", "release", "-m", "release 0.1.1");
    runGit("checkout", "main");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.2" }, null, 2)}\n`);
    runGit("commit", "-am", "chore: bump version to 0.1.2");

    const status = buildReleaseStatus(repoDir);

    assert.equal(status.health, "needs attention");
    assert.equal(status.releaseExists, true);
    assert.equal(status.latestSourceVersion, "0.1.2");
    assert.equal(status.latestReleaseVersion, "0.1.1");
    assert.equal(status.latestTaggedVersion, "0.1.1");
    assert.deepEqual(status.unmergedVersions, ["0.1.2"]);
    assert.deepEqual(status.missingTagVersions, ["v0.1.0", "v0.1.2"]);
    assert.equal(status.drift.disconnectedHistory, true);
    assert.match(status.nextRecommendedAction, /merge --execute/);
    assert.match(status.nextRecommendedAction, /tag --execute/);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("buildReleaseTagPlan tags every untagged release commit on the release branch", () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-tag-release-"));
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

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.2" }, null, 2)}\n`);
    runGit("commit", "-am", "chore: bump version to 0.1.2");

    const mergePlan = finalizeReleaseMergePlan(buildReleaseMergePlan(repoDir));
    executeReleaseMerge(mergePlan, repoDir);
    runGit("tag", "-a", "0.1.1", "release~1", "-m", "release 0.1.1");
    runGit("checkout", "main");

    const tagPlan = finalizeReleaseTagPlan(buildReleaseTagPlan(repoDir));

    assert.equal(tagPlan.releaseExists, true);
    assert.equal(tagPlan.mergeBase, null);
    assert.deepEqual(tagPlan.taggedVersions, ["0.1.1"]);
    assert.equal(tagPlan.latestDetectedVersion, "0.1.2");
    assert.equal(tagPlan.latestTaggedVersion, "0.1.1");
    assert.deepEqual(tagPlan.tags.map((tag) => tag.tagName), ["v0.1.0", "v0.1.2"]);
    assert.deepEqual(tagPlan.tags.map((tag) => tag.targetSubject), ["chore: scaffold app", "chore: bump version to 0.1.2"]);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("buildReleaseTagPlan follows source history even when release branch exists", () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-tag-source-history-"));
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

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.5" }, null, 2)}\n`);
    runGit("add", "package.json");
    runGit("commit", "-m", "chore: scaffold app");
    runGit("tag", "-a", "0.1.5", "-m", "release 0.1.5");

    const mergePlan = finalizeReleaseMergePlan(buildReleaseMergePlan(repoDir));
    executeReleaseMerge(mergePlan, repoDir);
    runGit("checkout", "main");

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.7" }, null, 2)}\n`);
    runGit("commit", "-am", "chore: bump version to 0.1.7");

    const tagPlan = finalizeReleaseTagPlan(buildReleaseTagPlan(repoDir));

    assert.equal(tagPlan.releaseExists, true);
    assert.equal(tagPlan.latestDetectedVersion, "0.1.7");
    assert.equal(tagPlan.latestTaggedVersion, "0.1.5");
    assert.deepEqual(tagPlan.tags.map((tag) => tag.tagName), ["v0.1.7"]);
    assert.equal(tagPlan.tags[0].targetSubject, "chore: bump version to 0.1.7");
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("buildReleaseTagPlan moves an existing tag to the latest commit for the same version", () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "gitxplain-tag-move-existing-"));
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

    writeFileSync(path.join(repoDir, "package.json"), `${JSON.stringify({ name: "gitxplain", version: "0.1.8" }, null, 2)}\n`);
    runGit("add", "package.json");
    runGit("commit", "-m", "chore: bump version to 0.1.8");
    runGit("tag", "-a", "0.1.8", "-m", "release 0.1.8");

    writeFileSync(path.join(repoDir, "README.md"), "docs update after 0.1.8\n");
    runGit("add", "README.md");
    runGit("commit", "-m", "docs: follow-up for 0.1.8");

    const tagPlan = finalizeReleaseTagPlan(buildReleaseTagPlan(repoDir));

    assert.deepEqual(tagPlan.taggedVersions, ["0.1.8"]);
    assert.deepEqual(tagPlan.tags.map((tag) => tag.tagName), ["0.1.8"]);
    assert.equal(tagPlan.tags[0].needsMove, true);
    assert.equal(tagPlan.tags[0].targetSubject, "docs: follow-up for 0.1.8");

    executeReleaseTagPlan(tagPlan, repoDir);

    assert.equal(runGit("rev-list", "-n", "1", "0.1.8"), runGit("rev-parse", "HEAD"));
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});
