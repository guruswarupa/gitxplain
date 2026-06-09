# gitxplain

`gitxplain` is an AI-powered Git assistant that helps you understand your code changes. It analyzes Git commits, commit ranges, branch diffs, merge conflicts, and more to generate clear, structured explanations of what changed, why it changed, and how it works.

Think of it as having a senior developer review your changes and explain them in plain language – whether you're trying to understand a teammate's commit, preparing a pull request description, reviewing security implications, or planning how to split a large commit into smaller, focused ones.

Supported providers:

- OpenAI
- Groq
- OpenRouter
- Gemini
- Ollama
- Chutes AI
- Anthropic
- Mistral
- Azure OpenAI

## Features

- Explains what a commit does, why it exists, and how the fix works
- Supports focused output modes like summary, issue, fix, impact, review, security, and line-by-line walkthroughs
- Supports blame summaries, changelog drafting, PR description drafting, refactor suggestions, and test suggestion modes
- Supports stash explanation and single-file diff deep dives
- Supports merge conflict analysis with suggested resolutions
- Supports cumulative token usage tracking and optional estimated cost reporting
- Supports interactive split-plan review before history is rewritten
- Supports AI-assisted commit splitting plans, with optional execution for the latest commit
- Supports release-branch merge previews driven by detected version bumps in diffs
- Supports automatic release tagging driven by the same version-bump detection used for release merges
- Supports release health status checks that show missing tags, unmerged version bumps, branch drift, and next steps
- Supports AI-assisted commit planning for uncommitted working tree changes
- Supports quick repository log output for full history inspection
- Supports repository-aware CI/CD workflow generation for GitHub Actions, GitLab CI, CircleCI, and Bitbucket Pipelines
- Supports single commits, commit ranges, and branch-vs-base comparisons
- Truncates oversized diffs before sending them to the model and reports that truncation
- Streams output for supported providers
- Caches responses locally to reduce repeat API costs
- Supports plain, JSON, Markdown, and HTML output
- Supports clipboard copy, verbosity controls, and hook installation
- Supports project-level and user-level config files
- Returns plain text or JSON output
- Uses native Node APIs only, so the MVP has no runtime dependencies

## Requirements

- Node.js 18+
- A Git repository in your current working directory
- An API key for your chosen provider, or a local Ollama instance

## Installation

Install from npm:

```bash
npm install -g gitxplain
```

After installation, you can use either `gitxplain` or the short alias `gx`:

```bash
gitxplain HEAD -s
gx HEAD -s
```

Install from bun:

```bash
bun install -g gitxplain
```

Install with Homebrew:

```bash
brew tap guruswarupa/homebrew-tap
brew install gitxplain
```

Install from the AUR:

```bash
yay -S gitxplain
```

```bash
paru -S gitxplain
```

Install from a Debian package downloaded from GitHub Releases:

```bash
sudo apt install ./gitxplain_<version>_all.deb
```

Optional advanced environment variables:

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
- User: `~/.gitxplain/config.json` on macOS/Linux, or `%USERPROFILE%\.gitxplain\config.json` on Windows

You can start from:

```bash
cp .env.example .env
```

## Provider Setup

**Before using gitxplain, you need to configure your AI provider and API key.**

Recommended persistent setup:

```bash
# Short alias
gx config set provider openai
gx config set api-key your_key
# Long command
gitxplain config set provider openai
gitxplain config set api-key your_key
```

You can also save a default model:

```bash
# Short alias
gx config set model gpt-4.1-mini
# Long command
gitxplain config set model gpt-4.1-mini
```

You can switch providers later:

```bash
# Short alias
gx config set provider groq
gx config set api-key your_key
# Long command
gitxplain config set provider groq
gitxplain config set api-key your_key
```

Additional supported providers:

```bash
# Short alias
gx config set provider anthropic
gx config set api-key your_key

gx config set provider mistral
gx config set api-key your_key

gx config set provider azure-openai
gx config set api-key your_key

# Long command
gitxplain config set provider anthropic
gitxplain config set api-key your_key

gitxplain config set provider mistral
gitxplain config set api-key your_key

gitxplain config set provider azure-openai
gitxplain config set api-key your_key
```

