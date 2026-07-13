# ADR-0003 — C++ Trace Profile v0.1

**Status:** Accepted
**Date:** Sprint 0

## Context

The tracing pipeline must be proven reliable before adding language complexity.
A deliberately narrow profile allows Sprint 0 to focus on the feasibility
question without being obstructed by C++ language edge cases.

## Decision

C++ Trace Profile v0.1 supports only:
- main() function
- local int variables with integer literal initialisation
- direct integer assignment
- simple arithmetic: + - * /
- sequential execution
- normal program completion (return 0)

## Validation Strategy

Validation occurs before compilation via `CppProfileValidator`.
Violations are structured and machine-readable with line numbers.
Unsupported code is explicitly rejected — never silently misrepresented.
The validator uses compiled regex patterns per construct category.

## Consequences

- Sprint 0 tracing is predictable within the profile.
- Profile violations are user-visible with line numbers and codes.
- The profile expands in future sprints.
- The validator is a separate component and can be upgraded independently.
- A Clang AST-based validator is the recommended upgrade path for Sprint 1.