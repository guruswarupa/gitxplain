import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import simpleGit from 'simple-git';
import Store from 'electron-store';
import { spawn } from 'child_process';

// Path to gitxplain CLI
const GITXPLAIN_CLI = path.join(__dirname, '../../gitxplain-main/gitxplain-main/cli/index.js');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../../out/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Initialize electron-store for persistent settings
const store = new Store() as any;

// IPC handlers
ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Folder selection for adding repositories
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Git Repository',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Get Git commit log
ipcMain.handle('git-log', async (event, repoPath, options = {}) => {
  try {
    const git = simpleGit(repoPath);
    const log = await git.log({
      maxCount: options.maxCount || 500,
      from: options.from,
      to: options.to,
    });
    
    return log.all.map(commit => ({
      hash: commit.hash,
      author: commit.author_name,
      email: commit.author_email,
      date: commit.date,
      message: commit.message,
      body: commit.body,
    }));
  } catch (error: any) {
    console.error('Git log error:', error);
    throw new Error(`Failed to get git log: ${error.message}`);
  }
});

// Get commit details with diff and stats
ipcMain.handle('git-details', async (event, { path: repoPath, hash }) => {
  try {
    const git = simpleGit(repoPath);
    
    // Get commit show with stats
    const show = await git.show([hash, '--stat', '--format=%H|%an|%ae|%aI|%s|%b']);
    
    // Get full diff
    const diff = await git.diff([`${hash}^`, hash]);
    
    // Parse file stats from show output
    const statsMatch = show.match(/(\d+) files? changed/);
    const insertionsMatch = show.match(/(\d+) insertions?/);
    const deletionsMatch = show.match(/(\d+) deletions?/);
    
    return {
      diff,
      stats: {
        filesChanged: statsMatch ? parseInt(statsMatch[1]) : 0,
        insertions: insertionsMatch ? parseInt(insertionsMatch[1]) : 0,
        deletions: deletionsMatch ? parseInt(deletionsMatch[1]) : 0,
      },
    };
  } catch (error: any) {
    console.error('Git details error:', error);
    throw new Error(`Failed to get commit details: ${error.message}`);
  }
});

// Get repository status
ipcMain.handle('git-status', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath);
    const status = await git.status();
    
    return {
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      renamed: status.renamed,
      staged: status.staged,
      files: status.files,
    };
  } catch (error: any) {
    console.error('Git status error:', error);
    throw new Error(`Failed to get git status: ${error.message}`);
  }
});

// Create commit
ipcMain.handle('git-commit', async (event, { path: repoPath, message, files }) => {
  try {
    const git = simpleGit(repoPath);
    
    // Stage files if provided
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      // Stage all changes if no specific files provided
      await git.add('.');
    }
    
    // Commit
    const result = await git.commit(message);
    return result.commit;
  } catch (error: any) {
    console.error('Git commit error:', error);
    throw new Error(`Failed to create commit: ${error.message}`);
  }
});

// Check if directory is a git repository
ipcMain.handle('git-is-repo', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath);
    const isRepo = await git.checkIsRepo();
    return isRepo;
  } catch (error) {
    return false;
  }
});

// Get current branch
ipcMain.handle('git-current-branch', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath);
    const branch = await git.branch();
    return branch.current;
  } catch (error: any) {
    console.error('Git branch error:', error);
    throw new Error(`Failed to get current branch: ${error.message}`);
  }
});

// Store operations for settings
ipcMain.handle('store-get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store-delete', (event, key) => {
  store.delete(key);
  return true;
});

// ============================================
// GITXPLAIN CLI INTEGRATION
// ============================================

interface GitxplainOptions {
  repoPath: string;
  commitRef: string;
  mode: 'summary' | 'full' | 'review' | 'security' | 'lines' | 'issues' | 'fix' | 'impact' | 'split';
  format?: 'plain' | 'json' | 'markdown' | 'html';
  provider?: string;
  model?: string;
  extraArgs?: string[];
  stdinText?: string;
}

// Helper to run gitxplain CLI as subprocess
function runGitxplain(options: GitxplainOptions): Promise<{ output: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const args = [
      GITXPLAIN_CLI,
      options.commitRef,
      `--${options.mode}`,
    ];
    
    // Add format flag
    if (options.format && options.format !== 'plain') {
      args.push(`--${options.format}`);
    }
    
    // Add provider/model overrides
    if (options.provider) {
      args.push('--provider', options.provider);
    }
    if (options.model) {
      args.push('--model', options.model);
    }
    if (options.extraArgs && options.extraArgs.length > 0) {
      args.push(...options.extraArgs);
    }
    
    // Get API keys from store
    const settings = store.get('settings') as any || {};
    const aiSettings = settings.ai || {};
    
    // Build environment with API keys - define all keys upfront for TypeScript
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      LLM_PROVIDER: options.provider || aiSettings.provider || 'openai',
      LLM_MODEL: aiSettings.model || undefined,
      OPENAI_API_KEY: aiSettings.openaiKey || undefined,
      GROQ_API_KEY: aiSettings.groqKey || undefined,
      OPENROUTER_API_KEY: aiSettings.openrouterKey || undefined,
      GEMINI_API_KEY: aiSettings.geminiKey || undefined,
      CHUTES_API_KEY: aiSettings.chutesKey || undefined,
      OLLAMA_BASE_URL: aiSettings.ollamaBaseUrl || undefined,
    };
    
    const proc = spawn('node', args, {
      cwd: options.repoPath,
      env,
      shell: true,
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (options.stdinText) {
      proc.stdin.write(options.stdinText);
      proc.stdin.end();
    }
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ output: stdout.trim() });
      } else {
        resolve({ output: stdout.trim(), error: stderr.trim() || 'Command failed' });
      }
    });
    
    proc.on('error', (err) => {
      reject(new Error(`Failed to run gitxplain: ${err.message}`));
    });
  });
}