Azure OpenAI also requires endpoint configuration:

```bash
export AZURE_OPENAI_BASE_URL="https://your-resource.openai.azure.com"
export AZURE_OPENAI_DEPLOYMENT="your-deployment-name"
export AZURE_OPENAI_API_VERSION="2024-10-21"
```

Optional token pricing env vars for estimated cost tracking:

```bash
export OPENAI_INPUT_COST_PER_MTOK="0.15"
export OPENAI_OUTPUT_COST_PER_MTOK="0.60"
```

Or use generic pricing defaults across providers:

```bash
export LLM_INPUT_COST_PER_MTOK="0.15"
export LLM_OUTPUT_COST_PER_MTOK="0.60"
```

If you want to inspect what is saved:

```bash
# Short alias
gx config list
gx config get provider
# Long command
gitxplain config list
gitxplain config get provider
```

Saved user settings live in `~/.gitxplain/config.json` on macOS/Linux, or `%USERPROFILE%\.gitxplain\config.json` on Windows.

## Config File

You can also use a config file for project-specific settings:

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

You can also save provider settings permanently with the CLI:

```bash
# Short alias
gx config set provider openai
gx config set api-key your_key
gx config set model gpt-4.1-mini
gx config list
# Long command
gitxplain config set provider openai
gitxplain config set api-key your_key
gitxplain config set model gpt-4.1-mini
gitxplain config list
```

## Quick Command Reference

All commands support both long-form flags (e.g., `--summary`) and short aliases (e.g., `-s`) for faster typing. The short alias `gx` can be used interchangeably with `gitxplain`.

### Analysis Modes
| Short Alias | Long Command | Description |
|-------------|--------------|-------------|
| `-s` | `--summary` / `--sum` | One-line summary |
| `-F` | `--full` | Full structured analysis |
| `-r` | `--review` / `--rev` | Code review findings |
| `-S` | `--security` / `--sec` | Security analysis |
| `-l` | `--lines` / `--lin` | Line-by-line walkthrough |
| `-R` | `--refactor` / `--ref` | Refactoring suggestions |
| `-t` | `--test-suggest` / `--test` | Test suggestions |
| `-p` | `--pr-description` / `--pr` | PR description |
| `-c` | `--changelog` / `--ch` | Changelog notes |
| `-i` | `--issues` / `--iss` | Issue-focused analysis |
| `-f` | `--fix` | Simple explanation |
| `-m` | `--impact` / `--imp` | Before/after impact |
| `-b` | `--blame` / `--bla` | File ownership analysis |
| `-C` | `--conflict` / `--con` | Merge conflict resolution |
| `-Z` | `--stash` / `--sta` | Stash explanation |
| `-x` | `--split` / `--spl` | Commit splitting |
| `-A` | `--performance` / `--perf` | Performance analysis |
| `-Q` | `--database` / `--db` | Database schema and query analysis |
| `-G` | `--docs` | Documentation analysis |
| `-Y` | `--api-docs` / `--api` | API documentation generation |
| `-J` | `--coverage` / `--cov` | Test coverage analysis |
| `-K` | `--mutation` / `--mut` | Mutation testing targets |

### Workflow Commands
| Short Alias | Long Command | Description |
|-------------|--------------|-------------|
| `-k` | `--commit` / `--com` / `--plan` | Plan commits for changes |
| `-g` | `--merge` / `--mrg` / `--mg` | Release merge |
| `-T` | `--tag` / `--tg` | Release tagging |
| `-e` | `--release` / `--rel` / `--rl` | Release status |
| `-E` | `--execute` / `--exe` / `--run` | Execute plan |
| `-d` | `--dry-run` / `--dry` / `--prev` | Preview without executing |
| `-I` | `--interactive` / `--int` / `--edit` | Interactive review |

