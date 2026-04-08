#!/usr/bin/env node

import process from "node:process";
import { fetchCommitData, isGitRepository } from "./services/gitService.js";
import { generateExplanation } from "./services/aiService.js";
import { formatOutput, formatJsonOutput } from "./services/outputFormatter.js";
import {
  saveGitConnection,
  isGitConnected,
  loadGitConnection,
  getGitUserInfo,
  verifyGitToken
} from "./services/gitConnectionService.js";
import { startChatSession } from "./services/chatService.js";
import { loadEnvFile } from "./services/envLoader.js";

const ANALYSIS_FLAGS = new Map([
  ["--summary", "summary"],
  ["--issues", "issues"],
  ["--fix", "fix"],
  ["--impact", "impact"],
  ["--full", "full"]
]);

function printHelp() {
  console.log(`gitxplain - AI-powered Git commit explainer

Usage:
  gitxplain help
  gitxplain --help
  gitxplain <commit-id> [options]
  gitxplain --connect-git              Connect GitHub account with PAT
  gitxplain --boot [options]           Start interactive chat with repo context

Commit Analysis Options:
  --summary      Generate a one-line summary
  --issues       Focus on bug or issue analysis
  --fix          Explain the fix in simple terms
  --impact       Explain before-vs-after behavior changes
  --full         Generate a full structured analysis

General Options:
  --provider     LLM provider: openai, groq, openrouter, gemini, ollama, chutes
  --model        Override the model name
  --json         Print JSON output
  --help         Show this help message

Examples - Commit Analysis:
  gitxplain HEAD~1 --full
  gitxplain a1b2c3d --summary
  gitxplain HEAD~1 --provider groq --model llama-3.3-70b-versatile

Examples - GitHub Connection & Chat:
  gitxplain --connect-git
  gitxplain --boot
  gitxplain --boot --provider groq --model llama-3.3-70b-versatile

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

Notes:
  Run gitxplain inside a Git repository.
  Use --provider or --model to override your environment for one command.
`);
}

function getFlagValue(args, flagName) {
  const directIndex = args.findIndex((arg) => arg === flagName);
  if (directIndex >= 0) {
    return args[directIndex + 1] ?? null;
  }

  const inline = args.find((arg) => arg.startsWith(`${flagName}=`));
  return inline ? inline.slice(flagName.length + 1) : null;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const subcommand = args[0];
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const valueFlags = new Set(["--provider", "--model"]);
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    if (valueFlags.has(arg)) {
      index += 1;
    }
  }

  const commitId = positional[0];
  const mode = [...ANALYSIS_FLAGS.entries()].find(([flag]) => flags.has(flag))?.[1] ?? null;

  return {
    commitId: subcommand === "help" ? null : commitId,
    json: flags.has("--json"),
    help: flags.has("--help") || subcommand === "help",
    connectGit: flags.has("--connect-git"),
    boot: flags.has("--boot"),
    mode,
    provider: getFlagValue(args, "--provider"),
    model: getFlagValue(args, "--model")
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
      "> "
    ].join("\n")
  );

  const selections = {
    "1": "summary",
    "2": "issues",
    "3": "fix",
    "4": "impact",
    "5": "full"
  };

  return selections[answer] ?? "full";
}

async function handleConnectGit() {
  console.log("\n🔐 GitHub Connection Setup\n");

  const pat = await askQuestion(
    "Enter your GitHub Personal Access Token (PAT): "
  );

  if (!pat || pat.trim().length === 0) {
    console.error("Error: PAT cannot be empty");
    process.exit(1);
  }

  console.log("\n⏳ Verifying token with GitHub...");

  try {
    const githubUser = await verifyGitToken(pat, "github");

    await saveGitConnection(pat, "github", {
      login: githubUser.login,
      name: githubUser.name || githubUser.login,
      email: githubUser.email || "private",
      avatar_url: githubUser.avatar_url,
      bio: githubUser.bio,
      company: githubUser.company,
      public_repos: githubUser.public_repos,
      followers: githubUser.followers
    });

    console.log("\n✅ Git Connected Successfully");
    console.log(`👤 User: ${githubUser.name || githubUser.login}`);
    console.log(`📧 Email: ${githubUser.email || "Private"}`);
    console.log(`📍 Location: ${githubUser.location || "Not specified"}`);
    console.log(`🔗 Profile: ${githubUser.html_url}`);
    console.log(`📊 Public repos: ${githubUser.public_repos}`);
    console.log(`👥 Followers: ${githubUser.followers}`);
    console.log("\nYou can now use 'gitxplain --boot' to start the chat interface.\n");
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Failed to verify GitHub token: ${error.message}`);
    console.error("\nMake sure your PAT has the right permissions and is valid.");
    process.exit(1);
  }
}

async function handleBoot(providerOverride, modelOverride) {
  if (!isGitConnected()) {
    console.error(
      "❌ Git is not connected. Please run 'gitxplain --connect-git' first."
    );
    process.exit(1);
  }

  const connection = loadGitConnection();
  console.log("\n🚀 Initializing Git Chat Interface...\n");
  if (connection.user && connection.user.login) {
    console.log(`✅ Connected as: @${connection.user.login}`);
  }
  console.log(`📅 Connection verified: ${new Date(connection.connectedAt).toLocaleString()}`);
  console.log("⏳ Loading your GitHub repositories...\n");

  try {
    // Validate provider config before starting chat
    let provider = providerOverride;
    let model = modelOverride;

    if (!provider) {
      provider = process.env.LLM_PROVIDER ?? "groq";
    }

    // Check if the provider configuration is valid
    try {
      const { getProviderConfig, validateProviderConfig } = await import(
        "./services/aiService.js"
      );
      const config = getProviderConfig(provider, model);
      validateProviderConfig(config);
    } catch (configError) {
      console.error(`\n❌ Configuration Error: ${configError.message}\n`);
      console.error("To use --boot, you need to configure an LLM provider:\n");
      console.error("Default Provider - Groq (fast & free):");
      console.error("  Create a .env file with: GROQ_API=your_groq_api_key");
      console.error("  gitxplain --boot\n");
      console.error("Alternative - OpenAI:");
      console.error("  export LLM_PROVIDER=openai");
      console.error("  export OPENAI_API_KEY=your_key\n");
      console.error("Alternative - Ollama (local, no API key):");
      console.error("  export LLM_PROVIDER=ollama\n");
      process.exit(1);
    }

    await startChatSession(
      connection.token,
      connection.user.login,
      provider,
      model
    );
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  loadEnvFile();
  const parsed = parseArgs(process.argv);

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  if (parsed.connectGit) {
    await handleConnectGit();
    return;
  }

  if (parsed.boot) {
    await handleBoot(parsed.provider, parsed.model);
    return;
  }

  if (!parsed.commitId) {
    printHelp();
    process.exit(1);
  }

  if (!isGitRepository(process.cwd())) {
    console.error("gitxplain must be run inside a Git repository.");
    process.exit(1);
  }

  const mode = parsed.mode ?? (await chooseModeInteractively());
  const commitData = fetchCommitData(parsed.commitId, process.cwd());
  const explanation = await generateExplanation({
    mode,
    commitData,
    providerOverride: parsed.provider,
    modelOverride: parsed.model
  });

  if (parsed.json) {
    console.log(formatJsonOutput({ mode, commitData, explanation }));
    return;
  }

  console.log(formatOutput({ mode, commitData, explanation }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
