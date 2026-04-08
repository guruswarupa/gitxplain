from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Health Check Models
class HealthCheckResponse(BaseModel):
    status: str = Field(..., description="Overall health status: healthy, warning, critical")
    systemLoad: float = Field(..., description="System load percentage")
    memoryUsage: float = Field(..., description="Memory usage percentage")
    diskUsage: float = Field(..., description="Disk usage percentage")
    pythonVersion: str = Field(..., description="Python version")
    nodeVersion: str = Field(..., description="Node.js version")
    timestamp: str = Field(..., description="Timestamp of the check")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "healthy",
                "systemLoad": 35.2,
                "memoryUsage": 45.8,
                "diskUsage": 62.1,
                "pythonVersion": "3.9.13",
                "nodeVersion": "18.16.0",
                "timestamp": "2024-01-15T10:30:00Z",
            }
        }

# Code Review Models
class CodeIssue(BaseModel):
    line: int = Field(..., description="Line number where issue occurs")
    severity: str = Field(..., description="Issue severity: error, warning, info")
    message: str = Field(..., description="Description of the issue")
    suggestion: Optional[str] = Field(None, description="Suggested fix for the issue")

class CodeReviewResult(BaseModel):
    file: str = Field(..., description="File path of reviewed code")
    issues: List[CodeIssue] = Field(default_factory=list, description="List of found issues")
    summary: str = Field(..., description="Overall summary of the review")

class CodeReviewRequest(BaseModel):
    code: str = Field(..., description="Code content to review")
    file_path: str = Field(default="code.py", description="File path for context")

    class Config:
        json_schema_extra = {
            "example": {
                "code": "def hello():\n  print('world')",
                "file_path": "hello.py",
            }
        }

# Git Models
class CommitInfo(BaseModel):
    hash: str = Field(..., description="Commit hash")
    author: str = Field(..., description="Commit author name")
    message: str = Field(..., description="Commit message")
    date: str = Field(..., description="Commit date in ISO format")

class GitStatistics(BaseModel):
    filesChanged: int = Field(..., description="Number of files changed")
    insertions: int = Field(..., description="Number of line insertions")
    deletions: int = Field(..., description="Number of line deletions")

class GitSummaryResponse(BaseModel):
    repositoryPath: str = Field(..., description="Path to the repository")
    branch: str = Field(..., description="Current branch name")
    totalCommits: int = Field(..., description="Total number of commits")
    recentCommits: List[CommitInfo] = Field(..., description="Recent commits")
    stats: GitStatistics = Field(..., description="Repository statistics")

    class Config:
        json_schema_extra = {
            "example": {
                "repositoryPath": "/path/to/repo",
                "branch": "main",
                "totalCommits": 145,
                "recentCommits": [
                    {
                        "hash": "abc123def456",
                        "author": "John Doe",
                        "message": "Fixed bug in authentication",
                        "date": "2024-01-15T10:30:00Z",
                    }
                ],
                "stats": {
                    "filesChanged": 5,
                    "insertions": 150,
                    "deletions": 45,
                },
            }
        }

# Error Models
class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Error message")
    code: Optional[str] = Field(None, description="Error code")
