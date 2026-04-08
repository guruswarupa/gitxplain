import { HealthStatus, CodeReviewResult, GitSummary } from '@/store/appStore';
export declare const apiService: {
    getHealthStatus(): Promise<HealthStatus>;
    submitCodeReview(code: string, filePath: string): Promise<CodeReviewResult[]>;
    getGitSummary(repositoryPath: string): Promise<GitSummary>;
    checkApiHealth(): Promise<boolean>;
};
//# sourceMappingURL=api.d.ts.map