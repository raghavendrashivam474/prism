# Changelog

All notable changes to PRISM are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Historical entries for v0.1.0 and v0.2.0 were back-filled at v0.3.0
release time. Going forward, entries are appended per sprint.

---

## [0.3.0] - 2026-07 - Sprint 2: Lesson Experience Foundation

### Added

Educational domain packages:

- `@prism/lessons` - lesson definitions, validation, static loader,
  catalog, session engine (pure progression), attempt orchestration,
  evidence-backed step evaluation, deterministic feedback projection,
  and a bridge from PrismExecutionResult to the lesson-domain
  ExecutionOutcome.
- `@prism/objectives` - runtime objective domain model, pluggable
  evaluator registry, and four concrete evaluators:
  `entity_exists`, `entity_value_equals`, `entity_value_changed`
  (strict single-transition semantics), `execution_completed`.
- `@prism/execution-result` - reusable PrismExecutionResult
  boundary composing NormalizedTrace, VisualStateSnapshot[], and
  SnapshotTimelineController into a discriminated
  pending / success / failure union.

Timeline extension:

- `@prism/timeline` - added `linkEvidence` and
  `EvidenceTimelineLinker` for resolving runtime evidence to
  snapshot indices without coupling the timeline controller to
  evidence semantics.

Lesson workspace UI (`apps/web`):

- New route `/lesson/[id]` composing the full Sprint 2 pipeline.
- `useLessonWorkspace` hook with `LessonWorkspaceMode` abstraction
  (active | review), useReducer-based session state, activeSource
  cache for edit preservation across review, and mode-aware
  timeline / evidence handling.
- New components: `LessonStepPanel` (multi-paragraph explanation,
  one-shot pulse animation on step transition),
  `LessonFeedbackPanel` (tone-tagged feedback with Show Me buttons
  and configurable continue-button label),
  `LessonProgressPanel` (clickable completed chips for review),
  `LessonCompletionPanel` (celebration card with concepts, stats,
  and review affordance).

Lesson content:

- `cpp-understanding-variable-state` - the real Sprint 2 lesson
  with four steps: A Variable Receives a Value, A Variable Can
  Change, A New Value Can Depend on Current State, Follow Multiple
  State Changes. Each step ships an explicit learning outcome and
  fits inside the Sprint 0 supported C++ profile.
- `cpp-variable-basics-test` - retained as a smoke-test lesson
  for future workspace changes.

Vertical integration test suite:

- Playwright + mocked-API integration suite in `apps/web/tests/`
  proving the complete learner journey end to end (7 tests) in
  approximately 60 seconds.

Documentation:

- `docs/sprint-2/sprint-2-architecture.md` - full architecture
  reference and pipeline diagram.
- `docs/sprint-2/completion-report.md` - Sprint 2 closure record
  and GO decision.
- `docs/sprint-2/known-limitations.md` - documented limitations.

### Changed

- `PrismExecutionResult` failure variant widened during 2.13a to
  preserve execution-narrative snapshots and a real timeline.
  Every consumer now renders a timeline uniformly regardless of
  status. Enforced by the invariant
  `timeline.currentSnapshot === snapshots[timeline.currentIndex]`
  at construction time.
- `apps/web` playground refactored to consume `PrismExecutionResult`
  via `HttpExecutionRunner`. Observable behavior unchanged for the
  learner.
- README updated with directory-scoped uvicorn invocation for
  local Windows development.

### Fixed

- Normalized 32 TypeScript source files that contained lone
  Windows-1252 punctuation bytes emitted by PowerShell
  `Set-Content`. Node/Vitest tolerated the invalid UTF-8; Next.js
  15's Rust file reader did not. Replacer preserved valid
  multi-byte UTF-8 sequences. Convention adopted going forward:
  ASCII-only comments in PowerShell-written files.

### Boundaries Preserved

- Sprint 0 supported C++ profile unchanged.
- Learning IR schema unchanged (still v0.1).
- Visual State Engine reducer unchanged.
- Snapshot timeline controller unchanged (linker is additive).
- FastAPI route surface unchanged.

### Known Limitations

- Windows local dev requires directory-scoped uvicorn
  (`cd apps/api && python -m uvicorn main:app`) due to an
  unresolved Docker Desktop file-sharing quirk with Python
  subprocess. Documented in README and known-limitations.
