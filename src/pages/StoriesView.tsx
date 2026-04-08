/**
 * Stories View Component
 * Displays grouped commits as narrative stories
 * This is the UNIQUE FEATURE of Commit Story Desktop
 */

import React from 'react';
import { BookOpen, GitCommit, FileCode, Calendar, Sparkles, RefreshCw } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';
import { Story, StoryType } from '../models';

export default function StoriesView() {
  const {
    stories,
    storiesLoading,
    setStoriesLoading,
    currentProject,
    commits,
  } = useCommitStoryStore();

  const handleGenerateStories = async () => {
    setStoriesLoading(true);
    try {
      // Placeholder: In real implementation:
      // 1. Call commit grouping engine
      // 2. Call AI service to generate narratives
      // 3. Update stories in store
      
      console.log('Generate stories from', commits.length, 'commits');
      
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For now, just show message
      alert('Story generation will be implemented once dependencies are installed');
    } catch (error) {
      console.error('Failed to generate stories:', error);
    } finally {
      setStoriesLoading(false);
    }
  };

  const getStoryTypeColor = (type: StoryType) => {
    const colors = {
      feature: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
      fix: 'bg-red-500/20 text-red-700 border-red-500/30',
      docs: 'bg-green-500/20 text-green-700 border-green-500/30',
      refactor: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
      style: 'bg-pink-500/20 text-pink-700 border-pink-500/30',
      test: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
      chore: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
    };
    return colors[type] || colors.chore;
  };

  const getStoryTypeIcon = (type: StoryType) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
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
          <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
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
        <button
          onClick={handleGenerateStories}
          disabled={commits.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Generate Stories
        </button>
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
            {commits.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Load a repository with commits first
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

interface StoryCardProps {
  story: Story;
}

function StoryCard({ story }: StoryCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  const getStoryTypeColor = (type: StoryType) => {
    const colors = {
      feature: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
      fix: 'bg-red-500/20 text-red-700 border-red-500/30',
      docs: 'bg-green-500/20 text-green-700 border-green-500/30',
      refactor: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
      style: 'bg-pink-500/20 text-pink-700 border-pink-500/30',
      test: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
      chore: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
    };
    return colors[type] || colors.chore;
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
              <span className="text-xs text-muted-foreground">
                {new Date(story.timestamp).toLocaleDateString()}
              </span>
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-primary" />
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
              <div className="space-y-2">
                {story.commits.map((commit) => (
                  <div
                    key={commit.hash}
                    className="text-sm p-2 bg-muted rounded-md"
                  >
                    <div className="font-mono text-xs text-muted-foreground mb-1">
                      {commit.hash.substring(0, 7)}
                    </div>
                    <div>{commit.message}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Files */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Files Affected</h4>
              <div className="flex flex-wrap gap-1">
                {story.files.map((file, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-1 bg-muted rounded-md font-mono"
                  >
                    {file}
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
