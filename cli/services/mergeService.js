import process from "node:process";
import {
  createCommitFromTree,
  getCommitMetadata,
  getCurrentBranchName,
  getDefaultBaseRef,
  getMergeBase,
  gitCheckout,
  gitCreateBranch,
  gitCreateAnnotatedTag,
  gitDeleteBranch,
  gitForceBranch,
  gitDeleteTag,
  isWorkingTreeClean,
  listBranchCommits,
  listCommitsAfter,
  listTags,
  listTagTargets,
  localBranchExists,
  resolveTreeSha,
  resolveCommitSha,
  runGitCommand
} from "./gitService.js";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  cyan: "\u001b[36m",
  yellow: "\u001b[33m",
  green: "\u001b[32m"
};

const RELEASE_BRANCH = "release";
const VERSION_PATTERN = /\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?\b/g;
const RELEASE_SUBJECT_PATTERN = /^release\s+(.+)$/i;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const INTEGER_PATTERN = /^\d+$/;
const TAG_VERSION_PATTERN = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?|\d+)$/;

function supportsColor() {
  return Boolean(process.stdout?.isTTY) && process.env.NO_COLOR == null;
}

function colorize(text, color) {
  if (!supportsColor()) {
    return text;
  }

  return `${color}${text}${ANSI.reset}`;
}

function unique(values) {
  return [...new Set(values)];
}

function extractVersions(line) {
  return unique(line.match(VERSION_PATTERN) ?? []);
}

function stripDiffPrefix(line) {
  return line.slice(1).trim();
}

function parseDiffPath(line) {
  const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
  return match ? match[2] : null;
}

function isExactFilename(filePath, filename) {
  return filePath === filename || filePath.endsWith(`/${filename}`);
}

function extractVersionCandidate(filePath, line) {
  const trimmed = line.trim();

  if (filePath == null || trimmed === "") {
    return null;
  }

  if (isExactFilename(filePath, "package.json")) {
    return trimmed.match(/^"version"\s*:\s*"([^"]+)"[,]?$/)?.[1] ?? null;
  }

  if (isExactFilename(filePath, "pubspec.yaml")) {
    return trimmed.match(/^version:\s*([^\s#]+)$/)?.[1] ?? null;
  }

  if (isExactFilename(filePath, "Cargo.toml")) {
    return trimmed.match(/^version\s*=\s*"([^"]+)"$/)?.[1] ?? null;
  }

  if (isExactFilename(filePath, "pom.xml")) {
    return trimmed.match(/^<version>([^<]+)<\/version>$/)?.[1] ?? null;
  }

  if (filePath.endsWith(".csproj")) {
    return (
      trimmed.match(/^<Version>([^<]+)<\/Version>$/)?.[1] ??
      trimmed.match(/^<ApplicationDisplayVersion>([^<]+)<\/ApplicationDisplayVersion>$/)?.[1] ??
      trimmed.match(/^<ApplicationVersion>([^<]+)<\/ApplicationVersion>$/)?.[1] ??
      null
    );
  }

  if (isExactFilename(filePath, "Info.plist")) {
    return (
      trimmed.match(/^<string>([^<]+)<\/string>$/)?.[1] ??
      null
    );
  }

  if (filePath.endsWith("AndroidManifest.xml")) {
    return (
      trimmed.match(/versionName="([^"]+)"/)?.[1] ??
      trimmed.match(/versionCode="([^"]+)"/)?.[1] ??
      null
    );
  }

  if (filePath.endsWith("build.gradle") || filePath.endsWith("build.gradle.kts")) {
    return (
      trimmed.match(/^versionName\s*[= ]\s*["']?([^"'\s]+)["']?$/)?.[1] ??
      trimmed.match(/^versionCode\s*[= ]\s*["']?([^"'\s]+)["']?$/)?.[1] ??
      trimmed.match(/^version\s*=\s*["']([^"']+)["']$/)?.[1] ??
      null
    );
  }

  if (isExactFilename(filePath, "gradle.properties")) {
    return (
      trimmed.match(/^(?:VERSION_NAME|versionName)\s*=\s*(\S+)$/)?.[1] ??
      trimmed.match(/^(?:VERSION_CODE|versionCode)\s*=\s*(\S+)$/)?.[1] ??
      null
    );
  }

  if (
    isExactFilename(filePath, "VERSION") ||
    isExactFilename(filePath, ".version") ||
    isExactFilename(filePath, "version.txt")
  ) {
    return (SEMVER_PATTERN.test(trimmed) || INTEGER_PATTERN.test(trimmed)) ? trimmed : null;
  }

  return null;
}

