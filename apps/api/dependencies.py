"""
API dependency factory.

Constructs the ExecutionService with its Sprint 0 dependencies.
FastAPI routes receive the service through dependency injection.
Routes never instantiate Docker or concrete adapters directly.
"""

from __future__ import annotations

from functools import lru_cache

from adapters.languages.cpp.adapter import CppLanguageAdapter
from adapters.sandboxes.docker.provider import DockerSandboxProvider
from contracts.language import LanguageAdapterRegistry
from core.execution.service import ExecutionService


@lru_cache(maxsize=1)
def _build_registry() -> LanguageAdapterRegistry:
    registry = LanguageAdapterRegistry()
    registry.register(CppLanguageAdapter())
    return registry


@lru_cache(maxsize=1)
def _build_sandbox() -> DockerSandboxProvider:
    return DockerSandboxProvider()


def get_execution_service() -> ExecutionService:
    """
    FastAPI dependency that returns a ready ExecutionService.
    Uses cached registry and sandbox to avoid rebuilding on every request.
    """
    return ExecutionService(
        language_registry=_build_registry(),
        sandbox_provider=_build_sandbox(),
    )