- Only two lessons registered. No catalog page yet. Navigate
  to `/lesson/{id}` directly.
- Lesson content lives inline in TypeScript. No file-based
  authoring surface.
- No session persistence across browser reload.
- No attempt-history browsing (latest attempt reviewable only).
- No URL-addressable review mode.
- Integration tests use mocked API - real docker compilation not
  exercised by CI.
- Single language (`cpp`).

### Test Baseline at Release

- Python (CI-safe): 124
- TypeScript unit: 368 across 7 packages
- Playwright integration: 7
- Total: 499 assertions, zero failures.

### Milestones

2.1 through 2.18. Detailed record in
`docs/sprint-2/completion-report.md`.

### Decision

**GO WITH LIMITATIONS.** Sprint 2 architecture is stable, the
vertical integration is proven, and all boundaries hold. The
Windows Docker dev-environment caveat is the sole qualifier.

---

## [0.2.0] - 2026-07 - Sprint 1: Visual Execution Core

### Added

- `@prism/trace-model` - Learning IR v0.1 ingestor and the
  frontend-owned NormalizedTrace model. The visual state engine
  never receives `unknown` - this is the validation boundary.
- `@prism/visual-state-engine` - deterministic reducer producing
  one immutable VisualStateSnapshot per Learning IR event.
- `@prism/timeline` - `SnapshotTimelineController` for O(1)
  index-based navigation. Never re-executes C++.
- `@prism/visualizer-variable-state` - variable-state renderer
  with created / changed / unchanged distinction, plus
  Learning IR step describer with deterministic per-event
  descriptions.
- `apps/web` - Next.js workspace composing the Sprint 0 execution
  service, the ingestor, the visual state engine, the timeline,
  and the visualizer. Monaco source-line highlighting driven by
  the current snapshot's event.
- `apps/api` - FastAPI route exposing the Sprint 0 execution
  service over HTTP.
- ADR-0004: snapshot-based timeline navigation.

### Architectural Invariants Established

- `currentSnapshot` is the single execution-step authority.
  Monaco line highlight, variable panel, and step description all
  derive from it. No independent UI state exists.
- Timeline navigation is snapshot selection, not event replay.
- Every visual projection is a pure function of the current
  snapshot.

### Sprint 1 Decision

**GO.** Detailed record in `docs/sprint-1/completion-report.md`.

---

## [0.1.0] - 2026-06 - Sprint 0: C++ Execution Feasibility

### Added

- Core execution service with language adapter registry and
  sandbox provider registry.
- CppLanguageAdapter with supported-profile validation and
  clang/gcc instrumentation.
- DockerSandboxProvider with network isolation, memory limits,
  CPU limits, and execution timeout enforcement.
- LocalSandboxProvider for CI-safe testing paths.
- CPP-to-Learning-IR transformer producing v0.1 traces.
- Learning IR v0.1 contract with source location, event
  sequencing, entity identity, and payload variants for
  execution.started, scope.entered, scope.exited, entity.created,
  entity.value_changed, execution.completed, execution.failed.
- Supported C++ profile: `int main()`, local `int` variables,
  integer literal initialization, assignment, integer arithmetic
  (`+ - * /`), sequential execution, `return 0;`.
- Structured failure taxonomy: `unsupported_profile`,
  `compilation_failed`, `execution_timed_out`, `execution_failed`,
  `trace_invalid`, `internal_error`.
- Golden-trace regression tests for supported profile.
- ADR-0001: contract-first modular architecture.
- ADR-0002: Learning IR as the execution-to-learning boundary.
- ADR-0003: C++ trace profile v0.1.

### Sprint 0 Decision

**GO WITH LIMITATIONS.** The narrow supported profile was accepted
as a deliberate constraint enabling reliable execution and
instrumentation. Detailed record in
`docs/sprint-0/completion-report.md`.

---

[0.3.0]: https://github.com/raghavendrashivam474/prism/releases/tag/v0.3.0
[0.2.0]: https://github.com/raghavendrashivam474/prism/releases/tag/v0.2.0
[0.1.0]: https://github.com/raghavendrashivam474/prism/releases/tag/v0.1.0