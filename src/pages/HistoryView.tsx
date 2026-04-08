/**
 * History View Component
 * Displays commit list with details panel and AI explanation
 */

import React, { useEffect, useState } from 'react';
import { GitCommit, User, Calendar, FileText, Sparkles, Shield, Eye, Code2, Scissors, Upload, GitBranch } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';
import { Commit } from '../models';
import SearchBar from '../components/SearchBar';

const MAX_AI_WORDS = 500;

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^[ \t]*[-*+]\s+/gm, '- ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function removeCliPreamble(text: string): string {
  let cleaned = stripAnsi(text).trim();

  // Case 1: metadata appears as a standalone line.
  cleaned = cleaned
    .split('\n')
    .filter((line) => !line.trim().toLowerCase().startsWith('gitxplain - target:'))
    .join('\n')
    .trim();

  // Case 2: metadata is prepended inline before the narrative body.
  cleaned = cleaned.replace(/^gitxplain\s*-\s*target:[\s\S]*?(?=\b(1\.\s+|summary:|review findings:|security findings:|implementation details:))/i, '');

  // Case 3: fallback - if gitxplain metadata exists anywhere, cut text from first meaningful section.
  if (/gitxplain\s*-\s*target:/i.test(cleaned)) {
    const sectionMatch = cleaned.match(/\b(1\.\s+(Summary|Issue|Root Cause|Fix|Impact|Risk Level|Technical Breakdown|Review Findings|Suggestions|Security Findings|Severity|Recommended Mitigations)|Summary:|Review Findings:|Security Findings:|Implementation Details:)/i);
    if (sectionMatch && typeof sectionMatch.index === 'number') {
      cleaned = cleaned.slice(sectionMatch.index);
    }
  }

  return cleaned.trim();
}

function structureSections(text: string): string {
  let structured = text;

  // Force line breaks for common inline metadata separators.
  structured = structured.replace(/\s+-\s+(Type:|Files Changed:|Stats:|Mode:|Provider:|Model:)/gi, '\n$1');

  // If output is collapsed into one line, split before known section starts.
  structured = structured.replace(/\s(?=(\d+\.\s+(Summary|Issue|Root Cause|Fix|Impact|Risk Level|Technical Breakdown|Review Findings|Suggestions|Security Findings|Severity|Recommended Mitigations)\b))/gi, '\n\n');

  // Break common section headings onto separate lines for readability.
  structured = structured.replace(
    /\s*(\d+)\.\s*(Summary|Issue|Root Cause|Fix|Impact|Risk Level|Technical Breakdown|Review Findings|Suggestions|Security Findings|Severity|Recommended Mitigations):\s*/gi,
    '\n\n$1. $2:\n'
  );

  // Handle headings that come without colon, e.g. "1. Review Findings".
  structured = structured.replace(
    /\s*(\d+)\.\s*(Summary|Issue|Root Cause|Fix|Impact|Risk Level|Technical Breakdown|Review Findings|Suggestions|Security Findings|Severity|Recommended Mitigations)\s*(?=(\d+\.\s)|$)/gi,
    '\n\n$1. $2:\n'
  );

  // Put each numbered item on its own block when the model returns one long paragraph.
  structured = structured.replace(/(\S)\s+(\d+\.\s)/g, '$1\n\n$2');

  // Ensure list markers start on new lines.
  structured = structured.replace(/\s+-\s+/g, '\n- ');

  // Normalize whitespace while preserving intentional new lines.
  structured = structured
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return structured;
}

function truncateWords(text: string, maxWords: number): { text: string; truncated: boolean } {
  const tokens = text.split(/(\s+)/);
  let wordCount = 0;
  const kept: string[] = [];

  for (const token of tokens) {
    if (!token) continue;

    if (/^\s+$/.test(token)) {
      kept.push(token);
      continue;
    }

    if (wordCount >= maxWords) {
      break;
    }

    kept.push(token);
    wordCount += 1;
  }

  const truncated = wordCount < text.split(/\s+/).filter(Boolean).length;
  if (!truncated) {
    return { text, truncated: false };
  }

  const formatted = kept.join('').replace(/[ \t]+\n/g, '\n').trimEnd();
  return {
    text: `${formatted}\n\n[Output truncated for readability]`,
    truncated: true,
  };
}

