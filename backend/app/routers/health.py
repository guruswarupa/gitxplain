from fastapi import APIRouter, HTTPException
from backend.app.models import HealthCheckResponse
from backend.app.services.cli_service import CLIService

router = APIRouter()

@router.get("/health-check", response_model=HealthCheckResponse)
async def health_check():
    """
    Get system health status including CPU load, memory, and disk usage
    """
    try:
        health_data = CLIService.check_system_health()
        return HealthCheckResponse(**health_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
