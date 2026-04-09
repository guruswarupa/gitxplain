#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { generateExplanation } from "./services/aiService.js";
import { startChatSession } from "./services/chatService.js";
import { loadEnvFile } from "./services/envLoader.js";
import {
  saveGitConnection,
  isGitConnected,
  loadGitConnection,
  getGitUserInfo,
  verifyGitToken
} from "./services/gitConnectionService.js";
import { copyToClipboard } from "./services/clipboardService.js";
import { loadConfig } from "./services/configService.js";
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
  buildReleaseTagPlan,
  executeReleaseMerge,
  executeReleaseTagPlan,
  finalizeReleaseMergePlan,
  finalizeReleaseTagPlan,
  formatReleaseMergePlan,
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
  ["--log", "log"],
  ["--status", "status"],
  ["--pipeline", "pipeline"]
]);

const FORMAT_FLAGS = new Map([
  ["--json", "json"],
  ["--markdown", "markdown"],
  ["--html", "html"]
]);

const RESERVED_SUBCOMMANDS = new Set([
  "help",
  "example",
  "install-hook",
  "git",
  "add",
  "remove",
  "del",
  "bin",
  "pop",
  "pull",
  "push",
  "commit",
  "merge",
  "tag",
  "log",
  "status",
  "pipeline"
]);

function printHelp() {
  console.log(`gitxplain - AI-powered Git change analysis, review, and commit workflow CLI

Usage:
  gitxplain help
  gitxplain --help
  gitxplain example
  gitxplain --example
  gitxplain git <native-git-args...>

Git:
  gitxplain commit
  gitxplain --commit
  gitxplain merge
  gitxplain --merge
  gitxplain tag
  gitxplain --tag
  gitxplain log
  gitxplain --log
  gitxplain status
  gitxplain --status
  gitxplain --pipeline
  gitxplain add <path> [more-paths...]
  gitxplain remove <path> [more-paths...]
  gitxplain remove hard
  gitxplain del <path> [more-paths...]
  gitxplain bin
  gitxplain pop [stash-index]
  gitxplain pull [remote] [branch]
  gitxplain push [remote] [branch]
  gitxplain install-hook [hook-name]

GitHub:
  gitxplain --connect-github [token]
  gitxplain --boot [options]

Analysis:
  gitxplain <commit-id> [options]
  gitxplain <start>..<end> [options]
  gitxplain --branch [base-ref] [options]
  gitxplain --pr [base-ref] [options]

What It Does:
  Analyze commits, ranges, branches, and working tree changes
  Generate summaries, reviews, security checks, and line-by-line walkthroughs
  Plan commits for uncommitted work and split oversized commits into atomic steps
  Merge release-version branch changes into a dedicated release branch
  Tag release-version commit windows on the current branch
  Inspect repository history and working tree status without calling the LLM
  Inspect the current repository and scaffold GitHub Actions CI/CD workflows
  Run quick local actions to stage, unstage, delete files, pop stashes, or push
  Pull from a remote or soft-reset the latest commit without leaving the CLI
  Pass through any native Git command and flags when you need the full Git surface

Modes:
  --summary    Generate a one-line summary of a change
  --issues     Focus on the bug, issue, or failure being addressed
  --fix        Explain the fix in simple, junior-friendly terms
  --impact     Explain before-vs-after behavior changes
  --full       Generate a full structured analysis
  --lines      Walk through the changed code file by file
  --review     Generate review findings, risks, and suggestions
  --security   Focus on security-relevant changes and concerns
  --split      Propose splitting a commit into smaller atomic commits
  --merge      Preview or apply a merge into the release branch based on version bumps
  --tag        Preview or create release tags based on version bumps
  --commit     Propose commits for current uncommitted changes
  --log        Print Git log entries for the current repository
  --status     Print Git working tree status for the current repository
  --pipeline   Detect the current repository stack and create CI/CD workflow files
  --execute    Execute a proposed split or commit plan
  --dry-run    Preview the plan without executing it (default for --split and --commit)

Quick Actions:
  add         Stage one or more files with git add
  remove      Unstage one or more files with git restore --staged
  remove hard Hard reset the repository to HEAD
  del         Delete one or more files from the working tree
  bin         Soft reset HEAD~1 while keeping your changes
  pop         Pop a stash entry with a plain numeric index like "pop 2"
  pull        Run git pull, optionally with a remote and branch
  push        Run git push, optionally with a remote and branch

Output:
  --json       Print structured JSON output
  --markdown   Print Markdown output
  --html       Print HTML output
  --quiet      Print only the main body without extra framing
  --verbose    Print provider, model, cache, latency, and usage details
  --clipboard  Copy the final output to the system clipboard
  --stream     Stream model output as it is generated when supported

GitHub:
  --connect-github Save your GitHub Personal Access Token to act autonomously inside Chat
  --boot            Launch an interactive chat session for dynamic querying, PR creation, and cloning

Providers:
  --provider   LLM provider: openai, groq, openrouter, gemini, ollama, chutes
  --model      Override the model name

Diff Budget:
  --max-diff-lines <n>   Limit diff lines sent to the model

Comparison:
  --branch [base-ref]    Analyze the current branch against a base branch
  --pr [base-ref]        Alias for --branch, useful for PR-style comparisons

Provider Setup:
  OpenAI:
    export LLM_PROVIDER=openai
    export OPENAI_API_KEY=your_key

  Groq:
    export LLM_PROVIDER=groq
    export GROQ_API_KEY=your_key

  OpenRouter:
    export LLM_PROVIDER=openrouter
    export OPENROUTER_API_KEY=your_key

  Gemini:
    export LLM_PROVIDER=gemini
    export GEMINI_API_KEY=your_key

  Ollama:
    export LLM_PROVIDER=ollama
    export OLLAMA_MODEL=llama3.2

  Chutes:
    export LLM_PROVIDER=chutes
    export CHUTES_API_KEY=your_key

Config:
  Project config: .gitxplainrc or .gitxplainrc.json
  User config: ~/.gitxplain/config.json

Hook Installation:
  gitxplain install-hook
  gitxplain install-hook post-commit

Notes:
  Run gitxplain inside a Git repository.
  If no mode is supplied, gitxplain will prompt you to choose one interactively.
  Use --provider or --model to override your config or environment for one command.
  Use gitxplain git <args...> to run any native Git subcommand with its normal flags.
`);
}

