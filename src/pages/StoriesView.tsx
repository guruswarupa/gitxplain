/**
 * Stories View Component
 * Displays grouped commits as narrative stories
 * This is the UNIQUE FEATURE of Commit Story Desktop
 */

import React, { useState } from 'react';
import { BookOpen, GitCommit, FileCode, Calendar, Sparkles, RefreshCw, Copy, Check, Download } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';
import { Story, StoryType, Commit } from '../models';
import { commitGroupingEngine } from '../services/commitGrouping';
import { generateUUID } from '../utils';

const MAX_STORY_SUMMARY_WORDS = 140;

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

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
    .replace(/\r/g, '');
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function cleanStorySummary(raw: string): string {
  if (!raw) return '';

  const cleaned = stripMarkdown(stripAnsi(raw))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^#\s*gitxplain/i.test(line)) return false;
      if (/^-\s*(target|type|files changed|stats|mode|commits|provider|model|warning):/i.test(line)) return false;
      if (/^meta:/i.test(line)) return false;
      if (/^(provider|model|cache|latency|usage):/i.test(line)) return false;
      return true;
    })
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return truncateWords(cleaned, MAX_STORY_SUMMARY_WORDS);
}

async function hydrateCommitsWithFiles(
  repoPath: string,
  commits: Commit[],
  setProgress: (value: string) => void
): Promise<Commit[]> {
  const missingFiles = commits.filter((commit) => !commit.files || commit.files.length === 0);
  if (missingFiles.length === 0) {
    return commits;
  }

  const fileMap = new Map<string, Commit['files']>();
  const batchSize = 20;

  for (let start = 0; start < missingFiles.length; start += batchSize) {
    const batch = missingFiles.slice(start, start + batchSize);
    setProgress(`Loading commit files (${Math.min(start + batch.length, missingFiles.length)}/${missingFiles.length})...`);

    const details = await Promise.all(
      batch.map(async (commit) => {
        try {
          const commitDetails = await window.electronAPI.getCommitDetails(repoPath, commit.hash);
          return { hash: commit.hash, files: commitDetails.files ?? [] };
        } catch {
          return { hash: commit.hash, files: [] };
        }
      })
    );

    for (const detail of details) {
      fileMap.set(detail.hash, detail.files);
    }
  }

  return commits.map((commit) => ({
    ...commit,
    files: commit.files && commit.files.length > 0 ? commit.files : (fileMap.get(commit.hash) ?? []),
  }));
}

