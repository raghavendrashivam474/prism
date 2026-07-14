/**
 * Pure visual state reducer.
 *
 * Takes the current VisualState and one NormalizedTraceEvent.
 * Returns a new VisualState.
 *
 * This function is pure: no mutation, no side effects.
 * Earlier snapshots are never affected by later state transitions.
 */

import type { NormalizedTraceEvent } from "@prism/trace-model";
import type { VisualState, EntityState, ScopeState } from "./types";

export const INITIAL_STATE: VisualState = {
  executionStatus: "idle",
  activeScopes: [],
  entities: {},
};

export function reduce(
  state: VisualState,
  event: NormalizedTraceEvent,
): VisualState {
  const { type, payload } = event;

  switch (type) {
    case "execution.started": {
      return {
        ...state,
        executionStatus: "running",
      };
    }

    case "scope.entered": {
      if (payload.kind !== "scope.entered") return state;
      const scope: ScopeState = {
        scopeId: payload.scopeId,
        displayName: payload.displayName,
      };
      return {
        ...state,
        activeScopes: [...state.activeScopes, scope],
      };
    }

    case "scope.exited": {
      if (payload.kind !== "scope.exited") return state;
      return {
        ...state,
        activeScopes: state.activeScopes.filter(
          (s) => s.scopeId !== payload.scopeId,
        ),
      };
    }

    case "entity.created": {
      if (payload.kind !== "entity.created") return state;
      if (!event.entityId) return state;

      const entity: EntityState = {
        entityId: event.entityId,
        kind: "variable",
        displayName: payload.displayName,
        dataType: payload.dataType,
        value: payload.value,
      };

      return {
        ...state,
        entities: {
          ...state.entities,
          [event.entityId]: entity,
        },
      };
    }

    case "entity.value_changed": {
      if (payload.kind !== "entity.value_changed") return state;
      if (!event.entityId) return state;

      const existing = state.entities[event.entityId];
      if (!existing) return state;

      return {
        ...state,
        entities: {
          ...state.entities,
          [event.entityId]: {
            ...existing,
            value: payload.value,
          },
        },
      };
    }

    case "execution.completed": {
      return {
        ...state,
        executionStatus: "completed",
      };
    }

    case "execution.failed": {
      return {
        ...state,
        executionStatus: "failed",
      };
    }

    default:
      return state;
  }
}