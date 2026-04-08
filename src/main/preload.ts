import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  once: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  },
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },
});

// Expose Git and Store APIs
contextBridge.exposeInMainWorld('electronAPI', {
  // Folder selection
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // Git operations
  getLog: (path: string, options?: any) => ipcRenderer.invoke('git-log', path, options),
  getCommitDetails: (path: string, hash: string) => ipcRenderer.invoke('git-details', { path, hash }),
  getStatus: (path: string) => ipcRenderer.invoke('git-status', path),
  commit: (path: string, message: string, files?: string[]) => 
    ipcRenderer.invoke('git-commit', { path, message, files }),
  isRepo: (path: string) => ipcRenderer.invoke('git-is-repo', path),
  getCurrentBranch: (path: string) => ipcRenderer.invoke('git-current-branch', path),
  
  // Store operations
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store-delete', key),
  
  // Gitxplain AI operations
  gitxplainExplain: (repoPath: string, commitRef: string, mode?: string) => 
    ipcRenderer.invoke('gitxplain-explain', { repoPath, commitRef, mode }),
  gitxplainSummary: (repoPath: string, commitRef: string) => 
    ipcRenderer.invoke('gitxplain-summary', { repoPath, commitRef }),
  gitxplainReview: (repoPath: string, commitRef: string) => 
    ipcRenderer.invoke('gitxplain-review', { repoPath, commitRef }),
  gitxplainSecurity: (repoPath: string, commitRef: string) => 
    ipcRenderer.invoke('gitxplain-security', { repoPath, commitRef }),
  gitxplainLines: (repoPath: string, commitRef: string) => 
    ipcRenderer.invoke('gitxplain-lines', { repoPath, commitRef }),
  gitxplainBranch: (repoPath: string, baseRef: string, mode?: string) => 
    ipcRenderer.invoke('gitxplain-branch', { repoPath, baseRef, mode }),
  gitxplainInstallHook: (repoPath: string, hookName?: string) =>
    ipcRenderer.invoke('gitxplain-install-hook', { repoPath, hookName }),
  gitxplainSplitPreview: (repoPath: string, commitRef: string) =>
    ipcRenderer.invoke('gitxplain-split-preview', { repoPath, commitRef }),
  gitxplainSplitExecute: (repoPath: string, commitRef: string) =>
    ipcRenderer.invoke('gitxplain-split-execute', { repoPath, commitRef }),
});
