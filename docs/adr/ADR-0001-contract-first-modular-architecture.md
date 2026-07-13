# ADR-0001 — Contract-First Modular Architecture

**Status:** Accepted
**Date:** Sprint 0

## Context

PRISM must support multiple source languages, multiple sandbox
implementations, and multiple visual learning systems in future sprints.
Coupling concrete implementations together would prevent independent
replacement and make the architecture brittle.

## Decision

PRISM adopts a contract-first modular architecture.

All cross-boundary communication uses typed contracts:
- Python Protocols for behavioural contracts (LanguageAdapter, SandboxProvider)
- Pydantic models for data contracts (ExecutionRequest, LearningTrace)

No concrete implementation class is imported across architectural boundaries.
Adapters are registered and resolved at runtime through a registry.

Boundaries established in Sprint 0:
1. ExecutionService <-> LanguageAdapter (via LanguageAdapter Protocol)
2. ExecutionService <-> SandboxProvider (via SandboxProvider Protocol)
3. LanguageAdapter  <-> Learning IR     (via LearningTrace contract)

## Consequences

- Any language adapter can be replaced without modifying ExecutionService.
- Any sandbox can be replaced without modifying language adapters.
- The C++ tracing strategy is replaceable within the C++ adapter boundary.
- Testing uses mock adapters without requiring real compilers or Docker.
- The registry pattern allows runtime adapter selection by language_id.
- Boundary compliance is verified by automated import-inspection tests.