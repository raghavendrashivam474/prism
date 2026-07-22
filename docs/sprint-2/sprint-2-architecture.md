# Sprint 2 Architecture

## Overview

Sprint 2 consumes Sprint 1.

Sprint 0 produced real C++ execution as Learning IR.
Sprint 1 transformed that IR into a deterministic, navigable visual
execution timeline.
Sprint 2 wraps the entire execution and visualization stack in an
educational layer: lessons, session progression, runtime objective
evaluation, learner feedback, evidence-linked review, and lesson
completion.

No Sprint 0 or Sprint 1 code was modified in Sprint 2.
The educational layer is composed on top of stable prior sprints.

## Full Pipeline

BROWSER
|
v
Lesson Route (/lesson/[id])
|
v
useLessonWorkspace hook
|
+-- StaticLessonLoader
| |
| v
| LessonDefinition (validated at registration)
| |
| v
| LessonSessionState (via startSession)
|
+-- HttpExecutionRunner
| |
| v
| HTTP POST /api/v1/executions [SPRINT 0/1]
| |
| v
| ExecutionService [SPRINT 0]
| |
| v
| Learning IR v0.1 (JSON)
| |
| v
| LearningIrV01Ingestor [SPRINT 1]
| |
| v
| NormalizedTrace
| |
| v
| DefaultVisualStateEngine [SPRINT 1]
| |
| v
| VisualStateSnapshot[] [SPRINT 1]
| |
| v
| SnapshotTimelineController [SPRINT 1]
| |
| v
| PrismExecutionResult [SPRINT 2]
|
+-- toExecutionOutcome
| |
| v
| ExecutionOutcome (lesson-domain)
| |
| v
| recordAttempt
| |
| v
| evaluateStep
| |
| v
| ObjectiveEvaluatorRegistry
| |
| v
| [entity_exists, entity_value_equals,
| entity_value_changed, execution_completed] evaluators
| |
| v
| ObjectiveEvaluationResult (+ evidence with sequence)
| |
| v
| StepEvaluation
| |
| v
| LessonAttempt (appended to LessonSessionState)
|
+-- projectStepFeedback
| |
| v
| LearnerFeedback (tone + per-objective structured messages)
|
+-- linkEvidence (on Show Me click)
| |
| v
| snapshotIndex --> timeline.select(...)
|
v
currentSnapshot <-- single authority (Sprint 1 invariant preserved)
|
+--+----------------+--------------------+
| | | |
v v v v
Monaco VariablePanel StepDescriber LessonFeedbackPanel
line (Sprint 1) (Sprint 1) (Sprint 2)
highlight


## Packages Introduced or Extended in Sprint 2

| Package                          | Introduced | Role                                                    |
|----------------------------------|------------|---------------------------------------------------------|
| @prism/lessons                   | Sprint 2   | LessonDefinition, session engine, attempts, evaluation, feedback, bridge |
| @prism/objectives                | Sprint 2   | Objective model, evaluator registry, four concrete evaluators |
| @prism/execution-result          | Sprint 2   | Unified PrismExecutionResult composing trace + snapshots + timeline |
| @prism/timeline                  | Sprint 1   | Extended in Sprint 2 with evidence linker (linkEvidence) |
| @prism/trace-model               | Sprint 1   | Unchanged                                               |
| @prism/visual-state-engine       | Sprint 1   | Unchanged                                               |
| @prism/visualizer-variable-state | Sprint 1   | Unchanged                                               |
| apps/web                         | Sprint 1   | Extended with /lesson/[id] route, lesson workspace hook, four new components |

## Architectural Boundaries

Each boundary has a clear owner. Consumers never reach past their
immediate producer.

### A. Execution Service

- Owner: apps/api + core/execution
- Input: source code + language id
- Output: Learning IR v0.1 JSON envelope
- Sprint 2 status: unchanged

### B. Learning IR

- Owner: contracts/learning_ir + packages/trace-model (ingestor)
- Input: raw IR JSON
- Output: NormalizedTrace
- Sprint 2 status: unchanged

### C. Visual State Engine

- Owner: packages/visual-state-engine
- Input: NormalizedTrace
- Output: VisualStateSnapshot[]
- Sprint 2 status: unchanged (snapshot invariants preserved)

### D. Timeline

- Owner: packages/timeline
- Input: VisualStateSnapshot[], select(index)
- Output: currentSnapshot
- Sprint 2 addition: evidence linker resolves an evidence.sequence
  to a snapshot index. The controller itself is unchanged; the
  linker is an additive read-only helper.

### E. Lesson Session Engine

- Owner: packages/lessons/session
- Input: LessonDefinition
- Output: LessonSessionState (with attempts, step statuses, session status)
- Transitions: startSession, completeActiveStep, activateStep,
  resetSession, recordAttempt (via orchestrator), plus helpers.
- Boundary rule: React never invents transitions. Every UI action
  delegates to a pure domain function.

### F. Objective Evaluators

- Owner: packages/objectives/evaluation
- Input: ObjectiveDefinition + ObjectiveEvaluationContext (trace + snapshots)
- Output: ObjectiveEvaluationResult (satisfied + evidence)
- Boundary rule: evaluators own semantic checks only. They produce
  no learner-facing text.

### G. Feedback Projection

- Owner: packages/lessons/feedback
- Input: LessonStepDefinition + StepEvaluation
- Output: LearnerFeedback (tone, heading, summary, per-objective structured messages)
- Boundary rule: evaluator plugins never produce copy. Feedback
  projection never invents semantics.

### H. Lesson UI

- Owner: apps/web (lesson workspace hook + components)
- Input: LessonDefinition, LessonSessionState, PrismExecutionResult, LearnerFeedback
- Output: rendered workspace
- Boundary rule: UI is presentation-only. All state transitions
  originate in domain functions dispatched through useReducer or
  domain-call callbacks.

## Data Flow Invariants (Preserved Through Sprint 2)

1. Learning IR is the execution-to-learning boundary. Nothing
   downstream of ingestion ever sees raw C++ or docker output.

2. currentSnapshot is the single active-execution-step authority.
   Monaco line highlight, variable panel, and step description all
   derive from it. Sprint 2 added: LessonFeedbackPanel's Show Me
   also selects the correct snapshot via linkEvidence.

3. Domain functions are pure. Every session transition, every
   evaluation, every feedback projection returns a new value; no
   in-place mutation.

4. Execution outcomes are discriminated: a failure never masquerades
   as an unsatisfied objective. On execution failure, per-objective
   status is `not_evaluated`, not `unsatisfied`.

5. Timeline availability is decoupled from success. A failure result
   still carries a navigable timeline (the failure snapshot), so
   consumers do not need to branch on status for timeline rendering.

## What Sprint 2 Explicitly Did NOT Change

- Sprint 0 supported C++ profile (int main, int locals, integer
  literals, assignment, integer arithmetic, sequential execution,
  return 0). No new C++ syntax supported.
- Learning IR schema. Still v0.1.
- Visual State Engine reducer logic. Unchanged.
- Snapshot timeline controller behavior. Extended additively.
- FastAPI route surface. Unchanged.

## Related Documents

- docs/sprint-2/completion-report.md - milestone-by-milestone record and GO decision
- docs/sprint-2/known-limitations.md - documented Sprint 2 limitations
- CHANGELOG.md - release history for v0.1.0, v0.2.0, v0.3.0