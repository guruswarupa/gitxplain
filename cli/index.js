#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readFileSync, realpathSync } from "node:fs";
import { generateExplanation } from "./services/aiService.js";
import { clearCache, getCacheStats } from "./services/cacheService.js";
import { loadEnvFile } from "./services/envLoader.js";
import { copyToClipboard } from "./services/clipboardService.js";
import { getUsageStats } from "./services/usageService.js";
import {
  applyConfigEnvironment,
  getProviderApiKeyField,
  getUserConfigPath,
  loadConfig,
  loadUserConfig,
  updateUserConfig
} from "./services/configService.js";
import {
  buildBranchRange,
  deletePaths,
  fetchBlameData,
  fetchCommitData,
  fetchCommitDataForFile,
  fetchConflictData,
  fetchStashData,
  fetchWorkingTreeData,
  gitAddFiles,
  gitPull,
  gitPush,
  gitResetHard,
  gitResetSoft,
  gitStashPop,
  gitRestoreStaged,
  getRepositoryLog,
  getRepositoryStatus,
  getDefaultBaseRef,
  isGitRepository,
  listGitSubcommands,
  runNativeGitPassthrough,
  resolveStashRef
} from "./services/gitService.js";
import { installHook } from "./services/hookService.js";
import {
  buildReleaseMergePlan,
  buildReleaseStatus,
  buildReleaseTagPlan,
  executeReleaseMerge,
  executeReleaseTagPlan,
  finalizeReleaseMergePlan,
  finalizeReleaseTagPlan,
  formatReleaseMergePlan,
  formatReleaseStatus,
  formatReleaseTagPlan
} from "./services/mergeService.js";
import {
  formatFooter,
  formatHtmlOutput,
  formatJsonOutput,
  formatMarkdownOutput,
  formatOutput,
  formatPreamble
} from "./services/outputFormatter.js";
import {
  formatPipelineRecommendations,
  inspectRepositoryForPipeline,
  resolvePipelineSelection,
  writePipelineFiles
} from "./services/pipelineService.js";
import { executeCommitPlan, formatCommitPlan, parseCommitPlan, reconcileCommitPlan } from "./services/commitService.js";
import {
  executeSplit,
  formatSplitPlan,
  parseSplitPlan,
  reconcileSplitPlan,
  validateSplitExecutionTarget
} from "./services/splitService.js";

const MODE_FLAGS = new Map([
  ["--summary", "summary"],
  ["--issues", "issues"],
  ["--fix", "fix"],
  ["--impact", "impact"],
  ["--full", "full"],
  ["--lines", "lines"],
  ["--review", "review"],
  ["--security", "security"],
  ["--refactor", "refactor"],
  ["--test-suggest", "test-suggest"],
  ["--pr-description", "pr-description"],
  ["--changelog", "changelog"],
  ["--blame", "blame"],
  ["--conflict", "conflict"],
  ["--stash", "stash"],
  ["--split", "split"],
  ["--merge", "merge"],
  ["--tag", "tag"],
  ["--commit", "commit"],
  ["--release", "release"],
  ["--log", "log"],
  ["--status", "status"],
  ["--pipeline", "pipeline"]
]);

const FORMAT_FLAGS = new Map([
  ["--json", "json"],
  ["--markdown", "markdown"],
  ["--html", "html"]
]);

const ANALYSIS_MODES = new Set([
  "summary",
  "issues",
  "fix",
  "impact",
  "full",
  "lines",
  "review",
  "security",
  "refactor",
  "test-suggest",
  "pr-description",
  "changelog",
  "blame",
  "conflict",
  "stash",
  "split"
]);

const RESERVED_SUBCOMMANDS = new Set([
  "help",
  "cache",
  "config",
  "install-hook",
  "git",
  "add",
  "remove",
  "del",
  "bin",
  "pop",
  "pull",
  "push"
]);

const CLI_VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

