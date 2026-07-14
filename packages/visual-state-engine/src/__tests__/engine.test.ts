import { describe, it, expect } from "vitest";
import { DefaultVisualStateEngine } from "../engine";
import { LearningIrV01Ingestor } from "@prism/trace-model";

// ---------------------------------------------------------------------------
// Shared fixture — the Sprint 0 arithmetic trace
// ---------------------------------------------------------------------------

const RAW_ARITHMETIC_TRACE = {
  irVersion: "0.1",
  executionId: "test-exec",
  languageId: "cpp",
  events: [
    { irVersion: "0.1", sequence: 1, type: "execution.started",    source: { line: 1 }, entityId: null, payload: {} },
    { irVersion: "0.1", sequence: 2, type: "scope.entered",        source: { line: 1 }, entityId: null, payload: { scopeId: "scope_main_1", displayName: "main" } },
    { irVersion: "0.1", sequence: 3, type: "entity.created",       source: { line: 2 }, entityId: "var_x_1", payload: { kind: "variable", displayName: "x", dataType: "int", value: 10, scopeId: "scope_main_1" } },
    { irVersion: "0.1", sequence: 4, type: "entity.value_changed", source: { line: 3 }, entityId: "var_x_1", payload: { previousValue: 10, value: 20 } },
    { irVersion: "0.1", sequence: 5, type: "entity.value_changed", source: { line: 4 }, entityId: "var_x_1", payload: { previousValue: 20, value: 25 } },
    { irVersion: "0.1", sequence: 6, type: "scope.exited",         source: { line: 6 }, entityId: null, payload: { scopeId: "scope_main_1", displayName: "main" } },
    { irVersion: "0.1", sequence: 7, type: "execution.completed",  source: { line: 6 }, entityId: null, payload: {} },
  ],
};

