"""
PRISM Execution API.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.routes.executions import router as executions_router

app = FastAPI(
    title="PRISM Execution API",
    description="Transforms C++ source into deterministic Learning IR events.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

app.include_router(
    executions_router,
    prefix="/api/v1",
    tags=["executions"],
)


@app.get("/health", tags=["health"])
async def health() -> dict:
    """API health check."""
    return {"status": "ok", "version": "0.2.0"}