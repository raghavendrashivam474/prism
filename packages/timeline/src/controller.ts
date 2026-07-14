/**
 * Snapshot-based Timeline Controller.
 *
 * Owns currentStepIndex.
 * Selects snapshots from a pre-built array.
 * Never replays events or re-executes C++.
 *
 * All navigation is O(1) — index selection into an immutable array.
 *
 * See ADR-0004 — Snapshot-Based Timeline Navigation.
 */

import type { VisualStateSnapshot } from "@prism/visual-state-engine";

export interface TimelineController {
  readonly currentIndex: number;
  readonly totalSteps: number;
  readonly currentSnapshot: VisualStateSnapshot | null;
  readonly isAtFirst: boolean;
  readonly isAtLast: boolean;
  next(): TimelineController;
  previous(): TimelineController;
  first(): TimelineController;
  last(): TimelineController;
  select(index: number): TimelineController;
  reset(snapshots: VisualStateSnapshot[]): TimelineController;
}

export class SnapshotTimelineController implements TimelineController {
  private constructor(
    private readonly _snapshots: readonly VisualStateSnapshot[],
    private readonly _currentIndex: number,
  ) {}

  static create(snapshots: VisualStateSnapshot[]): SnapshotTimelineController {
    return new SnapshotTimelineController(
      snapshots,
      snapshots.length > 0 ? 0 : -1,
    );
  }

  static empty(): SnapshotTimelineController {
    return new SnapshotTimelineController([], -1);
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get totalSteps(): number {
    return this._snapshots.length;
  }

  get currentSnapshot(): VisualStateSnapshot | null {
    if (this._currentIndex < 0 || this._currentIndex >= this._snapshots.length) {
      return null;
    }
    return this._snapshots[this._currentIndex];
  }

  get isAtFirst(): boolean {
    return this._currentIndex === 0;
  }

  get isAtLast(): boolean {
    return this._currentIndex === this._snapshots.length - 1;
  }

  next(): SnapshotTimelineController {
    const nextIndex = Math.min(
      this._currentIndex + 1,
      this._snapshots.length - 1,
    );
    if (nextIndex === this._currentIndex) return this;
    return new SnapshotTimelineController(this._snapshots, nextIndex);
  }

  previous(): SnapshotTimelineController {
    const prevIndex = Math.max(this._currentIndex - 1, 0);
    if (prevIndex === this._currentIndex) return this;
    return new SnapshotTimelineController(this._snapshots, prevIndex);
  }

  first(): SnapshotTimelineController {
    if (this._snapshots.length === 0) return this;
    if (this._currentIndex === 0) return this;
    return new SnapshotTimelineController(this._snapshots, 0);
  }

  last(): SnapshotTimelineController {
    if (this._snapshots.length === 0) return this;
    const lastIndex = this._snapshots.length - 1;
    if (this._currentIndex === lastIndex) return this;
    return new SnapshotTimelineController(this._snapshots, lastIndex);
  }

  select(index: number): SnapshotTimelineController {
    if (index < 0 || index >= this._snapshots.length) {
      return this; // Out of bounds: no change
    }
    if (index === this._currentIndex) return this;
    return new SnapshotTimelineController(this._snapshots, index);
  }

  reset(snapshots: VisualStateSnapshot[]): SnapshotTimelineController {
    return SnapshotTimelineController.create(snapshots);
  }
}