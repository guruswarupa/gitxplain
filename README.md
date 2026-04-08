# gitxplain

`gitxplain` is a Node.js CLI that analyzes a Git commit and generates structured, human-readable explanations with AI.

Supported providers:

- OpenAI
- Groq
- OpenRouter
- Gemini
- Ollama
- Chutes AI

## Features

- Explains what a commit does, why it exists, and how the fix works
- Supports focused output modes like summary, issue, fix, and impact
- Falls back to an interactive prompt when no analysis flag is supplied
- Returns plain text or JSON output
- Uses native Node APIs only, so the MVP has no runtime dependencies
- Connect GitHub account with personal access token
- Interactive chat interface with repository context

## New Features

### Git Connection (`--connect-git`)
Connect your GitHub account to enable repository-aware features:
```bash
gitxplain --connect-git
```

This will prompt for your GitHub Personal Access Token (PAT) and verify it with GitHub's API. Upon successful authentication, your connection details will be saved locally for future use.

**Required PAT Permissions:**
- `repo` - Full control of private repositories
- `public_repo` - Access to public repositories
- `user` - Read user profile data

### Interactive Chat (`--boot`)
Start an interactive chat session with the LLM that has full context of your repository's commit history and branches:
```bash
gitxplain --boot
```

The `--boot` command automatically uses **Groq** as the default provider (fast and free). Simply set your Groq API key:
```bash
export GROQ_API=your_groq_api_key
gitxplain --boot
```

You can override the default provider if needed:
```bash
gitxplain --boot --provider openai
gitxplain --boot --provider ollama --model llama2
```

**Commands in chat:**
- Type your questions about commits, changes, or the codebase
- `clear` - Clear conversation history
- `exit` - Close the chat session

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

You can start from:

```bash
cp .env.example .env
```

## Usage

```bash
gitxplain help
gitxplain <commit-id>
gitxplain <commit-id> --summary
gitxplain <commit-id> --issues
gitxplain <commit-id> --fix
gitxplain <commit-id> --impact
gitxplain <commit-id> --full
gitxplain <commit-id> --json
gitxplain <commit-id> --provider openrouter --model anthropic/claude-3.7-sonnet
gitxplain <commit-id> --provider chutes --model deepseek-ai/DeepSeek-V3-0324
gitxplain --connect-git
gitxplain --boot
```

Examples:

```bash
npm start -- HEAD~1 --summary
npm start -- a1b2c3d --full
npm start -- HEAD~1 --provider groq --model llama-3.3-70b-versatile
npm start -- HEAD~1 --provider gemini --model gemini-2.5-flash
npm start -- HEAD~1 --provider chutes --model deepseek-ai/DeepSeek-V3-0324
npm start -- --connect-git
npm start -- --boot
```

## Running The CLI

To use the actual `gitxplain` command directly:

```bash
cd /path/to/gitxplain
npm link
```

Then from any Git repository:

```bash
gitxplain help
gitxplain HEAD~1 --full
gitxplain a1b2c3d --summary
gitxplain --connect-git
gitxplain --boot
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
node /path/to/gitxplain/cli/index.js HEAD~1 --full
node /path/to/gitxplain/cli/index.js --connect-git
node /path/to/gitxplain/cli/index.js --boot
```

## Output Modes

- `--summary`: one-sentence commit summary
- `--issues`: bug or issue-oriented analysis
- `--fix`: junior-friendly explanation of the fix
- `--impact`: before-vs-after explanation focused on behavior changes
- `--full`: full structured analysis
- `--json`: return structured JSON instead of formatted text

If no analysis flag is supplied, the CLI asks what kind of explanation you want.

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
```

To make the command globally available during local development:

```bash
npm link
```
