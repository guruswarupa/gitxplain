import sys
import argparse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Import routers
from backend.app.routers import health, code_review, git

# Startup/shutdown context
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[FastAPI] Application starting...")
    yield
    print("[FastAPI] Application shutting down...")

# Create FastAPI app
app = FastAPI(
    title="DevInsight API",
    description="API for DevInsight - A developer environment monitoring and code analysis tool",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(code_review.router, prefix="/api", tags=["code-review"])
app.include_router(git.router, prefix="/api", tags=["git"])

# Root endpoint
@app.get("/")
async def root():
    return {"message": "DevInsight API is running"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    
    parser = argparse.ArgumentParser(description="Start DevInsight API server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--dev", action="store_true", help="Run in development mode with auto-reload")
    
    args = parser.parse_args()
    
    uvicorn.run(
        "backend.main:app",
        host=args.host,
        port=args.port,
        reload=args.dev,
    )
