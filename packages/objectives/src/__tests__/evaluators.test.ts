import { describe, it, expect } from "vitest";
import {
  EntityExistsEvaluator,
  EntityValueEqualsEvaluator,
  EntityValueChangedEvaluator,
  ExecutionCompletedEvaluator,
  createDefaultEvaluatorRegistry,
  type ObjectiveEvaluationContext,
  type EntityExistsObjectiveDefinition,
  type EntityValueEqualsObjectiveDefinition,
  type EntityValueChangedObjectiveDefinition,
  type ExecutionCompletedObjectiveDefinition,
} from "../index";
import type {
  NormalizedTrace,
  NormalizedTraceEvent,
} from "@prism/trace-model";

// ---------------------------------------------------------------------------
// Trace fixture builder
//
// Simulates the standard "int x = 10; x = 20;" style trace the Sprint 0
// C++ profile produces. Sequences are 1-based and contiguous.
// ---------------------------------------------------------------------------

interface BuiltTrace {
  trace: NormalizedTrace;
  events: NormalizedTraceEvent[];
}

function buildTrace(
  build: (add: (event: NormalizedTraceEvent) => void) => void,
): BuiltTrace {
  const events: NormalizedTraceEvent[] = [];
  let seq = 0;
  build((event) => {
    seq += 1;
    events.push({ ...event, sequence: seq });
  });
  const trace: NormalizedTrace = {
    irVersion: "learning-ir/v0.1",
    executionId: "test-exec",
    languageId: "cpp",
    events,
  };
  return { trace, events };
}

function ctx(trace: NormalizedTrace): ObjectiveEvaluationContext {
  return { trace, snapshots: [] };
}

function executionStarted(): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "execution.started",
    sourceLocation: { line: 1 },
    payload: { kind: "execution.started" },
  };
}

function scopeEntered(scopeId = "main"): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "scope.entered",
    sourceLocation: { line: 1 },
    payload: {
      kind: "scope.entered",
      scopeId,
      displayName: scopeId,
    },
  };
}

function scopeExited(scopeId = "main"): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "scope.exited",
    sourceLocation: { line: 1 },
    payload: {
      kind: "scope.exited",
      scopeId,
      displayName: scopeId,
    },
  };
}

function entityCreated(
  entityId: string,
  displayName: string,
  value: number,
  line = 2,
  scopeId = "main",
): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "entity.created",
    sourceLocation: { line },
    entityId,
    payload: {
      kind: "entity.created",
      entityKind: "variable",
      displayName,
      dataType: "int",
      value,
      scopeId,
    },
  };
}

function valueChanged(
  entityId: string,
  previousValue: number,
  value: number,
  line = 3,
): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "entity.value_changed",
    sourceLocation: { line },
    entityId,
    payload: {
      kind: "entity.value_changed",
      previousValue,
      value,
    },
  };
}

function executionCompleted(line = 4): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "execution.completed",
    sourceLocation: { line },
    payload: { kind: "execution.completed" },
  };
}

function executionFailed(): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "execution.failed",
    sourceLocation: { line: 1 },
    payload: {
      kind: "execution.failed",
      category: "compilation_failed",
      message: "test failure",
      diagnostics: [],
      violations: [],
    },
  };
}

// ---------------------------------------------------------------------------
// EntityExistsEvaluator
// ---------------------------------------------------------------------------

describe("EntityExistsEvaluator", () => {
  const evaluator = new EntityExistsEvaluator();

  const definition: EntityExistsObjectiveDefinition = {
    id: "obj-x-exists",
    type: "entity_exists",
    displayName: "x",
  };

  it("satisfied when entity is created", () => {
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(scopeExited());
      add(executionCompleted());
    });

    const result = evaluator.evaluate(definition, ctx(trace));
    expect(result.satisfied).toBe(true);
    expect(result.objectiveId).toBe("obj-x-exists");
  });

  it("evidence references the entity.created event", () => {
    const { trace, events } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(executionCompleted());
    });
    const createdEvent = events.find((e) => e.type === "entity.created")!;

    const result = evaluator.evaluate(definition, ctx(trace));
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].sequence).toBe(createdEvent.sequence);
    expect(result.evidence[0].entityId).toBe("var_x_1");
    expect(result.evidence[0].observed).toEqual({
      displayName: "x",
      value: 10,
    });
    expect(result.evidence[0].relatedEvent).toBe(createdEvent);
  });

  it("unsatisfied when entity is never created", () => {
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_y_1", "y", 5));
      add(executionCompleted());
    });

    const result = evaluator.evaluate(definition, ctx(trace));
    expect(result.satisfied).toBe(false);
    expect(result.evidence).toEqual([]);
  });

  it("evidence uses the FIRST creation when multiple entities share displayName", () => {
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered("outer"));
      add(entityCreated("var_x_1", "x", 1, 2, "outer"));
      add(scopeEntered("inner"));
      add(entityCreated("var_x_2", "x", 99, 3, "inner"));
      add(executionCompleted());
    });

    const result = evaluator.evaluate(definition, ctx(trace));
    expect(result.satisfied).toBe(true);
    expect(result.evidence[0].entityId).toBe("var_x_1");
  });
});

