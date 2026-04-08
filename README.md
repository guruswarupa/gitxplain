# gitxplain

`gitxplain` is a Node.js CLI that analyzes Git commits, commit ranges, and branch diffs to generate structured, human-readable explanations with AI.

Supported providers:

- OpenAI
- Groq
- OpenRouter
- Gemini
- Ollama
- Chutes AI

## Features

- Explains what a commit does, why it exists, and how the fix works
- Supports focused output modes like summary, issue, fix, impact, review, security, and line-by-line walkthroughs
- Supports AI-assisted commit splitting plans, with optional execution for the latest commit
- Supports release-branch merge previews driven by detected version bumps in diffs
- Supports automatic release tagging driven by the same version-bump detection used for release merges
- Supports AI-assisted commit planning for uncommitted working tree changes
- Supports quick repository log output for full history inspection
- Supports single commits, commit ranges, and branch-vs-base comparisons
- Truncates oversized diffs before sending them to the model and reports that truncation
- Streams output for supported providers
- Caches responses locally to reduce repeat API costs
- Supports plain, JSON, Markdown, and HTML output
- Supports clipboard copy, verbosity controls, and hook installation
- Supports project-level and user-level config files
- Falls back to an interactive prompt when no analysis flag is supplied
- Returns plain text or JSON output
- Uses native Node APIs only, so the MVP has no runtime dependencies

## Requirements

- Node.js 18+
- A Git repository in your current working directory
- An API key for your chosen provider, or a local Ollama instance

Optional environment variables:

- `LLM_PROVIDER` default: `openai`
- `LLM_MODEL` optional shared model override
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`
- `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_BASE_URL`
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`
- `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL`
- `OLLAMA_API_KEY` optional, default: `ollama`
- `OLLAMA_MODEL`, `OLLAMA_BASE_URL` default: `http://127.0.0.1:11434/v1`
- `CHUTES_API_KEY`, `CHUTES_MODEL`, `CHUTES_BASE_URL`

Optional config files:

- Project: `.gitxplainrc` or `.gitxplainrc.json`
- User: `~/.gitxplain/config.json`

You can start from:

```bash
cp .env.example .env
```

## Usage

```bash
gitxplain help
gitxplain commit
gitxplain --commit
gitxplain merge
gitxplain --merge
gitxplain tag
gitxplain --tag
gitxplore tag
gitxplore --tag
gitxplain log --log
gitxplain status
gitxplain --status
gitxplain add README.md
gitxplain remove README.md
gitxplain del scratch.txt
gitxplain pop
gitxplain pop 2
gitxplain push
gitxplain push origin main
gitxplain <commit-id>
gitxplain <commit-id> --summary
gitxplain <commit-id> --issues
gitxplain <commit-id> --fix
gitxplain <commit-id> --impact
gitxplain <commit-id> --full
gitxplain <commit-id> --lines
gitxplain <commit-id> --review
gitxplain <commit-id> --security
gitxplain <commit-id> --split
gitxplain --commit --execute
gitxplain merge
gitxplain --merge --execute
gitxplain tag
gitxplain --tag --execute
gitxplain <commit-id> --json
gitxplain <commit-id> --markdown
gitxplain <commit-id> --html
gitxplain <commit-id> --stream
gitxplain <commit-id> --clipboard
gitxplain <commit-id> --verbose
gitxplain <commit-id> --quiet
gitxplain log --log
gitxplain <start>..<end> --markdown
gitxplain --branch main --review
gitxplain --pr origin/main --security
gitxplain install-hook
gitxplain <commit-id> --provider openrouter --model anthropic/claude-3.7-sonnet
gitxplain <commit-id> --provider chutes --model deepseek-ai/DeepSeek-V3-0324
gitxplain <commit-id> --split --execute
```

Examples:

```bash
npm start -- HEAD~1 --summary
npm start -- commit
npm start -- merge
npm start -- tag
npm start -- log --log
npm start -- a1b2c3d --full
npm start -- HEAD~1 --lines
npm start -- HEAD~5..HEAD --markdown
npm start -- --branch main --review
npm start -- HEAD~1 --provider groq --model llama-3.3-70b-versatile
npm start -- HEAD~1 --provider gemini --model gemini-2.5-flash
npm start -- HEAD~1 --provider chutes --model deepseek-ai/DeepSeek-V3-0324
npm start -- HEAD --split --execute
```

## Running The CLI

To use the actual `gitxplain` command directly:

```bash
cd /home/guru/Dev/gitxplain
npm link
```

Then from any Git repository:

```bash
gitxplain help
gitxplain HEAD~1 --full
gitxplain a1b2c3d --summary
gitxplain HEAD~1 --lines
gitxplain HEAD~5..HEAD --markdown
gitxplain --branch main --review
```

The `gitxplain help` command also prints quick API-key setup examples for:

- OpenAI
- Groq
- OpenRouter
- Gemini
- Ollama
- Chutes AI

If you do not want to link it globally, you can still run it locally:

```bash
node /home/guru/Dev/gitxplain/cli/index.js HEAD~1 --full
```

## Output Modes

