# Quick Start Guide - Continue Implementation

This guide will help you complete the Commit Story Desktop implementation.

## Step 1: Install Dependencies ⚡ (Do this first!)

```bash
cd C:\Users\gudiy\Music\gitxplain-gui

# Install all required packages
pnpm add simple-git electron-store uuid @types/uuid diff marked html-to-text chart.js react-chartjs-2
```

## Step 2: View the Current Implementation 👀

Start the app to see what's already built:

```bash
pnpm dev
```

Then navigate to "Commit Story Desktop" in the top menu. You'll see:
- The sidebar (empty, needs IPC to add repos)
- The tab navigation (Changes, History, Stories, Insights)
- Empty states with instructions

## Step 3: Implement Electron IPC 🔌

### 3a. Update Main Process (`src/main/index.ts`)

Add these imports at the top:
```typescript
import simpleGit from 'simple-git';
import Store from 'electron-store';
import { dialog } from 'electron';
```

Add IPC handlers before `mainWindow` creation:

```typescript
// Folder selection
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Get Git log
ipcMain.handle('git-log', async (event, repoPath, options = {}) => {
  try {
    const git = simpleGit(repoPath);
    const log = await git.log({
      maxCount: options.maxCount || 500,
      from: options.from,
      to: options.to
    });
    
    return log.all.map(commit => ({
      hash: commit.hash,
      author: commit.author_name,
      email: commit.author_email,
      date: commit.date,
      message: commit.message,
      body: commit.body
    }));
  } catch (error) {
    console.error('Git log error:', error);
    throw error;
  }
});

// Get commit details
ipcMain.handle('git-details', async (event, { path, hash }) => {
  try {
    const git = simpleGit(path);
    const show = await git.show([hash, '--stat']);
    const diff = await git.diff([`${hash}^`, hash]);
    
    return {
      diff,
      stats: show
    };
  } catch (error) {
    console.error('Git details error:', error);
    throw error;
  }
});

// Get status
ipcMain.handle('git-status', async (event, path) => {
  try {
    const git = simpleGit(path);
    const status = await git.status();
    
    return {
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      renamed: status.renamed,
      staged: status.staged,
      files: status.files
    };
  } catch (error) {
    console.error('Git status error:', error);
    throw error;
  }
});

// Create commit
ipcMain.handle('git-commit', async (event, { path, message, files }) => {
  try {
    const git = simpleGit(path);
    
    // Stage files
    if (files && files.length > 0) {
      await git.add(files);
    }
    
    // Commit
    const result = await git.commit(message);
    return result.commit;
  } catch (error) {
    console.error('Git commit error:', error);
    throw error;
  }
});
```

### 3b. Update Preload (`src/main/preload.ts`)

Find the `contextBridge.exposeInMainWorld` call and add:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // Add these to existing API
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getLog: (path: string, options?: any) => ipcRenderer.invoke('git-log', path, options),
  getCommitDetails: (path: string, hash: string) => ipcRenderer.invoke('git-details', { path, hash }),
  getStatus: (path: string) => ipcRenderer.invoke('git-status', path),
  commit: (path: string, message: string, files?: string[]) => 
    ipcRenderer.invoke('git-commit', { path, message, files }),
});
```

### 3c. Add TypeScript Declarations

Create `src/electron.d.ts`:

```typescript
export interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  getLog: (path: string, options?: any) => Promise<any[]>;
  getCommitDetails: (path: string, hash: string) => Promise<any>;
  getStatus: (path: string) => Promise<any>;
  commit: (path: string, message: string, files?: string[]) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

## Step 4: Wire Up Project Sidebar 📁

Update `src/components/ProjectSidebar.tsx`, replace the `handleAddProject` function:

```typescript
const handleAddProject = async () => {
  try {
    const path = await window.electronAPI.selectFolder();
    if (!path) return;
    
    const project: Project = {
      id: crypto.randomUUID(),
      name: path.split(/[/\\]/).pop() || 'Unknown',
      path,
      lastSynced: Date.now(),
    };
    
    addProject(project);
    setCurrentProject(project);
    
    // Load commits
    loadCommits(project);
  } catch (error) {
    console.error('Failed to add project:', error);
    setError('Failed to add repository');
  }
};
```

Add this helper function at the bottom:

```typescript
async function loadCommits(project: Project) {
  const { setCommits, setCommitsLoading, setError } = useCommitStoryStore.getState();
  
  setCommitsLoading(true);
  try {
    const commits = await window.electronAPI.getLog(project.path, { maxCount: 500 });
    setCommits(commits);
  } catch (error) {
    console.error('Failed to load commits:', error);
    setError('Failed to load commits');
  } finally {
    setCommitsLoading(false);
  }
}
```

## Step 5: Wire Up History View 🔍

In `src/pages/HistoryView.tsx`, update the AI button handlers:

```typescript
const handleExplain = async () => {
  if (!selectedCommit || !currentProject) return;
  
  setAiLoading(true);
  try {
    const details = await window.electronAPI.getCommitDetails(
      currentProject.path,
      selectedCommit.hash
    );
    
    // For now, just show the diff (AI integration comes next)
    setAiExplanation(details.diff);
  } catch (error) {
    console.error('Failed to get commit details:', error);
    setAiExplanation('Failed to load commit details.');
  } finally {
    setAiLoading(false);
  }
};
```

## Step 6: Test the Basic Flow ✅

1. Start the app: `pnpm dev`
2. Go to "Commit Story Desktop"
3. Click "+" in sidebar
4. Select a Git repository
5. You should see commits load in the History tab!

## Step 7: Add AI Integration (Optional but Recommended) 🤖

Create `src/services/aiProviders/openaiProvider.ts`:

```typescript
import { AIProvider, AIAnalysisOptions } from '../aiService';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  supportsStreaming = true;
  
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  
  constructor(apiKey: string, model = 'gpt-4', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }
  
  async generateAnalysis(prompt: string, options: AIAnalysisOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: options.model || this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

Register it in `src/services/aiService.ts`:

```typescript
import { OpenAIProvider } from './aiProviders/openaiProvider';

// Add to AIService constructor:
constructor() {
  this.providers = new Map();
  this.cache = new Map();
  
  // Register OpenAI provider if API key exists
  const apiKey = process.env.OPENAI_API_KEY || localStorage.getItem('openai_api_key');
  if (apiKey) {
    this.registerProvider('openai', new OpenAIProvider(apiKey));
  }
}
```

## Step 8: Enable Story Generation 📖

In `src/pages/StoriesView.tsx`, update `handleGenerateStories`:

```typescript
import { commitGroupingEngine } from '../services/commitGrouping';
import { aiService } from '../services/aiService';

const handleGenerateStories = async () => {
  setStoriesLoading(true);
  try {
    // 1. Group commits
    const groups = commitGroupingEngine.groupCommits(commits);
    
    // 2. Generate narratives
    const newStories = await Promise.all(
      groups.map(async (group, index) => {
        const title = generateTitleFromGroup(group);
        const summary = await aiService.generateNarrative(group.commits, group.type);
        
        return {
          id: `story-${Date.now()}-${index}`,
          title,
          summary,
          commits: group.commits,
          type: group.type,
          files: Array.from(group.files),
          timestamp: group.timeRange.end
        };
      })
    );
    
    setStories(newStories);
  } catch (error) {
    console.error('Failed to generate stories:', error);
    alert('Failed to generate stories: ' + error.message);
  } finally {
    setStoriesLoading(false);
  }
};

function generateTitleFromGroup(group: CommitGroup): string {
  const firstMessage = group.commits[0]?.message || 'Changes';
  const cleaned = firstMessage.replace(/^(feat|fix|docs|style|refactor|test|chore):\s*/i, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(0, 50);
}
```

## Troubleshooting 🔧

### "Cannot find module 'simple-git'"
→ Run: `pnpm add simple-git`

### "window.electronAPI is undefined"
→ Check that preload.ts is properly configured in main process
→ Make sure contextIsolation is enabled

### Commits not loading
→ Check console for errors
→ Verify the path is a valid Git repository
→ Try with a different repository

### AI not working
→ Check API key is set
→ Verify network connection
→ Check console for API errors

## What's Next? 🚀

After these steps, you'll have:
- ✅ Working repository selection
- ✅ Commit history display
- ✅ Commit details view
- ✅ AI explanations (if configured)
- ✅ Story generation
- ✅ Basic insights

Then you can:
- Add more AI providers
- Implement report generation
- Add search functionality
- Create settings page
- Polish the UI
- Add tests

## Need Help?

Check:
- IMPLEMENTATION.md - Detailed status
- SUMMARY.md - Overview
- Console logs - Error messages
- Electron DevTools - F12 in the app

Happy coding! 🎉
