"""
Learning IR v0.1 — PRISM internal language-neutral execution representation.

Every language adapter produces LearningTrace.
No language-specific concepts exist beyond this boundary.
"""

from contracts.learning_ir.models import (
    IR_VERSION,
    EventType,
    LearningEvent,
    LearningTrace,
    SourceLocation,
)

__all__ = [
    "IR_VERSION",
    "EventType",
    "LearningEvent",
    "LearningTrace",
    "SourceLocation",
]