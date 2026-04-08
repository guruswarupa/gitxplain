import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGitCommand } from "./gitService.js";

export function installHook({ cwd, hookName = "post-commit" }) {
  const gitDir = runGitCommand(["rev-parse", "--git-dir"], cwd);
  const hookDir = path.resolve(cwd, gitDir, "hooks");
  const outputDir = path.resolve(cwd, gitDir, "gitxplain");
  const hookPath = path.join(hookDir, hookName);

  mkdirSync(hookDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const script = `#!/bin/sh
gitxplain HEAD --summary --markdown --quiet > "${path.join(outputDir, "last-explanation.md").replaceAll("\\", "/")}" 2>/dev/null || true
`;

  writeFileSync(hookPath, script, "utf8");
  chmodSync(hookPath, 0o755);
  return hookPath;
}
