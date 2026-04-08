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
    healthStatus: HealthStatus | null;
    setHealthStatus: (status: HealthStatus) => void;
    healthLoading: boolean;
    setHealthLoading: (loading: boolean) => void;
    codeReviewResults: CodeReviewResult[];
    setCodeReviewResults: (results: CodeReviewResult[]) => void;
    codeReviewLoading: boolean;
    setCodeReviewLoading: (loading: boolean) => void;
    gitSummary: GitSummary | null;
    setGitSummary: (summary: GitSummary) => void;
    gitLoading: boolean;
    setGitLoading: (loading: boolean) => void;
    error: string | null;
    setError: (error: string | null) => void;
    clearError: () => void;
}
export declare const useAppStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AppStore>>;
export {};
//# sourceMappingURL=appStore.d.ts.map