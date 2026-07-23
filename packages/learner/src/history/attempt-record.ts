/**
 * LessonAttemptRecord.
 *
 * Projected read model, NOT a stored entity. Never persisted
 * directly. Instead, the history projection (see projections.ts)
 * folds objective_evaluated events into attempt records grouped by
 * attemptId.
 *
 * The projection guarantee:
 *
 *   For every LessonAttemptRecord returned by projectLessonHistory,
 *   there exists a corresponding sequence of objective_evaluated
 *   events in the event store carrying the same attemptId. Reversing
 *   the fold reproduces the events (modulo timestamp ordering).
 *
 * A LessonAttemptRecord carries:
 *
 *   attemptId        - the branded id shared by every objective
 *                      event of this attempt
 *   attemptNumber    - the 1-based attempt number within the step
 *   lessonId         - which lesson the attempt was against
 *   stepId           - which step of the lesson the attempt was against
 *   satisfiedObjectiveIds   - ids the evaluator returned satisfied=true
 *   unsatisfiedObjectiveIds - ids the evaluator returned satisfied=false
 *                             for a valid execution
 *   notEvaluatedObjectiveIds - ids that could not be evaluated because
 *                              the underlying execution failed
 *   verdict          - "complete" | "incomplete" | "execution_failed"
 *                      computed by the projection using the same rule
 *                      as Milestone 2.8's evaluateStep
 *   firstEventAt     - ISO timestamp of the earliest objective_evaluated
 *                      event in the group (proxy for attempt start)
 *   lastEventAt      - ISO timestamp of the latest objective_evaluated
 *                      event in the group (proxy for attempt end)
 *
 * The three ID lists partition the step's objectives - every objective
 * evaluated in this attempt appears in exactly one list. Order within
 * each list matches event order (earliest first).
 */

import type {
  AttemptId,
  LessonId,
  ObjectiveId,
  StepId,
} from "../domain/ids";

export type LessonAttemptVerdict =
  | "complete"
  | "incomplete"
  | "execution_failed";

export interface LessonAttemptRecord {
  readonly attemptId: AttemptId;
  readonly attemptNumber: number;
  readonly lessonId: LessonId;
  readonly stepId: StepId;
  readonly satisfiedObjectiveIds: readonly ObjectiveId[];
  readonly unsatisfiedObjectiveIds: readonly ObjectiveId[];
  readonly notEvaluatedObjectiveIds: readonly ObjectiveId[];
  readonly verdict: LessonAttemptVerdict;
  readonly firstEventAt: string;
  readonly lastEventAt: string;
}

// ---------------------------------------------------------------------------
// Verdict rule
// ---------------------------------------------------------------------------

/**
 * Compute the verdict for an attempt from its evaluated / not-evaluated
 * partitions.
 *
 * Rules (matching Milestone 2.8's evaluateStep):
 *   - if any objective is not_evaluated -> "execution_failed"
 *     (execution failure blocks meaningful evaluation of the whole
 *     step; it's not correct to say "partially complete" when the
 *     runtime never ran)
 *   - else if every objective is satisfied -> "complete"
 *   - else -> "incomplete"
 */
export function computeAttemptVerdict(input: {
  readonly satisfiedCount: number;
  readonly unsatisfiedCount: number;
  readonly notEvaluatedCount: number;
}): LessonAttemptVerdict {
  if (input.notEvaluatedCount > 0) return "execution_failed";
  if (input.unsatisfiedCount === 0 && input.satisfiedCount > 0) {
    return "complete";
  }
  // satisfiedCount == 0 && unsatisfiedCount == 0 is only reachable if
  // an attempt somehow evaluated zero objectives, which the lesson
  // validator forbids. Treated as "incomplete" defensively.
  return "incomplete";
}