### Output Options
| Short Alias | Long Command | Description |
|-------------|--------------|-------------|
| `-j` | `--json` | JSON output |
| `-M` | `--markdown` / `--md` | Markdown output |
| `-H` | `--html` | HTML output |
| `-q` | `--quiet` / `--silent` | Quiet mode |
| `-v` | `--verbose` / `--verb` / `--vv` | Verbose mode |
| `-y` | `--clipboard` / `--clip` / `--copy` | Copy to clipboard |
| `-z` | `--stream` / `--str` | Stream output |
| `-n` | `--no-cache` / `--noc` / `--fresh` | Bypass cache |
| `-o` | `--cost` | Show cost |
| `-w` | `--provider` / `--prov` / `-W` | AI provider |
| `-O` | `--model` / `--mod` / `--mo` | AI model |
| `-X` | `--max-diff-lines` / `--max` / `--limit` | Diff line limit |

### Repository & Comparison
| Short Alias | Long Command | Description |
|-------------|--------------|-------------|
| `-L` | `--log` / `--lg` | Repository log |
| `-u` | `--status` / `--stat` / `--st` | Repository status |
| `-V` | `--pipeline` / `--pipe` / `--ci` | CI/CD pipeline generation |
| `-B` | `--branch` / `--br` | Branch comparison |
| `-P` | `--pr` / `--pull-request` | PR-style comparison |
| `-D` | `--diff` / `--dif` | File-specific diff |

## Usage

Show the built-in command reference.

```bash
# Short alias
gx --help
# Long command
gitxplain --help
```

Inspect cache usage or clear cached responses.

```bash
# Short alias
gx cache stats
gx cache clear
# Long command
gitxplain cache stats
gitxplain cache clear
```

Show cumulative token usage and estimated cost totals.

```bash
# Short alias
gx -o
# Long command
gitxplain --cost
```

Save the default AI provider.

```bash
# Short alias
gx config set provider <name>
# Long command
gitxplain config set provider <name>
```

Save the API key for a provider.

```bash
# Short alias
gx config set api-key <value> [-w <name>]
# Long command
gitxplain config set api-key <value> [--provider <name>]
```

Print one saved config value, or all of them.

```bash
# Short alias
gx config get [key]
# Long command
gitxplain config get [key]
```

List saved user config values.

```bash
# Short alias
gx config list
# Long command
gitxplain config list
```

Analyze a single commit.

```bash
# Short alias
gx <commit-id> [options]
# Long command
gitxplain <commit-id> [options]
```

Analyze a commit range.

```bash
# Short alias
gx <start>..<end> [options]
# Long command
gitxplain <start>..<end> [options]
```

Compare the current branch to a base branch.

```bash
# Short alias
gx -B [base-ref] [options]
# Long command
gitxplain --branch [base-ref] [options]
```

Compare the current branch like a PR.

```bash
# Short alias
gx -P [base-ref] [options]
# Long command
gitxplain --pr [base-ref] [options]
```

Plan commits for uncommitted working tree changes.

```bash
# Short alias
gx -k
# Long command
gitxplain --commit
```

Show release branch health and next steps.

```bash
# Short alias
gx -e [status]
# Long command
gitxplain --release [status]
```

Preview or execute a release merge.

```bash
# Short alias
gx -g
# Long command
gitxplain --merge
```

Preview or create release tags.

```bash
# Short alias
gx -T
# Long command
gitxplain --tag
```

Explain the latest stash, or a specific stash entry.

```bash
# Short alias
gx -Z
gx -Z stash@{2}
# Long command
gitxplain --stash
gitxplain --stash stash@{2}
```

Print repository log output.

```bash
# Short alias
gx -L
# Long command
gitxplain --log
```

Print repository status output.

```bash
# Short alias
gx -u
# Long command
gitxplain --status
```

Detect and generate CI/CD workflow files.

```bash
# Short alias
gx -V
# Long command
gitxplain --pipeline
```

Analyze unresolved merge conflicts in the working tree.

```bash
# Short alias
gx -C
gx -C -D src/auth.js
# Long command
gitxplain --conflict
gitxplain --conflict --diff src/auth.js
```

