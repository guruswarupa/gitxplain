import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const CONFIG_DIR = path.join(os.homedir(), ".gitxplain");
const CONNECTION_FILE = path.join(CONFIG_DIR, "git-connection.json");

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export async function saveGitConnection(token, provider = "github", userInfo = null) {
  ensureConfigDir();
  const connection = {
    token,
    provider,
    user: userInfo || {},
    connectedAt: new Date().toISOString()
  };
  fs.writeFileSync(CONNECTION_FILE, JSON.stringify(connection, null, 2), "utf8");
}

export function loadGitConnection() {
  try {
    if (fs.existsSync(CONNECTION_FILE)) {
      const data = fs.readFileSync(CONNECTION_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    // If file is corrupted, return null
    return null;
  }
  return null;
}

export function isGitConnected() {
  return loadGitConnection() !== null;
}

export function clearGitConnection() {
  try {
    if (fs.existsSync(CONNECTION_FILE)) {
      fs.unlinkSync(CONNECTION_FILE);
    }
  } catch (error) {
    // Ignore errors during cleanup
  }
}

export function getGitUserInfo() {
  try {
    const name = execFileSync("git", ["config", "user.name"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    const email = execFileSync("git", ["config", "user.email"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    return { name, email };
  } catch {
    return { name: "Unknown", email: "unknown@example.com" };
  }
}

export async function verifyGitToken(token, provider = "github") {
  try {
    if (provider === "github") {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "gitxplain"
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `GitHub API returned status ${response.status}`
        );
      }

      return await response.json();
    }
  } catch (error) {
    throw error;
  }
}

export async function fetchGitHubRepositories(token) {
  try {
    const response = await fetch("https://api.github.com/user/repos?per_page=30&sort=updated", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "gitxplain"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repositories: ${response.statusText}`);
    }

    const repos = await response.json();
    return repos.map((repo) => ({
      name: repo.name,
      owner: repo.owner.login,
      description: repo.description,
      url: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      updated_at: repo.updated_at
    }));
  } catch (error) {
    throw new Error(`Failed to fetch GitHub repositories: ${error.message}`);
  }
}

export async function fetchGitHubCommits(token, owner, repo) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=15`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "gitxplain"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch commits: ${response.statusText}`);
    }

    const commits = await response.json();
    return commits.map((commitData) => ({
      sha: commitData.sha.substring(0, 7),
      fullSha: commitData.sha,
      message: commitData.commit.message.split('\n')[0],
      author: commitData.commit.author.name,
      date: commitData.commit.author.date
    }));
  } catch (error) {
    throw new Error(`Failed to fetch GitHub commits: ${error.message}`);
  }
}

export async function fetchCommitDetails(token, owner, repo, sha) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "gitxplain"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch commit details: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      sha: data.sha,
      stats: data.stats,
      files: (data.files || []).map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || "No patch available or binary file"
      }))
    };
  } catch (error) {
    throw new Error(`Failed to fetch commit details: ${error.message}`);
  }
}

export async function fetchRepoTree(token, owner, repo, sha) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "gitxplain"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repo tree: ${response.statusText}`);
    }

    const data = await response.json();
    const paths = (data.tree || [])
      .filter(t => t.type === 'blob' || t.type === 'tree')
      .map(t => t.path);
      
    if (paths.length > 200) {
      return [...paths.slice(0, 200), `... and ${paths.length - 200} more items truncated`];
    }
    return paths;
  } catch (error) {
    return ["Failed to load repository file structure."];
  }
}

export async function downloadCommitArchive(token, owner, repo, sha, destPath) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/zipball/${sha}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "gitxplain"
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch zipball: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
    return true;
  } catch (error) {
    throw new Error(`Failed to download archive: ${error.message}`);
  }
}

export async function fetchFileContent(token, owner, repo, sha, filePath) {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${filePath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "gitxplain"
      }
    });
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch file content: ${error.message}`);
  }
}

export async function fetchRepoIssues(token, owner, repo) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=10`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "gitxplain"
      }
    });
    if (!response.ok) throw new Error(`Failed to fetch issues: ${response.statusText}`);
    const issues = await response.json();
    return issues.map(i => ({
      number: i.number,
      title: i.title,
      user: i.user.login,
      url: i.html_url
    }));
  } catch (error) {
    throw new Error(`Failed to fetch issues: ${error.message}`);
  }
}
