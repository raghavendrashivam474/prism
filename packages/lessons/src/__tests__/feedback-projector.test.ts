import { describe, it, expect } from "vitest";
import {
  FeedbackProjector,
  projectStepFeedback,
  projectAttemptFeedback,
  evaluateStep,
  startSession,
  recordAttempt,
  type LessonStepDefinition,
  type LessonDefinition,
  type StepEvaluation,
  type ExecutionOutcome,
} from "../index";
import {
  createDefaultEvaluatorRegistry,
  ObjectiveEvaluatorRegistry,
} from "@prism/objectives";
import type { NormalizedTrace, NormalizedTraceEvent } from "@prism/trace-model";

// ---------------------------------------------------------------------------
// Trace builder (same shape as other lesson-package tests)
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

function step(
  id: string,
  title: string,
  objectives: LessonStepDefinition["objectives"],
): LessonStepDefinition {
  return {
    id,
    title,
    content: { explanation: "test" },
    code: { starterSource: "int main() { return 0; }" },
    objectives,
  };
}

function successOutcome(trace: NormalizedTrace): ExecutionOutcome {
  return { kind: "success", trace, snapshots: [] };
}
function failureOutcome(): ExecutionOutcome {
  return {
    kind: "failure",
    category: "compilation_failed",
    message: "test failure",
  };
}

const registry = createDefaultEvaluatorRegistry();

// ---------------------------------------------------------------------------
// projectStepFeedback - complete verdict
// ---------------------------------------------------------------------------

describe("projectStepFeedback - complete verdict", () => {
  const s = step("s1", "Understanding Variables", [
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

  const trace = buildTrace((add) => {
    add(executionStarted());
    add(scopeEntered());
    add(entityCreated("var_x_1", "x", 10));
    add(valueChanged("var_x_1", 10, 20));
    add(executionCompleted());
  });

  const evaluation = evaluateStep(s, successOutcome(trace), registry);

  it("overall tone is success", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.tone).toBe("success");
  });

  it("heading mentions completion", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.heading).toBe("Step complete");
  });

  it("summary references the step title", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.summary).toContain("Understanding Variables");
  });

  it("every per-objective tone is success", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.objectives.every((o) => o.tone === "success")).toBe(true);
  });

  it("every per-objective status is satisfied", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.objectives.every((o) => o.status === "satisfied")).toBe(true);
  });

  it("carries evidenceHint sequences from satisfied evaluations", () => {
    const fb = projectStepFeedback(s, evaluation);
    for (const o of fb.objectives) {
      expect(o.evidenceHint).not.toBeNull();
      expect(o.evidenceHint!.sequence).toBeGreaterThan(0);
    }
  });

  it("preserves objective order from the step definition", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.objectives.map((o) => o.objectiveId)).toEqual([
      "o-exists",
      "o-changed",
      "o-done",
    ]);
  });

  it("uses per-type wording for each objective", () => {
    const fb = projectStepFeedback(s, evaluation);
    const [exists, changed, done] = fb.objectives;

    expect(exists.title).toBe("Create `x`");
    expect(exists.body).toContain("`x`");
    expect(exists.body).toContain("created");

    expect(changed.title).toBe("Change `x` from 10 to 20");
    expect(changed.body).toContain("10");
    expect(changed.body).toContain("20");

    expect(done.title).toBe("Program runs to completion");
    expect(done.body).toContain("completed");
  });
});

// ---------------------------------------------------------------------------
// projectStepFeedback - incomplete verdicts (partial vs retry)
// ---------------------------------------------------------------------------

describe("projectStepFeedback - incomplete verdicts", () => {
  const s = step("s1", "Change x", [
    { id: "o-exists", type: "entity_exists", displayName: "x" },
    {
      id: "o-changed",
      type: "entity_value_changed",
      displayName: "x",
      from: 10,
      to: 20,
    },
  ]);

  it("partial tone when some objectives satisfied", () => {
    const trace = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      // no value change to 20 - the changed objective will fail
      add(executionCompleted());
    });
    const evaluation = evaluateStep(s, successOutcome(trace), registry);
    const fb = projectStepFeedback(s, evaluation);

    expect(fb.tone).toBe("partial");
    expect(fb.heading).toBe("Some objectives satisfied");
    expect(fb.summary).toContain("1 of 2 objectives");
  });

  it("retry tone when NO objectives satisfied but execution ran", () => {
    // Step requires an entity y that never exists.
    const stepWithMissing = step("s1", "Create y", [
      { id: "o-y", type: "entity_exists", displayName: "y" },
    ]);
    const trace = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(executionCompleted());
    });
    const evaluation = evaluateStep(
      stepWithMissing,
      successOutcome(trace),
      registry,
    );
    const fb = projectStepFeedback(stepWithMissing, evaluation);

    expect(fb.tone).toBe("retry");
    expect(fb.heading).toBe("Keep going");
    expect(fb.summary).toContain("none of the objectives");
  });

  it("satisfied objectives keep success tone", () => {
    const trace = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(executionCompleted());
    });
    const evaluation = evaluateStep(s, successOutcome(trace), registry);
    const fb = projectStepFeedback(s, evaluation);

    const exists = fb.objectives.find((o) => o.objectiveId === "o-exists")!;
    expect(exists.status).toBe("satisfied");
    expect(exists.tone).toBe("success");
    expect(exists.evidenceHint).not.toBeNull();
  });

  it("unsatisfied objectives get retry tone and null evidenceHint", () => {
    const trace = buildTrace((add) => {
      add(executionStarted());
      add(scopeEntered());
      add(entityCreated("var_x_1", "x", 10));
      add(executionCompleted());
    });
    const evaluation = evaluateStep(s, successOutcome(trace), registry);
    const fb = projectStepFeedback(s, evaluation);

    const changed = fb.objectives.find((o) => o.objectiveId === "o-changed")!;
    expect(changed.status).toBe("unsatisfied");
    expect(changed.tone).toBe("retry");
    expect(changed.evidenceHint).toBeNull();
    expect(changed.body).toContain("did not change directly from 10 to 20");
  });
});