Install a git hook for commit, merge, or push workflows.

```bash
# Short alias
gx install-hook
gx install-hook post-merge
gx install-hook pre-push
# Long command
gitxplain install-hook
gitxplain install-hook post-merge
gitxplain install-hook pre-push
```

Analysis:

Generate a one-line summary.

```bash
# Short alias
gx -s
# Long command
gitxplain --summary
```

Focus on the issue being fixed.

```bash
# Short alias
gx -i
# Long command
gitxplain --issues
```

Explain the fix in simple terms.

```bash
# Short alias
gx -f
# Long command
gitxplain --fix
```

Explain behavior changes before vs after.

```bash
# Short alias
gx -m
# Long command
gitxplain --impact
```

Generate the full structured analysis.

```bash
# Short alias
gx -F
# Long command
gitxplain --full
```

Walk through the changed code file by file.

```bash
# Short alias
gx -l
# Long command
gitxplain --lines
```

Generate review findings and risks.

```bash
# Short alias
gx -r
# Long command
gitxplain --review
```

Focus on security-relevant changes.

```bash
# Short alias
gx -S
# Long command
gitxplain --security
```

Suggest refactoring follow-ups.

```bash
# Short alias
gx -R
# Long command
gitxplain --refactor
```

Suggest tests to add or update.

```bash
# Short alias
gx -t
# Long command
gitxplain --test-suggest
```

Generate a PR description.

```bash
# Short alias
gx -p
# Long command
gitxplain --pr-description
```

Generate changelog-style notes.

```bash
# Short alias
gx -c
# Long command
gitxplain --changelog
```

Analyze file ownership with git blame.

```bash
# Short alias
gx -b <file>
# Long command
gitxplain --blame <file>
```

Suggest resolutions for unresolved merge conflicts.

```bash
# Short alias
gx -C
# Long command
gitxplain --conflict
```

Explain a stash entry.

```bash
# Short alias
gx -Z [ref]
# Long command
gitxplain --stash [ref]
```

Focus analysis on one changed file.

```bash
# Short alias
gx -D <file>
# Long command
gitxplain --diff <file>
```

Propose splitting a commit into smaller commits.

```bash
# Short alias
gx -x
# Long command
gitxplain --split
```

Analyze performance implications of changes.

```bash
# Short alias
gx -A
# Long command
gitxplain --performance
```

Focus on database schema changes and query optimizations.

```bash
# Short alias
gx -Q
# Long command
gitxplain --database
```

Identify missing or outdated documentation.

```bash
# Short alias
gx -G
# Long command
gitxplain --docs
```

Generate API documentation updates from code changes.

```bash
# Short alias
gx -Y
# Long command
gitxplain --api-docs
```

Analyze test coverage implications of changes.

```bash
# Short alias
gx -J
# Long command
gitxplain --coverage
```

Suggest mutation testing targets based on changed code.

```bash
# Short alias
gx -K
# Long command
gitxplain --mutation
```

Propose commits for current working tree changes.

```bash
# Short alias
gx -k
# Long command
gitxplain --commit
```

Apply a split, commit, merge, or tag plan.

```bash
# Short alias
gx -E
# Long command
gitxplain --execute
```

Preview a plan without applying it.

```bash
# Short alias
gx -d
# Long command
gitxplain --dry-run
```

Review or edit a split plan before execution.

```bash
# Short alias
gx -I
# Long command
gitxplain --interactive
```

Release:

Show release status details.

```bash
# Short alias
gx -e [status]
# Long command
gitxplain --release [status]
```

Preview or apply a merge into the release branch.

```bash
# Short alias
gx -g
# Long command
gitxplain --merge
```

Preview or create release tags from version bumps.

```bash
# Short alias
gx -T
# Long command
gitxplain --tag
```

Repo:

Print the current repository log.

```bash
# Short alias
gx -L
# Long command
gitxplain --log
```

Print the current working tree status.

```bash
# Short alias
gx -u
# Long command
gitxplain --status
```