function printHelp() {
  console.log(`gitxplain - AI-powered Git change analysis, review, and commit workflow CLI

Usage:
  gitxplain --help
  gitxplain --version
  gitxplain cache clear
  gitxplain cache stats
  gitxplain --cost
  gitxplain install-hook [post-commit|post-merge|pre-push]
  gitxplain config set provider <name>
  gitxplain config set api-key <value> [--provider <name>]
  gitxplain config get [key]
  gitxplain config list
  gitxplain <commit-id> [options]
  gitxplain <start>..<end> [options]
  gitxplain --branch [base-ref] [options]
  gitxplain --pr [base-ref] [options]
  gitxplain --commit
  gitxplain --release [status]
  gitxplain --merge
  gitxplain --tag
  gitxplain --conflict
  gitxplain --stash [stash-ref]
  gitxplain --log
  gitxplain --status
  gitxplain --pipeline

Analysis:
  --summary       Generate a one-line summary of a change
  --issues        Focus on the issue or failure being addressed
  --fix           Explain the fix in simple terms
  --impact        Explain behavior changes before vs after
  --full          Generate a full structured analysis
  --lines         Walk through the changed code file by file
  --review        Generate review findings, risks, and suggestions
  --security      Focus on security-relevant changes and concerns
  --refactor      Suggest refactoring opportunities in the change
  --test-suggest  Suggest tests to add or update for the change
  --pr-description Generate a ready-to-paste PR description
  --changelog     Generate changelog-style release notes
  --blame <file>  Analyze ownership and history for one file with git blame
  --conflict      Suggest resolutions for unresolved merge conflicts in the working tree
  --stash [ref]   Explain a stash entry, defaulting to stash@{0}
  --split         Propose splitting a commit into smaller atomic commits
  --cost          Show cumulative token usage and estimated cost totals
  --commit        Propose commits for current uncommitted changes
  --execute       Execute a proposed split or commit plan
  --dry-run       Preview the plan without executing it
  --interactive   Review or edit a split plan before execution

Release:
  --release [status]  Show release branch health and next recommended action
  --merge         Preview or apply a merge into the release branch
  --tag           Preview or create release tags from version bumps

Repo:
  --log           Print Git log entries for the current repository
  --status        Print Git working tree status for the current repository
  --pipeline      Detect the current repository stack and create GitHub/GitLab/CircleCI/Bitbucket CI files

Quick Actions:
  config          Persist provider, model, and API key settings
  add             Stage one or more files with git add
  remove          Unstage one or more files with git restore --staged
  remove hard     Hard reset the repository to HEAD
  del             Delete one or more files from the working tree
  bin             Soft reset HEAD~1 while keeping your changes
  pop             Pop a stash entry like "pop 2"
  pull            Run git pull, optionally with a remote and branch
  push            Run git push, optionally with a remote and branch
  install-hook    Install a post-commit, post-merge, or pre-push gitxplain hook
  cache           Manage gitxplain cache entries
  git             Pass through to native git commands

Output:
  --provider <name>
  --model <name>
  --json
  --markdown
  --html
  --quiet
  --verbose
  --clipboard
  --stream
  --no-cache
  --diff <file>
  --max-diff-lines <n>

Comparison:
  --branch [base-ref]   Analyze the current branch against a base branch
  --pr [base-ref]       Alias for --branch, useful for PR-style comparisons

Config:
  Project config: .gitxplainrc or .gitxplainrc.json
  User config: ~/.gitxplain/config.json (macOS/Linux) or %USERPROFILE%\\.gitxplain\\config.json (Windows)

Notes:
  Run gitxplain inside a Git repository.
  If no command or mode is supplied, gitxplain prints this help text.
  Use --provider or --model to override your config or environment for one command.
  Use gitxplain git <args...> to run any native Git subcommand with its normal flags.
  install-hook supports: post-commit, post-merge, pre-push.
`);
}

function getFlagValue(args, flagName) {
  const directIndex = args.findIndex((arg) => arg === flagName);
  if (directIndex >= 0) {
    const nextArg = args[directIndex + 1];
    if (nextArg && !nextArg.startsWith("--")) {
      return nextArg;
    }

    return null;
  }

  const inline = args.find((arg) => arg.startsWith(`${flagName}=`));
  return inline ? inline.slice(flagName.length + 1) : null;
}

function parseNumber(value, fallback = null) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return parsed;
}

