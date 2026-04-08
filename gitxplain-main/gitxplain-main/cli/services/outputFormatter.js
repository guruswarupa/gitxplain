import process from "node:process";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  cyan: "\u001b[36m",
  yellow: "\u001b[33m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  gray: "\u001b[90m"
};

function supportsColor() {
  return Boolean(process.stdout?.isTTY) && process.env.NO_COLOR == null;
}

function colorize(text, color) {
  if (!supportsColor()) {
    return text;
  }

  return `${color}${text}${ANSI.reset}`;
}

function formatTargetLabel(commitData) {
  return commitData.analysisType === "range" ? "Range" : "Commit";
}

function highlightLine(line) {
  if (/^([0-9]+\.)?\s*(Summary|Issue|Root Cause|Fix|Impact|Risk Level|Technical Breakdown|Security Findings|Suggestions|Review Findings):/i.test(line)) {
    return colorize(line, ANSI.bold + ANSI.cyan);
  }

  if (/risk/i.test(line) && /\blow\b/i.test(line)) {
    return colorize(line, ANSI.green);
  }

  if (/risk/i.test(line) && /\bmedium\b/i.test(line)) {
    return colorize(line, ANSI.yellow);
  }

  if (/risk/i.test(line) && /\bhigh\b/i.test(line)) {
    return colorize(line, ANSI.red);
  }

  return line;
}

function formatExplanation(explanation) {
  return explanation
    .split("\n")
    .map((line) => highlightLine(line))
    .join("\n");
}

export function formatPreamble({ mode, commitData, options, promptMeta }) {
  if (options.quiet) {
    return "";
  }

  const header = [
    `${colorize(formatTargetLabel(commitData), ANSI.bold + ANSI.cyan)}: ${commitData.displayRef}`,
    `Files Changed: ${commitData.filesChanged.length}`,
    `Stats: ${commitData.stats}`,
    `Mode: ${mode}`
  ];

  if (commitData.analysisType === "range") {
    header.splice(1, 0, `Commits: ${commitData.commitCount}`);
  }

  if (promptMeta?.warnings?.length) {
    header.push(...promptMeta.warnings.map((warning) => colorize(`Warning: ${warning}`, ANSI.yellow)));
  }

  return `${header.join("\n")}\n\n`;
}

export function formatFooter({ responseMeta, promptMeta, options }) {
  if (!options.verbose || !responseMeta) {
    return "";
  }

  const lines = [
    "",
    colorize("Meta:", ANSI.bold + ANSI.gray),
    `Provider: ${responseMeta.provider}`,
    `Model: ${responseMeta.model}`,
    `Cache: ${responseMeta.cacheHit ? "hit" : "miss"}`,
    `Latency: ${responseMeta.latencyMs}ms`
  ];

  if (responseMeta.usage) {
    lines.push(`Usage: ${JSON.stringify(responseMeta.usage)}`);
  }

  if (promptMeta?.warnings?.length) {
    lines.push(...promptMeta.warnings);
  }

  return `${lines.join("\n")}\n`;
}

export function formatOutput({ mode, commitData, explanation, responseMeta, promptMeta, options }) {
  return `${formatPreamble({ mode, commitData, options, promptMeta })}${formatExplanation(explanation)}${formatFooter({ responseMeta, promptMeta, options })}`;
}

export function formatMarkdownOutput({ mode, commitData, explanation, responseMeta, promptMeta }) {
  const lines = [
    `# gitxplain`,
    ``,
    `- Target: ${commitData.displayRef}`,
    `- Type: ${commitData.analysisType}`,
    `- Files Changed: ${commitData.filesChanged.length}`,
    `- Stats: ${commitData.stats}`,
    `- Mode: ${mode}`
  ];

  if (commitData.analysisType === "range") {
    lines.push(`- Commits: ${commitData.commitCount}`);
  }

  if (responseMeta) {
    lines.push(`- Provider: ${responseMeta.provider}`);
    lines.push(`- Model: ${responseMeta.model}`);
  }

  if (promptMeta?.warnings?.length) {
    lines.push(...promptMeta.warnings.map((warning) => `- Warning: ${warning}`));
  }

  lines.push("", explanation);
  return lines.join("\n");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatHtmlOutput({ mode, commitData, explanation, responseMeta, promptMeta }) {
  const metaItems = [
    `<li><strong>Target:</strong> ${escapeHtml(commitData.displayRef)}</li>`,
    `<li><strong>Type:</strong> ${escapeHtml(commitData.analysisType)}</li>`,
    `<li><strong>Files Changed:</strong> ${commitData.filesChanged.length}</li>`,
    `<li><strong>Stats:</strong> ${escapeHtml(commitData.stats)}</li>`,
    `<li><strong>Mode:</strong> ${escapeHtml(mode)}</li>`
  ];

  if (commitData.analysisType === "range") {
    metaItems.push(`<li><strong>Commits:</strong> ${commitData.commitCount}</li>`);
  }

  if (responseMeta) {
    metaItems.push(`<li><strong>Provider:</strong> ${escapeHtml(responseMeta.provider)}</li>`);
    metaItems.push(`<li><strong>Model:</strong> ${escapeHtml(responseMeta.model)}</li>`);
  }

  if (promptMeta?.warnings?.length) {
    metaItems.push(
      ...promptMeta.warnings.map((warning) => `<li><strong>Warning:</strong> ${escapeHtml(warning)}</li>`)
    );
  }

  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><title>gitxplain</title></head><body>",
    "<h1>gitxplain</h1>",
    `<ul>${metaItems.join("")}</ul>`,
    `<pre>${escapeHtml(explanation)}</pre>`,
    "</body></html>"
  ].join("");
}

export function formatJsonOutput({ mode, commitData, explanation, responseMeta, promptMeta }) {
  return JSON.stringify(
    {
      mode,
      commit: {
        id: commitData.commitId,
        ref: commitData.displayRef,
        type: commitData.analysisType,
        count: commitData.commitCount,
        message: commitData.commitMessage,
        filesChanged: commitData.filesChanged,
        stats: commitData.stats
      },
      prompt: promptMeta,
      response: responseMeta,
      explanation
    },
    null,
    2
  );
}
