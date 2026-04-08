/**
 * Commit Grouping Engine
 * Groups commits into meaningful "Stories" based on:
 * 1. Commit prefix (feat, fix, docs, etc.)
 * 2. Time proximity
 * 3. File similarity
 */

import { Commit, Story, StoryType, CommitGroup } from '../models';

interface GroupingOptions {
  timeWindowHours?: number; // Default: 24 hours
  minFileSimilarity?: number; // 0-1, Default: 0.3 (30% file overlap)
  maxGroupSize?: number; // Default: 10 commits per group
}

export class CommitGroupingEngine {
  private options: Required<GroupingOptions>;

  constructor(options: GroupingOptions = {}) {
    this.options = {
      timeWindowHours: options.timeWindowHours || 24,
      minFileSimilarity: options.minFileSimilarity || 0.3,
      maxGroupSize: options.maxGroupSize || 10,
    };
  }

  /**
   * Group commits into stories
   */
  groupCommits(commits: Commit[]): CommitGroup[] {
    if (commits.length === 0) return [];

    // First, group by commit type prefix
    const typeGroups = this.groupByType(commits);

    // Then, within each type, group by time and file similarity
    const finalGroups: CommitGroup[] = [];

    for (const [type, typeCommits] of typeGroups) {
      const timeAndFileGroups = this.groupByTimeAndFiles(typeCommits, type);
      finalGroups.push(...timeAndFileGroups);
    }

    return finalGroups;
  }

  /**
   * Group commits by conventional commit prefix
   */
  private groupByType(commits: Commit[]): Map<StoryType, Commit[]> {
    const groups = new Map<StoryType, Commit[]>();

    for (const commit of commits) {
      const type = this.extractCommitType(commit.message);
      const existing = groups.get(type) || [];
      existing.push(commit);
      groups.set(type, existing);
    }

    return groups;
  }

  /**
   * Extract commit type from conventional commit message
   */
  private extractCommitType(message: string): StoryType {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.startsWith('feat:') || lowerMessage.startsWith('feature:')) {
      return 'feature';
    }
    if (lowerMessage.startsWith('fix:')) {
      return 'fix';
    }
    if (lowerMessage.startsWith('docs:')) {
      return 'docs';
    }
    if (lowerMessage.startsWith('refactor:')) {
      return 'refactor';
    }
    if (lowerMessage.startsWith('style:')) {
      return 'style';
    }
    if (lowerMessage.startsWith('test:')) {
      return 'test';
    }
    if (lowerMessage.startsWith('chore:')) {
      return 'chore';
    }

    // Fallback: try to infer from message content
    if (lowerMessage.includes('bug') || lowerMessage.includes('fix')) {
      return 'fix';
    }
    if (lowerMessage.includes('add') || lowerMessage.includes('implement')) {
      return 'feature';
    }
    if (lowerMessage.includes('test')) {
      return 'test';
    }
    if (lowerMessage.includes('refactor')) {
      return 'refactor';
    }
    if (lowerMessage.includes('doc')) {
      return 'docs';
    }

    return 'chore'; // default
  }

  /**
   * Group commits by time proximity and file similarity
   */
  private groupByTimeAndFiles(commits: Commit[], type: StoryType): CommitGroup[] {
    if (commits.length === 0) return [];

    // Sort by date descending (newest first)
    const sorted = [...commits].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const groups: CommitGroup[] = [];
    let currentGroup: Commit[] = [sorted[0]];
    let currentFiles = this.getFileSet(sorted[0]);

    for (let i = 1; i < sorted.length; i++) {
      const commit = sorted[i];
      const commitFiles = this.getFileSet(commit);

      const withinTimeWindow = this.isWithinTimeWindow(
        currentGroup[0],
        commit
      );
      const hasSimilarFiles = this.calculateFileSimilarity(
        currentFiles,
        commitFiles
      ) >= this.options.minFileSimilarity;

      const shouldGroup = 
        withinTimeWindow && 
        hasSimilarFiles && 
        currentGroup.length < this.options.maxGroupSize;

      if (shouldGroup) {
        currentGroup.push(commit);
        currentFiles = this.unionFileSets(currentFiles, commitFiles);
      } else {
        // Finalize current group
        groups.push(this.createGroup(currentGroup, type, currentFiles));
        
        // Start new group
        currentGroup = [commit];
        currentFiles = commitFiles;
      }
    }

    // Don't forget the last group
    if (currentGroup.length > 0) {
      groups.push(this.createGroup(currentGroup, type, currentFiles));
    }

    return groups;
  }

  /**
   * Check if two commits are within the time window
   */
  private isWithinTimeWindow(commit1: Commit, commit2: Commit): boolean {
    const time1 = new Date(commit1.date).getTime();
    const time2 = new Date(commit2.date).getTime();
    const diffHours = Math.abs(time1 - time2) / (1000 * 60 * 60);
    return diffHours <= this.options.timeWindowHours;
  }

  /**
   * Calculate Jaccard similarity between two file sets
   */
  private calculateFileSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 && set2.size === 0) return 1;
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Get set of file paths from a commit
   */
  private getFileSet(commit: Commit): Set<string> {
    return new Set(commit.files?.map(f => f.path) || []);
  }

  /**
   * Union of two file sets
   */
  private unionFileSets(set1: Set<string>, set2: Set<string>): Set<string> {
    return new Set([...set1, ...set2]);
  }

  /**
   * Create a CommitGroup object
   */
  private createGroup(
    commits: Commit[],
    type: StoryType,
    files: Set<string>
  ): CommitGroup {
    const dates = commits.map(c => new Date(c.date).getTime());
    
    return {
      type,
      commits,
      files,
      timeRange: {
        start: Math.min(...dates),
        end: Math.max(...dates),
      },
    };
  }

  /**
   * Convert CommitGroups to Stories (with AI-generated summaries)
   * Note: This creates the Story structure without AI content
   * Call AIService to populate the summary
   */
  createStoryFromGroup(group: CommitGroup, id: string, title: string): Story {
    return {
      id,
      title,
      summary: '', // To be filled by AI
      commits: group.commits,
      type: group.type,
      files: Array.from(group.files),
      timestamp: group.timeRange.end,
    };
  }
}

export const commitGroupingEngine = new CommitGroupingEngine();
