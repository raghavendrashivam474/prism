"""
C++ Language Adapter.

Implements the LanguageAdapter protocol for C++ Trace Profile v0.1.
Orchestrates: validation -> instrumentation -> sandbox workload -> transformation.

This adapter does not know how Docker containers are created.
It produces a PreparedExecution that the sandbox contract executes.
"""

from __future__ import annotations

from contracts.language.models import (
    ExecutionRequest,
    PreparedExecution,
    SandboxWorkloadFile,
    ValidationResult,
)
from contracts.learning_ir.models import LearningTrace
from contracts.sandbox.models import SandboxResult

from adapters.languages.cpp.instrumentation.profile_validator import CppProfileValidator
from adapters.languages.cpp.instrumentation.instrumentor import CppSourceInstrumentor
from adapters.languages.cpp.tracing.parser import RawCppTraceParser
from adapters.languages.cpp.transformer.transformer import CppTraceTransformer


# Shell script written into the sandbox workspace.
# Detects whichever compiler is available (clang++ preferred, g++ fallback).
_BUILD_AND_RUN_SCRIPT = """\
#!/usr/bin/env bash
set -e

if command -v clang++ &>/dev/null; then
    COMPILER="clang++"
elif command -v g++ &>/dev/null; then
    COMPILER="g++"
else
    echo "No C++ compiler found (clang++ or g++)" >&2
    exit 1
fi

"$COMPILER" -std=c++20 -O0 -o program instrumented.cpp 2>&1 >&2

./program
"""


class CppLanguageAdapter:
    """
    Language adapter for C++ Trace Profile v0.1.

    language_id = "cpp"
    """

    language_id: str = "cpp"

    def __init__(self) -> None:
        self._validator = CppProfileValidator()
        self._instrumentor = CppSourceInstrumentor()
        self._parser = RawCppTraceParser()
        self._transformer = CppTraceTransformer()

    # ------------------------------------------------------------------
    # LanguageAdapter protocol
    # ------------------------------------------------------------------

    def validate(self, request: ExecutionRequest) -> ValidationResult:
        """Validate source against C++ Trace Profile v0.1."""
        return self._validator.validate(request.source_code)

    def prepare(self, request: ExecutionRequest) -> PreparedExecution:
        """
        Instrument source and prepare a sandbox workload.

        Writes two files into the workspace:
          instrumented.cpp  — the trace-emitting source
          build_and_run.sh  — compile + execute script
        """
        instrumented = self._instrumentor.instrument(request.source_code)

        return PreparedExecution(
            files=[
                SandboxWorkloadFile(
                    path="instrumented.cpp",
                    content=instrumented,
                ),
                SandboxWorkloadFile(
                    path="build_and_run.sh",
                    content=_BUILD_AND_RUN_SCRIPT,
                ),
            ],
            command=["bash", "build_and_run.sh"],
            timeout_ms=15_000,
            memory_limit_mb=128,
            network_enabled=False,
            adapter_context={
                "execution_id": request.execution_id,
                "language_id": self.language_id,
            },
        )

    def transform(
        self,
        result: SandboxResult,
        execution_id: str = "",
    ) -> LearningTrace:
        """Transform a SandboxResult into a LearningTrace."""

        if result.timed_out:
            return self._transformer.make_failure_trace(
                category="execution_timed_out",
                message="C++ execution timed out.",
                execution_id=execution_id,
            )

        # Compilation failure: non-zero exit and nothing useful on stdout
        if result.exit_code != 0 and not result.stdout.strip():
            return self._transformer.make_failure_trace(
                category="compilation_failed",
                message="C++ compilation failed.",
                diagnostics=result.stderr.splitlines(),
                execution_id=execution_id,
            )

        raw_events = self._parser.parse(result.stdout)

        if not raw_events:
            return self._transformer.make_failure_trace(
                category="trace_invalid",
                message="No trace events were produced by the C++ execution.",
                diagnostics=result.stderr.splitlines(),
                execution_id=execution_id,
            )

        return self._transformer.transform(
            raw_events=raw_events,
            execution_id=execution_id,
        )