function formatAiOutput(raw: string): string {
  const withoutPreamble = removeCliPreamble(raw);
  const cleaned = stripMarkdown(withoutPreamble);
  const structured = structureSections(cleaned);
  return truncateWords(structured, MAX_AI_WORDS).text;
}

function formatSplitPreview(raw: string): string {
  return stripAnsi(raw)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderSplitPreview(text: string) {
  const lines = formatSplitPreview(text).split('\n');

  return (
    <div className="space-y-2 text-sm">
      {lines.map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={`sp-empty-${index}`} className="h-2" />;
        }

        if (/^split plan$/i.test(trimmed)) {
          return (
            <h4 key={`sp-title-${index}`} className="text-base font-semibold text-foreground">
              {trimmed}
            </h4>
          );
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          return (
            <h5 key={`sp-step-${index}`} className="font-semibold text-foreground pt-1">
              {trimmed}
            </h5>
          );
        }

        const metaMatch = trimmed.match(/^(Original Summary|Reason To Split|Files|Why):\s*(.*)$/i);
        if (metaMatch) {
          return (
            <p key={`sp-meta-${index}`} className="leading-6 text-foreground break-words">
              <span className="font-semibold">{metaMatch[1]}:</span>{' '}
              <span className="text-muted-foreground">{metaMatch[2]}</span>
            </p>
          );
        }

        return (
          <p key={`sp-line-${index}`} className="leading-6 text-muted-foreground break-words">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Examples: "Summary", "1. Summary:", "Implementation Details"
  const headingPattern = /^(\d+\.\s*)?[A-Za-z][A-Za-z\s/-]{1,60}:?$/;
  return headingPattern.test(trimmed);
}

function renderStructuredAiOutput(text: string) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('• ')) {
      const items: string[] = [];
      while (i < lines.length) {
        const bulletLine = lines[i].trim();
        if (!(bulletLine.startsWith('- ') || bulletLine.startsWith('• '))) {
          break;
        }
        items.push(bulletLine.replace(/^[-•]\s+/, ''));
        i += 1;
      }

      blocks.push(
        <ul key={`list-${i}`} className="list-disc pl-6 space-y-1 mb-4">
          {items.map((item, idx) => (
            <li key={`item-${i}-${idx}`}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (isHeadingLine(line)) {
      blocks.push(
        <h5 key={`heading-${i}`} className="text-xl font-semibold mt-3 mb-2">
          {line.replace(/:$/, '')}
        </h5>
      );
      i += 1;
      continue;
    }

    const paragraphLines: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (!nextLine || nextLine.startsWith('- ') || nextLine.startsWith('• ') || isHeadingLine(nextLine)) {
        break;
      }
      paragraphLines.push(nextLine);
      i += 1;
    }

    blocks.push(
      <p key={`para-${i}`} className="mb-4 leading-8 text-base">
        {paragraphLines.join(' ')}
      </p>
    );
  }

  return blocks;
}

export default function HistoryView() {
  const {
    commits,
    filteredCommits,
    searchQuery,
    selectedCommit,
    setSelectedCommit,
    setCommits,
    commitsLoading,
    currentProject,
  } = useCommitStoryStore();

  // Use filtered commits when searching, otherwise use all commits
  const displayCommits = searchQuery ? filteredCommits : commits;

  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<string>('');
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitPreview, setSplitPreview] = useState('');
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitExecuting, setSplitExecuting] = useState(false);
  const [splitError, setSplitError] = useState<string>('');
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string>('');
  const [pushSuccessMessage, setPushSuccessMessage] = useState<string>('');
  const [pushSuccessVisible, setPushSuccessVisible] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [branches, setBranches] = useState<string[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const loadBranchData = async () => {
    if (!currentProject) return;

    setBranchLoading(true);
    try {
      const branchData = await window.electronAPI.listBranches(currentProject.path);
      setCurrentBranch(branchData.current || '');
      setBranches(branchData.all || []);
    } catch (error: any) {
      const message = String(error?.message || 'Failed to load branch information.');
      if (message.includes('No handler registered for') && message.includes('git-list-branches')) {
        setPushError('Branch controls need an app restart to load. Please restart the Electron app and try again.');
      } else {
        setPushError(message);
      }
    } finally {
      setBranchLoading(false);
    }
  };

  useEffect(() => {
    setPushError('');
    setPushSuccessMessage('');
    loadBranchData();
  }, [currentProject?.path]);

  useEffect(() => {
    if (!pushSuccessMessage) {
      setPushSuccessVisible(false);
      return;
    }

    setPushSuccessVisible(true);

    const fadeTimer = setTimeout(() => {
      setPushSuccessVisible(false);
    }, 4500);

    const clearTimer = setTimeout(() => {
      setPushSuccessMessage('');
    }, 5000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [pushSuccessMessage]);

  const getProviderHelpMessage = (modeLabel: string) =>
    `Unable to run ${modeLabel}. Check your active AI provider and API key in Settings, then try again.`;

  const handleCommitClick = (commit: Commit) => {
    setSelectedCommit(commit);
    setAiExplanation(''); // Clear previous explanation
    setAiMode('');
  };

  const handleExplain = async () => {
    if (!selectedCommit || !currentProject) return;
    
    setAiLoading(true);
    setAiMode('explain');
    try {
      const result = await window.electronAPI.gitxplainExplain(
        currentProject.path,
        selectedCommit.hash,
        'full'
      );
      
      if (result.error) {
        setAiExplanation(`Error (Explain): ${result.error}\n\n${result.output || getProviderHelpMessage('Full Explanation')}`);
      } else {
        setAiExplanation(formatAiOutput(result.output));
      }
    } catch (error: any) {
      console.error('Failed to explain commit:', error);
      setAiExplanation(`Failed to explain commit: ${error.message}\n\nMake sure gitxplain CLI is available and your AI provider is configured.`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleReview = async () => {
    if (!selectedCommit || !currentProject) return;
    
    setAiLoading(true);
    setAiMode('review');
    try {
      const result = await window.electronAPI.gitxplainReview(
        currentProject.path,
        selectedCommit.hash
      );
      
      if (result.error) {
        setAiExplanation(`Error (Review): ${result.error}\n\n${result.output || getProviderHelpMessage('Code Review')}`);
      } else {
        setAiExplanation(formatAiOutput(result.output));
      }
    } catch (error: any) {
      console.error('Failed to get code review:', error);
      setAiExplanation(`**Failed to get code review:** ${error.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSecurity = async () => {
    if (!selectedCommit || !currentProject) return;
    
    setAiLoading(true);
    setAiMode('security');
    try {
      const result = await window.electronAPI.gitxplainSecurity(
        currentProject.path,
        selectedCommit.hash
      );
      
      if (result.error) {
        setAiExplanation(`Error (Security): ${result.error}\n\n${result.output || getProviderHelpMessage('Security Analysis')}`);
      } else {
        setAiExplanation(formatAiOutput(result.output));
      }
    } catch (error: any) {
      console.error('Failed to get security analysis:', error);
      setAiExplanation(`**Failed to get security analysis:** ${error.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleLines = async () => {
    if (!selectedCommit || !currentProject) return;
    
    setAiLoading(true);
    setAiMode('lines');
    try {
      const result = await window.electronAPI.gitxplainLines(
        currentProject.path,
        selectedCommit.hash
      );
      
      if (result.error) {
        setAiExplanation(`Error (Line-by-Line): ${result.error}\n\n${result.output || getProviderHelpMessage('Line-by-Line Walkthrough')}`);
      } else {
        setAiExplanation(formatAiOutput(result.output));
      }
    } catch (error: any) {
      console.error('Failed to get line-by-line explanation:', error);
      setAiExplanation(`**Failed to get line-by-line explanation:** ${error.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const openSplitModal = async () => {
    if (!selectedCommit || !currentProject) return;

    setShowSplitModal(true);
    setSplitLoading(true);
    setSplitError('');
    setSplitPreview('');

    try {
      const result = await window.electronAPI.gitxplainSplitPreview(
        currentProject.path,
        selectedCommit.hash
      );

      if (result.error) {
        setSplitError(result.error);
      } else {
        setSplitPreview(result.output || 'No split preview output returned.');
      }
    } catch (error: any) {
      setSplitError(error.message || 'Failed to generate split preview.');
    } finally {
      setSplitLoading(false);
    }
  };

  const executeSplit = async () => {
    if (!selectedCommit || !currentProject) return;

    setSplitExecuting(true);
    setSplitError('');
    try {
      const result = await window.electronAPI.gitxplainSplitExecute(
        currentProject.path,
        selectedCommit.hash
      );

      if (result.error) {
        setSplitError(result.error);
        return;
      }

      if (result.output) {
        setSplitPreview(result.output);
      }

      const refreshedCommits = await window.electronAPI.getLog(currentProject.path, { maxCount: 500 });
      setCommits(refreshedCommits);
      setSelectedCommit(null);
      setPushError('');
      setPushSuccessMessage('Split completed successfully. Click Sync Changes when you are ready to push.');
    } catch (error: any) {
      setSplitError(error.message || 'Failed to execute split.');
    } finally {
      setSplitExecuting(false);
    }
  };

  const handlePushAfterSplit = async () => {
    if (!currentProject) return;

    setPushLoading(true);
    setPushError('');
    try {
      const branch = await window.electronAPI.pushCurrentBranch(currentProject.path);
      setPushSuccessMessage(`Successfully pushed branch \"${branch}\" to origin.`);
    } catch (error: any) {
      setPushError(error.message || 'Failed to push branch.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleBranchChange = async (branchName: string) => {
    if (!currentProject || !branchName || branchName === currentBranch) return;

    setBranchLoading(true);
    setPushError('');
    setPushSuccessMessage('');

    try {
      const switchedTo = await window.electronAPI.checkoutBranch(currentProject.path, branchName);
      setCurrentBranch(switchedTo);
      setPushSuccessMessage(`Switched to branch "${switchedTo}".`);

      const refreshedCommits = await window.electronAPI.getLog(currentProject.path, { maxCount: 500 });
      setCommits(refreshedCommits);
      setSelectedCommit(null);

      await loadBranchData();
    } catch (error: any) {
      setPushError(error.message || 'Failed to switch branch.');
    } finally {
      setBranchLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const getModeLabel = () => {
    switch (aiMode) {
      case 'explain': return 'Full Explanation';
      case 'review': return 'Code Review';
      case 'security': return 'Security Analysis';
      case 'lines': return 'Line-by-Line Walkthrough';
      default: return 'AI Analysis';
    }
  };

  if (commitsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading commits...</p>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return null;
  }

  return (
    <div className="flex h-full">
      {/* Commit List */}
      <div className="w-96 border-r border-border flex flex-col bg-card">
        {/* Search Bar */}
        <SearchBar />
        
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Commit History</h2>
          <p className="text-sm text-muted-foreground">
            {searchQuery 
              ? `${displayCommits.length} of ${commits.length} commits` 
              : `${commits.length} commits`
            }
          </p>
        </div>

        {/* Commit List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {displayCommits.length === 0 && searchQuery ? (
            <div className="p-6 text-center text-muted-foreground">
              <p className="text-sm">No commits match "{searchQuery}"</p>
            </div>
          ) : (
            displayCommits.map((commit) => {
              const isSelected = selectedCommit?.hash === commit.hash;
              
              return (
                <div
                key={commit.hash}
                onClick={() => handleCommitClick(commit)}
                className={`p-4 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-accent border-l-4 border-l-primary'
                    : 'hover:bg-accent/50 border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <GitCommit className="w-5 h-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1 line-clamp-2">
                      {commit.message}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {commit.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(commit.date)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-mono text-muted-foreground">
                      {commit.hash.substring(0, 7)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>
      </div>

      {/* Commit Details Panel */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-border bg-card/50">
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Branch</span>
              <select
                value={currentBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                disabled={branchLoading || branches.length === 0}
                className="bg-background text-foreground text-sm font-medium focus:outline-none disabled:opacity-50 rounded px-2 py-1 border border-border"
                style={{
                  color: 'hsl(var(--foreground))',
                  backgroundColor: 'hsl(var(--background))',
                }}
              >
                {branches.length === 0 ? (
                  <option
                    value=""
                    style={{
                      color: 'hsl(var(--foreground))',
                      backgroundColor: 'hsl(var(--background))',
                    }}
                  >
                    {branchLoading ? 'Loading...' : 'No branches'}
                  </option>
                ) : (
                  branches.map((branch) => (
                    <option
                      key={branch}
                      value={branch}
                      style={{
                        color: 'hsl(var(--foreground))',
                        backgroundColor: 'hsl(var(--background))',
                      }}
                    >
                      {branch}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              onClick={handlePushAfterSplit}
              disabled={pushLoading || branchLoading || !currentBranch}
              className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors disabled:opacity-50 border border-border hover:bg-accent"
            >
              <Upload className="w-4 h-4" />
              {pushLoading ? 'Syncing...' : 'Sync Changes'}
            </button>
          </div>
          {(pushError || pushSuccessMessage) && (
            <div className={`mt-3 p-3 rounded-md border text-sm transition-opacity duration-500 ${pushError ? 'border-red-500/40 bg-red-500/10 text-red-700 opacity-100' : `border-green-500/40 bg-green-500/10 text-green-700 ${pushSuccessVisible ? 'opacity-100' : 'opacity-0'}`}`}>
              {pushError || pushSuccessMessage}
            </div>
          )}
        </div>
        {selectedCommit ? (
          <div className="p-6">
            {/* Commit Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">
                    {selectedCommit.message}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {selectedCommit.author}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {new Date(selectedCommit.date).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-mono text-muted-foreground">
                    {selectedCommit.hash}
                  </div>
                </div>
              </div>

              {/* AI Action Buttons */}
              <div className="flex gap-2 mb-6 flex-wrap">
                <button
                  onClick={handleExplain}
                  disabled={aiLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${
                    aiMode === 'explain' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Explain
                </button>
                <button
                  onClick={handleReview}
                  disabled={aiLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${
                    aiMode === 'review' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'border border-border hover:bg-accent'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Review
                </button>
                <button
                  onClick={handleSecurity}
                  disabled={aiLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${
                    aiMode === 'security' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'border border-border hover:bg-accent'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Security
                </button>
                <button
                  onClick={handleLines}
                  disabled={aiLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${
                    aiMode === 'lines' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'border border-border hover:bg-accent'
                  }`}
                >
                  <Code2 className="w-4 h-4" />
                  Line-by-Line
                </button>
                <button
                  onClick={openSplitModal}
                  disabled={aiLoading || splitLoading || splitExecuting}
                  className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors disabled:opacity-50 border border-border hover:bg-accent"
                >
                  <Scissors className="w-4 h-4" />
                  Split Commit
                </button>
              </div>
            </div>

            {/* AI Loading Indicator */}
            {aiLoading && (
              <div className="mb-6 p-6 bg-accent/50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">
                    Analyzing commit with AI... This may take a few seconds.
                  </span>
                </div>
              </div>
            )}

            {/* AI Explanation Panel */}
            {aiExplanation && !aiLoading && (
              <div className="mb-6 p-4 bg-accent rounded-lg border border-border">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  {getModeLabel()}
                </h4>
                <div className="text-sm bg-background p-5 rounded-md border border-border text-foreground">
                  {renderStructuredAiOutput(aiExplanation)}
                </div>
              </div>
            )}

            {/* Files Changed */}
            {selectedCommit.files && selectedCommit.files.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Files Changed ({selectedCommit.files.length})
                </h4>
                <div className="space-y-2">
                  {selectedCommit.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-card rounded-md border border-border"
                    >
                      <span className="text-sm font-mono">{file.path}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-green-600">+{file.additions}</span>
                        <span className="text-red-600">-{file.deletions}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Commit Body */}
            {selectedCommit.body && (
              <div className="p-4 bg-muted rounded-md">
                <h4 className="text-sm font-semibold mb-2">Details</h4>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {selectedCommit.body}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <GitCommit className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a commit to view details</p>
            </div>
          </div>
        )}
      </div>

      {showSplitModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Split Commit Preview</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This operation rewrites history. Use only on branches where force-push is acceptable.
              </p>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {splitLoading && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Generating split plan...
                </div>
              )}

              {splitError && !splitLoading && (
                <div className="p-3 rounded-md border border-red-500/40 bg-red-500/10 text-red-700 text-sm">
                  {splitError}
                </div>
              )}

              {!splitLoading && !splitError && (
                <div className="bg-muted/60 border border-border rounded-md p-4 max-h-[52vh] overflow-y-auto">
                  {renderSplitPreview(splitPreview)}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSplitModal(false)}
                disabled={splitExecuting}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              >
                Close
              </button>
              <button
                onClick={executeSplit}
                disabled={splitLoading || splitExecuting || !!splitError}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {splitExecuting ? 'Executing Split...' : 'Execute Split'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
