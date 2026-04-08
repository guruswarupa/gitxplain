/**
 * AI Provider Service
 * Abstraction layer for multiple AI providers (OpenAI, Groq, Gemini, Ollama, etc.)
 * Based on gitxplain CLI implementation
 */
import { AIAnalysisOptions, AIAnalysisResult, Commit } from '../models';
export interface AIProvider {
    name: string;
    generateAnalysis(diff: string, options: AIAnalysisOptions): Promise<string>;
    supportsStreaming: boolean;
}
export declare class AIService {
    private providers;
    private cache;
    constructor();
    analyzeCommit(commit: Commit, diff: string, options: AIAnalysisOptions): Promise<AIAnalysisResult>;
    analyzeCommitRange(commits: Commit[], options: AIAnalysisOptions): Promise<AIAnalysisResult>;
    generateNarrative(commits: Commit[], type: string): Promise<string>;
    private buildPrompt;
    private buildRangePrompt;
    private summarizeCommits;
    private extractCommitType;
    private generateCacheKey;
    private getProvider;
    registerProvider(name: string, provider: AIProvider): void;
    clearCache(): void;
}
export declare const aiService: AIService;
//# sourceMappingURL=aiService.d.ts.map