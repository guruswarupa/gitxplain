/**
 * Changes View Component
 * Shows uncommitted changes, staging, and commit creation
 */

import React, { useState, useEffect } from 'react';
import { FileText, FilePlus, FileX, GitCommit, Check, X, RefreshCw } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';

export default function ChangesView() {
  const { currentProject, setError } = useCommitStoryStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [stagedFiles, setStagedFiles] = useState<string[]>([]);
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (currentProject) {
      loadStatus();
    }
  }, [currentProject]);

  const loadStatus = async () => {
    if (!currentProject) return;
    
    setLoading(true);
    try {
      const status = await window.electronAPI.getStatus(currentProject.path);
      setGitStatus(status);
      
      // Auto-stage already staged files
      if (status.staged && status.staged.length > 0) {
        setStagedFiles(status.staged);
      }
    } catch (error: any) {
      console.error('Failed to load git status:', error);
      setError(error.message || 'Failed to load git status');
    } finally {
      setLoading(false);
    }
  };

  const handleStageFile = (file: string) => {
    if (stagedFiles.includes(file)) {
      setStagedFiles(stagedFiles.filter(f => f !== file));
    } else {
      setStagedFiles([...stagedFiles, file]);
    }
  };

  const handleStageAll = () => {
    if (!gitStatus) return;
    
    const allFiles = [
      ...gitStatus.modified,
      ...gitStatus.created,
      ...gitStatus.deleted,
    ];
    setStagedFiles(allFiles);
  };

  const handleUnstageAll = () => {
    setStagedFiles([]);
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      alert('Please enter a commit message');
      return;
    }

    if (stagedFiles.length === 0) {
      alert('No files staged for commit');
      return;
    }

    if (!currentProject) return;

    try {
      setLoading(true);
      const commitHash = await window.electronAPI.commit(
        currentProject.path,
        commitMessage,
        stagedFiles
      );
      
      // Success!
      alert(`Commit created: ${commitHash.substring(0, 7)}`);
      
      // Reset form
      setCommitMessage('');
      setStagedFiles([]);
      
      // Reload status
      await loadStatus();
    } catch (error: any) {
      console.error('Commit failed:', error);
      alert(`Failed to create commit: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) {
    return null;
  }

  if (loading && !gitStatus) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading changes...</p>
        </div>
      </div>
    );
  }

  const totalChanges = gitStatus
    ? gitStatus.modified.length +
      gitStatus.created.length +
      gitStatus.deleted.length +
      (gitStatus.files?.filter((f: any) => !f.working_dir.includes('?')).length || 0)
    : 0;

  return (
    <div className="flex h-full">
      {/* File List */}
      <div className="w-1/2 border-r border-border overflow-y-auto">
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">
              Changes ({totalChanges})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={loadStatus}
                disabled={loading}
                className="text-xs px-3 py-1 border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleStageAll}
                className="text-xs px-3 py-1 border border-border rounded hover:bg-accent transition-colors"
              >
                Stage All
              </button>
              <button
                onClick={handleUnstageAll}
                className="text-xs px-3 py-1 border border-border rounded hover:bg-accent transition-colors"
              >
                Unstage All
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} staged
          </p>
        </div>

        <div className="divide-y divide-border">
          {/* Modified Files */}
          {gitStatus && gitStatus.modified.length > 0 && (
            <FileSection
              title="Modified"
              files={gitStatus.modified}
              icon="M"
              iconColor="text-yellow-600"
              stagedFiles={stagedFiles}
              onToggleStage={handleStageFile}
            />
          )}

          {/* Created Files */}
          {gitStatus && gitStatus.created.length > 0 && (
            <FileSection
              title="Created"
              files={gitStatus.created}
              icon="A"
              iconColor="text-green-600"
              stagedFiles={stagedFiles}
              onToggleStage={handleStageFile}
            />
          )}

          {/* Deleted Files */}
          {gitStatus && gitStatus.deleted.length > 0 && (
            <FileSection
              title="Deleted"
              files={gitStatus.deleted}
              icon="D"
              iconColor="text-red-600"
              stagedFiles={stagedFiles}
              onToggleStage={handleStageFile}
            />
          )}

          {/* No Changes */}
          {totalChanges === 0 && !loading && (
            <div className="p-8 text-center text-muted-foreground">
              <GitCommit className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No changes to commit</p>
              <p className="text-sm mt-1">Your working directory is clean</p>
            </div>
          )}
        </div>
      </div>

      {/* Commit Panel */}
      <div className="w-1/2 flex flex-col">
        <div className="p-4 border-b border-border bg-card">
          <h2 className="text-lg font-semibold">Commit Changes</h2>
        </div>

        <div className="flex-1 p-4 flex flex-col">
          {/* Commit Message Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Commit Message
            </label>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Enter commit message..."
              className="w-full h-32 px-3 py-2 border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: Use conventional commits (feat:, fix:, docs:, etc.)
            </p>
          </div>

          {/* Staged Files Preview */}
          {stagedFiles.length > 0 && (
            <div className="mb-4 flex-1 overflow-y-auto">
              <label className="block text-sm font-medium mb-2">
                Files to commit ({stagedFiles.length})
              </label>
              <div className="space-y-1 max-h-48 overflow-y-auto p-2 bg-muted rounded-md">
                {stagedFiles.map((file) => (
                  <div
                    key={file}
                    className="text-sm font-mono flex items-center gap-2"
                  >
                    <Check className="w-3 h-3 text-green-600" />
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commit Button */}
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || stagedFiles.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GitCommit className="w-4 h-4" />
            Commit to {currentProject.name}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FileSectionProps {
  title: string;
  files: string[];
  icon: string;
  iconColor: string;
  stagedFiles: string[];
  onToggleStage: (file: string) => void;
}

function FileSection({
  title,
  files,
  icon,
  iconColor,
  stagedFiles,
  onToggleStage,
}: FileSectionProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">
        {title} ({files.length})
      </h3>
      <div className="space-y-1">
        {files.map((file) => {
          const isStaged = stagedFiles.includes(file);
          
          return (
            <div
              key={file}
              onClick={() => onToggleStage(file)}
              className="flex items-center gap-3 p-2 hover:bg-accent rounded-md cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`text-xs font-bold ${iconColor} w-4 text-center`}>
                  {icon}
                </span>
                <span className="text-sm font-mono truncate">{file}</span>
              </div>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                isStaged
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground group-hover:border-primary'
              }`}>
                {isStaged && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
