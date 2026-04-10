import { ANSI, colorize } from "./colorSupport.js";

function stripInlineMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .trimEnd();
}

function normalizeMarkdownLine(line, state) {
  const trimmed = line.trim();

  if (/^```/.test(trimmed)) {
    state.inCodeBlock = !state.inCodeBlock;
    return "";
  }

  if (state.inCodeBlock) {
    return `  ${line.replace(/^\s*/, "")}`;
  }

  if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
    return "";
  }

  let normalizedHeading = trimmed
    .replace(/^#{1,6}\s+/, "")
    .replace(/^([0-9]+\.)\s+/, "");
  normalizedHeading = stripInlineMarkdown(normalizedHeading).replace(/:\s*$/, "").trim();

  if (
    /^(summary|issues? fixed|issue|root cause|fix(?: explanation)?|impact|risk level|severity|technical breakdown|full analysis|line-by-line code walkthrough|code review|security review|security findings|review findings|suggestions|recommended mitigations)$/i.test(
      normalizedHeading
    )
  ) {
    return `${normalizedHeading}:`;
  }

  if (/^>\s*/.test(trimmed)) {
    return stripInlineMarkdown(trimmed.replace(/^>\s*/, ""));
  }

  const bulletMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
  if (bulletMatch) {
    const [, indent, marker, content] = bulletMatch;
    return `${indent}${marker} ${stripInlineMarkdown(content)}`;
  }

  return stripInlineMarkdown(line);
}

function formatTargetLabel(commitData) {
  if (commitData.analysisType === "range") {
    return "Range";
  }

  if (commitData.analysisType === "blame") {
    return "File";
  }

  if (commitData.analysisType === "stash") {
    return "Stash";
  }

  return "Commit";
}

function normalizeHeading(line) {
  const match = line.match(/^([0-9]+\.)?\s*(Summary|Issues? Fixed|Issue|Root Cause|Fix(?: Explanation)?|Impact|Risk Level|Severity|Technical Breakdown|Full Analysis|Line-by-Line Code Walkthrough|Code Review|Security Review|Security Findings|Review Findings|Suggestions|Recommended Mitigations)\s*:?\s*$/i);

  if (!match) {
    return null;
  }

  return `${match[2]}:`;
}

function isFileHeading(line) {
  return /^(?:File|Path)\s*:/i.test(line) || /^[A-Za-z0-9_./-]+\.[A-Za-z0-9]+:\s*$/.test(line);
}

function formatBulletLine(line) {
  const match = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);

  if (!match) {
    return null;
  }

  const [, indent, marker, content] = match;
  return `${indent}${colorize(marker, ANSI.cyan)} ${content}`;
}

function formatSeverityLine(line) {
  if (/\brisk level\b|\bseverity\b/i.test(line) === false) {
    return null;
  }

  return line;
}

function formatLine(line) {
  const trimmed = line.trim();

  if (trimmed === "") {
    return "";
  }

  const normalizedHeading = normalizeHeading(trimmed);

  if (normalizedHeading) {
    return colorize(normalizedHeading, ANSI.bold + ANSI.cyan);
  }

  if (isFileHeading(trimmed)) {
    return colorize(trimmed, ANSI.bold + ANSI.cyan);
  }

  const bulletLine = formatBulletLine(line);

  if (bulletLine) {
    return bulletLine;
  }

  const severityLine = formatSeverityLine(trimmed);

  if (severityLine) {
    return severityLine;
  }

  return line;
}

function formatExplanation(explanation) {
  const state = { inCodeBlock: false };
  const lines = explanation
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => normalizeMarkdownLine(line, state));
  const formatted = [];
  let previousWasBlank = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const formattedLine = formatLine(line);
    const isHeading = normalizeHeading(trimmed) != null || isFileHeading(trimmed);

    if (trimmed === "") {
      if (!previousWasBlank && formatted.length > 0) {
        formatted.push("");
      }
      previousWasBlank = true;
      continue;
    }

    if (isHeading && formatted.length > 0 && !previousWasBlank) {
      formatted.push("");
    }

    formatted.push(formattedLine);
    previousWasBlank = false;
  }

  return formatted.join("\n").trimEnd();
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

  if (responseMeta.estimatedCostUsd != null) {
    lines.push(`Estimated Cost: $${responseMeta.estimatedCostUsd.toFixed(6)}`);
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
