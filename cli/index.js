#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { generateExplanation } from "./services/aiService.js";
import { copyToClipboard } from "./services/clipboardService.js";
import { loadConfig } from "./services/configService.js";
import {
  buildBranchRange,
  fetchCommitData,
  getRepositoryLog,
  getDefaultBaseRef,
  isGitRepository
} from "./services/gitService.js";
import { installHook } from "./services/hookService.js";
import {
  formatFooter,
  formatHtmlOutput,
  formatJsonOutput,
  formatMarkdownOutput,
  formatOutput,
  formatPreamble
} from "./services/outputFormatter.js";
import { executeSplit, formatSplitPlan, parseSplitPlan } from "./services/splitService.js";

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
  ["--log", "log"]
]);

const FORMAT_FLAGS = new Map([
  ["--json", "json"],
  ["--markdown", "markdown"],
  ["--html", "html"]
]);

function printHelp() {
  console.log(`gitxplain - AI-powered Git and branch explainer

Usage:
  gitxplain help
  gitxplain --help
  gitxplain log
  gitxplain --log
  gitxplain install-hook [hook-name]
  gitxplain <commit-id> [options]
  gitxplain <start>..<end> [options]
  gitxplain --branch [base-ref] [options]
  gitxplain --pr [base-ref] [options]

Modes:
  --summary    Generate a one-line summary
  --issues     Focus on bug or issue analysis
  --fix        Explain the fix in simple terms
  --impact     Explain before-vs-after behavior changes
  --full       Generate a full structured analysis
  --lines      Explain the changed code line by line
  --review     Generate a code review with risks and suggestions
  --security   Focus on security risks introduced by the change
  --split      Propose splitting a commit into multiple atomic commits
  --log        Print recent Git log entries for the current repository
  --execute    Execute the proposed split (rewrites git history)
  --dry-run    Show the split plan without executing (default for --split)

Output:
  --json       Print JSON output
  --markdown   Print Markdown output
  --html       Print HTML output
  --quiet      Print only the explanation body
  --verbose    Print provider, model, cache, latency, and usage details
  --clipboard  Copy the final output to the system clipboard
  --stream     Stream the explanation as it is generated when supported

Providers:
  --provider   LLM provider: openai, groq, openrouter, gemini, ollama, chutes
  --model      Override the model name

Diff Budget:
  --max-diff-lines <n>   Limit diff lines sent to the model

Comparison:
  --branch [base-ref]    Analyze current branch against base branch
  --pr [base-ref]        Alias for --branch, useful for PR-style summaries

Examples:
  gitxplain HEAD~1 --full
  gitxplain HEAD~5..HEAD --markdown
  gitxplain --branch main --review
  gitxplain --pr origin/main --security --stream
  gitxplain log
  gitxplain --log
  gitxplain HEAD~1 --split
  gitxplain HEAD --split --execute
  gitxplain HEAD~1 --provider chutes --model deepseek-ai/DeepSeek-V3-0324

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
  Use --provider or --model to override your config or environment for one command.
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

export function parseArgs(argv) {
  const args = argv.slice(2);
  const subcommand = args[0];
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
  const isLogCommand = subcommand === "log";

  return {
    subcommand,
    help: flags.has("--help") || subcommand === "help",
    installHook: isInstallHook,
    logCommand: isLogCommand,
    hookName: isInstallHook ? positional[1] ?? "post-commit" : null,
    commitRef: isInstallHook || isLogCommand || subcommand === "help" ? null : positional[0] ?? null,
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
    log: flags.has("--log")
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
      "10. Repository Log",
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
    "10": "log"
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

  if (parsed.help) {
    printHelp();
    return 0;
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

  if (parsed.logCommand || parsed.log) {
    console.log(getRepositoryLog(cwd));
    return 0;
  }

  const runtimeOptions = resolveRuntimeOptions(parsed, config);
  const targetRef = resolveTargetRef(parsed, cwd);

  if (!targetRef) {
    printHelp();
    return 1;
  }

  const mode = parsed.mode ?? config.mode ?? (await chooseModeInteractively());
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

    const plan = parseSplitPlan(explanation);

    if (!plan.reason_to_split || plan.commits.length === 0) {
      console.log("This commit is already atomic. No split recommended.");
      return 0;
    }

    console.log(formatSplitPlan(plan));

    if (parsed.execute && !parsed.dryRun) {
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
