/**
 * Commit Grouping Engine
 * Groups commits into meaningful "Stories" based on:
 * 1. Commit prefix (feat, fix, docs, etc.)
 * 2. Time proximity
 * 3. File similarity
 */
import { Commit, Story, CommitGroup } from '../models';
interface GroupingOptions {
    timeWindowHours?: number;
    minFileSimilarity?: number;
    maxGroupSize?: number;
}
export declare class CommitGroupingEngine {
    private options;
    constructor(options?: GroupingOptions);
    /**
     * Group commits into stories
     */
    groupCommits(commits: Commit[]): CommitGroup[];
    /**
     * Group commits by conventional commit prefix
     */
    private groupByType;
    /**
     * Extract commit type from conventional commit message
     */
    private extractCommitType;
    /**
     * Group commits by time proximity and file similarity
     */
    private groupByTimeAndFiles;
    /**
     * Check if two commits are within the time window
     */
    private isWithinTimeWindow;
    /**
     * Calculate Jaccard similarity between two file sets
     */
    private calculateFileSimilarity;
    /**
     * Get set of file paths from a commit
     */
    private getFileSet;
    /**
     * Union of two file sets
     */
    private unionFileSets;
    /**
     * Create a CommitGroup object
     */
    private createGroup;
    /**
     * Convert CommitGroups to Stories (with AI-generated summaries)
     * Note: This creates the Story structure without AI content
     * Call AIService to populate the summary
     */
    createStoryFromGroup(group: CommitGroup, id: string, title: string): Story;
}
export declare const commitGroupingEngine: CommitGroupingEngine;
export {};
//# sourceMappingURL=commitGrouping.d.ts.map