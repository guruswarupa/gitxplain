/**
 * TypeScript declarations for Electron API
 */

export interface GitLogOptions {
  maxCount?: number;
  from?: string;
  to?: string;
}

export interface GitCommitDetails {
  diff: string;
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

export interface GitStatusResult {
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: string[];
  staged: string[];
  files: any[];
}

export interface GitxplainResult {
  output: string;
  error?: string;
}

export interface ElectronAPI {
  // Folder selection
  selectFolder: () => Promise<string | null>;
  
  // Git operations
  getLog: (path: string, options?: GitLogOptions) => Promise<any[]>;
  getCommitDetails: (path: string, hash: string) => Promise<GitCommitDetails>;
  getStatus: (path: string) => Promise<GitStatusResult>;
  commit: (path: string, message: string, files?: string[]) => Promise<string>;
  isRepo: (path: string) => Promise<boolean>;
  getCurrentBranch: (path: string) => Promise<string>;
  
  // Store operations
  storeGet: (key: string) => Promise<any>;
  storeSet: (key: string, value: any) => Promise<boolean>;
  storeDelete: (key: string) => Promise<boolean>;
  
  // Gitxplain AI operations
  gitxplainExplain: (repoPath: string, commitRef: string, mode?: string) => Promise<GitxplainResult>;
  gitxplainSummary: (repoPath: string, commitRef: string) => Promise<GitxplainResult>;
  gitxplainReview: (repoPath: string, commitRef: string) => Promise<GitxplainResult>;
  gitxplainSecurity: (repoPath: string, commitRef: string) => Promise<GitxplainResult>;
  gitxplainLines: (repoPath: string, commitRef: string) => Promise<GitxplainResult>;
  gitxplainBranch: (repoPath: string, baseRef: string, mode?: string) => Promise<GitxplainResult>;
  gitxplainInstallHook: (repoPath: string, hookName?: string) => Promise<GitxplainResult>;
  gitxplainSplitPreview: (repoPath: string, commitRef: string) => Promise<GitxplainResult>;
  gitxplainSplitExecute: (repoPath: string, commitRef: string) => Promise<GitxplainResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: {
      getAppPath: () => Promise<string>;
      getAppVersion: () => Promise<string>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      once: (channel: string, callback: (...args: any[]) => void) => void;
      send: (channel: string, ...args: any[]) => void;
    };
  }
}

export {};
