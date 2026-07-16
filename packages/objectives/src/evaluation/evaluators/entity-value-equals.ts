/**
 * EntityValueEqualsEvaluator — Milestone 2.7.
 *
 * Satisfied when an entity with the target displayName was observed holding
 * the target value at any point during execution.
 *
 * This includes:
 *   - the entity's initial creation value
 *   - any subsequent value_changed event whose resulting value matches
 *
 * Evidence is the earliest matching observation.
 */

import type { ObjectiveEvaluatorPlugin } from "../plugin";
import type {
  ObjectiveEvaluationContext,
  ObjectiveEvaluationResult,
  ObjectiveEvidence,
} from "../types";
import type { EntityValueEqualsObjectiveDefinition } from "../../domain/types";
import type { NormalizedTraceEvent } from "@prism/trace-model";

export class EntityValueEqualsEvaluator
  implements ObjectiveEvaluatorPlugin<"entity_value_equals">
{
  readonly objectiveType = "entity_value_equals" as const;

  evaluate(
    definition: EntityValueEqualsObjectiveDefinition,
    context: ObjectiveEvaluationContext,
  ): ObjectiveEvaluationResult {
    // Track which entityIds correspond to the target displayName.
    // A single displayName can (in principle) map to multiple entityIds
    // across nested scopes, so we track the set.
    const matchingEntityIds = new Set<string>();

    for (const event of context.trace.events) {
      if (
        event.type === "entity.created" &&
        event.payload.kind === "entity.created" &&
        event.payload.displayName === definition.displayName &&
        event.entityId !== undefined
      ) {
        matchingEntityIds.add(event.entityId);

        if (event.payload.value === definition.value) {
          return this._satisfied(definition, event, {
            displayName: event.payload.displayName,
            value: event.payload.value,
          });
        }
      }

      if (
        event.type === "entity.value_changed" &&
        event.payload.kind === "entity.value_changed" &&
        event.entityId !== undefined &&
        matchingEntityIds.has(event.entityId) &&
        event.payload.value === definition.value
      ) {
        return this._satisfied(definition, event, {
          displayName: definition.displayName,
          previousValue: event.payload.previousValue,
          value: event.payload.value,
        });
      }
    }

    return {
      objectiveId: definition.id,
      satisfied: false,
      evidence: [],
    };
  }

  private _satisfied(
    definition: EntityValueEqualsObjectiveDefinition,
    event: NormalizedTraceEvent,
    observed: Record<string, unknown>,
  ): ObjectiveEvaluationResult {
    const evidence: ObjectiveEvidence = {
      sequence: event.sequence,
      entityId: event.entityId,
      observed,
      relatedEvent: event,
    };
    return {
      objectiveId: definition.id,
      satisfied: true,
      evidence: [evidence],
    };
  }
}
