/**
 * Lesson step evaluation domain types — Milestone 2.8.
 *
 * This layer bridges two Sprint 2 boundaries:
 *
 *   - Sprint 1 execution outputs (NormalizedTrace + VisualStateSnapshot[])
 *   - Sprint 2 objective evaluators (@prism/objectives)
 *
 * It answers ONE question per invocation:
 *
 *   Given this lesson step and this execution outcome, which of the step's
 *   objectives were satisfied, with what runtime evidence, and is the step
 *   overall complete?
 *
 * It does NOT:
 *   - drive lesson progression (the session engine owns that)
 *   - record learner attempts (Milestone 2.9)
 *   - produce learner-facing feedback (Milestone 2.10)
 *   - link evidence to a timeline (Milestone 2.11)
 *
 * Failure vs unsatisfied distinction (handoff §25):
 *
 *   EXECUTION FAILURE
 *          ?
 *   VALID EXECUTION WITH UNSATISFIED OBJECTIVE
 *
 * When execution fails, we do NOT mark objectives "unsatisfied" — there was
 * no runtime to observe. We mark them "not_evaluated" and the step is
 * incomplete.
 */

import type { NormalizedTrace } from "@prism/trace-model";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import type {
  ObjectiveDefinition,
  ObjectiveEvaluationResult,
} from "@prism/objectives";

// ---------------------------------------------------------------------------
// Execution outcome
// ---------------------------------------------------------------------------

/**
 * A successful execution that produced a normalized trace AND its
 * reconstructed snapshot timeline.
 *
 * The lesson-side caller is responsible for producing both. This module
 * does not run the visual state engine itself — visual state reconstruction
 * remains owned by the Sprint 1 engine.
 */
export interface SuccessfulExecutionOutcome {
  readonly kind: "success";
  readonly trace: NormalizedTrace;
  readonly snapshots: readonly VisualStateSnapshot[];
}

/**
 * An execution failure (compilation error, sandbox error, unsupported
 * profile violation, etc.).
 *
 * When the outcome is failure, we intentionally carry ONLY the semantic
 * failure category and message. We do not attempt to reconstruct a
 * partial trace here. The learner-facing wording is a later concern.
 */
export interface FailedExecutionOutcome {
  readonly kind: "failure";
  readonly category: string;
  readonly message: string;
}

export type ExecutionOutcome =
  | SuccessfulExecutionOutcome
  | FailedExecutionOutcome;

// ---------------------------------------------------------------------------
// Per-objective outcome
// ---------------------------------------------------------------------------

/**
 * The status of a single objective inside a step evaluation.
 *
 *   satisfied      — objective's evaluator returned satisfied=true
 *   unsatisfied    — objective's evaluator returned satisfied=false against
 *                    a valid execution
 *   not_evaluated  — execution failed, so no runtime observation was
 *                    possible for this objective (handoff §25)
 */
export type StepObjectiveStatus =
  | "satisfied"
  | "unsatisfied"
  | "not_evaluated";

export interface StepObjectiveOutcome {
  readonly objectiveId: string;
  readonly status: StepObjectiveStatus;
  /**
   * The full evaluation result from the evaluator plugin.
   *
   * Present when status is "satisfied" or "unsatisfied".
   * Absent (null) when status is "not_evaluated".
   */
  readonly result: ObjectiveEvaluationResult | null;
}

// ---------------------------------------------------------------------------
// Step evaluation
// ---------------------------------------------------------------------------

/**
 * The overall verdict for a step after evaluation.
 *
 *   complete           — execution succeeded AND every objective satisfied
 *   incomplete         — execution succeeded but at least one objective
 *                        was unsatisfied
 *   execution_failed   — execution failed; no runtime observation possible
 */
export type StepEvaluationVerdict =
  | "complete"
  | "incomplete"
  | "execution_failed";

export interface StepEvaluation {
  readonly stepId: string;
  readonly verdict: StepEvaluationVerdict;
  readonly outcomes: readonly StepObjectiveOutcome[];
  /**
   * Present when verdict is "execution_failed". Preserves the failure
   * category and message so the caller can distinguish failure modes
   * without re-inspecting the execution outcome.
   */
  readonly failure: {
    readonly category: string;
    readonly message: string;
  } | null;
}

// Re-export for convenience so lesson-side callers don't need a separate
// import from @prism/objectives just to type an objectives array.
export type { ObjectiveDefinition, ObjectiveEvaluationResult };
