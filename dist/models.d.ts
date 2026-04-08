/**
 * Core data models for Commit Story Desktop
 * Based on specifications from planner.md
 */
export interface Project {
    id: string;
    name: string;
    path: string;
    lastSynced: number;
}
export interface Commit {
    hash: string;
    author: string;
    email: string;
    date: string;
    message: string;
    body?: string;
    files?: FileChange[];
}
export interface FileChange {
    path: string;
    additions: number;
    deletions: number;
    changes: number;
}
export type StoryType = 'fix' | 'feature' | 'docs' | 'refactor' | 'style' | 'test' | 'chore';
export interface Story {
    id: string;
    title: string;
    summary: string;
    commits: Commit[];
    type: StoryType;
    files: string[];
    timestamp: number;
}
export interface CommitGroup {
    type: StoryType;
    commits: Commit[];
    files: Set<string>;
    timeRange: {
        start: number;
        end: number;
    };
}
export interface GitStatus {
    modified: string[];
    created: string[];
    deleted: string[];
    renamed: string[];
    staged: string[];
    unstaged: string[];
    untracked: string[];
}
export interface CommitDetails {
    commit: Commit;
    diff: string;
    stats: {
        filesChanged: number;
        insertions: number;
        deletions: number;
    };
}
export interface RepoInsights {
    totalCommits: number;
    commitsPerDay: {
        date: string;
        count: number;
    }[];
    commitTypeDistribution: {
        type: StoryType;
        count: number;
    }[];
    activeFiles: {
        file: string;
        changes: number;
    }[];
    topAuthors: {
        author: string;
        commits: number;
    }[];
}
export interface AIAnalysisOptions {
    mode: 'summary' | 'full' | 'review' | 'security' | 'issues' | 'fix' | 'impact' | 'lines';
    provider?: 'openai' | 'groq' | 'openrouter' | 'gemini' | 'ollama' | 'chutes';
    model?: string;
    stream?: boolean;
}
export interface AIAnalysisResult {
    content: string;
    cached: boolean;
    tokensUsed?: number;
}
export interface Report {
    type: 'release-notes' | 'standup' | 'project-summary';
    title: string;
    content: string;
    generatedAt: number;
    commits?: Commit[];
    stories?: Story[];
}
export interface AppSettings {
    aiProvider: 'openai' | 'groq' | 'openrouter' | 'gemini' | 'ollama' | 'chutes';
    aiModel?: string;
    openaiApiKey?: string;
    groqApiKey?: string;
    openrouterApiKey?: string;
    geminiApiKey?: string;
    chutesApiKey?: string;
    ollamaBaseUrl?: string;
    maxCommits: number;
    cacheEnabled: boolean;
    streamEnabled: boolean;
    theme: 'light' | 'dark' | 'system';
}
//# sourceMappingURL=models.d.ts.map