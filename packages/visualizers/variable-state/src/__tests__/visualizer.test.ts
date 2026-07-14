import { describe, it, expect } from "vitest";
import { VariableStateVisualizer } from "../variable-state-visualizer";
import { LearningIrV01StepDescriber } from "../step-describer";
import { VisualizerRegistry } from "../plugin";
import { DefaultVisualStateEngine } from "@prism/visual-state-engine";
import { LearningIrV01Ingestor } from "@prism/trace-model";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const RAW_TRACE = {
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
  const trace = ingestor.ingest(RAW_TRACE);
  const engine = new DefaultVisualStateEngine();
  return engine.buildSnapshots(trace);
}

// ---------------------------------------------------------------------------
// VariableStateVisualizer
// ---------------------------------------------------------------------------

describe("VariableStateVisualizer", () => {
  const visualizer = new VariableStateVisualizer();

  it("id is variable-state", () => {
    expect(visualizer.id).toBe("variable-state");
  });

  describe("supports()", () => {
    it("returns false before any entities exist", () => {
      const snapshots = buildSnapshots();
      expect(visualizer.supports(snapshots[0])).toBe(false); // execution.started
    });

    it("returns true when entity is being created", () => {
      const snapshots = buildSnapshots();
      expect(visualizer.supports(snapshots[2])).toBe(true); // entity.created
    });

    it("returns true when entities exist in state", () => {
      const snapshots = buildSnapshots();
      expect(visualizer.supports(snapshots[3])).toBe(true); // value_changed
      expect(visualizer.supports(snapshots[4])).toBe(true);
      expect(visualizer.supports(snapshots[5])).toBe(true); // scope.exited
    });
  });

  describe("buildRenderModel()", () => {
    it("created variable has changeKind=created", () => {
      const snapshots = buildSnapshots();
      const model = visualizer.buildRenderModel(snapshots[2]); // entity.created
      expect(model.variables).toHaveLength(1);
      expect(model.variables[0].changeKind).toBe("created");
    });

    it("created variable has correct value", () => {
      const snapshots = buildSnapshots();
      const model = visualizer.buildRenderModel(snapshots[2]);
      expect(model.variables[0].currentValue).toBe(10);
      expect(model.variables[0].displayName).toBe("x");
      expect(model.variables[0].dataType).toBe("int");
    });

    it("created variable has no previousValue", () => {
      const snapshots = buildSnapshots();
      const model = visualizer.buildRenderModel(snapshots[2]);
      expect(model.variables[0].previousValue).toBeUndefined();
    });

    it("changed variable has changeKind=changed", () => {
      const snapshots = buildSnapshots();
      const model = visualizer.buildRenderModel(snapshots[3]); // value_changed 10->20
      expect(model.variables[0].changeKind).toBe("changed");
    });

    it("changed variable shows new value", () => {
      const snapshots = buildSnapshots();
      const model = visualizer.buildRenderModel(snapshots[3]);
      expect(model.variables[0].currentValue).toBe(20);
    });

    it("changed variable includes previousValue", () => {
      const snapshots = buildSnapshots();
      const model = visualizer.buildRenderModel(snapshots[3]);
      expect(model.variables[0].previousValue).toBe(10);
    });

    it("second change shows 20->25", () => {
      const snapshots = buildSnapshots();
      const model = visualizer.buildRenderModel(snapshots[4]);
      expect(model.variables[0].currentValue).toBe(25);
      expect(model.variables[0].previousValue).toBe(20);
      expect(model.variables[0].changeKind).toBe("changed");
    });

    it("unchanged variable at scope.exited has changeKind=unchanged", () => {
      const snapshots = buildSnapshots();
      const model = visualizer.buildRenderModel(snapshots[5]); // scope.exited
      expect(model.variables[0].changeKind).toBe("unchanged");
    });

    it("unchanged variable shows current value without previousValue", () => {
      const snapshots = buildSnapshots();
      const model = visualizer.buildRenderModel(snapshots[5]);
      expect(model.variables[0].currentValue).toBe(25);
      expect(model.variables[0].previousValue).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// LearningIrV01StepDescriber
// ---------------------------------------------------------------------------

describe("LearningIrV01StepDescriber", () => {
  const describer = new LearningIrV01StepDescriber();

  function describe_step(index: number) {
    return describer.describe(buildSnapshots()[index]);
  }

  it("describes execution.started", () => {
    const desc = describe_step(0);
    expect(desc.title).toBe("Program started");
    expect(desc.detail).toContain("started");
  });

  it("describes scope.entered with scope name", () => {
    const desc = describe_step(1);
    expect(desc.title).toContain("main");
    expect(desc.detail).toContain("main");
  });

  it("describes entity.created with variable name and value", () => {
    const desc = describe_step(2);
    expect(desc.title).toContain("x");
    expect(desc.detail).toContain("x");
    expect(desc.detail).toContain("10");
  });

  it("describes entity.value_changed with from and to values", () => {
    const desc = describe_step(3);
    expect(desc.title).toContain("x");
    expect(desc.detail).toContain("10");
    expect(desc.detail).toContain("20");
  });

  it("describes second entity.value_changed", () => {
    const desc = describe_step(4);
    expect(desc.detail).toContain("20");
    expect(desc.detail).toContain("25");
  });

  it("describes scope.exited with scope name", () => {
    const desc = describe_step(5);
    expect(desc.title).toContain("main");
    expect(desc.detail).toContain("main");
  });

  it("describes execution.completed", () => {
    const desc = describe_step(6);
    expect(desc.title).toContain("completed");
    expect(desc.detail).toContain("completed");
  });

  it("descriptions are deterministic", () => {
    const snapshots = buildSnapshots();
    const desc1 = describer.describe(snapshots[3]);
    const desc2 = describer.describe(snapshots[3]);
    expect(desc1.title).toBe(desc2.title);
    expect(desc1.detail).toBe(desc2.detail);
  });

  it("describes execution.failed with message", () => {
    const ingestor = new LearningIrV01Ingestor();
    const trace = ingestor.ingest({
      irVersion: "0.1",
      executionId: "test",
      languageId: "cpp",
      events: [
        {
          sequence: 1,
          type: "execution.failed",
          source: { line: 1 },
          entityId: null,
          payload: {
            category: "unsupported_profile",
            message: "Loops are not supported.",
            diagnostics: [],
            violations: [],
          },
        },
      ],
    });
    const engine = new DefaultVisualStateEngine();
    const snapshots = engine.buildSnapshots(trace);
    const desc = describer.describe(snapshots[0]);
    expect(desc.title).toContain("failed");
    expect(desc.detail).toContain("Loops are not supported.");
  });
});

// ---------------------------------------------------------------------------
// VisualizerRegistry
// ---------------------------------------------------------------------------

describe("VisualizerRegistry", () => {
  it("registers and resolves a plugin by id", () => {
    const registry = new VisualizerRegistry();
    const visualizer = new VariableStateVisualizer();
    registry.register(visualizer);
    expect(registry.resolve("variable-state")).toBe(visualizer);
  });

  it("returns null for unknown plugin id", () => {
    const registry = new VisualizerRegistry();
    expect(registry.resolve("unknown-plugin")).toBeNull();
  });

  it("registeredIds returns all registered ids", () => {
    const registry = new VisualizerRegistry();
    registry.register(new VariableStateVisualizer());
    expect(registry.registeredIds()).toContain("variable-state");
  });

  it("supportingPlugins returns plugins that support the snapshot", () => {
    const registry = new VisualizerRegistry();
    registry.register(new VariableStateVisualizer());
    const snapshots = buildSnapshots();
    const supporting = registry.supportingPlugins(snapshots[2]); // entity.created
    expect(supporting.length).toBeGreaterThan(0);
  });

  it("supportingPlugins returns empty when no plugin supports snapshot", () => {
    const registry = new VisualizerRegistry();
    registry.register(new VariableStateVisualizer());
    const snapshots = buildSnapshots();
    // execution.started — no entities yet
    const supporting = registry.supportingPlugins(snapshots[0]);
    expect(supporting).toHaveLength(0);
  });
});