Inspect the repo and create CI/CD workflow files.

```bash
# Short alias
gx -V
# Long command
gitxplain --pipeline
```

Quick Actions:

Persist provider, model, and API key settings.

```bash
# Short alias
gx config
# Long command
gitxplain config
```

Stage one or more files.

```bash
# Short alias
gx add
# Long command
gitxplain add
```

Unstage one or more files.

```bash
# Short alias
gx remove
# Long command
gitxplain remove
```

Hard reset the repository to HEAD.

```bash
# Short alias
gx remove hard
# Long command
gitxplain remove hard
```

Delete one or more files from the working tree.

```bash
# Short alias
gx del
# Long command
gitxplain del
```

Soft reset `HEAD~1` and keep your changes.

```bash
# Short alias
gx bin
# Long command
gitxplain bin
```

Pop a stash entry.

```bash
# Short alias
gx pop
# Long command
gitxplain pop
```

Run `git pull`.

```bash
# Short alias
gx pull
# Long command
gitxplain pull
```

Run `git push`.

```bash
# Short alias
gx push
# Long command
gitxplain push
```

Install the `gitxplain` hook.

```bash
# Short alias
gx install-hook
# Long command
gitxplain install-hook
```

Pass through to native Git commands.

```bash
# Short alias
gx git
# Long command
gitxplain git
```

Output:

Override the configured provider for one command.

```bash
# Short alias
gx -w <name>
# Long command
gitxplain --provider <name>
```

Override the configured model for one command.

```bash
# Short alias
gx -O <name>
# Long command
gitxplain --model <name>
```

Return JSON output.

```bash
# Short alias
gx -j
# Long command
gitxplain --json
```

Return Markdown output.

```bash
# Short alias
gx -M
# Long command
gitxplain --markdown
```

Return HTML output.

```bash
# Short alias
gx -H
# Long command
gitxplain --html
```

Reduce extra console output.

```bash
# Short alias
gx -q
# Long command
gitxplain --quiet
```

Show extra response metadata.

```bash
# Short alias
gx -v
# Long command
gitxplain --verbose
```

Copy the final output to the clipboard.

```bash
# Short alias
gx -y
# Long command
gitxplain --clipboard
```

Stream model output as it arrives.

```bash
# Short alias
gx -z
# Long command
gitxplain --stream
```

Bypass cached responses for one command.

```bash
# Short alias
gx -n
# Long command
gitxplain --no-cache
```

Show cumulative token usage and estimated cost totals.

```bash
# Short alias
gx -o
# Long command
gitxplain --cost
```

Limit diff size before sending it to the model.

```bash
# Short alias
gx -X <n>
# Long command
gitxplain --max-diff-lines <n>
```

## Running The CLI

To use the actual `gitxplain` command directly:

```bash
npm link
```

Run that from the repository root. `npm link` works on Windows, macOS, and Linux, though it may require elevated privileges depending on your Node/npm install prefix.

Then from any Git repository:

```bash
# Short alias
gx --help
gx HEAD~1 -F
gx a1b2c3d -s
gx HEAD~1 -l
gx HEAD~5..HEAD -M
gx -B main -r
gx -B main -p
gx HEAD~10..HEAD -c
gx HEAD -R
gx HEAD -t
gx -b cli/index.js
gx -C
gx -Z
gx HEAD~5..HEAD -l -D cli/index.js
gx -o
gx HEAD -x -I -E
gx install-hook post-merge

# Long command
gitxplain --help
gitxplain HEAD~1 --full
gitxplain a1b2c3d --summary
gitxplain HEAD~1 --lines
gitxplain HEAD~5..HEAD --markdown
gitxplain --branch main --review
gitxplain --branch main --pr-description
gitxplain HEAD~10..HEAD --changelog
gitxplain HEAD --refactor
gitxplain HEAD --test-suggest
gitxplain --blame cli/index.js
gitxplain --conflict
gitxplain --stash
gitxplain HEAD~5..HEAD --lines --diff cli/index.js
gitxplain --cost
gitxplain HEAD --split --interactive --execute
gitxplain install-hook post-merge
```

