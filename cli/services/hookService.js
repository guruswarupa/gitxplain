import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGitCommand } from "./gitService.js";

const HOOK_MARKER = "# gitxplain-hook";

function buildHookScript(hookName, outputDir) {
  if (hookName === "post-commit") {
    return `#!/bin/sh
${HOOK_MARKER}
gitxplain HEAD --summary --markdown --quiet > "${path.join(outputDir, "last-explanation.md")}" 2>/dev/null || true
`;
  }

  if (hookName === "post-merge") {
    return `#!/bin/sh
${HOOK_MARKER}
gitxplain HEAD --summary --markdown --quiet > "${path.join(outputDir, "last-merge-explanation.md")}" 2>/dev/null || true
`;
  }

  if (hookName === "pre-push") {
    return `#!/bin/sh
${HOOK_MARKER}
gitxplain HEAD --security --markdown --quiet > "${path.join(outputDir, "last-pre-push-security.md")}" 2>/dev/null || true
`;
  }

  throw new Error(`Unsupported hook "${hookName}". Supported hooks: post-commit, post-merge, pre-push.`);
}

export function installHook({ cwd, hookName = "post-commit" }) {
  const gitDir = runGitCommand(["rev-parse", "--git-dir"], cwd);
  const hookDir = path.resolve(cwd, gitDir, "hooks");
  const outputDir = path.resolve(cwd, gitDir, "gitxplain");
  const hookPath = path.join(hookDir, hookName);

  mkdirSync(hookDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const script = buildHookScript(hookName, outputDir);

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf8");
    if (!existing.includes(HOOK_MARKER)) {
      throw new Error(`Hook ${hookName} already exists at ${hookPath}. Refusing to overwrite a non-gitxplain hook.`);
    }
  }

  writeFileSync(hookPath, script, "utf8");
  chmodSync(hookPath, 0o755);
  return hookPath;
}