function rankVersionValue(value) {
  if (SEMVER_PATTERN.test(value)) {
    return 2;
  }

  if (INTEGER_PATTERN.test(value)) {
    return 1;
  }

  return 0;
}

function selectReleaseVersion(values) {
  return [...values].sort((left, right) => rankVersionValue(right) - rankVersionValue(left))[0] ?? null;
}

export function detectVersionChanges(diff) {
  const removedVersions = [];
  const addedVersions = [];
  let currentFile = null;

  for (const line of diff.split("\n")) {
    const diffPath = parseDiffPath(line);
    if (diffPath) {
      currentFile = diffPath;
      continue;
    }

    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith("-")) {
      const candidate = extractVersionCandidate(currentFile, stripDiffPrefix(line));
      if (candidate) {
        removedVersions.push(candidate);
      }
      continue;
    }

    if (line.startsWith("+")) {
      const candidate = extractVersionCandidate(currentFile, stripDiffPrefix(line));
      if (candidate) {
        addedVersions.push(candidate);
      }
    }
  }

  const removed = unique(removedVersions);
  const added = unique(addedVersions);
  const from = removed.filter((version) => !added.includes(version));
  const to = added.filter((version) => !removed.includes(version));

  return {
    from,
    to,
    hasVersionChange: from.length > 0 && to.length > 0,
    releaseVersion: selectReleaseVersion(to)
  };
}

function getReleaseVersion(change) {
  return change.releaseVersion ?? null;
}

function getCommitSubject(ref, cwd) {
  return runGitCommand(["log", "-1", "--pretty=format:%s", ref], cwd);
}