If you do not want to link it globally, you can still run it locally:

```bash
# Short alias
node ./cli/index.js HEAD~1 -F
# Long command
node ./cli/index.js HEAD~1 --full
```

## Quick Examples

Using short aliases can significantly speed up your workflow:

```bash
# Quick summary of last commit
# Short alias
gx HEAD -s
# Long command
gitxplain HEAD --summary

# Full analysis with JSON output
# Short alias
gx HEAD~1 -F -j
# Long command
gitxplain HEAD~1 --full --json

# Security review of current branch vs main
# Short alias
gx -B main -S
# Long command
gitxplain --branch main --security

# Plan commits for current changes
# Short alias
gx -k
# Long command
gitxplain --commit
# Alternative long alias
gitxplain --plan

# Show repository status
# Short alias
gx -u
# Long command
gitxplain --status
# Alternative long alias
gitxplain --stat

# Generate PR description for branch
# Short alias
gx -B main -p -M
# Long command
gitxplain --branch main --pr-description --markdown

# Split last commit interactively
# Short alias
gx HEAD -x -I -E
# Long command
gitxplain HEAD --split --interactive --execute

# Execute a commit plan
# Short alias
gx -k -E
# Long command
gitxplain --commit --execute
# Alternative long alias
gitxplain --plan --run

# Check release status
# Short alias
gx -e status
# Long command
gitxplain --release status
# Alternative long alias
gitxplain --rel status

# Review with cost tracking
# Short alias
gx HEAD~1 -r -o
# Long command
gitxplain HEAD~1 --review --cost

# Performance analysis of recent changes
# Short alias
gx HEAD~1 -A
# Long command
gitxplain HEAD~1 --performance
# Alternative long alias
gitxplain HEAD~1 --perf

# Database schema change review
# Short alias
gx HEAD -Q
# Long command
gitxplain HEAD --database
# Alternative long alias
gitxplain HEAD --db

# Check documentation coverage
# Short alias
gx HEAD -G
# Long command
gitxplain HEAD --docs

# Generate API docs for new endpoints
# Short alias
gx HEAD -Y -M
# Long command
gitxplain HEAD --api-docs --markdown
# Alternative long alias
gitxplain HEAD --api --markdown

# Analyze test coverage impact
# Short alias
gx HEAD~1 -J
# Long command
gitxplain HEAD~1 --coverage
# Alternative long alias
gitxplain HEAD~1 --cov

# Suggest mutation testing targets
# Short alias
gx HEAD -K
# Long command
gitxplain HEAD --mutation
# Alternative long alias
gitxplain HEAD --mut

# Preview before executing
# Short alias
gx HEAD -x -d
# Long command
gitxplain HEAD --split --dry-run
# Alternative long alias
gitxplain HEAD --split --prev

# Use alternative short aliases
gx HEAD -s -v -y     # summary with verbose output and clipboard
gx HEAD -F -j -q    # full JSON output without extra noise
gx HEAD -r -M -n    # markdown review bypassing cache
```

## Output Modes

