# Sprint 1 Completion Report

**Date:** July 2026
**Starting Version:** v0.1.0
**Ending Version:** v0.2.0
**Sprint Objective:** Consume Learning IR v0.1 and transform it into
a deterministic, synchronised, step-by-step visual execution experience.

---

## Sprint 1 Validation Question

> Can a learner connect a C++ source statement with the exact
> program-state change caused by that statement?

**Answer: YES — demonstrated live.**

Screenshot evidence at STEP 5 / 7 for `variable_arithmetic`:

- Monaco editor line 4 (`x = x + 5;`) is highlighted with a blue gutter marker
- Step description reads: **"x changed from 20 to 25."**
- Variable card shows `x : int` with the transition `20 → 25` in blue
- Footer step counter shows `STEP 5 / 7`
- Timeline navigation is enabled and functional

Every visual element on screen derives from the same `currentSnapshot`.

---

## Definition of Done — Final Status

| Requirement | Status |
|---|---|
| Supported C++ can be submitted from the browser | PASS |
| API reuses Sprint 0 ExecutionService | PASS |
| Learning IR validated at frontend ingestion boundary | PASS |
| Learning IR transformed into frontend-owned trace model | PASS |
| Visual State Engine is pure TypeScript | PASS |
| Ordered events produce deterministic snapshots | PASS |
| Snapshots are immutable | PASS |
| Timeline navigation uses snapshot selection | PASS |
| No reverse-event implementation exists | PASS |
| Timeline navigation does not re-execute C++ | PASS |
| Current snapshot is single execution-step authority | PASS |
| Monaco highlights current event's source line | PASS |
| Variable visualiser consumes visual state, not IR/C++ | PASS |
| Created / changed / unchanged states distinguishable | PASS |
| Every IR event type has deterministic description | PASS |
| Structured Sprint 0 failures produce intentional frontend states | PASS |
| Sprint 0 regression tests remain green | PASS |
| Sprint 1 integration tests pass | PASS |
| ADR-0004 is committed | PASS |
| Completion report records a decision | PASS |

---

## Test Results

| Suite | Tests | Runtime |
|---|---|---|
| Python — contracts | 54 | Sprint 0 |
| Python — transformer | 24 | Sprint 0 |
| Python — sandbox | 15 | Sprint 0 |
| Python — execution service | 14 | Sprint 0 |
| Python — golden | 18 | Sprint 0 |
| Python — API routes | 13 | Sprint 1 |
| TypeScript — trace-model ingestor | 23 | Sprint 1 |
| TypeScript — visual-state-engine | 18 | Sprint 1 |
| TypeScript — timeline controller | 28 | Sprint 1 |
| TypeScript — visualizers | 27 | Sprint 1 |
| **Total** | **234** | **All passing** |

Non-Docker CI-safe run: 124 Python + 96 TypeScript = **220 tests**.
Full run including Docker integration: **234 tests**.

---

## Architectural Boundaries Verified

**Automated import-inspection tests confirm:**

- `ExecutionService` imports only from `contracts/` and stdlib
- `apps/api/routes/executions.py` does not import Docker
- Frontend `trace-model` does not import React
- Frontend `visual-state-engine` does not import React or HTTP
- Frontend `timeline` does not import React
- Frontend `visualizers/variable-state` does not import React or HTTP

**Manual code review confirms:**

- Visualisers consume `VisualStateSnapshot`, never raw Learning IR
- React components consume render models, never state directly
- Monaco is not called from anywhere except the workspace page
- No component owns independent step state

---

## Issues Discovered and Resolved During Sprint 1

### 1. Monaco line highlight not reactive

**Symptom:** The initial page component set decorations in `onMount`
but never re-applied them when `activeLine` changed.

**Fix:** Refactored to use `useRef` for editor and monaco instances
combined with `useEffect` on `activeLine`. Decorations now update
reactively whenever the current snapshot changes.

### 2. PowerShell session function loss

**Symptom:** `Write-Utf8` helper function was lost when re-entering
the terminal session or changing directories.

**Fix:** Documented the redefinition pattern. All file writes use
UTF8NoBOM to prevent TOML and JSON encoding issues on Windows.

### 3. Docker-off surfaced as "compilation_failed"

**Symptom:** When Docker Desktop was not running, the frontend
displayed "Compilation failed" with Docker daemon connection errors
in the expandable diagnostics.

**Root cause:** The C++ adapter treats any non-zero exit with empty
stdout as compilation failure — it cannot distinguish container
runtime unavailability from actual compilation errors.

**Status:** Documented as a Sprint 2 improvement (see
`known-limitations.md`). Current behaviour surfaces the failure
correctly but under an imprecise category label.

---

## Sprint 1 Decision

**GO**

### Justification

The validation question is answered affirmatively with visual evidence.

The consumer architecture is proven to be:
- **Deterministic** — same trace produces identical snapshots
- **Synchronised** — one snapshot drives three projections simultaneously
- **Immutable** — earlier snapshots survive later state transitions
- **Replaceable** — the state engine, visualisers, and step describer
  can each be swapped without touching each other or PRISM Core

Learning IR v0.1 proved sufficient for deterministic visual state
reconstruction. No frontend consumer requirement emerged that
demanded an IR schema change.

The visual execution experience clearly connects source statements
to state changes. The blue gutter marker on the active line, the
blue variable card with the previous value struck through, and the
plain-language description all reinforce the same information at
the same time.

### Recommended Sprint 2 Actions

**Priority 1 — Learning content**
The infrastructure now supports lesson delivery. Sprint 2 should
begin defining what a lesson actually is.

**Priority 2 — Failure category taxonomy**
Add `infrastructure_unavailable` category at the sandbox layer
to distinguish operator problems from learner problems.

**Priority 3 — Profile expansion: user-defined functions**
The next natural complexity increment. The transformer already
supports scope IDs — the infrastructure is ready.

**Priority 4 — Learning IR v0.2 with column-level locations**
Only if a lesson-authoring or highlighting requirement demands it.
Not required by the current visual experience.

**Priority 5 — Container performance**
Docker cold-start latency should be addressed before user-facing
work on multi-lesson flows begins.