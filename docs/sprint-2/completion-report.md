# Sprint 2 Completion Report

**Date:** July 2026
**Starting Version:** v0.2.0
**Ending Version:** v0.3.0
**Sprint Objective:** Wrap the Sprint 0 + Sprint 1 execution and
visualization stack in an educational layer: lessons, session
progression, runtime objective evaluation, learner feedback,
evidence-linked review, and lesson completion.

---

## Sprint 2 Validation Question

> Can a learner load a lesson, execute code against runtime
> objectives, receive evidence-linked feedback, review completed
> steps, and finish the lesson - with every transition proven
> automatically end-to-end?

**Answer: YES - proven by 375 automated assertions across 8 packages
plus a browser-driven vertical integration suite.**

The canonical Sprint 2 lesson (`cpp-understanding-variable-state`)
loads, progresses through four learner-solved steps, terminates
with an explicit Finish action, and reveals a completion panel
summarizing the concepts worked through - all validated in an
automated browser run in approximately 60 seconds.

---

## Definition of Done - Final Status

| Requirement | Status |
|---|---|
| Lesson definition schema, validation, and loader | PASS |
| Static lesson catalog with summary projection | PASS |
| Deterministic lesson session engine (pure TypeScript) | PASS |
| Runtime objective domain model (4 objective types) | PASS |
| Pluggable objective evaluator registry | PASS |
| Four concrete evaluator plugins with strict semantics | PASS |
| Evidence-backed step evaluation | PASS |
| Learner attempts and session orchestration | PASS |
| Deterministic tone-tagged feedback projection | PASS |
| Evidence-to-timeline linker (structural evidence contract) | PASS |
| Reusable PrismExecutionResult boundary | PASS |
| Lesson workspace composition (page, hook, components) | PASS |
| Real Sprint 2 lesson content (four conceptual steps) | PASS |
| Show Me evidence focus + Review Mode workspace state | PASS |
| Explicit Finish button + LessonCompletionPanel | PASS |
| Multi-paragraph explanation rendering | PASS |
| Playwright vertical integration suite (7 tests) | PASS |
| No Sprint 0 or Sprint 1 regressions | PASS |
| All architectural boundaries (A through H) intact | PASS |
| Sprint 2 completion report and GO decision recorded | PASS |

---

## Test Results

| Suite | Tests | Runtime |
|---|---|---|
| Python - contracts, transformer, sandbox, executions, API | 124 | Sprint 0/1 |
| TypeScript - trace-model ingestor | 23 | Sprint 1 |
| TypeScript - visual-state-engine | 18 | Sprint 1 |
| TypeScript - timeline (controller + evidence linker) | 46 | Sprint 1/2 |
| TypeScript - variable-state visualizer | 27 | Sprint 1 |
| TypeScript - objectives (definitions + registry + evaluators) | 50 | Sprint 2 |
| TypeScript - execution-result | 37 | Sprint 2 |
| TypeScript - lessons (definitions, loader, session, evaluation, attempts, feedback, bridge) | 167 | Sprint 2 |
| Playwright - apps/web vertical integration suite | 7 | Sprint 2 |
| **Total** | **499** | **All passing** |

Note: total assertion count is 375 unit + integration when Python
suite is counted as its 124 individual tests. The number 499 above
represents every distinct assertion Sprint 2 ships behind (Python
124 + TypeScript unit 368 + Playwright 7).

Full suite runtime (CI-safe path, no Docker required):
approximately 90 seconds.

---

## Milestone-by-Milestone Record

