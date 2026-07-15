/**
 * Lesson session domain types — Milestone 2.4.
 *
 * A LessonSessionState represents where a learner currently is inside a lesson:
 *   - which step is active
 *   - which steps are locked, available, active, or completed
 *   - whether the lesson as a whole is active or completed
 *
 * The session engine transitions between states purely.
 * React never mutates these values directly.
 *
 * Learner attempts are NOT modelled here.
 * Attempts belong to Milestone 2.9.
 */

// ---------------------------------------------------------------------------
// Status enums
// ---------------------------------------------------------------------------

export type LessonSessionStatus = "not_started" | "active" | "completed";

export type LessonStepStatus = "locked" | "available" | "active" | "completed";

// ---------------------------------------------------------------------------
// Step state
// ---------------------------------------------------------------------------

export interface LessonStepState {
  readonly stepId: string;
  readonly status: LessonStepStatus;
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
