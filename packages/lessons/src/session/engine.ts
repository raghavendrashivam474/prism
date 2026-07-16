/**
 * Lesson Session Engine - Milestone 2.4 (extended for 2.9).
 *
 * Pure TypeScript. No React, no HTTP, no browser APIs.
 *
 * The engine transitions LessonSessionState between valid states
 * in response to progression actions:
 *
 *   startSession(lesson)           ? initialise session; step 0 is active
 *   completeActiveStep(state)      ? mark active step completed; unlock next
 *   activateStep(state, stepId)    ? activate an available step
 *   resetSession(lesson)           ? fresh session from scratch
 *
 * Read helpers:
 *   currentStepState(state)        ? the current step state or null
 *   isLessonComplete(state)        ? whether the session is completed
 *
 * Every transition returns a NEW state object. Nothing is mutated.
 *
 * Invalid transitions throw LessonSessionError with a machine-readable code.
 * The engine never silently swallows an invalid transition.
 *
 * Milestone 2.9 addition:
 *   startSession initialises every step with attempts: [].
 *   All progression transitions preserve attempts arrays unchanged.
 *   Attempt append semantics live in attempt-orchestrator.ts, not here,
 *   because appending an attempt requires an evaluator registry and an
 *   execution outcome - dependencies the pure progression engine does
 *   not have.
 */

import type { LessonDefinition } from "../domain/types";
import { validateLessonDefinition } from "../domain/validator";
import type {
  LessonSessionState,
  LessonStepState,
} from "./types";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LessonSessionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "LessonSessionError";
  }
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/**
 * Create an initial session state from a validated lesson definition.
 *
 * The first step is immediately active. All subsequent steps are locked.
 * The session status is "active".
 * Every step starts with attempts: [].
 */
export function startSession(lesson: LessonDefinition): LessonSessionState {
  validateLessonDefinition(lesson);

  const stepStates: LessonStepState[] = lesson.steps.map((step, index) => ({
    stepId: step.id,
    status: index === 0 ? "active" : "locked",
    attempts: [],
  }));

  return {
    lessonId: lesson.id,
    status: "active",
    currentStepIndex: 0,
    stepStates,
  };
}

/**
 * Reset a session to the initial state. Equivalent to startSession.
 * All previously-recorded attempts are cleared.
 */
export function resetSession(lesson: LessonDefinition): LessonSessionState {
  return startSession(lesson);
}

// ---------------------------------------------------------------------------
// Step completion
// ---------------------------------------------------------------------------

/**
 * Mark the currently active step as completed.
 *
 * Effects:
 *   - Active step transitions to "completed".
 *   - If a next step exists and is "locked", it becomes "available".
 *   - The next step is NOT automatically activated.
 *   - currentStepIndex remains unchanged.
 *   - If the active step is the FINAL step, the session status
 *     becomes "completed" and currentStepIndex stays valid.
 *   - Attempts arrays are preserved unchanged.
 *
 * Throws LessonSessionError if:
 *   - Session is already completed.
 *   - Current step is not active.
 */
export function completeActiveStep(
  state: LessonSessionState,
): LessonSessionState {
  if (state.status === "completed") {
    throw new LessonSessionError(
      "Cannot complete step: lesson is already completed.",
      "LESSON_ALREADY_COMPLETED",
      { lessonId: state.lessonId },
    );
  }

  const activeStep = state.stepStates[state.currentStepIndex];
  if (!activeStep || activeStep.status !== "active") {
    throw new LessonSessionError(
      "Cannot complete step: no active step at current index.",
      "NO_ACTIVE_STEP",
      { currentStepIndex: state.currentStepIndex },
    );
  }

  const isLastStep = state.currentStepIndex === state.stepStates.length - 1;

  const newStepStates = state.stepStates.map((s, i) => {
    if (i === state.currentStepIndex) {
      return { ...s, status: "completed" as const };
    }
    if (
      i === state.currentStepIndex + 1 &&
      s.status === "locked"
    ) {
      return { ...s, status: "available" as const };
    }
    return s;
  });

  return {
    ...state,
    status: isLastStep ? "completed" : state.status,
    stepStates: newStepStates,
  };
}

// ---------------------------------------------------------------------------
// Step activation
// ---------------------------------------------------------------------------

/**
 * Activate an available step by its step ID.
 *
 * Only a step with status "available" may be activated.
 * Attempts arrays are preserved unchanged.
 *
 * Throws LessonSessionError if:
 *   - Session is already completed.
 *   - Step ID is not found.
 *   - Step is locked, completed, or already active.
 */
export function activateStep(
  state: LessonSessionState,
  stepId: string,
): LessonSessionState {
  if (state.status === "completed") {
    throw new LessonSessionError(
      "Cannot activate step: lesson is already completed.",
      "LESSON_ALREADY_COMPLETED",
      { lessonId: state.lessonId },
    );
  }

  const targetIndex = state.stepStates.findIndex((s) => s.stepId === stepId);
  if (targetIndex === -1) {
    throw new LessonSessionError(
      `Step '${stepId}' not found in session.`,
      "STEP_NOT_FOUND",
      { stepId },
    );
  }

  const targetStep = state.stepStates[targetIndex];

  if (targetStep.status === "locked") {
    throw new LessonSessionError(
      `Cannot activate step '${stepId}': step is locked.`,
      "STEP_LOCKED",
      { stepId, status: targetStep.status },
    );
  }

  if (targetStep.status === "completed") {
    throw new LessonSessionError(
      `Cannot activate step '${stepId}': step is already completed.`,
      "STEP_ALREADY_COMPLETED",
      { stepId, status: targetStep.status },
    );
  }

  if (targetStep.status === "active") {
    throw new LessonSessionError(
      `Cannot activate step '${stepId}': step is already active.`,
      "STEP_ALREADY_ACTIVE",
      { stepId, status: targetStep.status },
    );
  }

  // targetStep.status === "available"
  const newStepStates = state.stepStates.map((s, i) => {
    if (i === targetIndex) {
      return { ...s, status: "active" as const };
    }
    return s;
  });

  return {
    ...state,
    currentStepIndex: targetIndex,
    stepStates: newStepStates,
  };
}

// ---------------------------------------------------------------------------
// Read helpers (pure)
// ---------------------------------------------------------------------------

export function currentStepState(
  state: LessonSessionState,
): LessonStepState | null {
  return state.stepStates[state.currentStepIndex] ?? null;
}

export function isLessonComplete(state: LessonSessionState): boolean {
  return state.status === "completed";
}
