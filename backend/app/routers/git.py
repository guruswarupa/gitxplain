from fastapi import APIRouter, HTTPException, Query
from backend.app.models import GitSummaryResponse
from backend.app.services.git_service import GitService

router = APIRouter()

@router.get("/git-summary", response_model=GitSummaryResponse)
async def get_git_summary(repo_path: str = Query(".", description="Path to git repository")):
    """
    Get git repository summary including:
    - Current branch
    - Total commits
    - Recent commit history
    - Repository statistics (insertions, deletions, files changed)
    """
    try:
        summary = GitService.get_repository_summary(repo_path)
        return GitSummaryResponse(**summary)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze repository: {str(e)}")
