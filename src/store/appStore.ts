import { create } from 'zustand';

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  systemLoad: number;
  memoryUsage: number;
  diskUsage: number;
  pythonVersion: string;
  nodeVersion: string;
  timestamp: string;
}

export interface CodeReviewResult {
  file: string;
  issues: Array<{
    line: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }>;
  summary: string;
}

export interface GitSummary {
  repositoryPath: string;
  branch: string;
  totalCommits: number;
  recentCommits: Array<{
    hash: string;
    author: string;
    message: string;
    date: string;
  }>;
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

interface AppStore {
  // Health Check
  healthStatus: HealthStatus | null;
  setHealthStatus: (status: HealthStatus) => void;
  healthLoading: boolean;
  setHealthLoading: (loading: boolean) => void;

  // Code Review
  codeReviewResults: CodeReviewResult[];
  setCodeReviewResults: (results: CodeReviewResult[]) => void;
  codeReviewLoading: boolean;
  setCodeReviewLoading: (loading: boolean) => void;

  // Git Summary
  gitSummary: GitSummary | null;
  setGitSummary: (summary: GitSummary) => void;
  gitLoading: boolean;
  setGitLoading: (loading: boolean) => void;

  // Errors
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Health Check
  healthStatus: null,
  setHealthStatus: (status) => set({ healthStatus: status }),
  healthLoading: false,
  setHealthLoading: (loading) => set({ healthLoading: loading }),

  // Code Review
  codeReviewResults: [],
  setCodeReviewResults: (results) => set({ codeReviewResults: results }),
  codeReviewLoading: false,
  setCodeReviewLoading: (loading) => set({ codeReviewLoading: loading }),

  // Git Summary
  gitSummary: null,
  setGitSummary: (summary) => set({ gitSummary: summary }),
  gitLoading: false,
  setGitLoading: (loading) => set({ gitLoading: loading }),

  // Errors
  error: null,
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
