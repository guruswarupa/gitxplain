## Installation

Install from npm:
```title="npm"
npm install -g gitxplain
```

Install from bun:
```title="bun"
bun install -g gitxplain
```

Install with Homebrew:
```title="Homebrew"
brew tap guruswarupa/homebrew-tap 
brew install gitxplain
```

Install from the AUR:
```title="AUR"
yay -S gitxplain

paru -S gitxplain
```

Install from a Debian package downloaded from GitHub Releases:
```title="debian"
sudo apt install ./gitxplain_<version>_all.deb
```

## Optional advanced environment variables:

•LLM_PROVIDER default: openai

•LLM_MODEL optional shared model override

•OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL

•GROQ_API_KEY, GROQ_MODEL, GROQ_BASE_URL

•OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL

•OPENROUTER_SITE_URL, OPENROUTER_APP_NAME

•GEMINI_API_KEY, GEMINI_MODEL, GEMINI_BASE_URL

•OLLAMA_API_KEY optional, default: ollama

•OLLAMA_MODEL, OLLAMA_BASE_URL default: http://127.0.0.1:11434/v1

•CHUTES_API_KEY, CHUTES_MODEL, CHUTES_BASE_URL

## Optional config files:

•Project: .gitxplainrc or .gitxplainrc.json

•User: ~/.gitxplain/config.json on macOS/Linux, or   %USERPROFILE%\.gitxplain\config.json on Windows


You can start from:
```
cp .env.example .env
```

## Usage

Show the built-in command reference.
```
gitxplain --help
```

Inspect cache usage or clear cached responses.
```linenums="1"
gitxplain cache stats
gitxplain cache clear
```

Show cumulative token usage and estimated cost totals.
```
gitxplain --cost
```

Save the default AI provider.
```
gitxplain config set provider <name>
```

Save the API key for a provider.
```
gitxplain config set api-key <value> [--provider <name>]
```

Print one saved config value, or all of them.
```
gitxplain config get [key]
```

List saved user config values.
```
gitxplain config list
```

Analyze a single commit.
```
gitxplain <commit-id> [options]
```

Analyze a commit range.
```
gitxplain <start>..<end> [options]
```

Compare the current branch to a base branch.
```
gitxplain --branch [base-ref] [options]
```

Compare the current branch like a PR.
```
gitxplain --pr [base-ref] [options]
```

Plan commits for uncommitted working tree changes.
```
gitxplain --commit
```

Show release branch health and next steps.
```
gitxplain --release [status]
```

Preview or execute a release merge.
```
gitxplain --merge
```

Preview or create release tags.
```
gitxplain --tag
```

Explain the latest stash, or a specific stash entry.
```linenums="1"
gitxplain --stash
gitxplain --stash stash@{2}
```

Print repository log output.
```
gitxplain --log
```

Print repository status output.
```
gitxplain --status
```

Detect and generate CI/CD workflow files.
```
gitxplain --pipeline
```

Analyze unresolved merge conflicts in the working tree.
```linenums="1"
gitxplain --conflict
gitxplain --conflict --diff src/auth.js
```

Install a git hook for commit, merge, or push workflows.
```linenums="1"
gitxplain install-hook
gitxplain install-hook post-merge
gitxplain install-hook pre-push
```

## Analysis:

Generate a one-line summary.
```
--summary
```

Focus on the issue being fixed.
```
--issues
```

Explain the fix in simple terms.
```
--fix
```

Explain behavior changes before vs after.
```
--impact
```

Generate the full structured analysis.
```
--full
```

Walk through the changed code file by file.
```
--lines
```

Generate review findings and risks.
```
--review
```

Focus on security-relevant changes.
```
--security
```

Suggest refactoring follow-ups.
```
--refactor
```

Suggest tests to add or update.
```
--test-suggest
```

Generate a PR description.
```
--pr-description
```

Generate changelog-style notes.
```
--changelog
```

Analyze file ownership with git blame.
```
--blame <file>
```

Suggest resolutions for unresolved merge conflicts.
```
--conflict
```

Focus analysis on one changed file.
```
--diff <file>
```

Propose splitting a commit into smaller commits.
```
--split
```

Propose commits for current working tree changes.
```
--commit
```

Apply a split, commit, merge, or tag plan.
```
--execute
```

Preview a plan without applying it.
```
--dry-run
```

Review or edit a split plan before execution.
```
--interactive
```

## Release:

Show release status details.
```
--release [status]
```

Preview or apply a merge into the release branch.
```
--merge
```

Preview or create release tags from version bumps.
```
--tag
```

## Repo:

Print the current repository log.
```
--log
```

Print the current working tree status.
```
--status
```

Inspect the repo and create CI/CD workflow files.
```
--pipeline
```

## Quick Actions:

Persist provider, model, and API key settings.
```
config
```

Stage one or more files.
```
add
```

Unstage one or more files.
```
remove
```

Hard reset the repository to HEAD.
```
remove hard
```

Delete one or more files from the working tree.
```
del
```

Soft reset HEAD~1 and keep your changes.
```
bin
```

Pop a stash entry.
```
pop
```

Run git pull.
```
pull
```

Run git push.
```
push
```

Install the gitxplain hook.
```
install-hook
```

Pass through to native Git commands.
```
git
```

## Output:

Override the configured provider for one command.
```
--provider <name>
```

Override the configured model for one command.
```
--model <name>
```

Return JSON output.
```
--json
```

Return Markdown output.
```
--markdown
```

Return HTML output.
```
--html
```

Reduce extra console output.
```
--quiet
```

Show extra response metadata.
```
--verbose
```

Copy the final output to the clipboard.
```
--clipboard
```

Stream model output as it arrives.
```
--stream
```

Bypass cached responses for one command.
```
--no-cache
```

Show cumulative token usage and estimated cost totals.
```
--cost
```

Limit diff size before sending it to the model.
```
--max-diff-lines <n>
```