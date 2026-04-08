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

interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export class AIService {
  private providers: Map<string, AIProvider>;
  private cache: Map<string, string>;

  constructor() {
    this.providers = new Map();
    this.cache = new Map();
  }

  async analyzeCommit(
    commit: Commit,
    diff: string,
    options: AIAnalysisOptions
  ): Promise<AIAnalysisResult> {
    const cacheKey = this.generateCacheKey(commit.hash, options.mode);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return {
        content: this.cache.get(cacheKey)!,
        cached: true,
      };
    }

    const prompt = this.buildPrompt(commit, diff, options.mode);
    const provider = this.getProvider(options.provider || 'openai');
    
    try {
      const content = await provider.generateAnalysis(prompt, options);
      this.cache.set(cacheKey, content);
      
      return {
        content,
        cached: false,
      };
    } catch (error) {
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeCommitRange(
    commits: Commit[],
    options: AIAnalysisOptions
  ): Promise<AIAnalysisResult> {
    const summary = this.summarizeCommits(commits);
    const provider = this.getProvider(options.provider || 'openai');
    
    const prompt = this.buildRangePrompt(commits, summary, options.mode);
    
    try {
      const content = await provider.generateAnalysis(prompt, options);
      
      return {
        content,
        cached: false,
      };
    } catch (error) {
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateNarrative(commits: Commit[], type: string): Promise<string> {
    const messages = commits.map(c => c.message).join('\n');
    const files = [...new Set(commits.flatMap(c => c.files?.map(f => f.path) || []))];
    
    const prompt = `
You are a senior developer creating a human-readable development narrative.

Given these commits:
${messages}

Files affected: ${files.join(', ')}
Type: ${type}

Generate a concise, narrative summary (2-3 sentences) that explains:
- What was accomplished
- Why it was needed
- What the impact is

Make it readable for non-technical stakeholders while being accurate.
`;

    const provider = this.getProvider('openai');
    return await provider.generateAnalysis(prompt, { mode: 'summary' });
  }

  private buildPrompt(commit: Commit, diff: string, mode: string): string {
    const baseContext = `
Commit: ${commit.hash}
Author: ${commit.author}
Date: ${commit.date}
Message: ${commit.message}
${commit.body ? `\nBody: ${commit.body}` : ''}

Diff:
${diff}
`;

    switch (mode) {
      case 'summary':
        return `${baseContext}\n\nProvide a one-sentence summary of what this commit does.`;
      
      case 'full':
        return `${baseContext}\n\nProvide a detailed explanation covering:
1. What changed (technical changes)
2. Why it changed (purpose/problem solved)
3. How it works (implementation approach)
4. Impact (effects on the codebase)`;
      
      case 'review':
        return `${baseContext}\n\nPerform a code review. Identify:
- Potential bugs or issues
- Code quality concerns
- Performance implications
- Security considerations
- Suggestions for improvement

Be constructive and specific.`;
      
      case 'security':
        return `${baseContext}\n\nAnalyze this commit from a security perspective:
- Authentication/Authorization changes
- Input validation issues
- Data exposure risks
- Injection vulnerabilities
- Cryptographic concerns
- Dependency security

Only report actual security concerns, not style issues.`;
      
      case 'issues':
        return `${baseContext}\n\nIdentify what bug or issue this commit addresses:
- What was broken
- Symptoms users experienced
- Root cause`;
      
      case 'fix':
        return `${baseContext}\n\nExplain how this fix works:
- What was the problem
- How the fix addresses it
- Why this approach was chosen

Use simple language suitable for junior developers.`;
      
      case 'impact':
        return `${baseContext}\n\nExplain the before vs after:
- Behavior before this change
- Behavior after this change
- Who/what is affected
- Any breaking changes`;
      
      case 'lines':
        return `${baseContext}\n\nProvide a file-by-file, line-by-line walkthrough:
- Purpose of each changed section
- Key logic changes
- Important dependencies
- Edge cases handled`;
      
      default:
        return `${baseContext}\n\nExplain this commit.`;
    }
  }

  private buildRangePrompt(commits: Commit[], summary: string, mode: string): string {
    const commitList = commits.map(c => `- ${c.hash.substring(0, 7)}: ${c.message}`).join('\n');
    
    return `
Analyze this series of commits:

${commitList}

Summary of changes:
${summary}

${mode === 'review' ? 'Provide a comprehensive code review of all changes.' :
  mode === 'security' ? 'Analyze security implications across all commits.' :
  'Provide a cohesive explanation of what was accomplished in this commit range.'}
`;
  }

  private summarizeCommits(commits: Commit[]): string {
    const types = new Map<string, number>();
    const files = new Set<string>();
    
    commits.forEach(commit => {
      const type = this.extractCommitType(commit.message);
      types.set(type, (types.get(type) || 0) + 1);
      commit.files?.forEach(f => files.add(f.path));
    });
    
    return `
Total commits: ${commits.length}
Types: ${Array.from(types.entries()).map(([t, c]) => `${t}(${c})`).join(', ')}
Files affected: ${files.size}
    `.trim();
  }

  private extractCommitType(message: string): string {
    const match = message.match(/^(feat|fix|docs|style|refactor|test|chore):/i);
    return match ? match[1].toLowerCase() : 'other';
  }

  private generateCacheKey(hash: string, mode: string): string {
    return `${hash}_${mode}`;
  }

  private getProvider(name: string): AIProvider {
    // For now, return a stub - will be implemented when packages are installed
    return {
      name,
      supportsStreaming: true,
      async generateAnalysis(prompt: string, options: AIAnalysisOptions): Promise<string> {
        throw new Error('AI providers not yet configured. Please install dependencies and configure API keys.');
      },
    };
  }

  registerProvider(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const aiService = new AIService();
