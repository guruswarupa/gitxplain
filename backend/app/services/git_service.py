import subprocess
import os
from typing import List, Dict, Optional
from datetime import datetime
import json

class GitService:
    """Service for Git operations and repository analysis"""

    @staticmethod
    def _run_git_command(command: str, repo_path: str = ".") -> str:
        """Run a git command in the specified repository"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                raise Exception(result.stderr)
            return result.stdout.strip()
        except Exception as e:
            raise Exception(f"Git command failed: {str(e)}")

    @staticmethod
    def get_current_branch(repo_path: str = ".") -> str:
        """Get the current branch name"""
        try:
            return GitService._run_git_command("git rev-parse --abbrev-ref HEAD", repo_path)
        except Exception:
            return "Unknown"

    @staticmethod
    def get_total_commits(repo_path: str = ".") -> int:
        """Get total number of commits in the repository"""
        try:
            count = GitService._run_git_command("git rev-list --count HEAD", repo_path)
            return int(count)
        except Exception:
            return 0

    @staticmethod
    def get_recent_commits(repo_path: str = ".", limit: int = 20) -> List[Dict]:
        """Get recent commits"""
        try:
            # Get commits in JSON format
            command = (
                f"git log --oneline -n {limit} "
                f"--format='%H|%an|%s|%aI'"
            )
            output = GitService._run_git_command(command, repo_path)

            commits = []
            for line in output.split("\n"):
                if line.strip():
                    parts = line.split("|")
                    if len(parts) >= 4:
                        commits.append({
                            "hash": parts[0],
                            "author": parts[1],
                            "message": parts[2],
                            "date": parts[3],
                        })
            return commits
        except Exception:
            return []

    @staticmethod
    def get_repository_stats(repo_path: str = ".") -> Dict:
        """Get repository statistics"""
        try:
            # Get files changed
            files_changed = GitService._run_git_command(
                "git diff --name-only HEAD~1..HEAD | wc -l", repo_path
            )
            
            # Get insertions and deletions
            stats = GitService._run_git_command(
                "git diff --shortstat HEAD~1..HEAD", repo_path
            )

            insertions = 0
            deletions = 0

            # Parse stats output format: "5 files changed, 150 insertions(+), 45 deletions(-)"
            if "insertions" in stats:
                parts = stats.split(",")
                for part in parts:
                    if "insertion" in part:
                        try:
                            insertions = int("".join(filter(str.isdigit, part.split()[0])))
                        except Exception:
                            pass
                    if "deletion" in part:
                        try:
                            deletions = int("".join(filter(str.isdigit, part.split()[0])))
                        except Exception:
                            pass

            try:
                files_changed = int(files_changed)
            except Exception:
                files_changed = 0

            return {
                "filesChanged": files_changed if files_changed > 0 else 0,
                "insertions": insertions,
                "deletions": deletions,
            }
        except Exception:
            return {"filesChanged": 0, "insertions": 0, "deletions": 0}

    @staticmethod
    def get_repository_summary(repo_path: str = ".") -> Dict:
        """Get complete repository summary"""
        # Validate repository
        try:
            GitService._run_git_command("git rev-parse --git-dir", repo_path)
        except Exception:
            raise ValueError(f"Not a valid git repository: {repo_path}")

        return {
            "repositoryPath": os.path.abspath(repo_path),
            "branch": GitService.get_current_branch(repo_path),
            "totalCommits": GitService.get_total_commits(repo_path),
            "recentCommits": GitService.get_recent_commits(repo_path),
            "stats": GitService.get_repository_stats(repo_path),
        }