// ---------------------------------------------------------------------------
// projectStepFeedback - execution failure (handoff S25)
// ---------------------------------------------------------------------------

describe("projectStepFeedback - execution failure (handoff S25)", () => {
  const s = step("s1", "Change x", [
    { id: "o-exists", type: "entity_exists", displayName: "x" },
    {
      id: "o-changed",
      type: "entity_value_changed",
      displayName: "x",
      from: 10,
      to: 20,
    },
  ]);

  const evaluation: StepEvaluation = evaluateStep(
    s,
    failureOutcome(),
    registry,
  );

  it("overall tone is execution_error", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.tone).toBe("execution_error");
  });

  it("heading does not blame objectives", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.heading).toBe("Your program did not execute");
  });

  it("summary references the failure category", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.summary).toContain("compilation_failed");
  });

  it("every per-objective status is not_evaluated", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.objectives.every((o) => o.status === "not_evaluated")).toBe(true);
  });

  it("every per-objective tone is execution_error", () => {
    const fb = projectStepFeedback(s, evaluation);
    expect(fb.objectives.every((o) => o.tone === "execution_error")).toBe(true);
  });

  it("does NOT claim any objective failed", () => {
    const fb = projectStepFeedback(s, evaluation);
    for (const o of fb.objectives) {
      expect(o.body.toLowerCase()).not.toContain("did not change");
      expect(o.body.toLowerCase()).not.toContain("never reached");
      expect(o.body.toLowerCase()).not.toContain("was not created");
    }
  });

  it("all evidenceHints are null on failure", () => {
    const fb = projectStepFeedback(s, evaluation);
    for (const o of fb.objectives) {
      expect(o.evidenceHint).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("projectStepFeedback - determinism", () => {
  const s = step("s1", "Understanding Variables", [
    { id: "o-exists", type: "entity_exists", displayName: "x" },
    { id: "o-done", type: "execution_completed" },
  ]);
  const trace = buildTrace((add) => {
    add(executionStarted());
    add(scopeEntered());
    add(entityCreated("var_x_1", "x", 10));
    add(executionCompleted());
  });

  it("repeated projections produce equal feedback", () => {
    const evaluation = evaluateStep(s, successOutcome(trace), registry);
    const a = projectStepFeedback(s, evaluation);
    const b = projectStepFeedback(s, evaluation);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// projectAttemptFeedback
// ---------------------------------------------------------------------------

describe("projectAttemptFeedback", () => {
  const s = step("s1", "Change x", [
    {
      id: "o-changed",
      type: "entity_value_changed",
      displayName: "x",
      from: 10,
      to: 20,
    },
  ]);
  const lesson: LessonDefinition = {
    id: "test-lesson",
    version: "0.1.0",
    title: "Test",
    description: "Test",
    languageId: "cpp",
    steps: [s],
  };

  const goodTrace = buildTrace((add) => {
    add(executionStarted());
    add(scopeEntered());
    add(entityCreated("var_x_1", "x", 10));
    add(valueChanged("var_x_1", 10, 20));
    add(executionCompleted());
  });

  it("projects feedback for the recorded attempt", () => {
    let state = startSession(lesson);
    state = recordAttempt(
      state,
      lesson,
      {
        source: "src",
        outcome: successOutcome(goodTrace),
        now: () => "2026-01-01T00:00:00.000Z",
      },
      registry,
    );
    const attempt = state.stepStates[0].attempts[0];
    const fb = projectAttemptFeedback(s, attempt);
    expect(fb.tone).toBe("success");
    expect(fb.stepId).toBe("s1");
  });

  it("throws when the attempt evaluation stepId does not match the step id", () => {
    let state = startSession(lesson);
    state = recordAttempt(
      state,
      lesson,
      {
        source: "src",
        outcome: successOutcome(goodTrace),
        now: () => "2026-01-01T00:00:00.000Z",
      },
      registry,
    );
    const attempt = state.stepStates[0].attempts[0];
    const otherStep = step("other-step", "Other", s.objectives);
    expect(() => projectAttemptFeedback(otherStep, attempt)).toThrow(
      /stepId/,
    );
  });
});

// ---------------------------------------------------------------------------
// FeedbackProjector - subclassability
// ---------------------------------------------------------------------------

describe("FeedbackProjector - is instantiable and subclassable", () => {
  it("default projector instance works", () => {
    const projector = new FeedbackProjector();
    const s = step("s1", "Any", [
      { id: "o-done", type: "execution_completed" },
    ]);
    const trace = buildTrace((add) => {
      add(executionStarted());
      add(executionCompleted());
    });
    const evaluation = evaluateStep(s, successOutcome(trace), registry);
    const fb = projector.projectStepFeedback(s, evaluation);
    expect(fb.tone).toBe("success");
  });
});