| Milestone | Objective | Status | Commit |
|---|---|---|---|
| 2.1 | Sprint 2 package foundation (empty lessons + objectives packages) | Complete | pre-handoff |
| 2.2 | Declarative lesson domain model + validation | Complete | pre-handoff |
| 2.3 | Static lesson loader and catalog | Complete | pre-handoff |
| 2.4 | Deterministic lesson session engine (pure progression only) | Complete | `63dd0bd` |
| 2.5 | Runtime objective domain model (4 objective types) | Complete | `a83392b` |
| 2.6 | Pluggable objective evaluator registry | Complete | `1edbad2` |
| 2.7 | Concrete evaluators (entity_exists, entity_value_equals, entity_value_changed, execution_completed) | Complete | `c6f4e46` |
| 2.8 | Evidence-backed step evaluation (evaluateStep bridge) | Complete | `34d3402` |
| 2.9 | Lesson attempts + session evaluation orchestration | Complete | `d541d72` |
| 2.10 | Deterministic learner feedback projection | Complete | `bc981ee` |
| 2.11 | Evidence-to-timeline linker | Complete | `e3d90ea` |
| 2.12 | Reusable PrismExecutionResult boundary | Complete | `5c1bfe9` |
| 2.13a | Workspace refactor around execution result boundary | Complete | `3b38433` |
| 2.13a (fix) | Encoding normalization across TypeScript sources | Complete | `51742f1` |
| 2.13b | Lesson workspace composition (page + hook + components) | Complete | `d4767c3` |
| 2.14 | Understanding Variable State lesson content (4 steps) | Complete | `05bfc36` |
| 2.15 | Show Me + Review Mode + paragraph rendering | Complete | `ac8b735` |
| Docker docs | README correction for Windows Docker invocation | Complete | `1889b51` |
| 2.16 | Lesson progression and completion flow (Finish + completion panel + pulse) | Complete | `2648fbd` |
| 2.17 | Sprint 2 vertical integration suite (Playwright) | Complete | `16cf79c` |
| 2.18 | Sprint 2 architecture review, closure, release | Complete | this commit |

---

## Architectural Boundaries Validated

Sprint 2 introduced four new domain packages and one composite
boundary while preserving every boundary established in Sprint 0
and Sprint 1. Each boundary has documented inputs, outputs,
responsibilities, and a clear owner.

### A. Execution Service (unchanged)

Owner: `core/execution` + `apps/api`
Input: source code, language id
Output: Learning IR v0.1 JSON
Sprint 2 change: none. FastAPI route surface unchanged.

### B. Learning IR (unchanged)

Owner: `contracts/learning_ir` + `packages/trace-model`
Input: raw IR JSON
Output: NormalizedTrace
Sprint 2 change: none. Ingestor rejects malformed traces at the
frontend boundary; the visual state engine never sees `unknown`.

### C. Visual State Engine (unchanged)

Owner: `packages/visual-state-engine`
Input: NormalizedTrace
Output: VisualStateSnapshot[]
Sprint 2 change: none. Snapshot immutability and per-event
determinism preserved.

### D. Timeline (extended additively)

Owner: `packages/timeline`
Input: VisualStateSnapshot[], select(index)
Output: currentSnapshot
Sprint 2 addition: `linkEvidence(snapshots, {sequence})` resolves
runtime evidence to a snapshot index. This is a pure read-only
helper. The `SnapshotTimelineController` was not modified.

### E. Lesson Session Engine (new in Sprint 2)

Owner: `packages/lessons/session`
Input: LessonDefinition
Output: LessonSessionState
Transitions: `startSession`, `completeActiveStep`, `activateStep`,
`resetSession`, `recordAttempt` (via orchestrator).
Boundary rule enforced throughout Sprint 2: React never invents
transitions. Every UI action delegates to a pure domain function
via `useReducer`.

### F. Objective Evaluators (new in Sprint 2)

Owner: `packages/objectives/evaluation`
Input: ObjectiveDefinition + ObjectiveEvaluationContext (trace + snapshots)
Output: ObjectiveEvaluationResult (satisfied + evidence)
Boundary rule enforced: evaluators own semantic checks only.
They produce no learner-facing text. Concrete plugins for
entity_exists, entity_value_equals, entity_value_changed, and
execution_completed are shipped with `createDefaultEvaluatorRegistry`.

### G. Feedback Projection (new in Sprint 2)

Owner: `packages/lessons/feedback`
Input: LessonStepDefinition + StepEvaluation
Output: LearnerFeedback (tone + per-objective structured messages)
Boundary rule enforced: no evaluator plugin was modified to add
wording. Copy is centralized in the projector. Handoff Section 25
distinction (execution failure vs unsatisfied objective) is
preserved: on failure, per-objective status is `not_evaluated`,
never `unsatisfied`.

### H. Lesson UI (new in Sprint 2)

Owner: `apps/web` (lesson workspace hook + components + page)
Input: LessonDefinition, LessonSessionState, PrismExecutionResult,
LearnerFeedback
Output: rendered `/lesson/[id]` workspace
Boundary rule enforced: UI is presentation-only. All state
transitions originate in domain functions.

### Composite boundary: PrismExecutionResult

Owner: `packages/execution-result`
This is the reusable boundary composing NormalizedTrace,
VisualStateSnapshot[], and SnapshotTimelineController into a
single discriminated result (pending / success / failure).

