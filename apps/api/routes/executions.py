"""
Execution API route.

POST /api/v1/executions

Receives source code, runs it through the Sprint 0 pipeline,
and returns Learning IR v0.1.

This route never touches Docker, C++ adapters, or raw traces directly.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException

from apps.api.dependencies import get_execution_service
from apps.api.models.execution import (
    ExecutionRequest,
    ExecutionResponse,
    SourceLocationResponse,
    TraceEventResponse,
    TraceResponse,
)
from contracts.language.models import ExecutionRequest as CoreExecutionRequest
from contracts.learning_ir.models import LearningTrace
from core.execution.service import ExecutionService

router = APIRouter()


def _map_trace_to_response(trace: LearningTrace) -> TraceResponse:
    """Map a LearningTrace into the API response model."""
    events = [
        TraceEventResponse(
            irVersion=event.ir_version,
            sequence=event.sequence,
            type=event.type.value,
            source=SourceLocationResponse(line=event.source.line),
            entityId=event.entity_id,
            payload=event.payload,
        )
        for event in trace.events
    ]
    return TraceResponse(
        irVersion=trace.ir_version,
        executionId=trace.execution_id,
        languageId=trace.language_id,
        events=events,
    )


@router.post(
    "/executions",
    response_model=ExecutionResponse,
    summary="Execute source code and return Learning IR",
)
async def execute(
    request: ExecutionRequest,
    service: ExecutionService = Depends(get_execution_service),
) -> ExecutionResponse:
    """
    Execute source code and return a Learning IR trace.

    Always returns 200 with a trace. Execution failures are represented
    as execution.failed events within the trace, not as HTTP errors.
    Only infrastructure failures return HTTP 5xx.
    """
    execution_id = str(uuid.uuid4())

    core_request = CoreExecutionRequest(
        language_id=request.languageId,
        source_code=request.source,
        execution_id=execution_id,
    )

    try:
        trace = service.execute(core_request)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Execution service unavailable: {exc}",
        )

    return ExecutionResponse(trace=_map_trace_to_response(trace))