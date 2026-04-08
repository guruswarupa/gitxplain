import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchCommitData,
  gitPush,
  getRepositoryLog,
  getRepositoryStatus,
  resolveStashRef,
  resolveTreeSha
} from "../cli/services/gitService.js";

test("fetchCommitData reads a single commit", () => {
  const responses = new Map([
    ['log -1 --pretty=format:%B abc123', 'Fix login crash'],
    ['diff abc123^!', 'diff --git a/src/auth.js b/src/auth.js'],
    ['show --pretty=format: --name-only abc123', 'src/auth.js'],
    ['show --stat --oneline --format=%h %s abc123', 'abc123 Fix login crash\n 1 file changed, 4 insertions(+), 1 deletion(-)'],
    ['log -1 --pretty=format:%s abc123', 'Fix login crash']
  ]);

  const data = fetchCommitData("abc123", "/tmp", (args) => responses.get(args.join(" ")));

  assert.equal(data.analysisType, "commit");
  assert.equal(data.commitMessage, "Fix login crash");
  assert.deepEqual(data.filesChanged, ["src/auth.js"]);
});

test("fetchCommitData reads a commit range", () => {
  const responses = new Map([
    ['diff HEAD~2..HEAD', 'diff --git a/a.js b/a.js'],
    ['diff --name-only HEAD~2..HEAD', 'a.js\nb.js'],
    ['diff --stat HEAD~2..HEAD', ' 2 files changed, 10 insertions(+), 2 deletions(-)'],
    ['log --reverse --pretty=format:%H%x1f%s%x1f%B HEAD~2..HEAD', '1234567\u001fFirst change\u001fBody one\n89abcde\u001fSecond change\u001fBody two']
  ]);

  const data = fetchCommitData("HEAD~2..HEAD", "/tmp", (args) => responses.get(args.join(" ")));

  assert.equal(data.analysisType, "range");
  assert.equal(data.commitCount, 2);
  assert.deepEqual(data.filesChanged, ["a.js", "b.js"]);
  assert.match(data.commitMessage, /First change/);
});

test("getRepositoryLog fetches full repository history by default", () => {
  const calls = [];
  const runner = (args) => {
    calls.push(args.join(" "));
    return "abc1234 2026-04-08 Guru Initial commit";
  };

  const log = getRepositoryLog("/tmp", null, runner);

  assert.equal(log, "abc1234 2026-04-08 Guru Initial commit");
  assert.deepEqual(calls, ["log --date=short --pretty=format:%h %ad %an %s"]);
});

test("getRepositoryLog supports an explicit limit when requested", () => {
  const calls = [];
  const runner = (args) => {
    calls.push(args.join(" "));
    return "abc1234 2026-04-08 Guru Initial commit";
  };

  const log = getRepositoryLog("/tmp", 20, runner);

  assert.equal(log, "abc1234 2026-04-08 Guru Initial commit");
  assert.deepEqual(calls, ["log --max-count=20 --date=short --pretty=format:%h %ad %an %s"]);
});

test("getRepositoryStatus formats porcelain status output for humans", () => {
  const calls = [];
  const runner = (args) => {
    calls.push(args.join(" "));
    return [
      "## main...origin/main",
      "M  README.md",
      "A  prompts/commit.txt",
      "MM cli/index.js",
      "AM cli/services/commitService.js",
      "?? scratch.txt"
    ].join("\n");
  };

  const status = getRepositoryStatus("/tmp", runner);

  assert.equal(
    status,
    [
      "main...origin/main",
      "Changes:",
      "- README.md: staged modification",
      "- prompts/commit.txt: staged new file",
      "- cli/index.js: staged modification, unstaged modification",
      "- cli/services/commitService.js: staged new file, unstaged modification",
      "- scratch.txt: untracked"
    ].join("\n")
  );
  assert.deepEqual(calls, ["status --short --branch"]);
});

test("getRepositoryStatus reports a clean working tree clearly", () => {
  const runner = () => "## main";

  const status = getRepositoryStatus("/tmp", runner);

  assert.equal(status, "main\n\nWorking tree is clean.");
});

test("resolveTreeSha resolves the tree object for a ref", () => {
  const calls = [];
  const runner = (args) => {
    calls.push(args.join(" "));
    return "tree123";
  };

  const treeSha = resolveTreeSha("HEAD", "/tmp", runner);

  assert.equal(treeSha, "tree123");
  assert.deepEqual(calls, ["rev-parse HEAD^{tree}"]);
});

test("gitPush runs plain git push with optional remote and branch", () => {
  const calls = [];
  const runner = (args) => {
    calls.push(args.join(" "));
    return "";
  };

  assert.equal(gitPush("/tmp", null, null, runner), "");
  assert.equal(gitPush("/tmp", "origin", "main", runner), "");

  assert.deepEqual(calls, ["push", "push origin main"]);
});

test("resolveStashRef converts plain indexes into stash refs", () => {
  assert.equal(resolveStashRef(), "stash@{0}");
  assert.equal(resolveStashRef("2"), "stash@{2}");
  assert.equal(resolveStashRef(5), "stash@{5}");
  assert.equal(resolveStashRef("stash@{3}"), "stash@{3}");
});

test("resolveStashRef rejects invalid stash indexes", () => {
  assert.throws(() => resolveStashRef("-1"), /Invalid stash index/);
  assert.throws(() => resolveStashRef("abc"), /Invalid stash index/);
});