function redactConfigValue(key, value) {
  if (typeof value !== "string") {
    return value;
  }

  if (!/api[_-]?key/i.test(key)) {
    return value;
  }

  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function printConfigEntries(config) {
  const entries = Object.entries(config).sort(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) {
    console.log("No user config saved yet.");
    return;
  }

  for (const [key, value] of entries) {
    console.log(`${key}: ${redactConfigValue(key, value)}`);
  }
}

function resolveConfigSetUpdate(parsed, currentConfig) {
  const key = parsed.configKey;
  const value = parsed.configValue;

  if (!key || !value) {
    throw new Error('Usage: gitxplain config set <provider|model|api-key> <value> [--provider <name>]');
  }

  if (key === "provider") {
    return { provider: value.toLowerCase() };
  }

  if (key === "model") {
    return { model: value };
  }

  if (key === "api-key") {
    const resolvedProvider = (parsed.provider ?? currentConfig.provider ?? currentConfig.LLM_PROVIDER ?? "").toLowerCase();
    const apiKeyField = getProviderApiKeyField(resolvedProvider);

    if (!apiKeyField) {
      throw new Error("Set a provider first with `gitxplain config set provider <name>`, or pass `--provider <name>`.");
    }

    return { [apiKeyField]: value };
  }

  return { [key]: value };
}

function handleConfigCommand(parsed) {
  const currentConfig = loadUserConfig();

  if (parsed.configAction === "list" || parsed.configAction == null) {
    console.log(`User config: ${getUserConfigPath()}`);
    printConfigEntries(currentConfig);
    return 0;
  }

  if (parsed.configAction === "get") {
    console.log(`User config: ${getUserConfigPath()}`);

    if (!parsed.configKey) {
      printConfigEntries(currentConfig);
      return 0;
    }

    const value = currentConfig[parsed.configKey];
    if (value === undefined) {
      console.log(`No value saved for ${parsed.configKey}.`);
      return 0;
    }

    console.log(`${parsed.configKey}: ${redactConfigValue(parsed.configKey, value)}`);
    return 0;
  }

  if (parsed.configAction === "set") {
    const updates = resolveConfigSetUpdate(parsed, currentConfig);
    const { configPath } = updateUserConfig(updates);
    const [savedKey, savedValue] = Object.entries(updates)[0];
    console.log(`Saved ${savedKey} to ${configPath}.`);
    console.log(`${savedKey}: ${redactConfigValue(savedKey, savedValue)}`);
    return 0;
  }

  throw new Error(`Unknown config subcommand: ${parsed.configAction}`);
}

function handleCacheCommand(parsed) {
  if (parsed.cacheAction == null) {
    throw new Error('Usage: gitxplain cache <clear|stats>');
  }

  if (parsed.cacheAction === "clear") {
    const deletedCount = clearCache();
    console.log(`Cleared ${deletedCount} cache entr${deletedCount === 1 ? "y" : "ies"}.`);
    return 0;
  }

  if (parsed.cacheAction === "stats") {
    const stats = getCacheStats();
    console.log(
      [
        "Cache Stats",
        `Entries: ${stats.entryCount}`,
        `Size: ${stats.totalSizeBytes} bytes`,
        `Oldest: ${stats.oldestEntryIso ?? "n/a"}`,
        `Newest: ${stats.newestEntryIso ?? "n/a"}`
      ].join("\n")
    );
    return 0;
  }

  throw new Error(`Unknown cache subcommand: ${parsed.cacheAction}`);
}

function isDirectNativeGitSubcommand(subcommand, knownGitSubcommands) {
  if (!subcommand || subcommand.startsWith("-")) {
    return false;
  }

  if (RESERVED_SUBCOMMANDS.has(subcommand)) {
    return false;
  }

  return knownGitSubcommands.has(subcommand);
}

export function parseArgs(argv, options = {}) {
  const args = argv.slice(2);
  const subcommand = args[0];
  const knownGitSubcommands = options.gitSubcommands ?? listGitSubcommands();
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const valueFlags = new Set(["--provider", "--model", "--max-diff-lines", "--branch", "--pr", "--blame", "--stash", "--diff"]);
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    if (arg.includes("=")) {
      continue;
    }

    if (valueFlags.has(arg)) {
      const nextArg = args[index + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        index += 1;
      }
    }
  }

  const explicitMode = [...MODE_FLAGS.entries()].find(([flag]) => flags.has(flag))?.[1] ?? null;
  const explicitFormat = [...FORMAT_FLAGS.entries()].find(([flag]) => flags.has(flag))?.[1] ?? null;
  const isInstallHook = subcommand === "install-hook";
  const isConfigCommand = subcommand === "config";
  const isCacheCommand = subcommand === "cache";
  const isNativeGitWrapper = subcommand === "git";
  const isReleaseCommand = flags.has("--release");
  const isAddCommand = subcommand === "add";
  const isRemoveCommand = subcommand === "remove";
  const isDeleteCommand = subcommand === "del";
  const isPipelineCommand = flags.has("--pipeline");
  const isBinCommand = subcommand === "bin";
  const isPopCommand = subcommand === "pop";
  const isPullCommand = subcommand === "pull";
  const isPushCommand = subcommand === "push";
  const isRemoveHardCommand = isRemoveCommand && positional[1] === "hard" && positional.length === 2;
  const isNativeGitCommand = isNativeGitWrapper || isDirectNativeGitSubcommand(subcommand, knownGitSubcommands);

  return {
    subcommand,
    help: flags.has("--help") || subcommand === "help",
    version: flags.has("--version"),
    cost: flags.has("--cost"),
    nativeGitCommand: isNativeGitCommand,
    installHook: isInstallHook,
    configCommand: isConfigCommand,
    cacheCommand: isCacheCommand,
    configAction: isConfigCommand ? positional[1] ?? null : null,
    configKey: isConfigCommand ? positional[2] ?? null : null,
    configValue: isConfigCommand ? positional.slice(3).join(" ") || null : null,
    cacheAction: isCacheCommand ? positional[1] ?? null : null,
    releaseCommand: isReleaseCommand,
    releaseAction: isReleaseCommand ? positional[0] ?? "status" : null,
    addCommand: isAddCommand,
    removeCommand: isRemoveCommand,
    deleteCommand: isDeleteCommand,
    pipelineCommand: isPipelineCommand,
    binCommand: isBinCommand,
    popCommand: isPopCommand,
    pullCommand: isPullCommand,
    pushCommand: isPushCommand,
    removeHardCommand: isRemoveHardCommand,
    nativeGitArgs: isNativeGitWrapper ? args.slice(1) : isNativeGitCommand ? args : [],
    hookName: isInstallHook ? positional[1] ?? "post-commit" : null,
    actionPaths:
      isAddCommand || isDeleteCommand ? positional.slice(1) : isRemoveHardCommand ? [] : isRemoveCommand ? positional.slice(1) : [],
    stashIndex: isPopCommand ? positional[1] ?? null : null,
    pullRemote: isPullCommand ? positional[1] ?? null : null,
    pullBranch: isPullCommand ? positional[2] ?? null : null,
    pushRemote: isPushCommand ? positional[1] ?? null : null,
    pushBranch: isPushCommand ? positional[2] ?? null : null,
    commitRef:
      isInstallHook ||
      isConfigCommand ||
      isCacheCommand ||
      isNativeGitCommand ||
      isReleaseCommand ||
      isAddCommand ||
      isRemoveCommand ||
      isDeleteCommand ||
      isPipelineCommand ||
      isBinCommand ||
      isPopCommand ||
      isPullCommand ||
      isPushCommand ||
      subcommand === "help"
        ? null
        : positional[0] ?? null,
    mode: explicitMode,
    format: explicitFormat,
    provider: getFlagValue(args, "--provider"),
    model: getFlagValue(args, "--model"),
    maxDiffLines: parseNumber(getFlagValue(args, "--max-diff-lines")),
    blameFile: getFlagValue(args, "--blame"),
    stashRef: flags.has("--stash") || args.some((arg) => arg.startsWith("--stash=")) ? getFlagValue(args, "--stash") : null,
    diffFile: getFlagValue(args, "--diff"),
    hasBranchFlag: flags.has("--branch") || args.some((arg) => arg.startsWith("--branch=")),
    branchBase: getFlagValue(args, "--branch"),
    hasPrFlag: flags.has("--pr") || args.some((arg) => arg.startsWith("--pr=")),
    prBase: getFlagValue(args, "--pr"),
    clipboard: flags.has("--clipboard"),
    stream: flags.has("--stream"),
    noCache: flags.has("--no-cache"),
    verbose: flags.has("--verbose"),
    quiet: flags.has("--quiet"),
    execute: flags.has("--execute"),
    dryRun: flags.has("--dry-run"),
    interactive: flags.has("--interactive"),
    release: flags.has("--release"),
    log: flags.has("--log"),
    status: flags.has("--status"),
    merge: flags.has("--merge"),
    tag: flags.has("--tag")
  };
}