// ---------------------------------------------------------------------------
// EntityValueEqualsEvaluator
// ---------------------------------------------------------------------------

describe("EntityValueEqualsEvaluator", () => {
  const evaluator = new EntityValueEqualsEvaluator();

  const wantsTwenty: EntityValueEqualsObjectiveDefinition = {
    id: "obj-x-eq-20",
    type: "entity_value_equals",
    displayName: "x",
    value: 20,
  };

  it("satisfied by initial creation value", () => {
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 20));
      add(executionCompleted());
    });

    const wantsInitial: EntityValueEqualsObjectiveDefinition = {
      id: "obj-x-eq-20-initial",
      type: "entity_value_equals",
      displayName: "x",
      value: 20,
    };

    const result = evaluator.evaluate(wantsInitial, ctx(trace));
    expect(result.satisfied).toBe(true);
    expect(result.evidence[0].observed).toEqual({
      displayName: "x",
      value: 20,
    });
  });

  it("satisfied by a later value_changed event", () => {
    const { trace, events } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(valueChanged("var_x_1", 10, 20));
      add(executionCompleted());
    });
    const changeEvent = events.find((e) => e.type === "entity.value_changed")!;

    const result = evaluator.evaluate(wantsTwenty, ctx(trace));
    expect(result.satisfied).toBe(true);
    expect(result.evidence[0].sequence).toBe(changeEvent.sequence);
    expect(result.evidence[0].observed).toEqual({
      displayName: "x",
      previousValue: 10,
      value: 20,
    });
  });

  it("uses the EARLIEST matching observation", () => {
    const { trace, events } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(valueChanged("var_x_1", 10, 20)); // first match
      add(valueChanged("var_x_1", 20, 30));
      add(valueChanged("var_x_1", 30, 20)); // second match, must be ignored
      add(executionCompleted());
    });
    const firstMatch = events.find(
      (e) =>
        e.type === "entity.value_changed" &&
        e.payload.kind === "entity.value_changed" &&
        e.payload.value === 20,
    )!;

    const result = evaluator.evaluate(wantsTwenty, ctx(trace));
    expect(result.evidence[0].sequence).toBe(firstMatch.sequence);
  });

  it("unsatisfied when value is never reached", () => {
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(valueChanged("var_x_1", 10, 15));
      add(executionCompleted());
    });

    const result = evaluator.evaluate(wantsTwenty, ctx(trace));
    expect(result.satisfied).toBe(false);
    expect(result.evidence).toEqual([]);
  });

  it("only considers entities matching displayName", () => {
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(entityCreated("var_y_1", "y", 20)); // y=20, not x=20
      add(executionCompleted());
    });

    const result = evaluator.evaluate(wantsTwenty, ctx(trace));
    expect(result.satisfied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EntityValueChangedEvaluator (strict semantics)
// ---------------------------------------------------------------------------

describe("EntityValueChangedEvaluator", () => {
  const evaluator = new EntityValueChangedEvaluator();

  const changesTenToTwenty: EntityValueChangedObjectiveDefinition = {
    id: "obj-x-10-to-20",
    type: "entity_value_changed",
    displayName: "x",
    from: 10,
    to: 20,
  };

  it("satisfied by a direct 10 -> 20 transition", () => {
    const { trace, events } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(valueChanged("var_x_1", 10, 20));
      add(executionCompleted());
    });
    const changeEvent = events.find((e) => e.type === "entity.value_changed")!;

    const result = evaluator.evaluate(changesTenToTwenty, ctx(trace));
    expect(result.satisfied).toBe(true);
    expect(result.evidence[0].sequence).toBe(changeEvent.sequence);
    expect(result.evidence[0].observed).toEqual({
      displayName: "x",
      previousValue: 10,
      value: 20,
    });
  });

  it("NOT satisfied when x reached 10 and later 20 through unrelated intermediate values", () => {
    // Sprint 2 brief section 21 explicitly requires this to be unsatisfied.
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(valueChanged("var_x_1", 10, 15));
      add(valueChanged("var_x_1", 15, 20));
      add(executionCompleted());
    });

    const result = evaluator.evaluate(changesTenToTwenty, ctx(trace));
    expect(result.satisfied).toBe(false);
  });

  it("NOT satisfied when the transition is on a different entity", () => {
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_y_1", "y", 10));
      add(valueChanged("var_y_1", 10, 20));
      add(executionCompleted());
    });

    const result = evaluator.evaluate(changesTenToTwenty, ctx(trace));
    expect(result.satisfied).toBe(false);
  });

  it("satisfied by the FIRST matching direct transition", () => {
    const { trace, events } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(valueChanged("var_x_1", 10, 20)); // first
      add(valueChanged("var_x_1", 20, 10));
      add(valueChanged("var_x_1", 10, 20)); // second, must be ignored
      add(executionCompleted());
    });
    const firstDirect = events.find(
      (e) =>
        e.type === "entity.value_changed" &&
        e.payload.kind === "entity.value_changed" &&
        e.payload.previousValue === 10 &&
        e.payload.value === 20,
    )!;

    const result = evaluator.evaluate(changesTenToTwenty, ctx(trace));
    expect(result.evidence[0].sequence).toBe(firstDirect.sequence);
  });

  it("unsatisfied when the entity is never created", () => {
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(executionCompleted());
    });

    const result = evaluator.evaluate(changesTenToTwenty, ctx(trace));
    expect(result.satisfied).toBe(false);
    expect(result.evidence).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ExecutionCompletedEvaluator
