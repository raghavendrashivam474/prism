"""
Execution Service.

Orchestrates the contract-driven pipeline.
Depends only on contracts — never on Docker, C++ tooling, or GDB.

Pipeline:
    ExecutionRequest
        -> LanguageAdapterRegistry -> LanguageAdapter
        -> validate()
        -> prepare()
        -> SandboxProvider.execute()
        -> adapter.transform()
        -> LearningTrace
"""

from __future__ import annotations

from contracts.language import LanguageAdapterRegistry
from contracts.language.models import ExecutionRequest
from contracts.learning_ir.models import (
    EventType,
    LearningEvent,
    LearningTrace,
    SourceLocation,
)
from contracts.sandbox import SandboxProvider
from contracts.sandbox.models import SandboxFile, SandboxWorkload


class ExecutionService:
    """
    Drives the full execution pipeline through contracts.

    All dependencies are injected. No concrete implementations
    are imported or instantiated inside this class.
    """

    def __init__(
        self,
        language_registry: LanguageAdapterRegistry,
        sandbox_provider: SandboxProvider,
    ) -> None:
        self._registry = language_registry
        self._sandbox = sandbox_provider

    def execute(self, request: ExecutionRequest) -> LearningTrace:
        """
        Run the full pipeline for one execution request.

        Always returns a LearningTrace.
        On any failure, returns a trace containing an execution.failed event
        rather than raising an exception to the caller.
        """

        # Step 1: Resolve language adapter
        try:
            adapter = self._registry.resolve(request.language_id)
        except KeyError:
            return self._failure(
                category="internal_error",
                message=f"No adapter registered for language '{request.language_id}'.",
                execution_id=request.execution_id,
                language_id=request.language_id,
            )

        # Step 2: Profile validation
        validation = adapter.validate(request)
        if not validation.supported:
            return self._unsupported(
                violations=[v.model_dump() for v in validation.violations],
                execution_id=request.execution_id,
                language_id=request.language_id,
            )

        # Step 3: Prepare workload
        try:
            prepared = adapter.prepare(request)
        except Exception as exc:
            return self._failure(
                category="internal_error",
                message=f"Failed to prepare execution workload: {exc}",
                execution_id=request.execution_id,
                language_id=request.language_id,
            )

        # Step 4: Build language-neutral SandboxWorkload
        workload = SandboxWorkload(
            files=[
                SandboxFile(path=f.path, content=f.content)
                for f in prepared.files
            ],
            command=prepared.command,
            environment=prepared.environment,
            timeout_ms=prepared.timeout_ms,
            memory_limit_mb=prepared.memory_limit_mb,
            network_enabled=prepared.network_enabled,
        )

        # Step 5: Execute in sandbox
        try:
            sandbox_result = self._sandbox.execute(workload)
        except Exception as exc:
            return self._failure(
                category="internal_error",
                message=f"Sandbox execution failed: {exc}",
                execution_id=request.execution_id,
                language_id=request.language_id,
            )

        # Step 6: Transform raw result into Learning IR
        try:
            return adapter.transform(
                sandbox_result,
                execution_id=request.execution_id,
            )
        except Exception as exc:
            return self._failure(
                category="internal_error",
                message=f"Trace transformation failed: {exc}",
                execution_id=request.execution_id,
                language_id=request.language_id,
            )

    # ------------------------------------------------------------------
    # Failure helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _failure(
        category: str,
        message: str,
        execution_id: str,
        language_id: str,
    ) -> LearningTrace:
        return LearningTrace(
            execution_id=execution_id,
            language_id=language_id,
            events=[
                LearningEvent(
                    sequence=1,
                    type=EventType.EXECUTION_FAILED,
                    source=SourceLocation(line=1),
                    payload={
                        "category": category,
                        "message": message,
                        "diagnostics": [],
                    },
                )
            ],
        )

    @staticmethod
    def _unsupported(
        violations: list[dict],
        execution_id: str,
        language_id: str,
    ) -> LearningTrace:
        return LearningTrace(
            execution_id=execution_id,
            language_id=language_id,
            events=[
                LearningEvent(
                    sequence=1,
                    type=EventType.EXECUTION_FAILED,
                    source=SourceLocation(line=1),
                    payload={
                        "category": "unsupported_profile",
                        "message": (
                            "Source code does not conform to the supported profile."
                        ),
                        "violations": violations,
                    },
                )
            ],
        )