- `--summary`: one-sentence commit summary
- `--issues`: bug or issue-oriented analysis
- `--fix`: junior-friendly explanation of the fix
- `--impact`: before-vs-after explanation focused on behavior changes
- `--full`: full structured analysis
- `--lines`: file-by-file, line-by-line walkthrough of the changed code
- `--review`: code review findings with actionable suggestions
- `--security`: security-focused analysis of the change
- `--split`: propose how to split a commit into multiple atomic commits
- `--merge`: preview or execute a merge into the `release` branch based on detected version bumps
- `--tag`: preview or create release tags from the same detected version windows
- `--commit`: propose commits for current uncommitted changes
- `--log`: print Git log entries for the current repository
- `--status`: print Git working tree status for the current repository
- `--execute`: apply a proposed split by rewriting history
- `--dry-run`: preview the split or commit plan without applying it
- `--json`: return structured JSON instead of formatted text
- `--markdown`: return Markdown output
- `--html`: return HTML output

If no analysis flag is supplied, the CLI asks what kind of explanation you want.

## Repository Log

Print recent log entries from the current repository:

```bash
gitxplain log
gitxplain --log
```

Both forms print the repository history in a compact one-line format using the current repository, without calling the LLM.

## Quick Actions

Run a few common Git actions directly through `gitxplain`:

```bash
gitxplain status
gitxplain add README.md
gitxplain remove README.md
gitxplain del scratch.txt
gitxplain pop
gitxplain pop 2
gitxplain push
gitxplain push origin main
```

## Comparison Modes

Single commit:

```bash
gitxplain HEAD~1 --full
```

Commit range:

```bash
gitxplain HEAD~5..HEAD --markdown
```

Branch or PR-style comparison:

```bash
gitxplain --branch main --review
gitxplain --pr origin/main --security
```

`--branch` and `--pr` compare the current branch to a base ref using the merge base with `HEAD`.

## Commit Splitting

Preview how a commit could be split:

```bash
gitxplain HEAD~1 --split
```

Actually split the current `HEAD` commit into smaller commits:

```bash
gitxplain HEAD --split --execute
```

Use a specific provider for the analysis:

```bash
gitxplain HEAD --split --provider gemini
```

`--split` asks the model for a plan first. By default this is a dry run and only prints the proposed commit breakdown. Adding `--execute` rewrites Git history by undoing the current `HEAD` commit and recreating it as multiple commits in the suggested order.

Warning: `--split --execute` rewrites history. If the commit was already pushed, you may need to force-push after reviewing the new commit stack. For safety, execution only supports splitting the current `HEAD` commit and requires a clean working tree.

## Release Merge

Preview the release merge plan for the current branch:

```bash
gitxplain merge
gitxplain --merge
```

Actually merge the current branch into the `release` branch:

```bash
gitxplain --merge --execute
```

This command scans commits on your current branch after the branch split point and uses version-file diffs as release checkpoints. Each time a commit changes the version, that closes a release window. On the `release` branch, the command creates commits named `release <version>`. If no release versions have been promoted yet, it creates release commits for all detected versions in order. If some release versions already exist on `release`, it skips those and creates only the latest unreleased `release <version>` commit.

## Release Tagging

Preview the release tags for the current branch:

```bash
gitxplain tag
gitxplain --tag
gitxplore tag
gitxplore --tag
```

Actually create the tags:

```bash
gitxplain --tag --execute
gitxplore --tag --execute
```

This command uses the same release-window detection as `merge`. It scans commits on your current branch after the branch split point, detects version bumps from version-file diffs, and maps each unreleased version to the last commit in that release window. By default it creates annotated tags named exactly after the detected version, such as `1.2.3`.

## Commit Working Tree

Preview how the current uncommitted changes should be committed:

```bash
gitxplain commit
gitxplain --commit
```

Actually create the suggested commits:

```bash
gitxplain --commit --execute
```

Use a specific provider for the analysis:

```bash
gitxplain --commit --provider gemini
```

This mode analyzes the current working tree, proposes one or more logical commits with conventional commit messages, and can then create those commits automatically. By default it only previews the plan.

## Config File

Example `.gitxplainrc`:

```json
{
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "mode": "full",
  "format": "markdown",
  "maxDiffLines": 600,
  "stream": true,
  "verbose": false
}
```

CLI flags still override config values for a single command.

## Clipboard, Streaming, And Hooks

Copy the final output to your clipboard:

```bash
gitxplain HEAD~1 --markdown --clipboard
```

Stream long responses as they arrive:

```bash
gitxplain HEAD~1 --full --stream
```

Install a post-commit hook that saves a Markdown explanation under `.git/gitxplain/last-explanation.md`:

```bash
gitxplain install-hook
```

## Provider Setup

OpenAI:

```bash
export LLM_PROVIDER=openai
export OPENAI_API_KEY=your_key
```

Groq:

```bash
export LLM_PROVIDER=groq
export GROQ_API_KEY=your_key
```

OpenRouter:

```bash
export LLM_PROVIDER=openrouter
export OPENROUTER_API_KEY=your_key
```

Gemini:

```bash
export LLM_PROVIDER=gemini
export GEMINI_API_KEY=your_key
```

Ollama:

```bash
export LLM_PROVIDER=ollama
export OLLAMA_MODEL=llama3.2
```

Chutes AI:

```bash
export LLM_PROVIDER=chutes
export CHUTES_API_KEY=your_key
export CHUTES_MODEL=deepseek-ai/DeepSeek-V3-0324
```

## Development

```bash
npm run lint
npm test
```

To make the command globally available during local development:

```bash
npm link
```