// ---------------------------------------------------------------------------

describe("ExecutionCompletedEvaluator", () => {
  const evaluator = new ExecutionCompletedEvaluator();

  const definition: ExecutionCompletedObjectiveDefinition = {
    id: "obj-exec-complete",
    type: "execution_completed",
  };

  it("satisfied when execution.completed is present", () => {
    const { trace, events } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(executionCompleted());
    });
    const completed = events.find((e) => e.type === "execution.completed")!;

    const result = evaluator.evaluate(definition, ctx(trace));
    expect(result.satisfied).toBe(true);
    expect(result.evidence[0].sequence).toBe(completed.sequence);
    expect(result.evidence[0].observed).toEqual({
      kind: "execution.completed",
    });
    expect(result.evidence[0].relatedEvent).toBe(completed);
  });

  it("unsatisfied when trace ends with execution.failed", () => {
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(executionFailed());
    });

    const result = evaluator.evaluate(definition, ctx(trace));
    expect(result.satisfied).toBe(false);
    expect(result.evidence).toEqual([]);
  });

  it("unsatisfied on an empty event trace", () => {
    const { trace } = buildTrace(() => {});
    const result = evaluator.evaluate(definition, ctx(trace));
    expect(result.satisfied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createDefaultEvaluatorRegistry
// ---------------------------------------------------------------------------

describe("createDefaultEvaluatorRegistry", () => {
  it("registers all four evaluator types", () => {
    const registry = createDefaultEvaluatorRegistry();
    expect(registry.registeredTypes().sort()).toEqual([
      "entity_exists",
      "entity_value_changed",
      "entity_value_equals",
      "execution_completed",
    ]);
  });

  it("can evaluate a mixed batch against a real-shaped trace", () => {
    const registry = createDefaultEvaluatorRegistry();
    const { trace } = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(valueChanged("var_x_1", 10, 20));
      add(scopeExited());
      add(executionCompleted());
    });

    const results = registry.evaluateAll(
      [
        { id: "a", type: "entity_exists", displayName: "x" },
        { id: "b", type: "entity_value_equals", displayName: "x", value: 20 },
        {
          id: "c",
          type: "entity_value_changed",
          displayName: "x",
          from: 10,
          to: 20,
        },
        { id: "d", type: "execution_completed" },
        // negative case
        {
          id: "e",
          type: "entity_value_changed",
          displayName: "x",
          from: 0,
          to: 99,
        },
      ],
      ctx(trace),
    );

    expect(results.map((r) => [r.objectiveId, r.satisfied])).toEqual([
      ["a", true],
      ["b", true],
      ["c", true],
      ["d", true],
      ["e", false],
    ]);

    // Satisfied results should carry evidence with a sequence.
    expect(results[0].evidence[0].sequence).toBeGreaterThan(0);
    expect(results[3].evidence[0].sequence).toBeGreaterThan(0);
  });

  it("returns a fresh registry each call (no shared state)", () => {
    const a = createDefaultEvaluatorRegistry();
    const b = createDefaultEvaluatorRegistry();
    expect(a).not.toBe(b);
  });
});