| Short Alias | Long Command | Description |
|-------------|--------------|-------------|
| `-s` | `--summary` | one-sentence commit summary |
| `-i` | `--issues` | bug or issue-oriented analysis |
| `-f` | `--fix` | junior-friendly explanation of the fix |
| `-m` | `--impact` | before-vs-after explanation focused on behavior changes |
| `-F` | `--full` | full structured analysis |
| `-l` | `--lines` | file-by-file, line-by-line walkthrough of the changed code |
| `-r` | `--review` | code review findings with actionable suggestions |
| `-S` | `--security` | security-focused analysis of the change |
| `-R` | `--refactor` | suggest maintainability-focused refactors visible in the change |
| `-t` | `--test-suggest` | suggest the most valuable tests to add or update |
| `-p` | `--pr-description` | draft a ready-to-paste pull request description |
| `-c` | `--changelog` | generate changelog-style release notes from the change set |
| `-b` | `--blame <file>` | summarize ownership and change history for one file using `git blame` |
| `-C` | `--conflict` | inspect unresolved merge conflicts and suggest likely resolutions |
| `-Z` | `--stash [ref]` | explain what is stored in a stash entry, defaulting to `stash@{0}` |
| `-D` | `--diff <file>` | focus commit or range analysis on a single file |
| `-x` | `--split` | propose how to split a commit into multiple atomic commits |
| `-A` | `--performance` | analyze performance implications of changes (database queries, algorithmic complexity, memory usage) |
| `-Q` | `--database` | focus on database schema changes, migrations, and query optimizations |
| `-G` | `--docs` | identify missing or outdated documentation based on code changes |
| `-Y` | `--api-docs` | generate API documentation updates from code changes |
| `-J` | `--coverage` | analyze test coverage implications of changes |
| `-K` | `--mutation` | suggest mutation testing targets based on changed code |
| `-I` | `--interactive` | review or edit a split plan before executing it |
| `-o` | `--cost` | show cumulative token usage and estimated cost totals |
| `-g` | `--merge` | preview or execute a merge into the `release` branch based on detected version bumps |
| `-T` | `--tag` | preview or create release tags from the same detected version windows |
| `-e` | `--release [status]` | inspect release branch health, missing tags, source-vs-release drift, and the next recommended action |
| `-k` | `--commit` | propose commits for current uncommitted changes |
| `-L` | `--log` | print Git log entries for the current repository |
| `-u` | `--status` | print Git working tree status for the current repository |
| `-V` | `--pipeline` | inspect the current repository and generate GitHub Actions, GitLab CI, CircleCI, or Bitbucket Pipelines config |
| `-E` | `--execute` | apply a proposed split by rewriting history |
| `-d` | `--dry-run` | preview the split or commit plan without applying it |
| `-j` | `--json` | return structured JSON instead of formatted text |
| `-M` | `--markdown` | return Markdown output |
| `-H` | `--html` | return HTML output |

## Repository Log

Print recent log entries from the current repository:

```bash
# Short alias
gx -L
# Long command
gitxplain --log
```

This prints the repository history in a compact one-line format using the current repository, without calling the LLM.

## Quick Actions

Run a few common Git actions directly through `gitxplain`:

```bash
# Short alias
gx -u
gx cache stats
gx cache clear
gx -o
gx add README.md
gx remove README.md
gx remove hard
gx del scratch.txt
gx bin
gx pop
gx pop 2
gx pull
gx pull origin main
gx push
gx push origin main

# Long command
gitxplain --status
gitxplain cache stats
gitxplain cache clear
gitxplain --cost
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
```

For native Git commands that do not have a custom `gitxplain` workflow, use them directly:

```bash
# Short alias
gx branch -a
gx checkout -b feature/demo
gx rebase origin/main
gx worktree list

# Long command
gitxplain branch -a
gitxplain checkout -b feature/demo
gitxplain rebase origin/main
gitxplain worktree list
```

If you want to force native Git for a reserved custom command name, use the `git` wrapper:

```bash
# Short alias
gx git commit -m "native commit message"
gx git merge feature/demo
gx git tag -a v1.2.3 -m "release"

# Long command
gitxplain git commit -m "native commit message"
gitxplain git merge feature/demo
gitxplain git tag -a v1.2.3 -m "release"
```

## Comparison Modes

Single commit:

```bash
# Short alias
gx HEAD~1 -F
# Long command
gitxplain HEAD~1 --full
```

Commit range:

```bash
# Short alias
gx HEAD~5..HEAD -M
# Long command
gitxplain HEAD~5..HEAD --markdown
```

Branch or PR-style comparison:

```bash
# Short alias
gx -B main -r
gx -P origin/main -S
# Long command
gitxplain --branch main --review
gitxplain --pr origin/main --security
```

`--branch` and `--pr` compare the current branch to a base ref using the merge base with `HEAD`.

## Commit Splitting

Preview how a commit could be split:

