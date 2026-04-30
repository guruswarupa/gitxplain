## Running the CLI
To use the actual gitxplain command directly:
```
npm link
```
Run that from the repository root. npm link works on Windows, macOS, and Linux, though it may require elevated privileges depending on your Node/npm install prefix.

Then from any Git repository:
```
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
```
node ./cli/index.js HEAD~1 --full
```

## Output Modes
--summary: one-sentence commit summary

--issues: bug or issue-oriented analysis

--fix: junior-friendly explanation of the fix

--impact: before-vs-after explanation focused on behavior changes

--full: full structured analysis

--lines: file-by-file, line-by-line walkthrough of the changed code

--review: code review findings with actionable suggestions

--security: security-focused analysis of the change

--refactor: suggest maintainability-focused refactors visible in the change

--test-suggest: suggest the most valuable tests to add or update

--pr-description: draft a ready-to-paste pull request description

--changelog: generate changelog-style release notes from the change set

--blame <file>: summarize ownership and change history for one file using git blame

--conflict: inspect unresolved merge conflicts and suggest likely resolutions

--stash [ref]: explain what is stored in a stash entry, defaulting to stash@{0}

--diff <file>: focus commit or range analysis on a single file

--split: propose how to split a commit into multiple atomic commits

--interactive: review or edit a split plan before executing it

--cost: show cumulative token usage and estimated cost totals

--merge: preview or execute a merge into the release branch based on detected version bumps

--tag: preview or create release tags from the same detected version windows

--release [status]: inspect release branch health, missing tags, source-vs-release drift, and the next recommended action

--commit: propose commits for current uncommitted changes

--log: print Git log entries for the current repository

--status: print Git working tree status for the current repository

--pipeline: inspect the current repository and generate GitHub Actions, GitLab CI, CircleCI, or Bitbucket Pipelines config

--execute: apply a proposed split by rewriting history

--dry-run: preview the split or commit plan without applying it

--json: return structured JSON instead of formatted text

--markdown: return Markdown output

--html: return HTML output

## Repository Log
Print recent log entries from the current repository:
```
gitxplain --log
```
This prints the repository history in a compact one-line format using the current repository, without calling the LLM.

## Quick Actions
Run a few common Git actions directly through gitxplain:
```
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

For native Git commands that do not have a custom gitxplain workflow, use them directly:
```
gitxplain branch -a
gitxplain checkout -b feature/demo
gitxplain rebase origin/main
gitxplain worktree list
```

If you want to force native Git for a reserved custom command name, use the git wrapper:
```
gitxplain git commit -m "native commit message"
gitxplain git merge feature/demo
gitxplain git tag -a v1.2.3 -m "release"
```

## Comparison Modes
Single commit:
```
gitxplain HEAD~1 --full
```

Commit range:
```
gitxplain HEAD~5..HEAD --markdown
```

Branch or PR-style comparison:
```
gitxplain --branch main --review
gitxplain --pr origin/main --security
```
--branch and --pr compare the current branch to a base ref using the merge base with HEAD.

## Commit Splitting
Preview how a commit could be split:
```
gitxplain HEAD~1 --split
```

Actually split the current HEAD commit into smaller commits:
```
gitxplain HEAD --split --execute
```

Review the plan interactively before executing it:
```
gitxplain HEAD --split --interactive --execute
```

Use a specific provider for the analysis:
```
gitxplain HEAD --split --provider gemini
```

--split asks the model for a plan first. By default this is a dry run and only prints the proposed commit breakdown. Adding --execute rewrites Git history by undoing the current HEAD commit and recreating it as multiple commits in the suggested order. Adding --interactive lets you keep, edit, skip, or abort individual split groups before the rewrite happens.

Warning: --split --execute rewrites history. If the commit was already pushed, you may need to force-push after reviewing the new commit stack. For safety, execution only supports splitting the current HEAD commit and requires a clean working tree.