function askQuestion(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (input) => {
      process.stdin.pause();
      resolve(input.trim());
    });
  });
}

function resolveConfiguredAnalysisMode(config) {
  return ANALYSIS_MODES.has(config.mode) ? config.mode : "full";
}

function resolveRuntimeOptions(parsed, config) {
  return {
    mode: parsed.mode ?? resolveConfiguredAnalysisMode(config),
    format: parsed.format ?? config.format ?? "plain",
    provider: parsed.provider ?? config.provider ?? null,
    model: parsed.model ?? config.model ?? null,
    maxDiffLines: parsed.maxDiffLines ?? config.maxDiffLines ?? 800,
    clipboard: parsed.clipboard || config.clipboard === true,
    stream: parsed.stream || config.stream === true,
    noCache: parsed.noCache,
    verbose: parsed.verbose || config.verbose === true,
    quiet: parsed.quiet || config.quiet === true
  };
}

function formatUsageStats(stats) {
  return [
    "Usage Stats",
    `Requests: ${stats.requestCount}`,
    `Input Tokens: ${stats.inputTokens}`,
    `Output Tokens: ${stats.outputTokens}`,
    `Total Tokens: ${stats.totalTokens}`,
    `Estimated Cost: $${stats.estimatedCostUsd.toFixed(6)}`
  ].join("\n");
}

async function reviewSplitPlanInteractively(plan) {
  const editedCommits = [];
  const deferredFiles = [];

  for (const commit of [...plan.commits].sort((left, right) => left.order - right.order)) {
    console.log("");
    console.log(`${commit.order}. ${commit.message}`);
    console.log(`Files: ${commit.files.join(", ")}`);
    console.log(`Why: ${commit.description}`);

    const action = (await askQuestion('Action [keep/edit/skip/abort] > ')).trim().toLowerCase();

    if (action === "abort") {
      return null;
    }

    if (action === "skip") {
      deferredFiles.push(...commit.files);
      continue;
    }

    if (action === "edit") {
      const nextMessage = await askQuestion("New commit message (leave blank to keep current) > ");
      const nextDescription = await askQuestion("New description (leave blank to keep current) > ");
      editedCommits.push({
        ...commit,
        message: nextMessage.trim() === "" ? commit.message : nextMessage.trim(),
        description: nextDescription.trim() === "" ? commit.description : nextDescription.trim()
      });
      continue;
    }

    editedCommits.push(commit);
  }

  if (deferredFiles.length > 0) {
    editedCommits.push({
      order: editedCommits.length + 1,
      message: "chore: include deferred split changes",
      files: deferredFiles,
      description: "Captures split groups that were skipped during interactive review."
    });
  }

  return {
    ...plan,
    commits: editedCommits.map((commit, index) => ({ ...commit, order: index + 1 }))
  };
}

function resolveTargetRef(parsed, cwd) {
  if (parsed.commitRef) {
    return parsed.commitRef;
  }

  if (parsed.hasBranchFlag || parsed.hasPrFlag) {
    const baseRef = parsed.branchBase || parsed.prBase || getDefaultBaseRef(cwd);
    return buildBranchRange(baseRef, cwd);
  }

  return null;
}

