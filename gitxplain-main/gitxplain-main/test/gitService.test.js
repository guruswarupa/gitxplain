import test from "node:test";
import assert from "node:assert/strict";
import { fetchCommitData } from "../cli/services/gitService.js";

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