Correction landed during Sprint 2: the failure variant was
initially modeled as `snapshots: []` with an empty timeline
controller. Architectural review during Milestone 2.13a widened
the failure variant to carry snapshots and a real timeline when
the trace produced them (execution narrative includes the failure
moment). Every consumer can render a timeline uniformly without
branching on status; status drives which panel renders, not
whether the timeline exists. The invariant
`timeline.currentSnapshot === snapshots[timeline.currentIndex]`
is enforced at construction time and validated by test.

---

## Retrospective

### What Worked Well

- **Contract-first milestones.** Every domain package was built as
  pure TypeScript with strict tests before the React layer
  consumed it. When integration time arrived, the domain code
  needed no changes. React state was a thin projection over
  already-tested domain state.

- **Discriminated unions everywhere.** `ExecutionOutcome`,
  `PrismExecutionResult`, `LessonAttemptResult`, `LessonSessionStatus`,
  `LessonStepStatus`, `LearnerFeedbackTone`, `EvidenceTimelineLinkResolution`
  are all discriminated. This made hook wiring straightforward,
  eliminated an entire class of null-ref bugs, and gave the
  compiler enough information to catch missed cases early.

- **Evidence as a first-class result.** Making `sequence` part of
  every evaluator's output from Milestone 2.6 onward meant the
  timeline linker at 2.11, the feedback projector at 2.10, and
  the Show Me interaction at 2.15 all composed without any
  schema changes. Reserving the field early paid off.

- **useReducer for session state.** Modeling lesson session state
  as a reducer whose actions delegate to pure domain functions
  meant zero domain logic leaked into React. Every session-related
  bug was diagnosable in isolation via existing unit tests.

- **Incremental milestone commits.** Small, coherent commits
  produced a readable history. Sprint 2 has 20+ commits, each
  reviewable in a single sitting. When a design mistake surfaced
  (Milestone 2.12 failure semantics), reverting was cheap because
  scope was contained.

- **Manual verification per milestone.** Every UI-touching
  milestone was verified live in the browser before commit. This
  caught the Rules of Hooks violation in 2.16 immediately, before
  it landed on the branch.

### Challenges Encountered

- **Windows Docker Desktop file-sharing quirk.** The single most
  time-consuming issue in Sprint 2. Reproduced consistently:
  identical docker commands succeeded from PowerShell and failed
  from Python subprocess with "Access is denied." Not isolated to
  path shape, integrity level, Python version, or docker flags.
  Documented in `docs/sprint-2/known-limitations.md` with a
  working invocation workaround. Deferred deeper investigation
  past Sprint 2 to avoid milestone drift.

- **Rules of Hooks violation in Milestone 2.16.** Placed a new
  `useMemo` after the loading-state early return. First render
  short-circuited before the memo; second render ran the memo.
  React counted 35 hooks vs 34, threw. Fix: move every hook to
  the top of the component, then early-return only after all
  hooks have been declared. Caught during first manual
  verification. No commit went out with the broken ordering.

- **Milestone 2.12 failure variant design mistake.** Original
  `PrismExecutionResult` failure variant returned an empty
  snapshots array. Architectural review at 2.13a caught that
  this was wrong: the timeline represents the execution narrative,
  not runtime evidence, and should be uniformly available. Widened
  the failure variant, added an invariant test. Corrected in the
  same milestone that introduced the boundary refactor. Honest
  amendment rather than hidden fix.

- **PowerShell + Windows-1252 encoding artifacts.** `Set-Content`
  on Windows emitted lone Windows-1252 punctuation bytes for em
  dashes, section signs, and bullets. Node/Vitest tolerated the
  invalid UTF-8; Next.js 15's Rust file reader did not. 32 files
  had accumulated the issue over multiple sessions before being
  caught. Fixed with a UTF-8-aware byte replacer and enforced
  ASCII-only comments going forward. Fixed as its own commit
  (`51742f1`) rather than mixed into a feature commit.

- **PowerShell wildcard interpretation of `[id]`.** The Next.js
  dynamic route folder `apps/web/app/lesson/[id]/` triggered
  wildcard globbing in `Set-Content -Path`. Worked around with
  `[System.IO.File]::WriteAllText` and `-LiteralPath` throughout.

- **Milestone 2.4 scope creep in the working tree.** When resuming
  Sprint 2, an uncommitted local session implementation existed
  that had already modeled learner attempts (Milestone 2.9
  territory). Trimming back to progression-only was the right
  call - it kept milestone boundaries clean and attempt modeling
  landed in 2.9 with proper test coverage.

### Lessons Learned

