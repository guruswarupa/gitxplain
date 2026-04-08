/**
 * Project Sidebar Component
 * Lists and manages Git repositories
 */

import React, { useEffect, useState } from 'react';
import { FolderGit2, Plus, Trash2, Github, Loader2, Download } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';
import { Project } from '../models';
import { generateUUID } from '../utils';

interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  cloneUrl: string;
  htmlUrl: string;
  defaultBranch: string;
}

export default function ProjectSidebar() {
  const {
    projects,
    currentProject,
    setCurrentProject,
    addProject,
    removeProject,
    sidebarCollapsed,
    setCommits,
    setCommitsLoading,
    setError,
  } = useCommitStoryStore();

  const [githubRepos, setGithubRepos] = useState<GitHubRepoItem[]>([]);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubExpanded, setGithubExpanded] = useState(false);
  const [importingRepoId, setImportingRepoId] = useState<number | null>(null);

  // Load saved projects on mount
  useEffect(() => {
    loadSavedProjects();
  }, []);

  const loadSavedProjects = async () => {
    try {
      const saved = await window.electronAPI.storeGet('projects');
      if (saved && Array.isArray(saved)) {
        saved.forEach(project => addProject(project));
      }
    } catch (error) {
      console.error('Failed to load saved projects:', error);
    }
  };

  const saveProjects = async (updatedProjects: Project[]) => {
    try {
      await window.electronAPI.storeSet('projects', updatedProjects);
    } catch (error) {
      console.error('Failed to save projects:', error);
    }
  };

  const handleAddProject = async () => {
    try {
      const path = await window.electronAPI.selectFolder();
      if (!path) return;

      // Check if it's a git repository
      const isRepo = await window.electronAPI.isRepo(path);
      if (!isRepo) {
        setError('Selected folder is not a Git repository');
        return;
      }

      // Check if already added
      if (projects.some(p => p.path === path)) {
        setError('Repository already added');
        return;
      }

      const project: Project = {
        id: generateUUID(),
        name: path.split(/[/\\]/).pop() || 'Unknown',
        path,
        lastSynced: Date.now(),
      };

      addProject(project);
      setCurrentProject(project);
      
      // Save to electron-store
      const updatedProjects = [...projects, project];
      await saveProjects(updatedProjects);

      // Load commits
      await loadCommits(project);
    } catch (error: any) {
      console.error('Failed to add project:', error);
      setError(error.message || 'Failed to add repository');
    }
  };

  const loadCommits = async (project: Project) => {
    setCommitsLoading(true);
    try {
      const commits = await window.electronAPI.getLog(project.path, { maxCount: 500 });
      
      // Add file information to each commit (will be loaded on-demand)
      setCommits(commits);
      
      // Update last synced
      project.lastSynced = Date.now();
      await saveProjects(projects.map(p => p.id === project.id ? project : p));
    } catch (error: any) {
      console.error('Failed to load commits:', error);
      setError(error.message || 'Failed to load commits');
    } finally {
      setCommitsLoading(false);
    }
  };

  const handleProjectClick = (project: Project) => {
    setCurrentProject(project);
    if (currentProject?.id !== project.id) {
      loadCommits(project);
    }
  };

  const getGitHubToken = async (): Promise<string> => {
    const appSettings = await window.electronAPI.storeGet('settings');
    return String(appSettings?.integrations?.githubToken || '').trim();
  };

  const loadGitHubRepos = async () => {
    setGithubLoading(true);
    try {
      const token = await getGitHubToken();
      if (!token) {
        setError('Add your GitHub token in Settings first.');
        setGithubExpanded(true);
        return;
      }

      const repos = await window.electronAPI.githubListRepos(token);
      setGithubRepos(repos);
      setGithubExpanded(true);
    } catch (error: any) {
      console.error('Failed to load GitHub repositories:', error);
      setError(error.message || 'Failed to load GitHub repositories');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleImportGitHubRepo = async (repo: GitHubRepoItem) => {
    setImportingRepoId(repo.id);
    try {
      const token = await getGitHubToken();
      if (!token) {
        setError('Add your GitHub token in Settings first.');
        return;
      }

      const localPath = await window.electronAPI.githubCloneRepo(repo.cloneUrl, repo.fullName, token);

      if (projects.some(p => p.path === localPath)) {
        const existingProject = projects.find(p => p.path === localPath) || null;
        if (existingProject) {
          setCurrentProject(existingProject);
          await loadCommits(existingProject);
        }
        return;
      }

      const project: Project = {
        id: generateUUID(),
        name: repo.fullName,
        path: localPath,
        lastSynced: Date.now(),
      };

      addProject(project);
      setCurrentProject(project);

      const updatedProjects = [...projects, project];
      await saveProjects(updatedProjects);
      await loadCommits(project);
    } catch (error: any) {
      console.error('Failed to import GitHub repository:', error);
      setError(error.message || 'Failed to import GitHub repository');
    } finally {
      setImportingRepoId(null);
    }
  };

  const handleRemoveProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('Remove this project from the list?')) {
      removeProject(projectId);
      const updatedProjects = projects.filter(p => p.id !== projectId);
      await saveProjects(updatedProjects);
    }
  };

  if (sidebarCollapsed) {
    return (
      <div className="w-12 bg-card border-r border-border flex flex-col items-center py-4">
        <button
          onClick={handleAddProject}
          className="p-2 hover:bg-accent rounded-md transition-colors"
          title="Add Project"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={loadGitHubRepos}
          className="p-2 hover:bg-accent rounded-md transition-colors mt-2"
          title="Import GitHub Repository"
        >
          {githubLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Github className="w-5 h-5" />}
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Repositories</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={loadGitHubRepos}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title="Import from GitHub"
            >
              {githubLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
            </button>
            <button
              onClick={handleAddProject}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title="Add Local Repository"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {githubExpanded && (
          <div className="rounded-md border border-border bg-muted/40 p-2">
            <div className="text-xs font-medium mb-2 text-muted-foreground">GitHub Repositories</div>
            <div className="max-h-44 overflow-y-auto space-y-1">
              {githubRepos.length === 0 && !githubLoading ? (
                <p className="text-xs text-muted-foreground">No repositories loaded yet.</p>
              ) : (
                githubRepos.map((repo) => (
                  <div key={repo.id} className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-accent/50">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{repo.fullName}</p>
                      <p className="text-[10px] text-muted-foreground">{repo.private ? 'Private' : 'Public'} · {repo.defaultBranch}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleImportGitHubRepo(repo)}
                      disabled={importingRepoId === repo.id}
                      className="px-2 py-1 text-[10px] rounded border border-border hover:bg-accent disabled:opacity-50"
                    >
                      {importingRepoId === repo.id ? 'Importing...' : (
                        <span className="inline-flex items-center gap-1">
                          <Download className="w-3 h-3" /> Import
                        </span>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <FolderGit2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No repositories added</p>
            <p className="text-xs mt-1">Click + to add a repository</p>
          </div>
        ) : (
          <div className="py-2">
            {projects.map((project) => {
              const isActive = currentProject?.id === project.id;
              
              return (
                <div
                  key={project.id}
                  onClick={() => handleProjectClick(project)}
                  className={`group mx-2 mb-1 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FolderGit2 className="w-4 h-4 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {project.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {project.path}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleRemoveProject(e, project.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {currentProject && (
        <div className="p-3 border-t border-border bg-muted/50">
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">{currentProject.name}</div>
            <div className="truncate">
              Last synced: {new Date(currentProject.lastSynced).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