function getCommitFiles(ref, cwd) {
  const output = runGitCommand(["show", "--pretty=format:", "--name-only", ref], cwd);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCommitDiff(ref, cwd) {
  return runGitCommand(["show", "--format=", ref], cwd);
}

function inspectCommit(sha, cwd) {
  const subject = getCommitSubject(sha, cwd);
  const versionChange = detectVersionChanges(getCommitDiff(sha, cwd));

  return {
    sha,
    shortSha: sha.slice(0, 7),
    subject,
    files: getCommitFiles(sha, cwd),
    versionChange,
    releaseVersion: getReleaseVersion(versionChange)
  };
}

function summarizeVersionPair(change) {
  return `${change.from.join(", ")} -> ${change.to.join(", ")}`;
}

function getReleasedVersions(releaseCommits) {
  const explicitVersions = releaseCommits
    .map((commit) => commit.subject.match(RELEASE_SUBJECT_PATTERN)?.[1]?.trim() ?? null)
    .filter(Boolean);

  const fallbackVersions = releaseCommits
    .map((commit) => commit.releaseVersion)
    .filter(Boolean);

  return new Set([...explicitVersions, ...fallbackVersions]);
}

function extractTaggedVersions(tagNames) {
  return new Set(
    tagNames
      .map((tagName) => tagName.match(TAG_VERSION_PATTERN)?.[1] ?? null)
      .filter(Boolean)
  );
}

export function buildReleaseWindows(sourceCommits) {
  const windows = [];
  let windowStartIndex = 0;
  let activeVersion = null;

  for (let index = 0; index < sourceCommits.length; index += 1) {
    const commit = sourceCommits[index];
    if (!commit.releaseVersion) {
      continue;
    }

    if (activeVersion == null) {
      activeVersion = commit.releaseVersion;
      continue;
    }

    if (commit.releaseVersion === activeVersion) {
      continue;
    }

    const previousIndex = index - 1;
    windows.push({
      version: activeVersion,
      commits: sourceCommits.slice(windowStartIndex, previousIndex + 1),
      startRef: sourceCommits[windowStartIndex]?.shortSha ?? null,
      endRef: sourceCommits[previousIndex]?.shortSha ?? null
    });
    windowStartIndex = index;
    activeVersion = commit.releaseVersion;
  }

  if (activeVersion != null) {
    windows.push({
      version: activeVersion,
      commits: sourceCommits.slice(windowStartIndex),
      startRef: sourceCommits[windowStartIndex]?.shortSha ?? null,
      endRef: sourceCommits.at(-1)?.shortSha ?? null
    });
  }

  return windows;
}

function selectLatestWindowsPerVersion(windows) {
  const seenVersions = new Set();
  const latestWindows = [];

  for (let index = windows.length - 1; index >= 0; index -= 1) {
    const window = windows[index];
    if (!window.version || seenVersions.has(window.version)) {
      continue;
    }

    seenVersions.add(window.version);
    latestWindows.push(window);
  }

  return latestWindows.reverse();
}

export function selectReleaseWindows(sourceCommits, releaseCommits = []) {
  const windows = buildReleaseWindows(sourceCommits);
  const releasedVersions = getReleasedVersions(releaseCommits);
  const unreleasedWindows = windows.filter((window) => !releasedVersions.has(window.version));

  return {
    windows: unreleasedWindows,
    releasedVersions: [...releasedVersions],
    latestDetectedVersion: windows.at(-1)?.version ?? null
  };
}

export function selectReleaseTags(sourceCommits, existingTagNames = [], existingTagTargets = []) {
  const windows = selectLatestWindowsPerVersion(buildReleaseWindows(sourceCommits));
  const taggedVersions = extractTaggedVersions(existingTagNames);
  const targetByVersion = new Map(
    existingTagTargets
      .map((tag) => {
        const version = tag.tagName?.match(TAG_VERSION_PATTERN)?.[1] ?? null;
        return version ? [version, tag.targetSha] : null;
      })
      .filter(Boolean)
  );
  const tags = windows
    .map((window) => {
      const targetCommit = window.commits.at(-1) ?? null;
      const existingTargetSha = targetByVersion.get(window.version) ?? null;
      const windowCommitShas = new Set(window.commits.map((commit) => commit.sha));

      return {
        ...window,
        tagName: window.version,
        existingTargetSha,
        needsMove:
          existingTargetSha != null &&
          targetCommit?.sha != null &&
          windowCommitShas.has(existingTargetSha) &&
          existingTargetSha !== targetCommit.sha,
        targetSha: targetCommit?.sha ?? null,
        targetShortSha: targetCommit?.shortSha ?? null,
        targetSubject: targetCommit?.subject ?? null
      };
    })
    .filter((tag) => !taggedVersions.has(tag.version) || tag.needsMove)
    .filter((tag) => tag.targetSha != null);

  return {
    tags,
    taggedVersions: [...taggedVersions],
    latestDetectedVersion: windows.at(-1)?.version ?? null
  };
}

function findLatestTaggedSourceVersion(sourceCommits, taggedVersions) {
  const tagged = new Set(taggedVersions);
  return selectLatestWindowsPerVersion(buildReleaseWindows(sourceCommits))
    .map((window) => window.version)
    .filter((version) => version && tagged.has(version))
    .at(-1) ?? null;
}

function buildReleaseTagPlanForSource(sourceBranch, sourceRef, cwd) {
  const sourceCommits = listBranchCommits(sourceRef, cwd).map((sha) => inspectCommit(sha, cwd));
  const existingTagNames = listTags(cwd);
  const existingTagTargets = listTagTargets(cwd);
  const selection = selectReleaseTags(sourceCommits, existingTagNames, existingTagTargets);

  return {
    sourceBranch,
    baseRef: sourceRef,
    mergeBase: null,
    releaseExists: localBranchExists(RELEASE_BRANCH, cwd),
    taggedVersions: selection.taggedVersions,
    latestDetectedVersion: selection.latestDetectedVersion,
    latestTaggedVersion: findLatestTaggedSourceVersion(sourceCommits, selection.taggedVersions),
    tags: selection.tags
  };
}

export function selectReleaseTagsFromReleaseCommits(releaseCommits, existingTagNames = []) {
  const taggedVersions = extractTaggedVersions(existingTagNames);
  const tags = releaseCommits
    .map((commit) => ({
      commit,
      version: commit.subject.match(RELEASE_SUBJECT_PATTERN)?.[1]?.trim() ?? null
    }))
    .filter((entry) => entry.version)
    .filter((entry) => !taggedVersions.has(entry.version))
    .map(({ commit, version }) => ({
      version,
      tagName: version,
      startRef: commit.shortSha,
      endRef: commit.shortSha,
      targetSha: commit.sha,
      targetShortSha: commit.shortSha,
      targetSubject: commit.subject,
      commits: [commit]
    }));

  return {
    tags,
    taggedVersions: [...taggedVersions],
    latestDetectedVersion:
      releaseCommits
        .map((commit) => commit.subject.match(RELEASE_SUBJECT_PATTERN)?.[1]?.trim() ?? null)
        .filter(Boolean)
        .at(-1) ?? null
  };
}

function getReleaseTrackSourceCommitShas(releaseExists, baseRef, sourceRef, cwd) {
  if (!releaseExists) {
    return {
      mergeBase: null,
      sourceCommitShas: listBranchCommits(sourceRef, cwd)
    };
  }

  try {
    const mergeBase = getMergeBase(baseRef, sourceRef, cwd);
    return {
      mergeBase,
      sourceCommitShas: listCommitsAfter(mergeBase, sourceRef, cwd)
    };
  } catch {
    return {
      mergeBase: null,
      sourceCommitShas: listBranchCommits(sourceRef, cwd)
    };
  }
}

function buildReleaseMergePlanForSource(sourceBranch, sourceRef, cwd) {
  const releaseExists = localBranchExists(RELEASE_BRANCH, cwd);
  const baseRef = releaseExists ? RELEASE_BRANCH : getDefaultBaseRef(cwd);
  const { mergeBase, sourceCommitShas } = getReleaseTrackSourceCommitShas(releaseExists, baseRef, sourceRef, cwd);
  const sourceCommits = sourceCommitShas.map((sha) => inspectCommit(sha, cwd));
  const releaseCommits = releaseExists ? listBranchCommits(RELEASE_BRANCH, cwd).map((sha) => inspectCommit(sha, cwd)) : [];
  const selection = selectReleaseWindows(sourceCommits, releaseCommits);

  return {
    releaseBranch: RELEASE_BRANCH,
    sourceBranch,
    baseRef,
    mergeBase,
    releaseExists,
    releasedVersions: selection.releasedVersions,
    latestDetectedVersion: selection.latestDetectedVersion,
    windows: selection.windows,
    createFromRef: releaseExists ? RELEASE_BRANCH : null
  };
}

export function buildReleaseMergePlan(cwd) {
  const sourceBranch = getCurrentBranchName(cwd);
  if (sourceBranch === RELEASE_BRANCH) {
    throw new Error(`Already on "${RELEASE_BRANCH}". Switch to a source branch before running --merge.`);
  }

  return buildReleaseMergePlanForSource(sourceBranch, "HEAD", cwd);
}

export function buildReleaseTagPlan(cwd) {
  const sourceBranch = getCurrentBranchName(cwd);
  if (sourceBranch === RELEASE_BRANCH) {
    throw new Error(`Already on "${RELEASE_BRANCH}". Switch to a source branch before running --tag.`);
  }

  return buildReleaseTagPlanForSource(sourceBranch, "HEAD", cwd);
}

export function finalizeReleaseMergePlan(plan) {
  return {
    ...plan,
    totalCommits: plan.windows.reduce((count, window) => count + window.commits.length, 0)
  };
}

export function finalizeReleaseTagPlan(plan) {
  return {
    ...plan,
    totalCommits: plan.tags.reduce((count, tag) => count + tag.commits.length, 0)
  };
}

function findLatestReleaseVersion(releaseCommits) {
  return releaseCommits
    .map((commit) => commit.subject.match(RELEASE_SUBJECT_PATTERN)?.[1]?.trim() ?? null)
    .filter(Boolean)
    .at(-1) ?? null;
}

function findLatestTaggedReleaseVersion(releaseCommits, taggedVersions) {
  const tagged = new Set(taggedVersions);
  return releaseCommits
    .map((commit) => commit.subject.match(RELEASE_SUBJECT_PATTERN)?.[1]?.trim() ?? null)
    .filter((version) => version && tagged.has(version))
    .at(-1) ?? null;
}

function buildDriftStatus(sourceRef, sourceLabel, releaseExists, cwd) {
  if (!releaseExists) {
    return {
      hasReleaseBranch: false,
      disconnectedHistory: false,
      sourceOnlyCount: listBranchCommits(sourceRef, cwd).length,
      releaseOnlyCount: 0,
      summary: `Release branch "${RELEASE_BRANCH}" does not exist yet.`
    };
  }

  try {
    const mergeBase = getMergeBase(sourceRef, RELEASE_BRANCH, cwd);
    const sourceOnlyCount = listCommitsAfter(mergeBase, sourceRef, cwd).length;
    const releaseOnlyCount = listCommitsAfter(mergeBase, RELEASE_BRANCH, cwd).length;

    return {
      hasReleaseBranch: true,
      disconnectedHistory: false,
      mergeBase,
      sourceOnlyCount,
      releaseOnlyCount,
      summary:
        sourceOnlyCount === 0 && releaseOnlyCount === 0
          ? `${sourceLabel} and ${RELEASE_BRANCH} point at the same history.`
          : `${sourceLabel} has ${sourceOnlyCount} unique commit(s); ${RELEASE_BRANCH} has ${releaseOnlyCount} unique commit(s).`
    };
  } catch {
    return {
      hasReleaseBranch: true,
      disconnectedHistory: true,
      mergeBase: null,
      sourceOnlyCount: listBranchCommits(sourceRef, cwd).length,
      releaseOnlyCount: listBranchCommits(RELEASE_BRANCH, cwd).length,
      summary: `${sourceLabel} and ${RELEASE_BRANCH} do not share a merge base. This is expected when the release branch is orphaned.`
    };
  }
}

function getNextRecommendedAction({ releaseExists, mergePlan, missingTagCount }) {
  if (!releaseExists && mergePlan.windows.length > 0) {
    return `Run \`gitxplain --merge --execute\` to create ${RELEASE_BRANCH} and promote ${mergePlan.windows.length} unreleased version(s).`;
  }

  if (!releaseExists && missingTagCount > 0) {
    return `Run \`gitxplain --tag --execute\` to create ${missingTagCount} missing version tag(s) on the current branch.`;
  }

  if (!releaseExists) {
    return `No ${RELEASE_BRANCH} branch exists yet, and no releasable version bumps were detected.`;
  }

  if (mergePlan.windows.length > 0 && missingTagCount > 0) {
    return `Run \`gitxplain --merge --execute\` to update ${RELEASE_BRANCH}, and \`gitxplain --tag --execute\` to create ${missingTagCount} missing version tag(s).`;
  }

  if (mergePlan.windows.length > 0) {
    return `Run \`gitxplain --merge --execute\` to promote ${mergePlan.windows.length} unreleased version(s) to ${RELEASE_BRANCH}.`;
  }

  if (missingTagCount > 0) {
    return `Run \`gitxplain --tag --execute\` to create ${missingTagCount} missing version tag(s).`;
  }

  return "No action required. Release branch and tags are up to date.";
}

export function buildReleaseStatus(cwd) {
  const currentBranch = getCurrentBranchName(cwd);
  const releaseExists = localBranchExists(RELEASE_BRANCH, cwd);
  const sourceBranch = currentBranch === RELEASE_BRANCH ? getDefaultBaseRef(cwd) : currentBranch;
  const sourceRef = currentBranch === RELEASE_BRANCH ? sourceBranch : "HEAD";
  const mergePlan = finalizeReleaseMergePlan(buildReleaseMergePlanForSource(sourceBranch, sourceRef, cwd));
  const releaseCommits = releaseExists ? listBranchCommits(RELEASE_BRANCH, cwd).map((sha) => inspectCommit(sha, cwd)) : [];
  const tagPlan = finalizeReleaseTagPlan(buildReleaseTagPlanForSource(sourceBranch, sourceRef, cwd));
  const drift = buildDriftStatus(sourceRef, sourceBranch, releaseExists, cwd);
  const missingTagVersions = tagPlan.tags.map((tag) => tag.tagName);
  const unmergedVersions = mergePlan.windows.map((window) => window.version);

  return {
    sourceBranch,
    sourceRef,
    releaseBranch: RELEASE_BRANCH,
    releaseExists,
    currentBranch,
    health:
      !releaseExists || unmergedVersions.length > 0 || missingTagVersions.length > 0
        ? "needs attention"
        : "healthy",
    latestSourceVersion: mergePlan.latestDetectedVersion,
    latestReleaseVersion: findLatestReleaseVersion(releaseCommits),
    latestTaggedVersion: tagPlan.latestTaggedVersion,
    unmergedVersions,
    missingTagVersions,
    drift,
    mergePlan,
    tagPlan,
    nextRecommendedAction: getNextRecommendedAction({
      releaseExists,
      mergePlan,
      missingTagCount: missingTagVersions.length
    })
  };
}

export function formatReleaseMergePlan(plan) {
  const lines = [
    colorize("Release Merge Plan", ANSI.bold + ANSI.cyan),
    `${colorize("Source Branch:", ANSI.bold + ANSI.cyan)} ${plan.sourceBranch}`,
    `${colorize("Target Branch:", ANSI.bold + ANSI.cyan)} ${plan.releaseBranch}`,
    `${colorize("Base Ref:", ANSI.bold + ANSI.cyan)} ${plan.baseRef}`,
    `${colorize("Released Versions:", ANSI.bold + ANSI.cyan)} ${
      plan.releasedVersions.length > 0 ? plan.releasedVersions.join(", ") : "none"
    }`,
    `${colorize("Latest Detected Version:", ANSI.bold + ANSI.cyan)} ${plan.latestDetectedVersion ?? "none"}`
  ];

  if (plan.windows.length === 0) {
    lines.push(colorize("No unreleased release commits detected. Nothing to merge.", ANSI.green));
    return lines.join("\n");
  }

  for (const window of plan.windows) {
    lines.push("");
    lines.push(colorize(`release ${window.version}`, ANSI.bold + ANSI.yellow));
    lines.push(`${colorize("Commit Range:", ANSI.bold + ANSI.cyan)} ${window.startRef}..${window.endRef}`);

    for (const commit of window.commits) {
      lines.push(`${colorize(commit.shortSha, ANSI.bold + ANSI.cyan)} ${commit.subject}`);
      if (commit.versionChange.hasVersionChange) {
        lines.push(`  ${colorize("Version:", ANSI.bold + ANSI.cyan)} ${summarizeVersionPair(commit.versionChange)}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatReleaseTagPlan(plan) {
  const lines = [
    colorize("Release Tag Plan", ANSI.bold + ANSI.cyan),
    `${colorize("Source Branch:", ANSI.bold + ANSI.cyan)} ${plan.sourceBranch}`,
    `${colorize("Base Ref:", ANSI.bold + ANSI.cyan)} ${plan.baseRef}`,
    `${colorize("Tagged Versions:", ANSI.bold + ANSI.cyan)} ${
      plan.taggedVersions.length > 0 ? plan.taggedVersions.join(", ") : "none"
    }`,
    `${colorize("Latest Detected Version:", ANSI.bold + ANSI.cyan)} ${plan.latestDetectedVersion ?? "none"}`
  ];

  if (plan.tags.length === 0) {
    lines.push(colorize("No release tag changes detected. Nothing to tag.", ANSI.green));
    return lines.join("\n");
  }

  for (const tag of plan.tags) {
    lines.push("");
    lines.push(colorize(`${tag.needsMove ? "move tag" : "tag"} ${tag.tagName}`, ANSI.bold + ANSI.yellow));
    lines.push(`${colorize("Commit Range:", ANSI.bold + ANSI.cyan)} ${tag.startRef}..${tag.endRef}`);
    lines.push(`${colorize("Target Commit:", ANSI.bold + ANSI.cyan)} ${tag.targetShortSha} ${tag.targetSubject}`);
    if (tag.needsMove) {
      lines.push(`${colorize("Action:", ANSI.bold + ANSI.cyan)} move existing tag to the latest commit for ${tag.tagName}`);
    }

    for (const commit of tag.commits) {
      lines.push(`${colorize(commit.shortSha, ANSI.bold + ANSI.cyan)} ${commit.subject}`);
      if (commit.versionChange.hasVersionChange) {
        lines.push(`  ${colorize("Version:", ANSI.bold + ANSI.cyan)} ${summarizeVersionPair(commit.versionChange)}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatReleaseStatus(status) {
  const lines = [
    colorize("Release Status", ANSI.bold + ANSI.cyan),
    `${colorize("Source Branch:", ANSI.bold + ANSI.cyan)} ${status.sourceBranch}`,
    `${colorize("Release Branch:", ANSI.bold + ANSI.cyan)} ${status.releaseBranch}`,
    `${colorize("Current Branch:", ANSI.bold + ANSI.cyan)} ${status.currentBranch}`,
    `${colorize("Overall:", ANSI.bold + ANSI.cyan)} ${status.health}`,
    `${colorize("Latest Source Version:", ANSI.bold + ANSI.cyan)} ${status.latestSourceVersion ?? "none"}`,
    `${colorize("Latest Release Version:", ANSI.bold + ANSI.cyan)} ${status.latestReleaseVersion ?? "none"}`,
    `${colorize("Latest Tagged Version:", ANSI.bold + ANSI.cyan)} ${status.latestTaggedVersion ?? "none"}`
  ];

  lines.push("");
  lines.push(colorize("Unmerged Version Bumps", ANSI.bold + ANSI.yellow));
  if (status.unmergedVersions.length === 0) {
    lines.push("none");
  } else {
    for (const window of status.mergePlan.windows) {
      lines.push(`- ${window.version} (${window.startRef}..${window.endRef})`);
    }
  }

  lines.push("");
  lines.push(colorize("Missing Release Tags", ANSI.bold + ANSI.yellow));
  if (status.missingTagVersions.length === 0) {
    lines.push("none");
  } else {
    for (const tag of status.tagPlan.tags) {
      lines.push(`- ${tag.tagName} -> ${tag.targetShortSha} ${tag.targetSubject}`);
    }
  }

  lines.push("");
  lines.push(colorize("Branch Drift", ANSI.bold + ANSI.yellow));
  lines.push(status.drift.summary);
  lines.push(`- Commits only on ${status.sourceBranch}: ${status.drift.sourceOnlyCount}`);
  lines.push(`- Commits only on ${status.releaseBranch}: ${status.drift.releaseOnlyCount}`);

  lines.push("");
  lines.push(`${colorize("Next Recommended Action:", ANSI.bold + ANSI.cyan)} ${status.nextRecommendedAction}`);

  return lines.join("\n");
}

function buildRecoveryMessage({ originalBranch, originalReleaseSha, createdReleaseBranch }) {
  const lines = ["Release promotion failed. Recovery steps:"];

  if (createdReleaseBranch) {
    lines.push(`- Return to ${originalBranch} with \`git checkout ${originalBranch}\``);
    lines.push(`- Delete the temporary ${RELEASE_BRANCH} branch with \`git branch -D ${RELEASE_BRANCH}\``);
    return lines.join("\n");
  }

  lines.push(`- Reset ${RELEASE_BRANCH} back to ${originalReleaseSha} with \`git reset --hard ${originalReleaseSha}\``);
  lines.push(`- Return to ${originalBranch} with \`git checkout ${originalBranch}\``);
  return lines.join("\n");
}

function buildReleaseCommitMetadata(ref, version, cwd) {
  const metadata = getCommitMetadata(ref, cwd);

  return {
    ...metadata,
    message: `release ${version}`
  };
}

export function executeReleaseMerge(plan, cwd) {
  if (plan.windows.length === 0) {
    throw new Error("No unreleased release commits detected. Nothing to merge.");
  }

  if (!isWorkingTreeClean(cwd)) {
    throw new Error("Working tree must be clean before executing a release merge.");
  }

  const originalBranch = getCurrentBranchName(cwd);
  const releaseExists = localBranchExists(RELEASE_BRANCH, cwd);
  const originalReleaseSha = releaseExists ? resolveCommitSha(RELEASE_BRANCH, cwd) : null;
  let updatedReleaseSha = originalReleaseSha;

  try {
    for (const window of plan.windows) {
      const targetCommit = window.commits.at(-1);
      if (targetCommit?.sha == null) {
        throw new Error(`Unable to determine the source commit for release ${window.version}.`);
      }

      const treeSha = resolveTreeSha(targetCommit.sha, cwd);
      const metadata = buildReleaseCommitMetadata(targetCommit.sha, window.version, cwd);
      updatedReleaseSha = createCommitFromTree(
        treeSha,
        updatedReleaseSha == null ? [] : [updatedReleaseSha],
        metadata,
        cwd
      );
    }

    if (updatedReleaseSha == null || updatedReleaseSha === originalReleaseSha) {
      throw new Error("Release merge did not create any new commits.");
    }

    if (releaseExists) {
      gitForceBranch(RELEASE_BRANCH, updatedReleaseSha, cwd);
    } else {
      gitCreateBranch(RELEASE_BRANCH, updatedReleaseSha, cwd);
    }

    gitCheckout(RELEASE_BRANCH, cwd);
  } catch (error) {
    try {
      if (releaseExists) {
        gitForceBranch(RELEASE_BRANCH, originalReleaseSha, cwd);
      } else if (localBranchExists(RELEASE_BRANCH, cwd)) {
        if (getCurrentBranchName(cwd) === RELEASE_BRANCH) {
          gitCheckout(originalBranch, cwd);
        }
        gitDeleteBranch(RELEASE_BRANCH, cwd);
      }

      if (getCurrentBranchName(cwd) !== originalBranch) {
        gitCheckout(originalBranch, cwd);
      }
    } catch {
      // Preserve original failure and print recovery guidance below.
    }

    console.error(error.message);
    console.error(
      buildRecoveryMessage({
        originalBranch,
        originalReleaseSha,
        createdReleaseBranch: !releaseExists
      })
    );
    throw new Error("Release merge aborted.");
  }
}

export function executeReleaseTagPlan(plan, cwd) {
  if (plan.tags.length === 0) {
    throw new Error("No release tag changes detected. Nothing to tag.");
  }

  const createdTags = [];

  try {
    for (const tag of plan.tags) {
      if (tag.needsMove) {
        gitDeleteTag(tag.tagName, cwd);
      }

      gitCreateAnnotatedTag(tag.tagName, tag.targetSha, `release ${tag.tagName}`, cwd);
      createdTags.push(tag.tagName);
    }
  } catch (error) {
    for (const tagName of createdTags.reverse()) {
      try {
        gitDeleteTag(tagName, cwd);
      } catch {
        // Preserve the original failure; partial cleanup is best-effort.
      }
    }

    throw error;
  }
}

export { RELEASE_BRANCH };
