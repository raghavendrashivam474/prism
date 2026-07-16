/**
 * Lesson session domain types — Milestones 2.4 and 2.9.
 *
 * A LessonSessionState represents where a learner currently is inside a lesson:
 *   - which step is active
 *   - which steps are locked, available, active, or completed
 *   - the learner attempts recorded against each step (Milestone 2.9)
 *   - whether the lesson as a whole is active or completed
 *
 * The session engine transitions between states purely.
 * React never mutates these values directly.
 */

import type { ExecutionOutcome, StepEvaluation } from "../evaluation/types";

// ---------------------------------------------------------------------------
// Status enums
// ---------------------------------------------------------------------------

export type LessonSessionStatus = "not_started" | "active" | "completed";

export type LessonStepStatus = "locked" | "available" | "active" | "completed";

// ---------------------------------------------------------------------------
// Attempt (Milestone 2.9)
// ---------------------------------------------------------------------------

/**
 * A single learner submission against a lesson step.
 *
 * Attempts are scoped to a lesson session (they do not persist across
 * sessions in Sprint 2). A Sprint 3 milestone will introduce durable
 * lesson history and per-attempt persistence.
 *
 * Fields:
 *   attemptNumber — 1-based, monotonic within the step
 *   submittedAt   — ISO 8601 timestamp string, produced deterministically
 *                   via injected clock (see attempt-orchestrator.recordAttempt)
 *   source        — the learner-submitted source code
 *   outcome       — the ExecutionOutcome the caller obtained by running it
 *   evaluation    — the StepEvaluation produced by evaluateStep against the
 *                   step and outcome
 *
 * Attempts contain NO learner-facing wording. Feedback wording is a
 * projection built on top of the underlying evaluation (Milestone 2.10).
 */
export interface LessonAttempt {
  readonly attemptNumber: number;
  readonly submittedAt: string;
  readonly source: string;
  readonly outcome: ExecutionOutcome;
  readonly evaluation: StepEvaluation;
}

// ---------------------------------------------------------------------------
// Step state
// ---------------------------------------------------------------------------

export interface LessonStepState {
  readonly stepId: string;
  readonly status: LessonStepStatus;
  /**
   * Attempts recorded against this step, in submission order.
   *
   * Initial state is [] (established by startSession).
   * resetSession clears this back to [].
   * completeActiveStep and activateStep never modify attempts —
   * only recordAttempt appends.
   */
  readonly attempts: readonly LessonAttempt[];
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export interface LessonSessionState {
  readonly lessonId: string;
  readonly status: LessonSessionStatus;
  readonly currentStepIndex: number;
  readonly stepStates: readonly LessonStepState[];
}
