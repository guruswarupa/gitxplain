import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchBlameData,
  fetchCommitData,
  fetchCommitDataForFile,
  fetchStashData,
  gitPull,
  gitPush,
  gitResetHard,
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

test("fetchBlameData builds a blame-oriented analysis payload", () => {
  const blameOutput = [
    "1111111111111111111111111111111111111111 1 1 1",
    "author Alice",
    "author-mail <alice@example.com>",
    "author-time 1712700000",
    "summary Initial parser",
    "\tconst a = 1;",
    "2222222222222222222222222222222222222222 2 2 1",
    "author Bob",
    "author-mail <bob@example.com>",
    "author-time 1712786400",
    "summary Add guard",
    "\tif (!value) return;",
    "2222222222222222222222222222222222222222 3 3 1",
    "author Bob",
    "author-mail <bob@example.com>",
    "author-time 1712786400",
    "summary Add guard",
    "\treturn value;"
  ].join("\n");

  const data = fetchBlameData("src/auth.js", "/tmp", (args) => {
    assert.deepEqual(args, ["blame", "--line-porcelain", "--", "src/auth.js"]);
    return blameOutput;
  });

  assert.equal(data.analysisType, "blame");
  assert.equal(data.displayRef, "src/auth.js");
  assert.equal(data.commitMessage, "Blame analysis for src/auth.js");
  assert.equal(data.stats, "3 line annotations across 2 authors");
  assert.match(data.diff, /Authors:/);
  assert.match(data.diff, /Alice/);
  assert.match(data.diff, /Bob/);
  assert.match(data.diff, /L2 \| Bob/);
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

test("fetchCommitDataForFile scopes a single commit to one file", () => {
  const responses = new Map([
    ['log -1 --pretty=format:%B abc123', 'Fix login crash'],
    ['diff abc123^! -- src/auth.js', 'diff --git a/src/auth.js b/src/auth.js'],
    ['show --pretty=format: --name-only abc123 -- src/auth.js', 'src/auth.js'],
    ['show --stat --oneline --format=%h %s abc123 -- src/auth.js', 'abc123 Fix login crash\n 1 file changed, 4 insertions(+), 1 deletion(-)'],
    ['log -1 --pretty=format:%s abc123', 'Fix login crash']
  ]);

  const data = fetchCommitDataForFile("abc123", "src/auth.js", "/tmp", (args) => responses.get(args.join(" ")));

  assert.equal(data.displayRef, "abc123 :: src/auth.js");
  assert.deepEqual(data.filesChanged, ["src/auth.js"]);
  assert.match(data.diff, /src\/auth\.js/);
});

test("fetchCommitDataForFile scopes a range to one file", () => {
  const responses = new Map([
    ['diff HEAD~2..HEAD -- a.js', 'diff --git a/a.js b/a.js'],
    ['diff --name-only HEAD~2..HEAD -- a.js', 'a.js'],
    ['diff --stat HEAD~2..HEAD -- a.js', ' 1 file changed, 5 insertions(+), 1 deletion(-)'],
    ['log --reverse --pretty=format:%H%x1f%s%x1f%B HEAD~2..HEAD -- a.js', '1234567\u001fFirst change\u001fBody one']
  ]);

  const data = fetchCommitDataForFile("HEAD~2..HEAD", "a.js", "/tmp", (args) => responses.get(args.join(" ")));

  assert.equal(data.displayRef, "HEAD~2..HEAD :: a.js");
  assert.equal(data.commitCount, 1);
  assert.deepEqual(data.filesChanged, ["a.js"]);
});

test("fetchStashData reads stash contents", () => {
  const responses = new Map([
    ['log -1 --pretty=format:%gs stash@{1}', 'WIP on main: abc1234 fix login crash'],
    ['stash show -p stash@{1}', 'diff --git a/src/auth.js b/src/auth.js'],
    ['stash show --name-only stash@{1}', 'src/auth.js'],
    ['stash show --stat stash@{1}', ' src/auth.js | 5 +++--\n 1 file changed, 3 insertions(+), 2 deletions(-)']
  ]);

  const data = fetchStashData("stash@{1}", "/tmp", null, (args) => responses.get(args.join(" ")));

  assert.equal(data.analysisType, "stash");
  assert.equal(data.displayRef, "stash@{1}");
  assert.equal(data.commitMessage, "WIP on main: abc1234 fix login crash");
  assert.deepEqual(data.filesChanged, ["src/auth.js"]);
});

test("fetchStashData supports file-scoped stash analysis", () => {
  const responses = new Map([
    ['log -1 --pretty=format:%gs stash@{0}', 'WIP on main: abc1234 fix login crash'],
    ['stash show -p stash@{0} -- src/auth.js', 'diff --git a/src/auth.js b/src/auth.js'],
    ['stash show --name-only stash@{0} -- src/auth.js', 'src/auth.js'],
    ['stash show --stat stash@{0} -- src/auth.js', ' src/auth.js | 5 +++--\n 1 file changed, 3 insertions(+), 2 deletions(-)']
  ]);

  const data = fetchStashData(null, "/tmp", "src/auth.js", (args) => responses.get(args.join(" ")));

  assert.equal(data.displayRef, "stash@{0} :: src/auth.js");
  assert.deepEqual(data.filesChanged, ["src/auth.js"]);
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

test("gitPull runs plain git pull with optional remote and branch", () => {
  const calls = [];
  const runner = (args) => {
    calls.push(args.join(" "));
    return "";
  };

  assert.equal(gitPull("/tmp", null, null, runner), "");
  assert.equal(gitPull("/tmp", "origin", "main", runner), "");

  assert.deepEqual(calls, ["pull", "pull origin main"]);
});

test("gitResetHard targets HEAD by default", () => {
  const calls = [];
  const runner = (args) => {
    calls.push(args.join(" "));
    return "";
  };

  assert.equal(gitResetHard("HEAD", "/tmp", runner), "");
  assert.deepEqual(calls, ["reset --hard HEAD"]);
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