function renderFinalOutput({ runtimeOptions, mode, commitData, explanation, responseMeta, promptMeta }) {
  if (runtimeOptions.format === "json") {
    return formatJsonOutput({ mode, commitData, explanation, responseMeta, promptMeta });
  }

  if (runtimeOptions.format === "markdown") {
    return formatMarkdownOutput({ mode, commitData, explanation, responseMeta, promptMeta });
  }

  if (runtimeOptions.format === "html") {
    return formatHtmlOutput({ mode, commitData, explanation, responseMeta, promptMeta });
  }

  return formatOutput({
    mode,
    commitData,
    explanation,
    responseMeta,
    promptMeta,
    options: runtimeOptions
  });
}

async function runPipelineCommand(cwd) {
  const analysis = inspectRepositoryForPipeline(cwd);

  if (!analysis.supported) {
    console.log(analysis.reason);
    return 1;
  }

  console.log(formatPipelineRecommendations(analysis));

  const answer = await askQuestion(
    `\nChoose a pipeline option (1-${analysis.options.length}) or type "cancel" > `
  );
  const selection = resolvePipelineSelection(analysis, answer);

  if (!selection) {
    console.log("Aborted.");
    return 0;
  }

  const { writtenFiles, updatedFiles, unchangedFiles, notes } = writePipelineFiles(cwd, analysis, selection);

  if (updatedFiles.length === 0 && unchangedFiles.length > 0) {
    console.log(`\nWorkflow files already matched the current template: ${unchangedFiles.join(", ")}`);
  } else if (updatedFiles.length > 0 && unchangedFiles.length === 0) {
    console.log(`\nUpdated workflow files: ${updatedFiles.join(", ")}`);
  } else {
    console.log(`\nUpdated workflow files: ${updatedFiles.join(", ")}`);
    console.log(`Unchanged workflow files: ${unchangedFiles.join(", ")}`);
  }

  if (notes.length > 0) {
    console.log(`\n${notes.join("\n")}`);
  }

  return 0;
}