```bash
# Short alias
gx HEAD~1 -x
# Long command
gitxplain HEAD~1 --split
```

Actually split the current `HEAD` commit into smaller commits:

```bash
# Short alias
gx HEAD -x -E
# Long command
gitxplain HEAD --split --execute
```

Review the plan interactively before executing it:

```bash
# Short alias
gx HEAD -x -I -E
# Long command
gitxplain HEAD --split --interactive --execute
```

Use a specific provider for the analysis:

```bash
# Short alias
gx HEAD -x -w gemini
# Long command
gitxplain HEAD --split --provider gemini
```

`--split` asks the model for a plan first. By default this is a dry run and only prints the proposed commit breakdown. Adding `--execute` rewrites Git history by undoing the current `HEAD` commit and recreating it as multiple commits in the suggested order. Adding `--interactive` lets you keep, edit, skip, or abort individual split groups before the rewrite happens.

Warning: `--split --execute` rewrites history. If the commit was already pushed, you may need to force-push after reviewing the new commit stack. For safety, execution only supports splitting the current `HEAD` commit and requires a clean working tree.

## Release Merge

Preview the release merge plan for the current branch:

```bash
# Short alias
gx -g
# Long command
gitxplain --merge
```

Actually merge the current branch into the `release` branch:

```bash
# Short alias
gx -g -E
# Long command
gitxplain --merge --execute
```

This command scans commits on your current branch after the branch split point and uses version-file diffs as release checkpoints. Each time a commit changes the version, that closes a release window. On the `release` branch, the command creates commits named `release <version>`. If no release versions have been promoted yet, it creates release commits for all detected versions in order. If some release versions already exist on `release`, it skips those and creates only the latest unreleased `release <version>` commit.

## Release Tagging

Preview the release tags for the current branch:

```bash
# Short alias
gx -T
# Long command
gitxplain --tag
```

Actually create the tags:

```bash
# Short alias
gx -T -E
# Long command
gitxplain --tag --execute
```

This command scans the full history of your current branch, detects version bumps from version-file diffs, and maps each untagged detected version to the last commit in that version window. It works independently from the `merge` workflow and does not require a `release` branch. By default it creates annotated tags named exactly after the detected version, such as `1.2.3`.

## Commit Working Tree

Preview how the current uncommitted changes should be committed:

```bash
# Short alias
gx -k
# Long command
gitxplain --commit
```

Actually create the suggested commits:

```bash
# Short alias
gx -k -E
# Long command
gitxplain --commit --execute
```

Use a specific provider for the analysis:

```bash
# Short alias
gx -k -w gemini
# Long command
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

You can also save provider settings permanently with the CLI:

```bash
# Short alias
gx config set provider openai
gx config set api-key your_key
gx config set model gpt-4.1-mini
gx config list
# Long command
gitxplain config set provider openai
gitxplain config set api-key your_key
gitxplain config set model gpt-4.1-mini
gitxplain config list
```

## Clipboard, Streaming, Cost, And Hooks

Copy the final output to your clipboard:

```bash
# Short alias
gx HEAD~1 -M -y
# Long command
gitxplain HEAD~1 --markdown --clipboard
```

Stream long responses as they arrive:

```bash
# Short alias
gx HEAD~1 -F -z
# Long command
gitxplain HEAD~1 --full --stream
```

Show cumulative usage and estimated cost totals:

```bash
# Short alias
gx -o
# Long command
gitxplain --cost
```

Install a post-commit hook that saves a Markdown explanation under `.git/gitxplain/last-explanation.md`:

```bash
# Short alias
gx install-hook
# Long command
gitxplain install-hook
```

Install a post-merge hook that explains the new `HEAD` after merges:

```bash
# Short alias
gx install-hook post-merge
# Long command
gitxplain install-hook post-merge
```

Install a pre-push hook that runs a security-oriented review:

```bash
# Short alias
gx install-hook pre-push
# Long command
gitxplain install-hook pre-push
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

Run this from the repository root. On some systems, you may need an elevated shell depending on where npm installs global links.
