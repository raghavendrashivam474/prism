/**
 * Deterministic Step Describer.
 *
 * Produces human-readable descriptions of execution steps.
 * No AI. No external dependencies.
 * Output is deterministic: same snapshot always produces same description.
 *
 * Does not embed descriptions in Learning IR.
 * Reads the snapshot event type and payload.
 */

import type { VisualStateSnapshot } from "@prism/visual-state-engine";

export interface StepDescription {
  readonly title: string;
  readonly detail: string;
}

export interface StepDescriber {
  describe(snapshot: VisualStateSnapshot): StepDescription;
}

export class LearningIrV01StepDescriber implements StepDescriber {
  describe(snapshot: VisualStateSnapshot): StepDescription {
    const { event } = snapshot;
    const { type, payload } = event;

    switch (type) {
      case "execution.started":
        return {
          title: "Program started",
          detail: "Program execution started.",
        };

      case "scope.entered": {
        const name =
          payload.kind === "scope.entered" ? payload.displayName : "unknown";
        return {
          title: `Entered ${name}`,
          detail: `Execution entered ${name}.`,
        };
      }

      case "entity.created": {
        if (payload.kind !== "entity.created") break;
        return {
          title: `${payload.displayName} created`,
          detail: `${payload.displayName} was created with value ${payload.value}.`,
        };
      }

      case "entity.value_changed": {
        if (payload.kind !== "entity.value_changed") break;
        const entity = snapshot.state.entities[event.entityId ?? ""];
        const name = entity?.displayName ?? event.entityId ?? "variable";
        return {
          title: `${name} changed`,
          detail: `${name} changed from ${payload.previousValue} to ${payload.value}.`,
        };
      }

      case "scope.exited": {
        const name =
          payload.kind === "scope.exited" ? payload.displayName : "unknown";
        return {
          title: `Left ${name}`,
          detail: `Execution left ${name}.`,
        };
      }

      case "execution.completed":
        return {
          title: "Program completed",
          detail: "Program execution completed.",
        };

      case "execution.failed": {
        if (payload.kind !== "execution.failed") break;
        return {
          title: "Execution failed",
          detail: payload.message,
        };
      }
    }

    return {
      title: "Unknown step",
      detail: `Unknown event type: ${type}`,
    };
  }
}