export async function main(argv = process.argv) {
  const cwd = process.cwd();
  const parsed = parseArgs(argv);
  const hasNoCommandOrFlags = argv.slice(2).length === 0;

  loadEnvFile(cwd); // Ensure environment is loaded first
  const config = loadConfig(cwd);
  applyConfigEnvironment(config);

  if (parsed.version) {
    console.log(CLI_VERSION);
    return 0;
  }

  if (parsed.cost) {
    console.log(formatUsageStats(getUsageStats()));
    return 0;
  }

  if (parsed.help || hasNoCommandOrFlags) {
    printHelp();
    return 0;
  }

  if (parsed.configCommand) {
    return handleConfigCommand(parsed);
  }

  if (parsed.cacheCommand) {
    return handleCacheCommand(parsed);
  }

  if (parsed.nativeGitCommand) {
    return runNativeGitPassthrough(parsed.nativeGitArgs, cwd);
  }

  if (!isGitRepository(cwd)) {
    console.error("gitxplain must be run inside a Git repository.");
    return 1;
  }

  if (parsed.installHook) {
    const hookPath = installHook({ cwd, hookName: parsed.hookName });
    console.log(`Installed ${parsed.hookName} hook at ${hookPath}`);
    return 0;
  }

  if (parsed.log) {
    console.log(getRepositoryLog(cwd));
    return 0;
  }

  if (parsed.status) {
    console.log(getRepositoryStatus(cwd));
    return 0;
  }

  if (parsed.releaseCommand) {
    if (parsed.releaseAction !== "status") {
      throw new Error(`Unknown release subcommand: ${parsed.releaseAction}`);
    }

    console.log(formatReleaseStatus(buildReleaseStatus(cwd)));
    return 0;
  }

  if (parsed.pipelineCommand) {
    return runPipelineCommand(cwd);
  }

  if (
    parsed.addCommand ||
    parsed.removeCommand ||
    parsed.deleteCommand ||
    parsed.binCommand ||
    parsed.popCommand ||
    parsed.pullCommand ||
    parsed.pushCommand
  ) {
    if (!parsed.popCommand && !parsed.binCommand && !parsed.pullCommand && !parsed.removeHardCommand && parsed.actionPaths.length === 0) {
      if (!parsed.pushCommand) {
        throw new Error(`No paths provided for "${parsed.subcommand}".`);
      }
    }

    if (parsed.addCommand) {
      gitAddFiles(parsed.actionPaths, cwd);
      console.log(`Staged ${parsed.actionPaths.join(", ")}.`);
      return 0;
    }

    if (parsed.removeCommand) {
      if (parsed.removeHardCommand) {
        gitResetHard("HEAD", cwd);
        console.log("Hard reset to HEAD.");
        return 0;
      }

      gitRestoreStaged(parsed.actionPaths, cwd);
      console.log(`Unstaged ${parsed.actionPaths.join(", ")}.`);
      return 0;
    }

    if (parsed.deleteCommand) {
      deletePaths(parsed.actionPaths, cwd);
      console.log(`Deleted ${parsed.actionPaths.join(", ")}.`);
      return 0;
    }

    if (parsed.binCommand) {
      gitResetSoft(cwd);
      console.log("Soft reset HEAD~1 and kept your changes.");
      return 0;
    }

    if (parsed.popCommand) {
      const stashRef = resolveStashRef(parsed.stashIndex);
      gitStashPop(parsed.stashIndex, cwd);
      console.log(`Popped ${stashRef}.`);
      return 0;
    }

    if (parsed.pullCommand) {
      gitPull(cwd, parsed.pullRemote, parsed.pullBranch);
      console.log(
        `Pulled${parsed.pullRemote ? ` from ${parsed.pullRemote}` : ""}${parsed.pullBranch ? ` ${parsed.pullBranch}` : ""}.`
      );
      return 0;
    }

    gitPush(cwd, parsed.pushRemote, parsed.pushBranch);
    console.log(
      `Pushed${parsed.pushRemote ? ` to ${parsed.pushRemote}` : ""}${parsed.pushBranch ? ` ${parsed.pushBranch}` : ""}.`
    );
    return 0;
  }

  const runtimeOptions = resolveRuntimeOptions(parsed, config);
  const mode = ANALYSIS_MODES.has(parsed.mode) ? parsed.mode : resolveConfiguredAnalysisMode(config);

  if (parsed.mode === "commit") {
    const commitData = fetchWorkingTreeData(cwd);

    if (commitData.filesChanged.length === 0 || commitData.diff === "") {
      console.log("Working tree is clean. Nothing to commit.");
      return 0;
    }

    const { explanation, responseMeta, promptMeta } = await generateExplanation({
      mode: "commit",
      commitData,
      providerOverride: runtimeOptions.provider,
      modelOverride: runtimeOptions.model,
      maxDiffLines: runtimeOptions.maxDiffLines,
      noCache: runtimeOptions.noCache,
      stream: false,
      onChunk: null,
      onStart: null
    });

    const plan = reconcileCommitPlan(parseCommitPlan(explanation), cwd);

    if (!plan.reason_to_commit || plan.commits.length === 0) {
      console.log("No meaningful commit grouping recommended.");
      return 0;
    }

    console.log(formatCommitPlan(plan));

    if (parsed.execute && !parsed.dryRun) {
      const confirmed = await askQuestion(
        "\nThis will create new commits from your working tree changes. Continue? (yes/no) > "
      );
      if (confirmed.toLowerCase() !== "yes") {
        console.log("Aborted.");
        return 0;
      }

      executeCommitPlan(plan, cwd);
      console.log(`\nCommit complete. Created ${plan.commits.length} commits.`);
    } else {
      console.log("\nThis is a preview. Run with --execute to apply the commit plan.");
    }

    if (runtimeOptions.verbose) {
      process.stdout.write(formatFooter({ responseMeta, promptMeta, options: runtimeOptions }));
    }

    return 0;
  }

  if (parsed.mode === "merge" || parsed.merge) {
    if (parsed.commitRef) {
      throw new Error("--merge works from the current branch and does not accept a commit ref.");
    }

    const plan = finalizeReleaseMergePlan(buildReleaseMergePlan(cwd));

    if (plan.windows.length === 0) {
      console.log("No unreleased release commits detected. Nothing to merge.");
      return 0;
    }

    console.log(formatReleaseMergePlan(plan));

    if (parsed.execute && !parsed.dryRun) {
      const confirmed = await askQuestion(
        `\nThis will create ${plan.windows.length} release commit(s) on ${plan.releaseBranch}. Continue? (yes/no) > `
      );
      if (confirmed.toLowerCase() !== "yes") {
        console.log("Aborted.");
        return 0;
      }

      executeReleaseMerge(plan, cwd);
      console.log(`\nRelease promotion complete. Created ${plan.windows.length} release commit(s) on ${plan.releaseBranch}.`);
    } else {
      console.log(`\nThis is a preview. Run with --execute to create release commits on ${plan.releaseBranch}.`);
    }

    return 0;
  }

  if (parsed.mode === "tag" || parsed.tag) {
    if (parsed.commitRef) {
      throw new Error("--tag works from the current branch and does not accept a commit ref.");
    }

    const plan = finalizeReleaseTagPlan(buildReleaseTagPlan(cwd));

    if (plan.tags.length === 0) {
      console.log("No unreleased release tags detected. Nothing to tag.");
      return 0;
    }

    console.log(formatReleaseTagPlan(plan));

    if (parsed.execute && !parsed.dryRun) {
      const confirmed = await askQuestion(
        `\nThis will create ${plan.tags.length} release tag(s). Continue? (yes/no) > `
      );
      if (confirmed.toLowerCase() !== "yes") {
        console.log("Aborted.");
        return 0;
      }

      executeReleaseTagPlan(plan, cwd);
      console.log(`\nRelease tagging complete. Created ${plan.tags.length} release tag(s).`);
    } else {
      console.log("\nThis is a preview. Run with --execute to create release tags.");
    }

    return 0;
  }

  const targetRef = resolveTargetRef(parsed, cwd);

  if (parsed.mode === "blame") {
    if (!parsed.blameFile) {
      throw new Error("--blame requires a file path.");
    }

    const commitData = fetchBlameData(parsed.blameFile, cwd);
    const canStream = runtimeOptions.stream && runtimeOptions.format === "plain";
    let streamStarted = false;

    if (runtimeOptions.stream && !canStream && !runtimeOptions.quiet) {
      console.error(`Streaming is only supported with plain output. Ignoring --stream for ${runtimeOptions.format} format.`);
    }

    const { explanation, responseMeta, promptMeta } = await generateExplanation({
      mode: "blame",
      commitData,
      providerOverride: runtimeOptions.provider,
      modelOverride: runtimeOptions.model,
      maxDiffLines: runtimeOptions.maxDiffLines,
      noCache: runtimeOptions.noCache,
      stream: canStream,
      onStart: canStream
        ? ({ promptMeta: streamPromptMeta }) => {
            if (!runtimeOptions.quiet && !streamStarted) {
              process.stdout.write(
                formatPreamble({
                  mode: "blame",
                  commitData,
                  responseMeta: null,
                  promptMeta: streamPromptMeta,
                  options: runtimeOptions
                })
              );
              streamStarted = true;
            }
          }
        : null,
      onChunk: canStream ? (chunk) => process.stdout.write(chunk) : null
    });

    const renderedOutput = renderFinalOutput({
      runtimeOptions,
      mode: "blame",
      commitData,
      explanation,
      responseMeta,
      promptMeta
    });

    if (canStream) {
      process.stdout.write("\n");
      if (runtimeOptions.verbose) {
        process.stdout.write(formatFooter({ responseMeta, promptMeta, options: runtimeOptions }));
      }
    } else {
      console.log(renderedOutput);
    }

    if (runtimeOptions.clipboard) {
      copyToClipboard(renderedOutput);
      if (!runtimeOptions.quiet) {
        console.error("Copied output to clipboard.");
      }
    }

    return 0;
  }

  if (parsed.mode === "conflict") {
    const commitData = fetchConflictData(cwd, parsed.diffFile);
    const canStream = runtimeOptions.stream && runtimeOptions.format === "plain";
    let streamStarted = false;

    if (runtimeOptions.stream && !canStream && !runtimeOptions.quiet) {
      console.error(`Streaming is only supported with plain output. Ignoring --stream for ${runtimeOptions.format} format.`);
    }

    const { explanation, responseMeta, promptMeta } = await generateExplanation({
      mode: "conflict",
      commitData,
      providerOverride: runtimeOptions.provider,
      modelOverride: runtimeOptions.model,
      maxDiffLines: runtimeOptions.maxDiffLines,
      noCache: runtimeOptions.noCache,
      stream: canStream,
      onStart: canStream
        ? ({ promptMeta: streamPromptMeta }) => {
            if (!runtimeOptions.quiet && !streamStarted) {
              process.stdout.write(
                formatPreamble({
                  mode: "conflict",
                  commitData,
                  responseMeta: null,
                  promptMeta: streamPromptMeta,
                  options: runtimeOptions
                })
              );
              streamStarted = true;
            }
          }
        : null,
      onChunk: canStream ? (chunk) => process.stdout.write(chunk) : null
    });

    const renderedOutput = renderFinalOutput({
      runtimeOptions,
      mode: "conflict",
      commitData,
      explanation,
      responseMeta,
      promptMeta
    });

    if (canStream) {
      process.stdout.write("\n");
      if (runtimeOptions.verbose) {
        process.stdout.write(formatFooter({ responseMeta, promptMeta, options: runtimeOptions }));
      }
    } else {
      console.log(renderedOutput);
    }

    if (runtimeOptions.clipboard) {
      copyToClipboard(renderedOutput);
      if (!runtimeOptions.quiet) {
        console.error("Copied output to clipboard.");
      }
    }

    return 0;
  }

  if (parsed.mode === "stash") {
    const commitData = fetchStashData(parsed.stashRef, cwd, parsed.diffFile);
    const canStream = runtimeOptions.stream && runtimeOptions.format === "plain";
    let streamStarted = false;

    if (runtimeOptions.stream && !canStream && !runtimeOptions.quiet) {
      console.error(`Streaming is only supported with plain output. Ignoring --stream for ${runtimeOptions.format} format.`);
    }

    const { explanation, responseMeta, promptMeta } = await generateExplanation({
      mode: "stash",
      commitData,
      providerOverride: runtimeOptions.provider,
      modelOverride: runtimeOptions.model,
      maxDiffLines: runtimeOptions.maxDiffLines,
      noCache: runtimeOptions.noCache,
      stream: canStream,
      onStart: canStream
        ? ({ promptMeta: streamPromptMeta }) => {
            if (!runtimeOptions.quiet && !streamStarted) {
              process.stdout.write(
                formatPreamble({
                  mode: "stash",
                  commitData,
                  responseMeta: null,
                  promptMeta: streamPromptMeta,
                  options: runtimeOptions
                })
              );
              streamStarted = true;
            }
          }
        : null,
      onChunk: canStream ? (chunk) => process.stdout.write(chunk) : null
    });

    const renderedOutput = renderFinalOutput({
      runtimeOptions,
      mode: "stash",
      commitData,
      explanation,
      responseMeta,
      promptMeta
    });

    if (canStream) {
      process.stdout.write("\n");
      if (runtimeOptions.verbose) {
        process.stdout.write(formatFooter({ responseMeta, promptMeta, options: runtimeOptions }));
      }
    } else {
      console.log(renderedOutput);
    }

    if (runtimeOptions.clipboard) {
      copyToClipboard(renderedOutput);
      if (!runtimeOptions.quiet) {
        console.error("Copied output to clipboard.");
      }
    }

    return 0;
  }

  if (!targetRef) {
    printHelp();
    return 1;
  }

  const commitData = parsed.diffFile
    ? fetchCommitDataForFile(targetRef, parsed.diffFile, cwd)
    : fetchCommitData(targetRef, cwd);

  if (mode === "split") {
    if (commitData.analysisType !== "commit") {
      throw new Error("--split only supports analyzing a single commit.");
    }

    const { explanation, responseMeta, promptMeta } = await generateExplanation({
      mode: "split",
      commitData,
      providerOverride: runtimeOptions.provider,
      modelOverride: runtimeOptions.model,
      maxDiffLines: runtimeOptions.maxDiffLines,
      noCache: runtimeOptions.noCache,
      stream: false,
      onChunk: null,
      onStart: null
    });

    const plan = reconcileSplitPlan(parseSplitPlan(explanation), commitData.filesChanged);

    if (!plan.reason_to_split || plan.commits.length === 0) {
      console.log("This commit is already atomic. No split recommended.");
      return 0;
    }

    console.log(formatSplitPlan(plan));

    if (parsed.execute && !parsed.dryRun) {
      const reviewedPlan = parsed.interactive ? await reviewSplitPlanInteractively(plan) : plan;
      if (reviewedPlan == null) {
        console.log("Aborted.");
        return 0;
      }

      if (parsed.interactive) {
        console.log("");
        console.log(formatSplitPlan(reviewedPlan));
      }

      validateSplitExecutionTarget(commitData.commitId, cwd);
      const confirmed = await askQuestion(
        "\nThis will rewrite git history. Continue? (yes/no) > "
      );
      if (confirmed.toLowerCase() !== "yes") {
        console.log("Aborted.");
        return 0;
      }

      executeSplit(reviewedPlan, commitData.commitId, cwd);
      console.log(`\nSplit complete. Created ${reviewedPlan.commits.length} commits.`);
    } else {
      console.log("\nThis is a preview. Run with --execute to apply the split.");
    }

    if (runtimeOptions.verbose) {
      process.stdout.write(formatFooter({ responseMeta, promptMeta, options: runtimeOptions }));
    }

    return 0;
  }

  const canStream = runtimeOptions.stream && runtimeOptions.format === "plain";
  let streamStarted = false;

  if (runtimeOptions.stream && !canStream && !runtimeOptions.quiet) {
    console.error(`Streaming is only supported with plain output. Ignoring --stream for ${runtimeOptions.format} format.`);
  }

  const { explanation, responseMeta, promptMeta } = await generateExplanation({
    mode,
    commitData,
    providerOverride: runtimeOptions.provider,
    modelOverride: runtimeOptions.model,
    maxDiffLines: runtimeOptions.maxDiffLines,
    noCache: runtimeOptions.noCache,
    stream: canStream,
    onStart: canStream
      ? ({ promptMeta: streamPromptMeta }) => {
          if (!runtimeOptions.quiet && !streamStarted) {
            process.stdout.write(
              formatPreamble({
                mode,
                commitData,
                responseMeta: null,
                promptMeta: streamPromptMeta,
                options: runtimeOptions
              })
            );
            streamStarted = true;
          }
        }
      : null,
    onChunk: canStream ? (chunk) => process.stdout.write(chunk) : null
  });

  let renderedOutput;

  if (canStream) {
    process.stdout.write("\n");
    if (runtimeOptions.verbose) {
      process.stdout.write(formatFooter({ responseMeta, promptMeta, options: runtimeOptions }));
    }

    renderedOutput = renderFinalOutput({
      runtimeOptions,
      mode,
      commitData,
      explanation,
      responseMeta,
      promptMeta
    });
  } else {
    renderedOutput = renderFinalOutput({
      runtimeOptions,
      mode,
      commitData,
      explanation,
      responseMeta,
      promptMeta
    });
    console.log(renderedOutput);
  }

  if (runtimeOptions.clipboard) {
    copyToClipboard(renderedOutput);
    if (!runtimeOptions.quiet) {
      console.error("Copied output to clipboard.");
    }
  }

  return 0;
}

const entryFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? realpathSync(path.resolve(process.argv[1])) : "";

if (executedFile === entryFile) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.message);
      process.exit(1);
    }
  );
}
