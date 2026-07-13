# ADR-0002 — Learning IR as the Stable Internal Boundary

**Status:** Accepted
**Date:** Sprint 0

## Context

PRISM must support multiple source languages and multiple visual learning
systems. Connecting language-specific execution output directly to visual
components would create a dependency matrix where every language must know
about every visual system.

## Decision

Learning IR v0.1 is the stable internal boundary between:

- Language-specific execution adapters (producers)
- PRISM visual learning systems (future consumers)

All language adapters produce LearningTrace.
All future visual systems consume LearningTrace.
No language-specific concepts escape the adapter boundary.

## Entity Identity Rule

entityId must be a stable trace-local identifier.
entityId must never equal a bare display name.

Valid:   var_x_1   var_x_2   x#1
Invalid: x         y         count

This rule is enforced by schema validation on every LearningEvent.
It prepares the system for variable shadowing and nested scopes.

## Consequences

- Language adapters may be replaced without affecting visual systems.
- Visual systems may be added without modifying language adapters.
- Learning IR schema changes require coordinated migration.
- The irVersion field supports future schema evolution.