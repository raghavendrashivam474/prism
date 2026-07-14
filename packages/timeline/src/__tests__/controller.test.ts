import { describe, it, expect } from "vitest";
import { SnapshotTimelineController } from "../controller";
import { DefaultVisualStateEngine } from "@prism/visual-state-engine";
import { LearningIrV01Ingestor } from "@prism/trace-model";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RAW_ARITHMETIC_TRACE = {
  irVersion: "0.1",
  executionId: "test-exec",
  languageId: "cpp",
  events: [
    { sequence: 1, type: "execution.started",    source: { line: 1 }, entityId: null, payload: {} },
    { sequence: 2, type: "scope.entered",        source: { line: 1 }, entityId: null, payload: { scopeId: "scope_main_1", displayName: "main" } },
    { sequence: 3, type: "entity.created",       source: { line: 2 }, entityId: "var_x_1", payload: { kind: "variable", displayName: "x", dataType: "int", value: 10, scopeId: "scope_main_1" } },
    { sequence: 4, type: "entity.value_changed", source: { line: 3 }, entityId: "var_x_1", payload: { previousValue: 10, value: 20 } },
    { sequence: 5, type: "entity.value_changed", source: { line: 4 }, entityId: "var_x_1", payload: { previousValue: 20, value: 25 } },
    { sequence: 6, type: "scope.exited",         source: { line: 6 }, entityId: null, payload: { scopeId: "scope_main_1", displayName: "main" } },
    { sequence: 7, type: "execution.completed",  source: { line: 6 }, entityId: null, payload: {} },
  ],
};

function buildSnapshots(): VisualStateSnapshot[] {
  const ingestor = new LearningIrV01Ingestor();
  const trace = ingestor.ingest(RAW_ARITHMETIC_TRACE);
  const engine = new DefaultVisualStateEngine();
  return engine.buildSnapshots(trace);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SnapshotTimelineController", () => {

  describe("initialisation", () => {
    it("starts at index 0 when snapshots exist", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.currentIndex).toBe(0);
    });

    it("empty controller has index -1", () => {
      const controller = SnapshotTimelineController.empty();
      expect(controller.currentIndex).toBe(-1);
    });

    it("empty controller has null currentSnapshot", () => {
      const controller = SnapshotTimelineController.empty();
      expect(controller.currentSnapshot).toBeNull();
    });

    it("totalSteps matches snapshot count", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.totalSteps).toBe(7);
    });

    it("currentSnapshot at index 0 is the first snapshot", () => {
      const snapshots = buildSnapshots();
      const controller = SnapshotTimelineController.create(snapshots);
      expect(controller.currentSnapshot).toBe(snapshots[0]);
    });
  });

  describe("next()", () => {
    it("advances index by 1", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.next().currentIndex).toBe(1);
    });

    it("does not advance past last index", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots()).last();
      expect(controller.next().currentIndex).toBe(6);
    });

    it("returns same instance when already at last", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots()).last();
      expect(controller.next()).toBe(controller);
    });

    it("next().next() advances by 2", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.next().next().currentIndex).toBe(2);
    });
  });

  describe("previous()", () => {
    it("decrements index by 1", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots()).next().next();
      expect(controller.previous().currentIndex).toBe(1);
    });

    it("does not go below 0", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.previous().currentIndex).toBe(0);
    });

    it("returns same instance when already at first", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.previous()).toBe(controller);
    });
  });

  describe("first()", () => {
    it("returns to index 0 from any position", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots()).last();
      expect(controller.first().currentIndex).toBe(0);
    });

    it("returns same instance when already at first", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.first()).toBe(controller);
    });
  });

  describe("last()", () => {
    it("jumps to last index", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.last().currentIndex).toBe(6);
    });

    it("returns same instance when already at last", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots()).last();
      expect(controller.last()).toBe(controller);
    });
  });

  describe("select()", () => {
    it("selects a specific index", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.select(4).currentIndex).toBe(4);
    });

    it("ignores out-of-bounds negative index", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.select(-1).currentIndex).toBe(0);
    });

    it("ignores out-of-bounds high index", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.select(999).currentIndex).toBe(0);
    });

    it("returns same instance when selecting current index", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots()).select(3);
      expect(controller.select(3)).toBe(controller);
    });
  });

  describe("reset()", () => {
    it("resets to index 0 with new snapshots", () => {
      const snapshots = buildSnapshots();
      const controller = SnapshotTimelineController
        .create(snapshots)
        .last()
        .reset(snapshots);
      expect(controller.currentIndex).toBe(0);
    });

    it("totalSteps updates after reset", () => {
      const snapshots = buildSnapshots();
      const twoSnapshots = snapshots.slice(0, 2);
      const controller = SnapshotTimelineController
        .create(snapshots)
        .reset(twoSnapshots);
      expect(controller.totalSteps).toBe(2);
    });
  });

  describe("boundary flags", () => {
    it("isAtFirst is true at index 0", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.isAtFirst).toBe(true);
    });

    it("isAtFirst is false at index 1", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots()).next();
      expect(controller.isAtFirst).toBe(false);
    });

    it("isAtLast is true at last index", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots()).last();
      expect(controller.isAtLast).toBe(true);
    });

    it("isAtLast is false at index 0", () => {
      const controller = SnapshotTimelineController.create(buildSnapshots());
      expect(controller.isAtLast).toBe(false);
    });
  });

  describe("currentSnapshot synchronisation", () => {
    it("currentSnapshot changes with navigation", () => {
      const snapshots = buildSnapshots();
      const controller = SnapshotTimelineController.create(snapshots);
      const atStep0 = controller.currentSnapshot;
      const atStep1 = controller.next().currentSnapshot;
      expect(atStep0).not.toBe(atStep1);
      expect(atStep0?.stepIndex).toBe(0);
      expect(atStep1?.stepIndex).toBe(1);
    });

    it("navigating back returns to correct snapshot", () => {
      const snapshots = buildSnapshots();
      const controller = SnapshotTimelineController.create(snapshots);
      const forward = controller.next().next().next();
      const back = forward.previous().previous().previous();
      expect(back.currentIndex).toBe(0);
      expect(back.currentSnapshot).toBe(snapshots[0]);
    });
  });
});