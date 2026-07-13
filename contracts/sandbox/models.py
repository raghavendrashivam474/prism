"""
Data models for the sandbox provider contract.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SandboxFile(BaseModel):
    """A file to be placed in the sandbox workspace."""

    path: str = Field(description="Relative path within the workspace.")
    content: str = Field(description="File content.")

    model_config = {"frozen": True}


class SandboxWorkload(BaseModel):
    """
    A language-neutral description of an execution workload.

    The sandbox must not interpret language-specific concepts.
    """

    files: list[SandboxFile] = Field(
        description="Files to write into the workspace before execution."
    )
    command: list[str] = Field(description="Command and arguments to execute.")
    environment: dict[str, str] = Field(default_factory=dict)
    timeout_ms: int = Field(default=10_000)
    memory_limit_mb: int = Field(default=64)
    network_enabled: bool = Field(default=False)

    model_config = {"frozen": True}


class SandboxResult(BaseModel):
    """
    The result of a sandbox execution.

    The sandbox does not interpret the meaning of stdout or stderr.
    """

    exit_code: int = Field(description="Process exit code. 0 indicates normal completion.")
    stdout: str = Field(default="")
    stderr: str = Field(default="")
    timed_out: bool = Field(default=False)
    duration_ms: int = Field(default=0)

    model_config = {"frozen": True}


__all__ = [
    "SandboxFile",
    "SandboxWorkload",
    "SandboxResult",
]