import React, { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { apiService } from '@/services/api';
import { GitBranch, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react';

export default function CommitStory() {
  const [repoPath, setRepoPath] = useState('');
  const [expandedCommits, setExpandedCommits] = useState<Set<number>>(new Set());
  const { gitSummary, gitLoading, setGitSummary, setGitLoading, setError } = useAppStore();

  const handleFetchGitSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim()) {
      setError('Please enter a repository path');
      return;
    }

    setGitLoading(true);
    try {
      const summary = await apiService.getGitSummary(repoPath);
      setGitSummary(summary);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setGitLoading(false);
    }
  };

  const toggleCommitExpand = (index: number) => {
    const newExpanded = new Set(expandedCommits);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCommits(newExpanded);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Commit Story</h1>
        <p className="text-muted-foreground">Explore your repository history and commit patterns</p>
      </div>

      {/* Repository Input */}
      <div className="mb-6">
        <form onSubmit={handleFetchGitSummary} className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="Enter repository path (e.g., /path/to/repo or current directory: .)"
              className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={gitLoading}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {gitLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Analyze Repository
              </>
            )}
          </button>
        </form>
      </div>

      {gitSummary && (
        <div className="space-y-6">
          {/* Repository Info */}
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-start gap-4 mb-4">
              <GitBranch className="w-6 h-6 text-primary mt-1" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-2">{gitSummary.repositoryPath}</h2>
                <div className="flex gap-6 text-sm">
                  <div>
                    <div className="text-muted-foreground">Current Branch</div>
                    <div className="font-semibold">{gitSummary.branch}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Commits</div>
                    <div className="font-semibold">{gitSummary.totalCommits}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-sm text-muted-foreground mb-1">Files Changed</div>
              <div className="text-2xl font-bold">{gitSummary.stats.filesChanged}</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-sm text-muted-foreground mb-1">Insertions</div>
              <div className="text-2xl font-bold text-green-600">+{gitSummary.stats.insertions}</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-sm text-muted-foreground mb-1">Deletions</div>
              <div className="text-2xl font-bold text-red-600">-{gitSummary.stats.deletions}</div>
            </div>
          </div>

          {/* Recent Commits */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-card">
              <h3 className="font-semibold">Recent Commits</h3>
            </div>

            {gitSummary.recentCommits.length > 0 ? (
              <div className="divide-y divide-border">
                {gitSummary.recentCommits.map((commit, idx) => (
                  <div key={idx} className="p-6 hover:bg-accent/50 transition-colors">
                    <button
                      onClick={() => toggleCommitExpand(idx)}
                      className="w-full text-left flex items-start gap-4 mb-2"
                    >
                      <div className="flex-1">
                        <div className="font-semibold group flex items-center gap-2">
                          {expandedCommits.has(idx) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                          {commit.message}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{commit.author}</div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                        {new Date(commit.date).toLocaleDateString()}
                      </div>
                    </button>

                    {expandedCommits.has(idx) && (
                      <div className="mt-3 p-3 bg-muted rounded font-mono text-xs">
                        <div className="text-muted-foreground mb-2">Commit Hash</div>
                        <div className="break-all">{commit.hash}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">No commits found</div>
            )}
          </div>
        </div>
      )}

      {!gitSummary && !gitLoading && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">No repository data loaded</p>
          <p className="text-sm text-muted-foreground">Enter a repository path above to get started</p>
        </div>
      )}
    </div>
  );
}
