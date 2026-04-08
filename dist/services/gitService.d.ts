/**
 * Git Service
 * Wrapper around simple-git for Git operations
 * This service should only be used in the Electron main process for security
 */
import { Commit, GitStatus, CommitDetails } from '../models';
export interface GitLogOptions {
    maxCount?: number;
    from?: string;
    to?: string;
}
/**
 * GitService class - to be instantiated in main process
 */
export declare class GitService {
    private repoPath;
    private git;
    constructor(repoPath: string);
    /**
     * Get commit log
     */
    getLog(options?: GitLogOptions): Promise<Commit[]>;
    /**
     * Get detailed commit information including diff
     */
    getCommitDetails(hash: string): Promise<CommitDetails>;
    /**
     * Get repository status
     */
    getStatus(): Promise<GitStatus>;
    /**
     * Create a new commit
     */
    commit(message: string, files?: string[]): Promise<string>;
    /**
     * Get diff between two refs
     */
    getDiff(from: string, to?: string): Promise<string>;
    /**
     * Check if directory is a Git repository
     */
    isRepo(): Promise<boolean>;
    /**
     * Get current branch name
     */
    getCurrentBranch(): Promise<string>;
    /**
     * Parse file stats from git show output
     */
    private parseFileStats;
}
/**
 * Factory function to create GitService instance
 * Used in main process after verifying repo path
 */
export declare function createGitService(repoPath: string): GitService;
//# sourceMappingURL=gitService.d.ts.map