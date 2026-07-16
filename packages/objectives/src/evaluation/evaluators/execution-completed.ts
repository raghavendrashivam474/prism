/**
 * ExecutionCompletedEvaluator — Milestone 2.7.
 *
 * Satisfied when the trace contains an execution.completed event.
 *
 * A trace with an execution.failed event does NOT satisfy this objective.
 * It also does NOT throw — Sprint 2 section 25 makes clear that lesson-level
 * "should we even evaluate?" logic belongs to Milestone 2.8, not here.
 * This evaluator simply reports satisfied=false in that case.
 */

import type { ObjectiveEvaluatorPlugin } from "../plugin";
import type {
  ObjectiveEvaluationContext,
  ObjectiveEvaluationResult,
} from "../types";
import type { ExecutionCompletedObjectiveDefinition } from "../../domain/types";

export class ExecutionCompletedEvaluator
  implements ObjectiveEvaluatorPlugin<"execution_completed">
{
  readonly objectiveType = "execution_completed" as const;

  evaluate(
    definition: ExecutionCompletedObjectiveDefinition,
    context: ObjectiveEvaluationContext,
  ): ObjectiveEvaluationResult {
    for (const event of context.trace.events) {
      if (event.type === "execution.completed") {
        return {
          objectiveId: definition.id,
          satisfied: true,
          evidence: [
            {
              sequence: event.sequence,
              observed: { kind: "execution.completed" },
              relatedEvent: event,
            },
          ],
        };
      }
    }

    return {
      objectiveId: definition.id,
      satisfied: false,
      evidence: [],
    };
  }
}
