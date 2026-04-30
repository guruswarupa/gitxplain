## Features
•Explains what a commit does, why it exists, and how the fix works

•Supports focused output modes like summary, issue, fix, impact, review, security, and line-by-line walkthroughs

•Supports blame summaries, changelog drafting, PR description drafting, refactor suggestions, and test suggestion modes

•Supports stash explanation and single-file diff deep dives

•Supports merge conflict analysis with suggested resolutions

•Supports cumulative token usage tracking and optional estimated cost reporting

•Supports interactive split-plan review before history is rewritten

•Supports AI-assisted commit splitting plans, with optional execution for the latest commit

•Supports release-branch merge previews driven by detected version bumps in diffs

•Supports automatic release tagging driven by the same version-bump detection used for release merges

•Supports release health status checks that show missing tags, unmerged version bumps, branch drift, and next steps

•Supports AI-assisted commit planning for uncommitted working tree changes

•Supports quick repository log output for full history inspection

•Supports repository-aware CI/CD workflow generation for GitHub Actions, GitLab CI, CircleCI, and Bitbucket Pipelines

•Supports single commits, commit ranges, and branch-vs-base comparisons

•Truncates oversized diffs before sending them to the model and reports that truncation

•Streams output for supported providers

•Caches responses locally to reduce repeat API costs

•Supports plain, JSON, Markdown, and HTML output

•Supports clipboard copy, verbosity controls, and hook installation

•Supports project-level and user-level config files

•Returns plain text or JSON output

•Uses native Node APIs only, so the MVP has no runtime dependencies


## Requirements
•Node.js 18+

•A Git repository in your current working directory

•An API key for your chosen provider, or a local Ollama instance