/**
 * Report Generation Service
 * Creates comprehensive project reports from commit history and stories
 */
import { Project, Commit, Story, RepoInsights } from '../models';
export interface ReportOptions {
    includeCommitList: boolean;
    includeStories: boolean;
    includeInsights: boolean;
    includeFileChanges: boolean;
    dateRange?: {
        start: Date;
        end: Date;
    };
    format: 'markdown' | 'html' | 'json';
}
export interface ReportData {
    project: Project;
    commits: Commit[];
    stories: Story[];
    insights: RepoInsights | null;
    generatedAt: Date;
    options: ReportOptions;
}
declare const defaultOptions: ReportOptions;
/**
 * Generate a comprehensive project report
 */
export declare function generateReport(data: ReportData): string;
export { defaultOptions };
//# sourceMappingURL=reportService.d.ts.map