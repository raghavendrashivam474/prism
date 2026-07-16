/**
 * EntityExistsEvaluator — Milestone 2.7.
 *
 * Satisfied when execution observed the creation of an entity whose
 * displayName matches the objective's target.
 *
 * Evidence:
 *   - sequence of the entity.created event
 *   - entityId of the created entity
 *   - observed.displayName and observed.value at creation
 */

import type { ObjectiveEvaluatorPlugin } from "../plugin";
import type {
  ObjectiveEvaluationContext,
  ObjectiveEvaluationResult,
  ObjectiveEvidence,
} from "../types";
import type { EntityExistsObjectiveDefinition } from "../../domain/types";

export class EntityExistsEvaluator
  implements ObjectiveEvaluatorPlugin<"entity_exists">
{
  readonly objectiveType = "entity_exists" as const;

  evaluate(
    definition: EntityExistsObjectiveDefinition,
    context: ObjectiveEvaluationContext,
  ): ObjectiveEvaluationResult {
    for (const event of context.trace.events) {
      if (event.type !== "entity.created") continue;
      if (event.payload.kind !== "entity.created") continue;
      if (event.payload.displayName !== definition.displayName) continue;

      const evidence: ObjectiveEvidence = {
        sequence: event.sequence,
        entityId: event.entityId,
        observed: {
          displayName: event.payload.displayName,
          value: event.payload.value,
        },
        relatedEvent: event,
      };

      return {
        objectiveId: definition.id,
        satisfied: true,
        evidence: [evidence],
      };
    }

    return {
      objectiveId: definition.id,
      satisfied: false,
      evidence: [],
    };
  }
}
