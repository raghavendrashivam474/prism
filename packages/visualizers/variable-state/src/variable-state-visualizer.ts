/**
 * Variable State Visualiser.
 *
 * Consumes a VisualStateSnapshot and produces a VariableRenderModel.
 *
 * Determines change kind for each variable:
 *   created   — the entity was created at this exact step
 *   changed   — the entity value changed at this step
 *   unchanged — the entity exists but did not change at this step
 *
 * Does not parse Learning IR. Does not know about C++.
 * Reads VisualState entities and current event type.
 */

import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import type { VisualizerPlugin } from "./plugin";

export type VariableChangeKind = "created" | "changed" | "unchanged";

export interface VariableEntry {
  readonly entityId: string;
  readonly displayName: string;
  readonly dataType: string;
  readonly currentValue: number;
  readonly previousValue?: number;
  readonly changeKind: VariableChangeKind;
}

export interface VariableRenderModel {
  readonly variables: readonly VariableEntry[];
}

export class VariableStateVisualizer
  implements VisualizerPlugin<VariableRenderModel>
{
  readonly id = "variable-state";

  supports(snapshot: VisualStateSnapshot): boolean {
    // Show the variable panel whenever there are entities in state,
    // or when an entity is being created at this step.
    const hasEntities = Object.keys(snapshot.state.entities).length > 0;
    const isEntityEvent =
      snapshot.event.type === "entity.created" ||
      snapshot.event.type === "entity.value_changed";
    return hasEntities || isEntityEvent;
  }

  buildRenderModel(snapshot: VisualStateSnapshot): VariableRenderModel {
    const { state, event } = snapshot;
    const entities = Object.values(state.entities);

    const variables: VariableEntry[] = entities.map((entity) => {
      const changeKind = this._determineChangeKind(entity.entityId, event);

      let previousValue: number | undefined;
      if (
        changeKind === "changed" &&
        event.type === "entity.value_changed" &&
        event.payload.kind === "entity.value_changed"
      ) {
        previousValue = event.payload.previousValue;
      }

      return {
        entityId: entity.entityId,
        displayName: entity.displayName,
        dataType: entity.dataType,
        currentValue: entity.value,
        previousValue,
        changeKind,
      };
    });

    return { variables };
  }

  private _determineChangeKind(
    entityId: string,
    event: VisualStateSnapshot["event"],
  ): VariableChangeKind {
    if (event.entityId !== entityId) return "unchanged";

    switch (event.type) {
      case "entity.created":
        return "created";
      case "entity.value_changed":
        return "changed";
      default:
        return "unchanged";
    }
  }
}