/**
 * Git Service
 * Wrapper around simple-git for Git operations
 * This service should only be used in the Electron main process for security
 */

import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import { Commit, FileChange, GitStatus, CommitDetails } from '../models';

export interface GitLogOptions {
  maxCount?: number;
  from?: string;
  to?: string;
}

/**
 * GitService class - to be instantiated in main process
 */
export class GitService {
  private repoPath: string;
  private git: SimpleGit;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Get commit log
   */
  async getLog(options: GitLogOptions = {}): Promise<Commit[]> {
    try {
      const log: LogResult = await this.git.log({
        maxCount: options.maxCount || 500,
        from: options.from,
        to: options.to,
      });

      return log.all.map(item => ({
        hash: item.hash,
        author: item.author_name,
        email: item.author_email,
        date: item.date,
        message: item.message,
        body: item.body,
      }));
    } catch (error: any) {
      throw new Error(`Failed to get log: ${error.message}`);
    }
  }

  /**
   * Get detailed commit information including diff
   */
  async getCommitDetails(hash: string): Promise<CommitDetails> {
    try {
      // Get commit info
      const log = await this.git.log([hash, '-1']);
      const commit = log.latest;

      if (!commit) {
        throw new Error('Commit not found');
      }

      // Get diff
      const diff = await this.git.diff([`${hash}^`, hash]);

      // Get file stats
      const showOutput = await this.git.show([hash, '--stat', '--format=']);
      const files = this.parseFileStats(showOutput);

      // Calculate stats
      const stats = {
        filesChanged: files.length,
        insertions: files.reduce((sum, f) => sum + f.additions, 0),
        deletions: files.reduce((sum, f) => sum + f.deletions, 0),
      };

      return {
        commit: {
          hash: commit.hash,
          author: commit.author_name,
          email: commit.author_email,
          date: commit.date,
          message: commit.message,
          body: commit.body,
          files,
        },
        diff,
        stats,
      };
    } catch (error: any) {
      throw new Error(`Failed to get commit details: ${error.message}`);
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<GitStatus> {
    try {
      const status = await this.git.status();

      // Renamed files are objects with 'from' and 'to' properties
      // We'll just use the 'to' (new name) for simplicity
      const renamedFiles = status.renamed.map((r: any) => 
        typeof r === 'string' ? r : r.to || r.from
      );

      return {
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        renamed: renamedFiles,
        staged: status.staged,
        unstaged: [...status.modified, ...status.created, ...status.deleted],
        untracked: status.not_added,
      };
    } catch (error: any) {
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  /**
   * Create a new commit
   */
  async commit(message: string, files?: string[]): Promise<string> {
    try {
      // Stage files
      if (files && files.length > 0) {
        await this.git.add(files);
      } else {
        await this.git.add('.');
      }

      // Commit
      const result = await this.git.commit(message);
      return result.commit;
    } catch (error: any) {
      throw new Error(`Failed to commit: ${error.message}`);
    }
  }

  /**
   * Get diff between two refs
   */
  async getDiff(from: string, to?: string): Promise<string> {
    try {
      if (to) {
        return await this.git.diff([from, to]);
      } else {
        return await this.git.diff([from]);
      }
    } catch (error: any) {
      throw new Error(`Failed to get diff: ${error.message}`);
    }
  }

  /**
   * Check if directory is a Git repository
   */
  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.branch();
      return branch.current;
    } catch (error: any) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
  }

  /**
   * Parse file stats from git show output
   */
  private parseFileStats(stats: string): FileChange[] {
    const files: FileChange[] = [];
    const lines = stats.split('\n');

    for (const line of lines) {
      // Match format like: "path/to/file.ts | 10 +++++-----"
      const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s+([+\-]+)\s*$/);
      if (match) {
        const [, path, changesStr, symbols] = match;
        const additions = (symbols.match(/\+/g) || []).length;
        const deletions = (symbols.match(/-/g) || []).length;

        files.push({
          path: path.trim(),
          additions,
          deletions,
          changes: parseInt(changesStr, 10),
        });
      }
    }

    return files;
  }
}

/**
 * Factory function to create GitService instance
 * Used in main process after verifying repo path
 */
export function createGitService(repoPath: string): GitService {
  return new GitService(repoPath);
}