## Release Merge
Preview the release merge plan for the current branch:
```
gitxplain --merge
```

Actually merge the current branch into the release branch:
```
gitxplain --merge --execute
```

This command scans commits on your current branch after the branch split point and uses version-file diffs as release checkpoints. Each time a commit changes the version, that closes a release window. On the release branch, the command creates commits named release <version>. If no release versions have been promoted yet, it creates release commits for all detected versions in order. If some release versions already exist on release, it skips those and creates only the latest unreleased release <version> commit.

## Release Tagging
Preview the release tags for the current branch:
```
gitxplain --tag
gitxplore --tag
```

Actually create the tags:
```
gitxplain --tag --execute
gitxplore --tag --execute
```

This command scans the full history of your current branch, detects version bumps from version-file diffs, and maps each untagged detected version to the last commit in that version window. It works independently from the merge workflow and does not require a release branch. By default it creates annotated tags named exactly after the detected version, such as 1.2.3.

## Commit Working Tree
Preview how the current uncommitted changes should be committed:
```
gitxplain --commit
```

Actually create the suggested commits:
```
gitxplain --commit --execute
```

Use a specific provider for the analysis:
```
gitxplain --commit --provider gemini
```

This mode analyzes the current working tree, proposes one or more logical commits with conventional commit messages, and can then create those commits automatically. By default it only previews the plan.

## Config File
Example .gitxplainrc:
```
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
```
gitxplain config set provider openai
gitxplain config set api-key your_key
gitxplain config set model gpt-4.1-mini
gitxplain config list
```

## Clipboard, Streaming, Cost, And Hooks
Copy the final output to your clipboard:
```
gitxplain HEAD~1 --markdown --clipboard
```

Stream long responses as they arrive:
```
gitxplain HEAD~1 --full --stream
```

Show cumulative usage and estimated cost totals:
```
gitxplain --cost
```

Install a post-commit hook that saves a Markdown explanation under .git/gitxplain/last-explanation.md:
```
gitxplain install-hook
```

Install a post-merge hook that explains the new HEAD after merges:
```
gitxplain install-hook post-merge
```

Install a pre-push hook that runs a security-oriented review:
```
gitxplain install-hook pre-push
```

## Provider Setup
Recommended persistent setup:
```
gitxplain config set provider openai
gitxplain config set api-key your_key
```

You can also save a default model:
```
gitxplain config set model gpt-4.1-mini
```

You can switch providers later:
```
gitxplain config set provider groq
gitxplain config set api-key your_key
```

Additional supported providers:
```
gitxplain config set provider anthropic
gitxplain config set api-key your_key

gitxplain config set provider mistral
gitxplain config set api-key your_key

gitxplain config set provider azure-openai
gitxplain config set api-key your_key
```

Azure OpenAI also requires endpoint configuration:
```
export AZURE_OPENAI_BASE_URL="https://your-resource.openai.azure.com"
export AZURE_OPENAI_DEPLOYMENT="your-deployment-name"
export AZURE_OPENAI_API_VERSION="2024-10-21"
```

Optional token pricing env vars for estimated cost tracking:
```
export OPENAI_INPUT_COST_PER_MTOK="0.15"
export OPENAI_OUTPUT_COST_PER_MTOK="0.60"
```
Or use generic pricing defaults across providers:
```
export LLM_INPUT_COST_PER_MTOK="0.15"
export LLM_OUTPUT_COST_PER_MTOK="0.60"
```

If you want to inspect what is saved:
```
gitxplain config list
gitxplain config get provider
```

Saved user settings live in ~/.gitxplain/config.json on macOS/Linux, or %USERPROFILE%\.gitxplain\config.json on Windows.

## Development
```
npm run lint
npm test
```

To make the command globally available during local development:
```
npm link
```

Run this from the repository root. On some systems, you may need an elevated shell depending on where npm installs global links.
