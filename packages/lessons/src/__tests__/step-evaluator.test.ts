import { describe, it, expect } from "vitest";
import {
  evaluateStep,
  type ExecutionOutcome,
  type LessonStepDefinition,
} from "../index";
import {
  createDefaultEvaluatorRegistry,
  ObjectiveEvaluatorRegistry,
  ObjectiveEvaluatorRegistryError,
  type ObjectiveEvaluatorPlugin,
} from "@prism/objectives";
import type { NormalizedTrace, NormalizedTraceEvent } from "@prism/trace-model";

// ---------------------------------------------------------------------------
// Trace fixture builder (identical shape to the evaluators tests, kept
// local to avoid cross-package test coupling).
// ---------------------------------------------------------------------------

function buildTrace(
  build: (add: (event: NormalizedTraceEvent) => void) => void,
): NormalizedTrace {
  const events: NormalizedTraceEvent[] = [];
  let seq = 0;
  build((event) => {
    seq += 1;
    events.push({ ...event, sequence: seq });
  });
  return {
    irVersion: "learning-ir/v0.1",
    executionId: "test-exec",
    languageId: "cpp",
    events,
  };
}

function executionStarted(): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "execution.started",
    sourceLocation: { line: 1 },
    payload: { kind: "execution.started" },
  };
}
function scopeEntered(): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "scope.entered",
    sourceLocation: { line: 1 },
    payload: { kind: "scope.entered", scopeId: "main", displayName: "main" },
  };
}
function entityCreated(
  entityId: string,
  displayName: string,
  value: number,
): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "entity.created",
    sourceLocation: { line: 2 },
    entityId,
    payload: {
      kind: "entity.created",
      entityKind: "variable",
      displayName,
      dataType: "int",
      value,
      scopeId: "main",
    },
  };
}
function valueChanged(
  entityId: string,
  previousValue: number,
  value: number,
): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "entity.value_changed",
    sourceLocation: { line: 3 },
    entityId,
    payload: { kind: "entity.value_changed", previousValue, value },
  };
}
function executionCompleted(): NormalizedTraceEvent {
  return {
    sequence: 0,
    type: "execution.completed",
    sourceLocation: { line: 4 },
    payload: { kind: "execution.completed" },
  };
}

// ---------------------------------------------------------------------------
// Step fixtures
// ---------------------------------------------------------------------------

function stepWithObjectives(
  objectives: LessonStepDefinition["objectives"],
): LessonStepDefinition {
  return {
    id: "step-1",
    title: "Test Step",
    content: { explanation: "test" },
    code: { starterSource: "int main() { return 0; }" },
    objectives,
  };
}

function successOutcome(trace: NormalizedTrace): ExecutionOutcome {
  return { kind: "success", trace, snapshots: [] };
}

function failureOutcome(
  category = "compilation_failed",
  message = "test failure",
): ExecutionOutcome {
  return { kind: "failure", category, message };
}

// ---------------------------------------------------------------------------
// Execution success — all satisfied
// ---------------------------------------------------------------------------

describe("evaluateStep — successful execution, all objectives satisfied", () => {
  const registry = createDefaultEvaluatorRegistry();

  const trace = buildTrace((add) => {
    add(executionStarted());
    add(scopeEntered());
    add(entityCreated("var_x_1", "x", 10));
    add(valueChanged("var_x_1", 10, 20));
    add(executionCompleted());
  });

  const step = stepWithObjectives([
    { id: "o-exists", type: "entity_exists", displayName: "x" },
    {
      id: "o-changed",
      type: "entity_value_changed",
      displayName: "x",
      from: 10,
      to: 20,
    },
    { id: "o-done", type: "execution_completed" },
  ]);

  it("verdict is complete", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    expect(result.verdict).toBe("complete");
  });

  it("every objective is satisfied", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    expect(result.outcomes.every((o) => o.status === "satisfied")).toBe(true);
  });

  it("outcomes preserve objective order", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    expect(result.outcomes.map((o) => o.objectiveId)).toEqual([
      "o-exists",
      "o-changed",
      "o-done",
    ]);
  });

  it("each outcome carries the underlying evaluation result with evidence", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    for (const o of result.outcomes) {
      expect(o.result).not.toBeNull();
      expect(o.result!.satisfied).toBe(true);
      expect(o.result!.evidence.length).toBeGreaterThan(0);
      expect(o.result!.evidence[0].sequence).toBeGreaterThan(0);
    }
  });

  it("failure field is null on success", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    expect(result.failure).toBeNull();
  });

  it("stepId is preserved", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    expect(result.stepId).toBe("step-1");
  });
});

// ---------------------------------------------------------------------------
// Execution success — some unsatisfied
// ---------------------------------------------------------------------------

