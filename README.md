# gitxplain

`gitxplain` is a Node.js CLI that analyzes a Git commit and generates structured, human-readable explanations with AI.

Supported providers:

- OpenAI
- Groq
- OpenRouter
- Gemini
- Ollama

## Features

- Explains what a commit does, why it exists, and how the fix works
- Supports focused output modes like summary, issue, fix, and impact
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

You can start from:

```bash
cp .env.example .env
```

## Usage

```bash
gitxplain <commit-id>
gitxplain <commit-id> --summary
gitxplain <commit-id> --issues
gitxplain <commit-id> --fix
gitxplain <commit-id> --impact
gitxplain <commit-id> --full
gitxplain <commit-id> --json
gitxplain <commit-id> --provider openrouter --model anthropic/claude-3.7-sonnet
```

Examples:

```bash
npm start -- HEAD~1 --summary
npm start -- a1b2c3d --full
npm start -- HEAD~1 --provider groq --model llama-3.3-70b-versatile
npm start -- HEAD~1 --provider gemini --model gemini-2.5-flash
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

## Development

```bash
npm run lint
```

To make the command globally available during local development:

```bash
npm link
```
