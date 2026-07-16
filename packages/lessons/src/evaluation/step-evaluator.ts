/**
 * evaluateStep - Milestone 2.8.
 *
 * Pure function. Given:
 *
 *   - a validated LessonStepDefinition
 *   - an ExecutionOutcome (success or failure)
 *   - an ObjectiveEvaluatorRegistry
 *
 * returns a deterministic StepEvaluation.
 *
 * Behaviour rules:
 *
 *   1. If outcome.kind === "failure":
 *        - Every objective is reported as "not_evaluated".
 *        - The step verdict is "execution_failed".
 *        - No evaluator plugin is invoked.
 *
 *   2. If outcome.kind === "success":
 *        - Each objective is evaluated in definition order through the
 *          registry, using the trace + snapshots as evaluation context.
 *        - Each objective's status is "satisfied" or "unsatisfied" based on
 *          the plugin's result.
 *        - The step verdict is "complete" iff every objective is satisfied,
 *          otherwise "incomplete".
 *
 * A step with zero objectives is intentionally impossible: lesson validation
 * (Milestone 2.2) rejects empty objectives arrays. This function does NOT
 * re-validate - it trusts the definition it receives.
 *
 * This function does not throw for any evaluator returning satisfied=false.
 * It DOES propagate any error thrown by the registry (missing evaluator,
 * plugin bug) so that lesson-authoring problems surface loudly.
 */

import type { LessonStepDefinition } from "../domain/types";
import type { ObjectiveEvaluatorRegistry } from "@prism/objectives";
import type {
  ExecutionOutcome,
  StepEvaluation,
  StepObjectiveOutcome,
} from "./types";

export function evaluateStep(
  step: LessonStepDefinition,
  outcome: ExecutionOutcome,
  registry: ObjectiveEvaluatorRegistry,
): StepEvaluation {
  if (outcome.kind === "failure") {
    const outcomes: StepObjectiveOutcome[] = step.objectives.map((obj) => ({
      objectiveId: obj.id,
      status: "not_evaluated" as const,
      result: null,
    }));

    return {
      stepId: step.id,
      verdict: "execution_failed",
      outcomes,
      failure: {
        category: outcome.category,
        message: outcome.message,
      },
    };
  }

  // outcome.kind === "success"
  const context = {
    trace: outcome.trace,
    snapshots: outcome.snapshots,
  };

  const outcomes: StepObjectiveOutcome[] = step.objectives.map((obj) => {
    const result = registry.evaluate(obj, context);
    return {
      objectiveId: obj.id,
      status: result.satisfied ? ("satisfied" as const) : ("unsatisfied" as const),
      result,
    };
  });

  const allSatisfied = outcomes.every((o) => o.status === "satisfied");

  return {
    stepId: step.id,
    verdict: allSatisfied ? "complete" : "incomplete",
    outcomes,
    failure: null,
  };
}