describe("evaluateStep — successful execution, some objectives unsatisfied", () => {
  const registry = createDefaultEvaluatorRegistry();

  const trace = buildTrace((add) => {
    add(executionStarted());
    add(scopeEntered());
    add(entityCreated("var_x_1", "x", 10));
    // no change to 20 — the value_changed objective will fail
    add(executionCompleted());
  });

  const step = stepWithObjectives([
    { id: "o-exists", type: "entity_exists", displayName: "x" },
    {
      id: "o-changed",
      type: "entity_value_changed",
      displayName: "x",
      from: 10,
      to: 20,
    },
    { id: "o-done", type: "execution_completed" },
  ]);

  it("verdict is incomplete", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    expect(result.verdict).toBe("incomplete");
  });

  it("satisfied objectives are marked satisfied", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    const exists = result.outcomes.find((o) => o.objectiveId === "o-exists")!;
    expect(exists.status).toBe("satisfied");
  });

  it("unsatisfied objectives are marked unsatisfied", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    const changed = result.outcomes.find((o) => o.objectiveId === "o-changed")!;
    expect(changed.status).toBe("unsatisfied");
    expect(changed.result).not.toBeNull();
    expect(changed.result!.satisfied).toBe(false);
  });

  it("failure field is null even when incomplete", () => {
    const result = evaluateStep(step, successOutcome(trace), registry);
    expect(result.failure).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Execution failure
// ---------------------------------------------------------------------------

describe("evaluateStep — execution failure", () => {
  const registry = createDefaultEvaluatorRegistry();

  const step = stepWithObjectives([
    { id: "o-exists", type: "entity_exists", displayName: "x" },
    {
      id: "o-changed",
      type: "entity_value_changed",
      displayName: "x",
      from: 10,
      to: 20,
    },
  ]);

  it("verdict is execution_failed", () => {
    const result = evaluateStep(step, failureOutcome(), registry);
    expect(result.verdict).toBe("execution_failed");
  });

  it("every objective is marked not_evaluated", () => {
    const result = evaluateStep(step, failureOutcome(), registry);
    expect(result.outcomes.every((o) => o.status === "not_evaluated")).toBe(
      true,
    );
  });

  it("not_evaluated outcomes carry null result (no observation was possible)", () => {
    const result = evaluateStep(step, failureOutcome(), registry);
    for (const o of result.outcomes) {
      expect(o.result).toBeNull();
    }
  });

  it("failure field preserves category and message", () => {
    const result = evaluateStep(
      step,
      failureOutcome("timeout", "sandbox timed out"),
      registry,
    );
    expect(result.failure).toEqual({
      category: "timeout",
      message: "sandbox timed out",
    });
  });

  it("does NOT invoke the registry on failure", () => {
    // Prove no evaluator is called by constructing an EMPTY registry.
    // A successful path against this same objective set would throw
    // NO_EVALUATOR_REGISTERED — the failure path must not.
    const emptyRegistry = new ObjectiveEvaluatorRegistry();
    expect(() =>
      evaluateStep(step, failureOutcome(), emptyRegistry),
    ).not.toThrow();
  });

  it("outcomes preserve objective order on failure", () => {
    const result = evaluateStep(step, failureOutcome(), registry);
    expect(result.outcomes.map((o) => o.objectiveId)).toEqual([
      "o-exists",
      "o-changed",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("evaluateStep — determinism", () => {
  const registry = createDefaultEvaluatorRegistry();

  const trace = buildTrace((add) => {
    add(executionStarted());
    add(scopeEntered());
    add(entityCreated("var_x_1", "x", 10));
    add(valueChanged("var_x_1", 10, 20));
    add(executionCompleted());
  });

  const step = stepWithObjectives([
    { id: "o-exists", type: "entity_exists", displayName: "x" },
    { id: "o-done", type: "execution_completed" },
  ]);

  it("repeated evaluations produce equivalent results", () => {
    const a = evaluateStep(step, successOutcome(trace), registry);
    const b = evaluateStep(step, successOutcome(trace), registry);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Registry error propagation
// ---------------------------------------------------------------------------

describe("evaluateStep — registry error propagation", () => {
  it("propagates NO_EVALUATOR_REGISTERED for unknown objective types on success", () => {
    const emptyRegistry = new ObjectiveEvaluatorRegistry();
    const step = stepWithObjectives([
      { id: "o-1", type: "entity_exists", displayName: "x" },
    ]);
    const trace = buildTrace((add) => {
      add(executionStarted());
      add(executionCompleted());
    });

    expect(() =>
      evaluateStep(step, successOutcome(trace), emptyRegistry),
    ).toThrow(ObjectiveEvaluatorRegistryError);
  });

  it("propagates evaluator plugin errors", () => {
    const throwingPlugin: ObjectiveEvaluatorPlugin<"entity_exists"> = {
      objectiveType: "entity_exists",
      evaluate: () => {
        throw new Error("plugin bug");
      },
    };
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(throwingPlugin);

    const step = stepWithObjectives([
      { id: "o-1", type: "entity_exists", displayName: "x" },
    ]);
    const trace = buildTrace((add) => {
      add(executionStarted());
      add(executionCompleted());
    });

    expect(() =>
      evaluateStep(step, successOutcome(trace), registry),
    ).toThrow("plugin bug");
  });
});
