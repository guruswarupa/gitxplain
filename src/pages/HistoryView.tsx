/**
 * History View Component
 * Displays commit list with details panel and AI explanation
 */

import React, { useState } from 'react';
import { GitCommit, User, Calendar, FileText, Sparkles, Shield, Eye, Code2 } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';
import { Commit } from '../models';
import SearchBar from '../components/SearchBar';

export default function HistoryView() {
  const {
    commits,
    filteredCommits,
    searchQuery,
    selectedCommit,
    setSelectedCommit,
    commitsLoading,
    currentProject,
  } = useCommitStoryStore();

  // Use filtered commits when searching, otherwise use all commits
  const displayCommits = searchQuery ? filteredCommits : commits;

  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<string>('');

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
        setAiExplanation(`**Error:** ${result.error}\n\n${result.output || 'Make sure your AI provider API key is configured in Settings.'}`);
      } else {
        setAiExplanation(result.output);
      }
    } catch (error: any) {
      console.error('Failed to explain commit:', error);
      setAiExplanation(`**Failed to explain commit:** ${error.message}\n\nMake sure gitxplain CLI is available and your AI provider is configured.`);
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
        setAiExplanation(`**Error:** ${result.error}\n\n${result.output || 'Make sure your AI provider API key is configured in Settings.'}`);
      } else {
        setAiExplanation(result.output);
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
        setAiExplanation(`**Error:** ${result.error}\n\n${result.output || 'Make sure your AI provider API key is configured in Settings.'}`);
      } else {
        setAiExplanation(result.output);
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
        setAiExplanation(`**Error:** ${result.error}\n\n${result.output || 'Make sure your AI provider API key is configured in Settings.'}`);
      } else {
        setAiExplanation(result.output);
      }
    } catch (error: any) {
      console.error('Failed to get line-by-line explanation:', error);
      setAiExplanation(`**Failed to get line-by-line explanation:** ${error.message}`);
    } finally {
      setAiLoading(false);
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
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap text-sm bg-background p-4 rounded-md overflow-x-auto">
                    {aiExplanation}
                  </pre>
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
    </div>
  );
}
