# 📘 Commit Story Desktop — Planner

## 1. Project Overview

**Goal:**
Build a native Windows desktop application using Electron + React that transforms raw Git history into structured, human-readable narratives (“Commit Stories”), while providing a familiar UI similar to GitHub Desktop.

**Core Idea:**

* GitHub Desktop shows *what changed*
* Commit Story shows *why it changed and what it means*

**Core Workflow:**

1. User selects a local Git repository
2. App reads `.git` data using `simple-git`
3. System groups commits into meaningful “Stories”
4. AI generates human-readable narratives
5. UI displays stories, insights, and commit details

---

## 2. Technical Stack

* **Framework:** Electron.js
* **Frontend:** React + Tailwind CSS
* **Git Integration:** simple-git
* **State Persistence:** electron-store
* **Charts:** Chart.js (react-chartjs-2)
* **Icons:** lucide-react

---

## 3. System Architecture

### 🔐 Architecture Rule

* All Git operations MUST run in Main process
* Renderer (React) must NEVER access filesystem directly
* Communication via IPC

---

### Main Process (`main.js`)

Handles:

* Window creation
* Git operations
* IPC handlers

Expose:

* `getLog(path)`
* `getCommitDetails(path, hash)`
* `getStatus(path)`
* `commitChanges(path, message)`
* `selectFolder()`

---

### Preload (`preload.js`)

Expose safe API:

```js
window.electronAPI = {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getLog: (path) => ipcRenderer.invoke('git-log', path),
  getCommitDetails: (path, hash) => ipcRenderer.invoke('git-details', { path, hash }),
  getStatus: (path) => ipcRenderer.invoke('git-status', path),
  commit: (path, message) => ipcRenderer.invoke('git-commit', { path, message })
}
```

---

## 4. Data Structures

### Project Object

```json
{
  "id": "uuid",
  "name": "Project Name",
  "path": "C:/repo",
  "lastSynced": "timestamp"
}
```

---

### Commit Object

```json
{
  "hash": "",
  "author": "",
  "date": "",
  "message": ""
}
```

---

### Story Object (CORE)

```json
{
  "id": "uuid",
  "title": "Authentication Fix",
  "summary": "Improved login reliability by fixing token issues",
  "commits": [],
  "type": "fix | feature | docs",
  "files": [],
  "timestamp": ""
}
```

---

## 5. Core Feature Modules

### 📁 Repository Management

* Add repo (folder picker)
* Store using electron-store
* Switch between repos

---

### 📄 Git Integration

Use simple-git:

* `git log --pretty=format:"%H|%an|%ar|%s"`
* `git show --stat <hash>`
* `git status`

---

### 🧠 Commit Grouping Engine (IMPORTANT)

Group commits using:

1. Prefix:

   * feat → feature
   * fix → bug
   * docs → docs

2. Time proximity:

   * commits within X hours

3. File similarity:

   * same files modified

---

### ✨ Narrative Generator (CORE)

Convert multiple commits into a story:

**Input:**

```
fix: login bug
fix: token refresh
test: login tests
```

**Output:**

```
"Improved authentication reliability by fixing token issues and adding test coverage."
```

---

### 📊 Insights Engine

Generate:

* commits per day
* commit type distribution
* active files

---

## 6. UI Architecture (GitHub Desktop Inspired)

### Layout

```
-----------------------------------------
| Sidebar | Main Panel                  |
|         |                             |
| Repos   | Tabs:                       |
|         | - Changes                   |
|         | - History                   |
|         | - Stories ⭐                |
|         | - Insights 📊              |
-----------------------------------------
```

---

### Tabs

#### 🟢 Changes

* File changes
* Diff viewer
* Commit input

---

#### 📜 History

* Commit list
* Click → details
* AI explanation panel

---

#### 🧩 Stories (UNIQUE FEATURE)

* Story cards
* Grouped commits
* Narrative summary

---

#### 📊 Insights

* Charts:

  * commits/day
  * feature vs fix

---

## 7. Key UI Components

* `ProjectSidebar.jsx`
* `ChangesView.jsx`
* `HistoryView.jsx`
* `CommitDetails.jsx`
* `CommitStoryCard.jsx`
* `StoriesView.jsx`
* `InsightsDashboard.jsx`

---

## 8. AI Integration (Reuse CLI Logic)

Reuse your existing CLI (`gitxplain`) logic:

* summary
* full explanation
* review
* security

---

### UI Controls:

* Explain
* Review
* Security
* Beginner Mode

---

## 9. Search & Deep Inspect

* Input: commit hash (≥6 chars)
* Fetch via IPC
* Show:

  * commit details
  * file stats
  * AI explanation
  * story context

---

## 10. Reports (Problem Requirement)

Generate:

* 🧾 Release Notes
* 📋 Standup Summary
* 📄 Project Summary

Export as:

* Markdown
* HTML

---

## 11. Performance Strategy

* Limit commits (e.g., last 500)
* Cache results
* Lazy loading

---

## 12. Implementation Roadmap

### Phase 1

* Setup Electron + React + Tailwind

### Phase 2

* IPC bridge (main + preload)
* simple-git integration

### Phase 3

* Changes + History UI

### Phase 4

* Story grouping engine

### Phase 5

* AI narrative integration

### Phase 6

* Insights dashboard

### Phase 7

* Search + Deep Inspect

---

## 13. Security

* contextIsolation: true
* nodeIntegration: false
* expose only safe APIs

---

## 14. Final Positioning

> “Commit Story Desktop transforms messy Git history into meaningful development narratives.”

---

## 15. Key Differentiator

Compared to GitHub Desktop:

* ✅ AI explanations
* ✅ Story grouping
* ✅ Narrative generation
* ✅ Insights dashboard

---

## 16. Demo Flow

1. Add repository
2. Show raw commits
3. Click “Generate Stories”
4. Display grouped narratives
5. Show insights dashboard
6. Search commit → deep inspect

---

## 17. Tagline

> “Git shows what changed. We show why it matters.”
