import test from "node:test";
import assert from "node:assert/strict";
import {
  formatJsonOutput,
  formatMarkdownOutput,
  formatOutput
} from "../cli/services/outputFormatter.js";

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

const commitData = {
  analysisType: "commit",
  displayRef: "abc123",
  commitId: "abc123",
  commitCount: 1,
  commitMessage: "Fix login crash",
  filesChanged: ["src/auth.js"],
  stats: "1 file changed, 4 insertions(+), 1 deletion(-)"
};

test("formatOutput includes header and explanation", { concurrency: false }, () => {
  const formatted = formatOutput({
    mode: "full",
    commitData,
    explanation: "Summary:\nFix login crash",
    responseMeta: null,
    promptMeta: { warnings: [] },
    options: { quiet: false, verbose: false }
  });

  assert.match(formatted, /Commit: abc123|Range: abc123/);
  assert.match(formatted, /Fix login crash/);
});

test("formatOutput normalizes headings and keeps readable spacing", { concurrency: false }, () => {
  const formatted = stripAnsi(
    formatOutput({
      mode: "full",
      commitData,
      explanation: "1. Summary\n- Fixed login crash\n2. Security Review\n- No significant findings",
      responseMeta: null,
      promptMeta: { warnings: [] },
      options: { quiet: false, verbose: false }
    })
  );

  assert.match(formatted, /\nSummary:\n- Fixed login crash\n\nSecurity Review:\n- No significant findings/);
});

test("formatOutput colors positive and negative bullet lines", { concurrency: false }, () => {
  const originalIsTTY = process.stdout.isTTY;
  const originalForceColor = process.env.FORCE_COLOR;
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true
  });
  process.env.FORCE_COLOR = "1";

  const formatted = formatOutput({
    mode: "review",
    commitData,
    explanation: "Review Findings:\n- High risk regression in auth flow\nSuggestions:\n- Safe improvement: add coverage",
    responseMeta: null,
    promptMeta: { warnings: [] },
    options: { quiet: false, verbose: false }
  });

  Object.defineProperty(process.stdout, "isTTY", {
    value: originalIsTTY,
    configurable: true
  });
  if (originalForceColor == null) {
    delete process.env.FORCE_COLOR;
  } else {
    process.env.FORCE_COLOR = originalForceColor;
  }

  assert.match(formatted, /\u001b\[31m-\u001b\[0m/);
  assert.match(formatted, /\u001b\[32m-\u001b\[0m/);
});

test("formatOutput converts markdown headings and inline formatting into terminal text", { concurrency: false }, () => {
  const formatted = stripAnsi(
    formatOutput({
      mode: "full",
      commitData,
      explanation:
        "## **Summary**\n- **Good:** fixed login redirect\n\n### Review Findings\n1. **Issue:** missing null check\n\n```js\nconst ok = true;\n```",
      responseMeta: null,
      promptMeta: { warnings: [] },
      options: { quiet: false, verbose: false }
    })
  );

  assert.match(formatted, /\nSummary:\n- Good: fixed login redirect/);
  assert.match(formatted, /\nReview Findings:\n1\. Issue: missing null check/);
  assert.match(formatted, /\n  const ok = true;/);
  assert.doesNotMatch(formatted, /```|\*\*/);
});

test("formatOutput converts markdown numbered headings like ### 1. Summary", { concurrency: false }, () => {
  const formatted = stripAnsi(
    formatOutput({
      mode: "full",
      commitData,
      explanation: "### 1. Summary:\nRefactor release planning.\n\n### 2. Issue:\nDuplicated logic.",
      responseMeta: null,
      promptMeta: { warnings: [] },
      options: { quiet: true, verbose: false }
    })
  );

  assert.equal(formatted, "Summary:\nRefactor release planning.\n\nIssue:\nDuplicated logic.");
});

test("formatOutput treats low risk explanation text as positive", { concurrency: false }, () => {
  const originalIsTTY = process.stdout.isTTY;
  const originalForceColor = process.env.FORCE_COLOR;
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true
  });
  process.env.FORCE_COLOR = "1";

  const formatted = formatOutput({
    mode: "full",
    commitData,
    explanation: "Risk Level:\nLow. The change is a simple refactoring with minimal risk.",
    responseMeta: null,
    promptMeta: { warnings: [] },
    options: { quiet: true, verbose: false }
  });

  Object.defineProperty(process.stdout, "isTTY", {
    value: originalIsTTY,
    configurable: true
  });
  if (originalForceColor == null) {
    delete process.env.FORCE_COLOR;
  } else {
    process.env.FORCE_COLOR = originalForceColor;
  }

  assert.match(formatted, /\u001b\[32mLow\. The change is a simple refactoring with minimal risk\.\u001b\[0m/);
});

test("formatMarkdownOutput includes metadata and explanation", { concurrency: false }, () => {
  const formatted = formatMarkdownOutput({
    mode: "summary",
    commitData,
    explanation: "Short summary",
    responseMeta: { provider: "openai", model: "gpt-4.1-mini" },
    promptMeta: { warnings: [] }
  });

  assert.match(formatted, /# gitxplain/);
  assert.match(formatted, /Provider: openai/);
  assert.match(formatted, /Short summary/);
});

test("formatJsonOutput returns machine readable payload", { concurrency: false }, () => {
  const formatted = formatJsonOutput({
    mode: "summary",
    commitData,
    explanation: "Short summary",
    responseMeta: { provider: "openai", model: "gpt-4.1-mini" },
    promptMeta: { truncated: false, warnings: [] }
  });

  const parsed = JSON.parse(formatted);
  assert.equal(parsed.mode, "summary");
  assert.equal(parsed.commit.id, "abc123");
  assert.equal(parsed.response.provider, "openai");
});