function printExamples() {
  console.log(`gitxplain examples

Examples:
  gitxplain --connect-github <token>
  gitxplain --boot
  gitxplain HEAD~1 --full
  gitxplain HEAD~1 --review
  gitxplain HEAD~5..HEAD --markdown
  gitxplain --branch main --review
  gitxplain --pr origin/main --security --stream
  gitxplain commit
  gitxplain --commit --execute
  gitxplain merge
  gitxplain --merge --execute
  gitxplain tag
  gitxplain --tag --execute
  gitxplain log
  gitxplain --log
  gitxplain status
  gitxplain --status
  gitxplain pipeline
  gitxplain --pipeline
  gitxplain add README.md
  gitxplain remove README.md
  gitxplain remove hard
  gitxplain del scratch.txt
  gitxplain bin
  gitxplain pop
  gitxplain pop 2
  gitxplain pull
  gitxplain pull origin main
  gitxplain push
  gitxplain push origin main
  gitxplain HEAD~1 --split
  gitxplain HEAD --split --execute
  gitxplain HEAD~1 --provider chutes --model deepseek-ai/DeepSeek-V3-0324
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
  const isExample = flags.has("--example") || subcommand === "example";
  const isNativeGitWrapper = subcommand === "git";
  const isConnectGitHub = flags.has("--connect-github") || flags.has("--connect-git");
  const isBoot = flags.has("--boot");
  const isLogCommand = subcommand === "log";
  const isStatusCommand = subcommand === "status";
  const isCommitCommand = subcommand === "commit";
  const isMergeCommand = subcommand === "merge";
  const isTagCommand = subcommand === "tag";
  const isAddCommand = subcommand === "add";
  const isRemoveCommand = subcommand === "remove";
  const isDeleteCommand = subcommand === "del";
  const isPipelineCommand = subcommand === "pipeline" || flags.has("--pipeline");
  const isBinCommand = subcommand === "bin";
  const isPopCommand = subcommand === "pop";
  const isPullCommand = subcommand === "pull";
  const isPushCommand = subcommand === "push";
  const isRemoveHardCommand = isRemoveCommand && positional[1] === "hard" && positional.length === 2;
  const isNativeGitCommand = isNativeGitWrapper || isDirectNativeGitSubcommand(subcommand, knownGitSubcommands);

  return {
    subcommand,
    help: flags.has("--help") || subcommand === "help",
    example: isExample,
    nativeGitCommand: isNativeGitCommand,
    installHook: isInstallHook,
    connectGitHub: isConnectGitHub,
    boot: isBoot,
    logCommand: isLogCommand,
    statusCommand: isStatusCommand,
    commitCommand: isCommitCommand,
    mergeCommand: isMergeCommand,
    tagCommand: isTagCommand,
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
    connectToken: isConnectGitHub ? positional[0] : null,
    stashIndex: isPopCommand ? positional[1] ?? null : null,
    pullRemote: isPullCommand ? positional[1] ?? null : null,
    pullBranch: isPullCommand ? positional[2] ?? null : null,
    pushRemote: isPushCommand ? positional[1] ?? null : null,
    pushBranch: isPushCommand ? positional[2] ?? null : null,
    commitRef:
      isInstallHook ||
      isExample ||
      isNativeGitCommand ||
      isConnectGitHub ||
      isBoot ||
      isLogCommand ||
      isStatusCommand ||
      isCommitCommand ||
      isMergeCommand ||
      isTagCommand ||
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

async function chooseModeInteractively() {
  const answer = await askQuestion(
    [
      "What do you want to know?",
      "1. Summary",
      "2. Issues Fixed",
      "3. Fix Explanation",
      "4. Impact",
      "5. Full Analysis",
      "6. Line-by-Line Code Walkthrough",
      "7. Code Review",
      "8. Security Review",
      "9. Split Commit",
      "10. Merge To Release Branch",
      "11. Tag Release Commits",
      "12. Repository Log",
      "13. Commit Working Tree",
      "14. Create CI/CD Pipelines",
      "> "
    ].join("\n")
  );

  const selections = {
    "1": "summary",
    "2": "issues",
    "3": "fix",
    "4": "impact",
    "5": "full",
    "6": "lines",
    "7": "review",
    "8": "security",
    "9": "split",
    "10": "merge",
    "11": "tag",
    "12": "log",
    "13": "commit",
    "14": "pipeline"
  };

  return selections[answer] ?? "full";
}

function resolveRuntimeOptions(parsed, config) {
  return {
    mode: parsed.mode ?? config.mode ?? "full",
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

export function buildBootSessionArgs(connection, userInfo, parsed) {
  return {
    token: connection.token,
    providerOverride: parsed.provider,
    modelOverride: parsed.model,
    username: userInfo.name || connection.user?.login || null
  };
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

export async function main(argv = process.argv) {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const parsed = parseArgs(argv);
  const hasNoCommandOrFlags = argv.slice(2).length === 0;

  loadEnvFile(cwd); // Ensure environment is loaded first

  if (parsed.help || hasNoCommandOrFlags) {
    printHelp();
    return 0;
  }

  if (parsed.example) {
    printExamples();
    return 0;
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

  if (parsed.connectGitHub) {
    let token = parsed.connectToken;
    if (!token) {
      if (process.env.GITHUB_TOKEN) {
        token = process.env.GITHUB_TOKEN;
      } else {
        console.error("Please provide your GitHub Personal Access Token.\nRun: gitxplain --connect-github <YOUR_TOKEN>\nOr set it in your .env as GITHUB_TOKEN=...");
        return 1;
      }
    }
    try {
      console.log("Verifying token with GitHub API...");
      const userInfo = await verifyGitToken(token);
      await saveGitConnection(token, "github", userInfo);
      console.log(`\nSuccessfully connected to GitHub as: \x1b[36m${userInfo.login}\x1b[0m`);
      console.log(`Token saved securely to your local configuration.\n`);
    } catch (e) {
      console.error(`Token verification failed: ${e.message}`);
      return 1;
    }
    return 0;
  }

  if (parsed.boot) {
    if (!isGitConnected()) {
      console.error("You must connect a GitHub account first to use the interactive agent.\nCommand: gitxplain --connect-github <YOUR_TOKEN>");
      return 1;
    }
    const connection = loadGitConnection();
    const userInfo = getGitUserInfo();
    try {
      const { getProviderConfig, validateProviderConfig } = await import(
        "./services/aiService.js"
      );
      const config = getProviderConfig(parsed.provider, parsed.model);
      validateProviderConfig(config);
      const sessionArgs = buildBootSessionArgs(connection, userInfo, parsed);
      await startChatSession(
        sessionArgs.token,
        sessionArgs.providerOverride,
        sessionArgs.modelOverride,
        sessionArgs.username
      );
    } catch (configError) {
      console.error(`Missing LLM Key. Please check your .env variables or --provider flags.\n${configError.message}`);
      return 1;
    }
    return 0;
  }

  if (parsed.logCommand || parsed.log) {
    console.log(getRepositoryLog(cwd));
    return 0;
  }

  if (parsed.statusCommand || parsed.status) {
    console.log(getRepositoryStatus(cwd));
    return 0;
  }

  if (parsed.pipelineCommand) {
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
  const mode = parsed.mode ?? config.mode ?? (await chooseModeInteractively());

  if (mode === "pipeline") {
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

  if (mode === "commit" || parsed.commitCommand) {
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

  if (mode === "merge" || parsed.mergeCommand || parsed.merge) {
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

  if (mode === "tag" || parsed.tagCommand || parsed.tag) {
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