- **Reserve evidence structure early.** The `sequence` field on
  `ObjectiveEvidence` was added at Milestone 2.6 with only the
  registry using it. By Milestone 2.15 it powered Show Me,
  linkEvidence, and the entire evidence-linked learner experience.
  Reserving structural fields before they have consumers is much
  cheaper than adding them later.

- **Discriminated unions beat booleans.** `LessonWorkspaceMode =
  "active" | "review"` was chosen over `isReviewMode: boolean` in
  Milestone 2.15. Future modes (showcase, ai-guided, debug) can
  be added without a wave of consumer updates.

- **Correct mistakes explicitly.** The 2.12 failure variant
  correction was documented in the 2.13a commit message and the
  code comment inside `PrismExecutionResult`. Hidden fixes erode
  trust in the codebase; explicit amendments strengthen it.

- **Documentation belongs in the commit where the behavior lives.**
  The Windows Docker note landed in `README.md` in its own
  small commit (`1889b51`) rather than being buried in Milestone
  2.16. Small doc-only commits are cheap and searchable.

- **Manual verification is not a substitute for automated tests,
  but it catches different bugs.** The Rules of Hooks violation
  in 2.16 was caught by the browser console, not by unit tests.
  The Playwright suite in 2.17 now catches the same class of
  bug automatically going forward.

- **Boundaries stay clean when consumers cannot reach past their
  producer.** Every boundary rule in this sprint was defensible
  with reference to a specific handoff section. Sections 8, 21,
  22, 24, 25 of the Sprint 2 brief were quoted repeatedly during
  design decisions. Written architectural principles turn into
  code architecture only when they get consulted at each decision
  point.

---

## Sprint 3 Readiness

Sprint 2 leaves PRISM with:

- A complete, tested, and validated lesson experience for the
  Sprint 0 supported C++ profile.
- A stable set of domain packages (`@prism/lessons`,
  `@prism/objectives`, `@prism/execution-result`, plus Sprint 1
  packages) with 368 unit-test assertions.
- A working `/lesson/[id]` route validated end-to-end via
  Playwright integration.
- One real lesson (`cpp-understanding-variable-state`) and one
  smoke-test lesson.
- Documented architectural boundaries that Sprint 3 work will
  extend rather than replace.

Sprint 3 can begin on this foundation. Likely directions include:

- Curriculum: multiple lessons, ordering, prerequisites,
  progression across lessons.
- Learner intelligence: concept graph, mastery model, adaptive
  recommendations.
- Persistence: session storage, resume across reload, learner
  profile.
- Content authoring: lesson definitions moved out of inline
  TypeScript into a content boundary.
- Additional evaluator types as new pedagogical needs emerge.
- Possible C++ profile expansion (loops, conditionals, functions)
  once the current profile's teaching capacity is exhausted.

None of these require modifying Sprint 2's domain code. Sprint 3
extends; it does not replace.

---

## GO Decision

**Recommendation: GO WITH LIMITATIONS**

**Rationale:**

- Sprint 2 objectives achieved. Every milestone from 2.1 through
  2.17 delivered its named capability. Milestone 2.18 records the
  closure.
- Architectural boundaries validated. All eight boundaries (A
  through H) documented, tested, and intact.
- Vertical integration proven. 7 Playwright tests exercise the
  full learner journey end-to-end in the real browser.
- No production regressions. 368 unit-test assertions and 7
  integration assertions pass. Sprint 0 and Sprint 1 test surfaces
  unchanged.
- All known limitations documented in
  `docs/sprint-2/known-limitations.md`.

**Limitation qualifying the GO:**

- Windows local development requires the directory-scoped
  `uvicorn` invocation (`cd apps/api && python -m uvicorn main:app`)
  due to an unresolved Docker Desktop file-sharing quirk with
  Python subprocess. Workaround is documented in the README. Does
  not affect the shipped domain surface, the integration test
  suite, or the primary learner experience. Root cause
  investigation deferred to a future session.

Sprint 2 is closed. The repository is ready for Sprint 3.

---

## Related Documents

- `docs/sprint-2/sprint-2-architecture.md` - full architecture reference and pipeline diagram
- `docs/sprint-2/known-limitations.md` - documented Sprint 2 limitations and rationale
- `CHANGELOG.md` - project release history (v0.1.0, v0.2.0, v0.3.0)
- `docs/sprint-1/completion-report.md` - Sprint 1 closure record
- `docs/sprint-0/completion-report.md` - Sprint 0 closure record