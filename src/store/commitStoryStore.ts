/**
 * Commit Story Store
 * State management for commit history, stories, and insights
 */

import { create } from 'zustand';
import { Project, Commit, Story, RepoInsights, AppSettings } from '../models';

interface CommitStoryStore {
  // Projects
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  
  // Commits
  commits: Commit[];
  setCommits: (commits: Commit[]) => void;
  selectedCommit: Commit | null;
  setSelectedCommit: (commit: Commit | null) => void;
  
  // Stories
  stories: Story[];
  setStories: (stories: Story[]) => void;
  selectedStory: Story | null;
  setSelectedStory: (story: Story | null) => void;
  storiesLoading: boolean;
  setStoriesLoading: (loading: boolean) => void;
  
  // Insights
  insights: RepoInsights | null;
  setInsights: (insights: RepoInsights | null) => void;
  insightsLoading: boolean;
  setInsightsLoading: (loading: boolean) => void;
  
  // UI State
  currentTab: 'changes' | 'history' | 'stories' | 'insights' | 'settings';
  setCurrentTab: (tab: 'changes' | 'history' | 'stories' | 'insights' | 'settings') => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Loading states
  commitsLoading: boolean;
  setCommitsLoading: (loading: boolean) => void;
  
  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  
  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const defaultSettings: AppSettings = {
  aiProvider: 'openai',
  maxCommits: 500,
  cacheEnabled: true,
  streamEnabled: true,
  theme: 'system',
};

export const useCommitStoryStore = create<CommitStoryStore>((set) => ({
  // Projects
  projects: [],
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),
  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
    })),
  removeProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      currentProject:
        state.currentProject?.id === projectId ? null : state.currentProject,
    })),
  
  // Commits
  commits: [],
  setCommits: (commits) => set({ commits }),
  selectedCommit: null,
  setSelectedCommit: (commit) => set({ selectedCommit: commit }),
  
  // Stories
  stories: [],
  setStories: (stories) => set({ stories }),
  selectedStory: null,
  setSelectedStory: (story) => set({ selectedStory: story }),
  storiesLoading: false,
  setStoriesLoading: (loading) => set({ storiesLoading: loading }),
  
  // Insights
  insights: null,
  setInsights: (insights) => set({ insights }),
  insightsLoading: false,
  setInsightsLoading: (loading) => set({ insightsLoading: loading }),
  
  // UI State
  currentTab: 'history',
  setCurrentTab: (tab) => set({ currentTab: tab }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  // Loading states
  commitsLoading: false,
  setCommitsLoading: (loading) => set({ commitsLoading: loading }),
  
  // Settings
  settings: defaultSettings,
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
  
  // Error handling
  error: null,
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
