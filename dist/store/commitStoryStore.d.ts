/**
 * Commit Story Store
 * State management for commit history, stories, and insights
 */
import { Project, Commit, Story, RepoInsights, AppSettings } from '../models';
interface CommitStoryStore {
    projects: Project[];
    currentProject: Project | null;
    setCurrentProject: (project: Project | null) => void;
    addProject: (project: Project) => void;
    removeProject: (projectId: string) => void;
    commits: Commit[];
    setCommits: (commits: Commit[]) => void;
    selectedCommit: Commit | null;
    setSelectedCommit: (commit: Commit | null) => void;
    stories: Story[];
    setStories: (stories: Story[]) => void;
    selectedStory: Story | null;
    setSelectedStory: (story: Story | null) => void;
    storiesLoading: boolean;
    setStoriesLoading: (loading: boolean) => void;
    insights: RepoInsights | null;
    setInsights: (insights: RepoInsights | null) => void;
    insightsLoading: boolean;
    setInsightsLoading: (loading: boolean) => void;
    currentTab: 'changes' | 'history' | 'stories' | 'insights' | 'settings';
    setCurrentTab: (tab: 'changes' | 'history' | 'stories' | 'insights' | 'settings') => void;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
    commitsLoading: boolean;
    setCommitsLoading: (loading: boolean) => void;
    settings: AppSettings;
    updateSettings: (settings: Partial<AppSettings>) => void;
    error: string | null;
    setError: (error: string | null) => void;
    clearError: () => void;
}
export declare const useCommitStoryStore: import("zustand").UseBoundStore<import("zustand").StoreApi<CommitStoryStore>>;
export {};
//# sourceMappingURL=commitStoryStore.d.ts.map