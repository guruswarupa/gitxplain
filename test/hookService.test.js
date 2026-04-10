import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installHook } from "../cli/services/hookService.js";

function createRepoDir() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "gitxplain-hook-"));
  execFileSync("git", ["init"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  return cwd;
}

test("installHook writes post-merge and pre-push scripts", () => {
  const cwd = createRepoDir();

  try {
    const postMergePath = installHook({ cwd, hookName: "post-merge" });
    const prePushPath = installHook({ cwd, hookName: "pre-push" });

    assert.match(fs.readFileSync(postMergePath, "utf8"), /last-merge-explanation\.md/);
    assert.match(fs.readFileSync(prePushPath, "utf8"), /--security --markdown --quiet/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
