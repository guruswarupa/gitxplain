export function formatOutput({ mode, commitData, explanation }) {
  const header = [
    `Commit: ${commitData.commitId}`,
    `Files Changed: ${commitData.filesChanged.length}`,
    `Stats: ${commitData.stats}`,
    `Mode: ${mode}`
  ].join("\n");

  return `${header}\n\n${explanation}`;
}

export function formatJsonOutput({ mode, commitData, explanation }) {
  return JSON.stringify(
    {
      mode,
      commit: {
        id: commitData.commitId,
        message: commitData.commitMessage,
        filesChanged: commitData.filesChanged,
        stats: commitData.stats
      },
      explanation
    },
    null,
    2
  );
}
