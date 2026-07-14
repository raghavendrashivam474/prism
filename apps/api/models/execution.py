"""
API-layer request and response models.

These are HTTP boundary models separate from Learning IR contracts.
Mapping happens in the route, not in ExecutionService.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ExecutionRequest(BaseModel):
    """Incoming execution request from the frontend."""

    languageId: str = Field(
        description="Language identifier, e.g. cpp.",
        examples=["cpp"],
    )
    source: str = Field(
        description="Source code to execute.",
        min_length=1,
    )


class SourceLocationResponse(BaseModel):
    line: int


class TraceEventResponse(BaseModel):
    irVersion: str
    sequence: int
    type: str
    source: SourceLocationResponse
    entityId: str | None = None
    payload: dict = Field(default_factory=dict)


class TraceResponse(BaseModel):
    irVersion: str
    executionId: str
    languageId: str
    events: list[TraceEventResponse]


class ExecutionResponse(BaseModel):
    """Successful execution response containing Learning IR."""
    trace: TraceResponse