"""
Language adapter contracts.

Defines the boundary between PRISM Core execution logic and
language-specific tracing implementations.

No C++, no GDB, no Docker — only the shapes of data and behaviour.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from contracts.language.models import (
    ExecutionRequest,
    PreparedExecution,
    ValidationResult,
    ValidationViolation,
)
from contracts.learning_ir.models import LearningTrace


@runtime_checkable
class LanguageAdapter(Protocol):
    """
    Contract for all language-specific execution adapters.

    The execution service depends on this protocol, never on
    a concrete adapter class.
    """

    language_id: str

    def validate(self, request: ExecutionRequest) -> ValidationResult: ...
    def prepare(self, request: ExecutionRequest) -> PreparedExecution: ...
    def transform(self, result: object) -> LearningTrace: ...


class LanguageAdapterRegistry:
    """
    Registry mapping language identifiers to adapter instances.

    The execution service resolves adapters through this registry.
    """

    def __init__(self) -> None:
        self._adapters: dict[str, LanguageAdapter] = {}

    def register(self, adapter: LanguageAdapter) -> None:
        """Register a language adapter."""
        if not isinstance(adapter, LanguageAdapter):
            raise TypeError(
                f"Expected a LanguageAdapter, got {type(adapter).__name__}"
            )
        self._adapters[adapter.language_id] = adapter

    def resolve(self, language_id: str) -> LanguageAdapter:
        """
        Resolve an adapter by language identifier.
        Raises KeyError if the language is not registered.
        """
        if language_id not in self._adapters:
            available = list(self._adapters.keys())
            raise KeyError(
                f"No adapter registered for language '{language_id}'. "
                f"Available: {available}"
            )
        return self._adapters[language_id]

    def available_languages(self) -> list[str]:
        """Return all registered language identifiers."""
        return list(self._adapters.keys())


__all__ = [
    "LanguageAdapter",
    "LanguageAdapterRegistry",
    "ExecutionRequest",
    "PreparedExecution",
    "ValidationResult",
    "ValidationViolation",
]