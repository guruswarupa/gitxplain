import test from "node:test";
import assert from "node:assert/strict";
import {
  formatJsonOutput,
  formatMarkdownOutput,
  formatOutput
} from "../cli/services/outputFormatter.js";

const commitData = {
  analysisType: "commit",
  displayRef: "abc123",
  commitId: "abc123",
  commitCount: 1,
  commitMessage: "Fix login crash",
  filesChanged: ["src/auth.js"],
  stats: "1 file changed, 4 insertions(+), 1 deletion(-)"
};

test("formatOutput includes header and explanation", () => {
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

test("formatMarkdownOutput includes metadata and explanation", () => {
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

test("formatJsonOutput returns machine readable payload", () => {
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
