#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { generateExplanation } from "./services/aiService.js";
import { loadEnvFile } from "./services/envLoader.js";
import { copyToClipboard } from "./services/clipboardService.js";
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
  fetchCommitData,
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
  "split"
]);

const RESERVED_SUBCOMMANDS = new Set([
  "help",
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

function printHelp() {
  console.log(`gitxplain - AI-powered Git change analysis, review, and commit workflow CLI

Usage:
  gitxplain --help
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
  --split         Propose splitting a commit into smaller atomic commits
  --commit        Propose commits for current uncommitted changes
  --execute       Execute a proposed split or commit plan
  --dry-run       Preview the plan without executing it

Release:
  --release [status]  Show release branch health and next recommended action
  --merge         Preview or apply a merge into the release branch
  --tag           Preview or create release tags from version bumps

Repo:
  --log           Print Git log entries for the current repository
  --status        Print Git working tree status for the current repository
  --pipeline      Detect the current repository stack and create CI/CD workflow files

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
  install-hook    Install the gitxplain hook
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
  const valueFlags = new Set(["--provider", "--model", "--max-diff-lines", "--branch", "--pr"]);
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
    nativeGitCommand: isNativeGitCommand,
    installHook: isInstallHook,
    configCommand: isConfigCommand,
    configAction: isConfigCommand ? positional[1] ?? null : null,
    configKey: isConfigCommand ? positional[2] ?? null : null,
    configValue: isConfigCommand ? positional.slice(3).join(" ") || null : null,
    logCommand: false,
    statusCommand: false,
    commitCommand: false,
    mergeCommand: false,
    tagCommand: false,
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
    hasBranchFlag: flags.has("--branch") || args.some((arg) => arg.startsWith("--branch=")),
    branchBase: getFlagValue(args, "--branch"),
    hasPrFlag: flags.has("--pr") || args.some((arg) => arg.startsWith("--pr=")),
    prBase: getFlagValue(args, "--pr"),
    clipboard: flags.has("--clipboard"),
    stream: flags.has("--stream"),
    verbose: flags.has("--verbose"),
    quiet: flags.has("--quiet"),
    execute: flags.has("--execute"),
    dryRun: flags.has("--dry-run"),
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
    verbose: parsed.verbose || config.verbose === true,
    quiet: parsed.quiet || config.quiet === true
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

  const { writtenFiles, notes } = writePipelineFiles(cwd, analysis, selection);
  console.log(`\nCreated workflow files: ${writtenFiles.join(", ")}`);

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

  if (parsed.help || hasNoCommandOrFlags) {
    printHelp();
    return 0;
  }

  if (parsed.configCommand) {
    return handleConfigCommand(parsed);
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

  if (!targetRef) {
    printHelp();
    return 1;
  }

  const commitData = fetchCommitData(targetRef, cwd);

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
      validateSplitExecutionTarget(commitData.commitId, cwd);
      const confirmed = await askQuestion(
        "\nThis will rewrite git history. Continue? (yes/no) > "
      );
      if (confirmed.toLowerCase() !== "yes") {
        console.log("Aborted.");
        return 0;
      }

      executeSplit(plan, commitData.commitId, cwd);
      console.log(`\nSplit complete. Created ${plan.commits.length} commits.`);
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

  const { explanation, responseMeta, promptMeta } = await generateExplanation({
    mode,
    commitData,
    providerOverride: runtimeOptions.provider,
    modelOverride: runtimeOptions.model,
    maxDiffLines: runtimeOptions.maxDiffLines,
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
