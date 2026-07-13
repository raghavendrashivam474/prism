"""
Sandbox provider contracts.

Defines the boundary between PRISM Core and execution infrastructure.
No Docker, no subprocess details.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from contracts.sandbox.models import SandboxResult, SandboxWorkload


@runtime_checkable
class SandboxProvider(Protocol):
    """
    Contract for all sandbox execution providers.

    The execution service depends on this protocol.
    """

    def execute(self, workload: SandboxWorkload) -> SandboxResult: ...


__all__ = [
    "SandboxProvider",
    "SandboxWorkload",
    "SandboxResult",
]