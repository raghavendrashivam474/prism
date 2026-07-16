/**
 * Lesson attempt orchestrator — Milestone 2.9.
 *
 * Pure TypeScript. No React, no HTTP, no browser APIs, no I/O.
 *
 * This module bridges three previously-separate concerns:
 *
 *   Session progression       (Milestone 2.4 — session/engine.ts)
 *   Step evaluation           (Milestone 2.8 — evaluation/step-evaluator.ts)
 *   Objective evaluators      (Milestones 2.6, 2.7 — @prism/objectives)
 *
 * It answers ONE question per invocation:
 *
 *   Given the current session state, a lesson definition, a learner
 *   submission (source + execution outcome), and an evaluator registry —
 *   what is the new session state?
 *
 * Behaviour:
 *
 *   1. Reject if the session is already completed.
 *   2. Reject if there is no active step at currentStepIndex.
 *   3. Locate the matching LessonStepDefinition in the lesson.
 *   4. Call evaluateStep(step, outcome, registry) — no semantic logic here.
 *   5. Build a new LessonAttempt with monotonic attemptNumber.
 *   6. Append the attempt to the active step.
 *   7. If the evaluation verdict is "complete", advance the step exactly
 *      like completeActiveStep would (same effect on status flags, next
 *      step unlock, session termination on final step). If not, leave the
 *      step active for another attempt.
 *
 * Determinism:
 *   The submittedAt timestamp is produced by an injected `now` function,
 *   defaulting to () => new Date().toISOString(). Tests inject a fixed
 *   clock so results are deterministic and equal across runs.
 *
 * This orchestrator does NOT:
 *   - execute code (the caller does that and passes ExecutionOutcome)
 *   - re-implement session progression rules
 *   - re-implement objective evaluation
 *   - produce learner-facing wording (Milestone 2.10)
 *   - persist attempts beyond the returned session state (a Sprint 3 concern)
 */

import type { LessonDefinition } from "../domain/types";
import type { ObjectiveEvaluatorRegistry } from "@prism/objectives";
import type {
  LessonAttempt,
  LessonSessionState,
  LessonStepState,
} from "./types";
import type { ExecutionOutcome } from "../evaluation/types";
import { evaluateStep } from "../evaluation/step-evaluator";
import { LessonSessionError } from "./engine";

export interface RecordAttemptInput {
  readonly source: string;
  readonly outcome: ExecutionOutcome;
  /**
   * Deterministic clock. Defaults to () => new Date().toISOString().
   * Tests inject a fixed value to keep results reproducible.
   */
  readonly now?: () => string;
}

export function recordAttempt(
  state: LessonSessionState,
  lesson: LessonDefinition,
  input: RecordAttemptInput,
  registry: ObjectiveEvaluatorRegistry,
): LessonSessionState {
  if (state.status === "completed") {
    throw new LessonSessionError(
      "Cannot record attempt: lesson is already completed.",
      "LESSON_ALREADY_COMPLETED",
      { lessonId: state.lessonId },
    );
  }

  if (state.lessonId !== lesson.id) {
    throw new LessonSessionError(
      `Session lessonId '${state.lessonId}' does not match provided lesson '${lesson.id}'.`,
      "LESSON_MISMATCH",
      { sessionLessonId: state.lessonId, providedLessonId: lesson.id },
    );
  }

  const activeStepState = state.stepStates[state.currentStepIndex];
  if (!activeStepState || activeStepState.status !== "active") {
    throw new LessonSessionError(
      "Cannot record attempt: no active step at current index.",
      "NO_ACTIVE_STEP",
      { currentStepIndex: state.currentStepIndex },
    );
  }

  const stepDefinition = lesson.steps.find(
    (s) => s.id === activeStepState.stepId,
  );
  if (!stepDefinition) {
    // Defensive: startSession preserves step ordering from the lesson,
    // so this should be unreachable given a matching lesson.
    throw new LessonSessionError(
      `Active step '${activeStepState.stepId}' not found in lesson '${lesson.id}'.`,
      "STEP_DEFINITION_NOT_FOUND",
      { stepId: activeStepState.stepId, lessonId: lesson.id },
    );
  }

  const evaluation = evaluateStep(stepDefinition, input.outcome, registry);

  const now = input.now ?? (() => new Date().toISOString());
  const attempt: LessonAttempt = {
    attemptNumber: activeStepState.attempts.length + 1,
    submittedAt: now(),
    source: input.source,
    outcome: input.outcome,
    evaluation,
  };

  const stepShouldComplete = evaluation.verdict === "complete";
  const isLastStep = state.currentStepIndex === state.stepStates.length - 1;

  const newStepStates: LessonStepState[] = state.stepStates.map((s, i) => {
    if (i === state.currentStepIndex) {
      return {
        ...s,
        status: stepShouldComplete ? ("completed" as const) : s.status,
        attempts: [...s.attempts, attempt],
      };
    }
    if (
      stepShouldComplete &&
      i === state.currentStepIndex + 1 &&
      s.status === "locked"
    ) {
      return { ...s, status: "available" as const };
    }
    return s;
  });

  return {
    ...state,
    status:
      stepShouldComplete && isLastStep ? ("completed" as const) : state.status,
    stepStates: newStepStates,
  };
}