function runGitxplainCommand(repoPath: string, args: string[]): Promise<{ output: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const settings = store.get('settings') as any || {};
    const aiSettings = settings.ai || {};

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      LLM_PROVIDER: aiSettings.provider || 'openai',
      LLM_MODEL: aiSettings.model || undefined,
      OPENAI_API_KEY: aiSettings.openaiKey || undefined,
      GROQ_API_KEY: aiSettings.groqKey || undefined,
      OPENROUTER_API_KEY: aiSettings.openrouterKey || undefined,
      GEMINI_API_KEY: aiSettings.geminiKey || undefined,
      CHUTES_API_KEY: aiSettings.chutesKey || undefined,
      OLLAMA_BASE_URL: aiSettings.ollamaBaseUrl || undefined,
    };

    const proc = spawn('node', [GITXPLAIN_CLI, ...args], {
      cwd: repoPath,
      env,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ output: stdout.trim() });
      } else {
        resolve({ output: stdout.trim(), error: stderr.trim() || 'Command failed' });
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run gitxplain command: ${err.message}`));
    });
  });
}

// Explain a commit (summary or full analysis)
ipcMain.handle('gitxplain-explain', async (event, { repoPath, commitRef, mode = 'full' }) => {
  try {
    const result = await runGitxplain({
      repoPath,
      commitRef,
      mode,
      format: 'markdown',
    });
    return result;
  } catch (error: any) {
    console.error('Gitxplain explain error:', error);
    throw new Error(`Failed to explain commit: ${error.message}`);
  }
});

// Get summary of a commit
ipcMain.handle('gitxplain-summary', async (event, { repoPath, commitRef }) => {
  try {
    const result = await runGitxplain({
      repoPath,
      commitRef,
      mode: 'summary',
      format: 'plain',
    });
    return result;
  } catch (error: any) {
    console.error('Gitxplain summary error:', error);
    throw new Error(`Failed to summarize commit: ${error.message}`);
  }
});

// Code review
ipcMain.handle('gitxplain-review', async (event, { repoPath, commitRef }) => {
  try {
    const result = await runGitxplain({
      repoPath,
      commitRef,
      mode: 'review',
      format: 'markdown',
    });
    return result;
  } catch (error: any) {
    console.error('Gitxplain review error:', error);
    throw new Error(`Failed to review commit: ${error.message}`);
  }
});

// Security analysis
ipcMain.handle('gitxplain-security', async (event, { repoPath, commitRef }) => {
  try {
    const result = await runGitxplain({
      repoPath,
      commitRef,
      mode: 'security',
      format: 'markdown',
    });
    return result;
  } catch (error: any) {
    console.error('Gitxplain security error:', error);
    throw new Error(`Failed to analyze security: ${error.message}`);
  }
});

// Line-by-line explanation
ipcMain.handle('gitxplain-lines', async (event, { repoPath, commitRef }) => {
  try {
    const result = await runGitxplain({
      repoPath,
      commitRef,
      mode: 'lines',
      format: 'markdown',
    });
    return result;
  } catch (error: any) {
    console.error('Gitxplain lines error:', error);
    throw new Error(`Failed to explain lines: ${error.message}`);
  }
});

// Branch/range analysis (for Stories)
ipcMain.handle('gitxplain-branch', async (event, { repoPath, baseRef, mode = 'full' }) => {
  try {
    // Use range format: baseRef..HEAD
    const commitRef = `${baseRef}..HEAD`;
    const result = await runGitxplain({
      repoPath,
      commitRef,
      mode,
      format: 'markdown',
    });
    return result;
  } catch (error: any) {
    console.error('Gitxplain branch error:', error);
    throw new Error(`Failed to analyze branch: ${error.message}`);
  }
});

// Install git hook for current repository
ipcMain.handle('gitxplain-install-hook', async (event, { repoPath, hookName = 'post-commit' }) => {
  try {
    const result = await runGitxplainCommand(repoPath, ['install-hook', hookName]);
    return result;
  } catch (error: any) {
    console.error('Gitxplain install-hook error:', error);
    throw new Error(`Failed to install hook: ${error.message}`);
  }
});

// Commit split preview
ipcMain.handle('gitxplain-split-preview', async (event, { repoPath, commitRef }) => {
  try {
    const result = await runGitxplain({
      repoPath,
      commitRef,
      mode: 'split',
      format: 'plain',
      extraArgs: ['--dry-run'],
    });
    return result;
  } catch (error: any) {
    console.error('Gitxplain split preview error:', error);
    throw new Error(`Failed to generate split preview: ${error.message}`);
  }
});

// Commit split execution with explicit confirmation
ipcMain.handle('gitxplain-split-execute', async (event, { repoPath, commitRef }) => {
  try {
    const result = await runGitxplain({
      repoPath,
      commitRef,
      mode: 'split',
      format: 'plain',
      extraArgs: ['--execute'],
      stdinText: 'yes\n',
    });
    return result;
  } catch (error: any) {
    console.error('Gitxplain split execute error:', error);
    throw new Error(`Failed to execute split: ${error.message}`);
  }
});
