/**
 * Visual State Engine.
 *
 * Processes an ordered NormalizedTrace and builds an array of
 * immutable VisualStateSnapshots.
 *
 * One snapshot is produced per event.
 * Snapshot 0 corresponds to event[0].
 *
 * Snapshots are built once. Timeline navigation selects snapshots.
 * No reverse-event logic exists here.
 */

import type { NormalizedTrace } from "@prism/trace-model";
import type { VisualStateSnapshot } from "./types";
import { INITIAL_STATE, reduce } from "./reducer";

export interface VisualStateEngine {
  buildSnapshots(trace: NormalizedTrace): VisualStateSnapshot[];
}

export class DefaultVisualStateEngine implements VisualStateEngine {
  buildSnapshots(trace: NormalizedTrace): VisualStateSnapshot[] {
    const snapshots: VisualStateSnapshot[] = [];
    let currentState = INITIAL_STATE;

    for (let i = 0; i < trace.events.length; i++) {
      const event = trace.events[i];
      const nextState = reduce(currentState, event);

      snapshots.push({
        stepIndex: i,
        sequence: event.sequence,
        event,
        // Object.freeze enforces immutability at runtime during development
        state: Object.freeze({ ...nextState }),
      });

      currentState = nextState;
    }

    return snapshots;
  }
}