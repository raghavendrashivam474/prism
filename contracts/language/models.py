"""
Data models for the language adapter contract.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ExecutionRequest(BaseModel):
    """A request to execute source code through a language adapter."""

    language_id: str = Field(description="Language identifier, e.g. 'cpp'.")
    source_code: str = Field(description="Raw source code to execute.")
    execution_id: str = Field(description="Unique identifier for this execution request.")

    model_config = {"frozen": True}


class ValidationViolation(BaseModel):
    """A single profile validation violation."""

    code: str = Field(description="Machine-readable violation code.")
    line: int | None = Field(default=None, description="Source line where violation was detected.")
    message: str = Field(description="Human-readable violation description.")

    model_config = {"frozen": True}


class ValidationResult(BaseModel):
    """Result of profile validation for a given source input."""

    supported: bool = Field(description="True if the source falls within the supported profile.")
    violations: list[ValidationViolation] = Field(
        default_factory=list,
        description="Violations found. Empty when supported is True.",
    )

    model_config = {"frozen": True}


class SandboxWorkloadFile(BaseModel):
    """A file to be written into the sandbox workspace."""

    path: str = Field(description="Relative path within the workspace.")
    content: str = Field(description="File content.")

    model_config = {"frozen": True}


class PreparedExecution(BaseModel):
    """
    A sandbox workload prepared by a language adapter.

    Contains sufficient information to describe an execution request
    without any language-specific concepts escaping into core logic.
    """

    files: list[SandboxWorkloadFile] = Field(
        description="Files to write into the sandbox workspace."
    )
    command: list[str] = Field(description="Command to execute inside the sandbox.")
    environment: dict[str, str] = Field(default_factory=dict)
    timeout_ms: int = Field(default=10_000)
    memory_limit_mb: int = Field(default=64)
    network_enabled: bool = Field(default=False)
    adapter_context: dict = Field(
        default_factory=dict,
        description="Opaque adapter-specific context. Core logic must not read this.",
    )

    model_config = {"frozen": True}


__all__ = [
    "ExecutionRequest",
    "ValidationResult",
    "ValidationViolation",
    "PreparedExecution",
    "SandboxWorkloadFile",
]