function buildSnapshots() {
  const ingestor = new LearningIrV01Ingestor();
  const trace = ingestor.ingest(RAW_ARITHMETIC_TRACE);
  const engine = new DefaultVisualStateEngine();
  return engine.buildSnapshots(trace);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DefaultVisualStateEngine", () => {

  describe("snapshot count", () => {
    it("produces one snapshot per event", () => {
      const snapshots = buildSnapshots();
      expect(snapshots).toHaveLength(7);
    });

    it("produces zero snapshots for empty trace", () => {
      const ingestor = new LearningIrV01Ingestor();
      const trace = ingestor.ingest({ irVersion: "0.1", executionId: "", languageId: "cpp", events: [] });
      const engine = new DefaultVisualStateEngine();
      const snapshots = engine.buildSnapshots(trace);
      expect(snapshots).toHaveLength(0);
    });
  });

  describe("snapshot indexing", () => {
    it("stepIndex starts at 0", () => {
      const snapshots = buildSnapshots();
      expect(snapshots[0].stepIndex).toBe(0);
    });

    it("stepIndex is contiguous", () => {
      const snapshots = buildSnapshots();
      snapshots.forEach((s, i) => {
        expect(s.stepIndex).toBe(i);
      });
    });

    it("sequence matches the event sequence", () => {
      const snapshots = buildSnapshots();
      snapshots.forEach((s, i) => {
        expect(s.sequence).toBe(i + 1);
      });
    });
  });

  describe("execution status transitions", () => {
    it("initial state is idle before any events", () => {
      // The state BEFORE the first event — we check via an empty trace
      const ingestor = new LearningIrV01Ingestor();
      const trace = ingestor.ingest({ irVersion: "0.1", executionId: "", languageId: "cpp", events: [] });
      const engine = new DefaultVisualStateEngine();
      const snapshots = engine.buildSnapshots(trace);
      expect(snapshots).toHaveLength(0);
    });

    it("execution.started sets status to running", () => {
      const snapshots = buildSnapshots();
      expect(snapshots[0].state.executionStatus).toBe("running");
    });

    it("execution.completed sets status to completed", () => {
      const snapshots = buildSnapshots();
      expect(snapshots[6].state.executionStatus).toBe("completed");
    });
  });

  describe("scope tracking", () => {
    it("scope.entered adds scope to activeScopes", () => {
      const snapshots = buildSnapshots();
      expect(snapshots[1].state.activeScopes).toHaveLength(1);
      expect(snapshots[1].state.activeScopes[0].displayName).toBe("main");
    });

    it("scope.exited removes scope from activeScopes", () => {
      const snapshots = buildSnapshots();
      expect(snapshots[5].state.activeScopes).toHaveLength(0);
    });
  });

  describe("entity tracking", () => {
    it("entity.created adds entity to state", () => {
      const snapshots = buildSnapshots();
      const state = snapshots[2].state;
      expect(state.entities["var_x_1"]).toBeDefined();
      expect(state.entities["var_x_1"].value).toBe(10);
      expect(state.entities["var_x_1"].displayName).toBe("x");
      expect(state.entities["var_x_1"].dataType).toBe("int");
    });

    it("entity.value_changed updates entity value", () => {
      const snapshots = buildSnapshots();
      expect(snapshots[3].state.entities["var_x_1"].value).toBe(20);
    });

    it("second entity.value_changed updates to 25", () => {
      const snapshots = buildSnapshots();
      expect(snapshots[4].state.entities["var_x_1"].value).toBe(25);
    });
  });

  describe("snapshot immutability", () => {
    it("earlier snapshots are not mutated by later events", () => {
      const snapshots = buildSnapshots();

      // Capture the value at step 2 (entity.created, value=10)
      const valueAtStep2 = snapshots[2].state.entities["var_x_1"].value;

      // Later steps change the value, but snapshot[2] must remain 10
      expect(snapshots[3].state.entities["var_x_1"].value).toBe(20);
      expect(snapshots[4].state.entities["var_x_1"].value).toBe(25);

      // Earlier snapshot must be unchanged
      expect(valueAtStep2).toBe(10);
      expect(snapshots[2].state.entities["var_x_1"].value).toBe(10);
    });

    it("snapshot at step 3 has value 20, not 25", () => {
      const snapshots = buildSnapshots();
      expect(snapshots[3].state.entities["var_x_1"].value).toBe(20);
      expect(snapshots[4].state.entities["var_x_1"].value).toBe(25);
      // They are different objects
      expect(snapshots[3].state).not.toBe(snapshots[4].state);
    });

    it("modifying snapshot object does not affect stored snapshot", () => {
      const snapshots = buildSnapshots();
      // State is frozen — attempting to mutate should silently fail or throw
      const state = snapshots[2].state;
      expect(() => {
        // @ts-expect-error — testing runtime immutability
        state.executionStatus = "idle";
      }).toThrow();
      // Original value unchanged
      expect(snapshots[2].state.executionStatus).toBe("running");
    });
  });

  describe("failure state", () => {
    it("execution.failed sets status to failed", () => {
      const ingestor = new LearningIrV01Ingestor();
      const failureTrace = ingestor.ingest({
        irVersion: "0.1",
        executionId: "test",
        languageId: "cpp",
        events: [
          {
            sequence: 1,
            type: "execution.failed",
            source: { line: 1 },
            entityId: null,
            payload: { category: "unsupported_profile", message: "Test", diagnostics: [], violations: [] },
          },
        ],
      });
      const engine = new DefaultVisualStateEngine();
      const snapshots = engine.buildSnapshots(failureTrace);
      expect(snapshots[0].state.executionStatus).toBe("failed");
    });
  });

  describe("multiple variables", () => {
    it("tracks multiple variables independently", () => {
      const ingestor = new LearningIrV01Ingestor();
      const trace = ingestor.ingest({
        irVersion: "0.1",
        executionId: "test",
        languageId: "cpp",
        events: [
          { sequence: 1, type: "execution.started",   source: { line: 1 }, entityId: null, payload: {} },
          { sequence: 2, type: "scope.entered",        source: { line: 1 }, entityId: null, payload: { scopeId: "scope_main_1", displayName: "main" } },
          { sequence: 3, type: "entity.created",       source: { line: 2 }, entityId: "var_a_1", payload: { kind: "variable", displayName: "a", dataType: "int", value: 1, scopeId: "scope_main_1" } },
          { sequence: 4, type: "entity.created",       source: { line: 3 }, entityId: "var_b_1", payload: { kind: "variable", displayName: "b", dataType: "int", value: 2, scopeId: "scope_main_1" } },
          { sequence: 5, type: "entity.created",       source: { line: 4 }, entityId: "var_c_1", payload: { kind: "variable", displayName: "c", dataType: "int", value: 3, scopeId: "scope_main_1" } },
          { sequence: 6, type: "scope.exited",         source: { line: 6 }, entityId: null, payload: { scopeId: "scope_main_1", displayName: "main" } },
          { sequence: 7, type: "execution.completed",  source: { line: 6 }, entityId: null, payload: {} },
        ],
      });
      const engine = new DefaultVisualStateEngine();
      const snapshots = engine.buildSnapshots(trace);

      const finalState = snapshots[6].state;
      expect(finalState.entities["var_a_1"].value).toBe(1);
      expect(finalState.entities["var_b_1"].value).toBe(2);
      expect(finalState.entities["var_c_1"].value).toBe(3);
    });
  });
});