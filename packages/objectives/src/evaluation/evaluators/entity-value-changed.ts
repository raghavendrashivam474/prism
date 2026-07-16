/**
 * EntityValueChangedEvaluator - Milestone 2.7.
 *
 * Satisfied when a DIRECT observed transition from `from` to `to` happened
 * for an entity matching displayName. "Direct" means a single
 * entity.value_changed event with previousValue === from and value === to.
 *
 * Sprint 2 brief section 21 explicitly rejects the loose interpretation:
 *   "Do not infer satisfaction merely because
 *    Snapshot 2: x = 10, Snapshot 9: x = 20."
 *
 * Evidence is the first matching value_changed event.
 */

import type { ObjectiveEvaluatorPlugin } from "../plugin";
import type {
  ObjectiveEvaluationContext,
  ObjectiveEvaluationResult,
  ObjectiveEvidence,
} from "../types";
import type { EntityValueChangedObjectiveDefinition } from "../../domain/types";

export class EntityValueChangedEvaluator
  implements ObjectiveEvaluatorPlugin<"entity_value_changed">
{
  readonly objectiveType = "entity_value_changed" as const;

  evaluate(
    definition: EntityValueChangedObjectiveDefinition,
    context: ObjectiveEvaluationContext,
  ): ObjectiveEvaluationResult {
    const matchingEntityIds = new Set<string>();

    for (const event of context.trace.events) {
      if (
        event.type === "entity.created" &&
        event.payload.kind === "entity.created" &&
        event.payload.displayName === definition.displayName &&
        event.entityId !== undefined
      ) {
        matchingEntityIds.add(event.entityId);
        continue;
      }

      if (
        event.type === "entity.value_changed" &&
        event.payload.kind === "entity.value_changed" &&
        event.entityId !== undefined &&
        matchingEntityIds.has(event.entityId) &&
        event.payload.previousValue === definition.from &&
        event.payload.value === definition.to
      ) {
        const evidence: ObjectiveEvidence = {
          sequence: event.sequence,
          entityId: event.entityId,
          observed: {
            displayName: definition.displayName,
            previousValue: event.payload.previousValue,
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
    }

    return {
      objectiveId: definition.id,
      satisfied: false,
      evidence: [],
    };
  }
}