export default function StoriesView() {
  const {
    stories,
    setStories,
    storiesLoading,
    setStoriesLoading,
    currentProject,
    commits,
  } = useCommitStoryStore();

  const [generationProgress, setGenerationProgress] = useState<string>('');

  const handleGenerateStories = async () => {
    if (!currentProject || commits.length === 0) return;
    
    setStoriesLoading(true);
    setGenerationProgress('Preparing commit data...');
    
    try {
      const commitsWithFiles = await hydrateCommitsWithFiles(
        currentProject.path,
        commits,
        setGenerationProgress
      );

      setGenerationProgress('Grouping commits...');
      // Step 1: Group commits using the grouping engine
      const groups = commitGroupingEngine.groupCommits(commitsWithFiles);
      
      if (groups.length === 0) {
        setGenerationProgress('No commit groups found');
        setStoriesLoading(false);
        return;
      }
      
      setGenerationProgress(`Found ${groups.length} commit groups. Generating narratives...`);
      
      // Step 2: Create stories from groups
      const newStories: Story[] = [];
      
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        setGenerationProgress(`Generating story ${i + 1} of ${groups.length}...`);
        
        // Generate a title from the group
        const title = generateGroupTitle(group.type, group.commits);
        
        // Create base story
        const story = commitGroupingEngine.createStoryFromGroup(
          group,
          generateUUID(),
          title
        );
        
        // Try to generate AI narrative for this group
        try {
          const commitRange = group.commits.length > 1
            ? `${group.commits[group.commits.length - 1].hash}..${group.commits[0].hash}`
            : group.commits[0].hash;
            
          const result = await window.electronAPI.gitxplainExplain(
            currentProject.path,
            commitRange,
            'summary'
          );
          
          if (result.output && !result.error) {
            const cleaned = cleanStorySummary(result.output);
            story.summary = cleaned || generateFallbackSummary(group.type, group.commits, Array.from(group.files));
          } else {
            // Fallback to generated summary
            story.summary = generateFallbackSummary(group.type, group.commits, Array.from(group.files));
          }
        } catch (error) {
          console.error('AI narrative generation failed:', error);
          story.summary = generateFallbackSummary(group.type, group.commits, Array.from(group.files));
        }
        
        newStories.push(story);
      }
      
      // Update store with new stories
      setStories(newStories);
      setGenerationProgress('');
      
    } catch (error) {
      console.error('Failed to generate stories:', error);
      setGenerationProgress('Failed to generate stories');
    } finally {
      setStoriesLoading(false);
    }
  };

  if (!currentProject) {
    return null;
  }

  if (storiesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Generating commit stories...</p>
          <p className="text-sm text-muted-foreground mt-2">{generationProgress}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Commit Stories</h2>
          <p className="text-muted-foreground">
            AI-generated narratives from your commit history
          </p>
        </div>
        <div className="flex gap-2">
          {stories.length > 0 && (
            <button
              onClick={() => exportStories(stories)}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          <button
            onClick={handleGenerateStories}
            disabled={commits.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            {stories.length > 0 ? 'Regenerate' : 'Generate'} Stories
          </button>
        </div>
      </div>

      {/* Empty State */}
      {stories.length === 0 ? (
        <div className="flex items-center justify-center h-[calc(100%-100px)]">
          <div className="text-center max-w-md">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Stories Yet</h3>
            <p className="text-muted-foreground mb-6">
              Click "Generate Stories" to transform your commit history into meaningful narratives.
              Stories group related commits and explain what changed, why it matters, and the impact.
            </p>
            {commits.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Load a repository with commits first
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Found {commits.length} commits ready to analyze
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Story Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper Functions

function generateGroupTitle(type: StoryType, commits: Commit[]): string {
  const typeLabels: Record<StoryType, string> = {
    feature: 'New Feature',
    fix: 'Bug Fix',
    docs: 'Documentation Update',
    refactor: 'Code Refactoring',
    style: 'Style Changes',
    test: 'Test Updates',
    chore: 'Maintenance',
  };
  
  // Try to extract a meaningful title from commit messages
  const mainCommit = commits[0];
  const message = mainCommit.message;
  
  // Remove conventional commit prefix if present
  const cleanMessage = message.replace(/^(feat|fix|docs|refactor|style|test|chore)(\(.+\))?:\s*/i, '');
  
  // Capitalize first letter
  const title = cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1);
  
  // Truncate if too long
  if (title.length > 60) {
    return title.substring(0, 57) + '...';
  }
  
  return title || `${typeLabels[type]} - ${commits.length} commits`;
}

function generateFallbackSummary(type: StoryType, commits: Commit[], files: string[]): string {
  const typeDescriptions: Record<StoryType, string> = {
    feature: 'introduces new functionality',
    fix: 'addresses issues and bugs',
    docs: 'improves documentation',
    refactor: 'improves code structure without changing behavior',
    style: 'updates code formatting and style',
    test: 'adds or updates tests',
    chore: 'performs maintenance tasks',
  };
  
  const commitCount = commits.length;
  const fileCount = files.length;
  const authors = [...new Set(commits.map(c => c.author))];
  
  let summary = `This ${type} ${typeDescriptions[type]}. `;
  summary += `It includes ${commitCount} commit${commitCount > 1 ? 's' : ''} `;
  summary += `affecting ${fileCount} file${fileCount > 1 ? 's' : ''}`;
  
  if (authors.length === 1) {
    summary += ` by ${authors[0]}`;
  } else if (authors.length > 1) {
    summary += ` by ${authors.length} contributors`;
  }
  
  summary += '.';
  
  // Add key commit messages
  if (commits.length > 0) {
    const keyMessages = commits.slice(0, 3).map(c => 
      c.message.replace(/^(feat|fix|docs|refactor|style|test|chore)(\(.+\))?:\s*/i, '')
    );
    summary += ` Key changes: ${keyMessages.join('; ')}.`;
  }
  
  return summary;
}

function exportStories(stories: Story[]) {
  const markdown = stories.map(story => {
    const date = new Date(story.timestamp).toLocaleDateString();
    const commitList = story.commits.map(c => `  - ${c.hash.substring(0, 7)}: ${c.message}`).join('\n');
    const fileList = story.files.join(', ');
    
    return `## ${story.title}

**Type:** ${story.type.toUpperCase()} | **Date:** ${date}

${story.summary}

### Commits (${story.commits.length})
${commitList}

### Files Affected
${fileList}

---
`;
  }).join('\n');
  
  const blob = new Blob([`# Commit Stories\n\nGenerated from repository history.\n\n${markdown}`], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'commit-stories.md';
  a.click();
  URL.revokeObjectURL(url);
}

interface StoryCardProps {
  story: Story;
}

function StoryCard({ story }: StoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const getStoryTypeColor = (type: StoryType) => {
    const colors = {
      feature: 'bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-400',
      fix: 'bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400',
      docs: 'bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400',
      refactor: 'bg-purple-500/20 text-purple-700 border-purple-500/30 dark:text-purple-400',
      style: 'bg-pink-500/20 text-pink-700 border-pink-500/30 dark:text-pink-400',
      test: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:text-yellow-400',
      chore: 'bg-gray-500/20 text-gray-700 border-gray-500/30 dark:text-gray-400',
    };
    return colors[type] || colors.chore;
  };

  const handleCopy = async () => {
    const text = `${story.title}\n\n${story.summary}\n\nCommits: ${story.commits.length}\nFiles: ${story.files.length}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Card Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">{story.title}</h3>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-md border ${getStoryTypeColor(
                  story.type
                )}`}
              >
                {story.type.toUpperCase()}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(story.timestamp).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        {/* AI Summary */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {story.summary}
          </p>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {story.commits.length} commit{story.commits.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {story.files.length} file{story.files.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-primary hover:underline"
        >
          {expanded ? 'Hide' : 'Show'} details
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-border">
            {/* Commits */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Commits</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {story.commits.map((commit) => (
                  <div
                    key={commit.hash}
                    className="text-sm p-2 bg-muted rounded-md"
                  >
                    <div className="font-mono text-xs text-muted-foreground mb-1">
                      {commit.hash.substring(0, 7)} • {commit.author}
                    </div>
                    <div className="line-clamp-2">{commit.message}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Files */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Files Affected</h4>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {story.files.map((file, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-1 bg-muted rounded-md font-mono"
                  >
                    {file.split('/').pop()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
