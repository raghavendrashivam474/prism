"""
Learning IR data models.
Minimal placeholder — full schema defined in Milestone 0.3.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class LearningEvent(BaseModel):
    """Placeholder — expanded in Milestone 0.3."""
    type: str
    model_config = {"frozen": True}


class LearningTrace(BaseModel):
    """Placeholder — expanded in Milestone 0.3."""
    events: list[LearningEvent] = Field(default_factory=list)
    model_config = {"frozen": True}


__all__ = ["LearningEvent", "LearningTrace"]