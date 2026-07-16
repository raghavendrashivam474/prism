import { describe, it, expect } from "vitest";
import {
  startSession,
  recordAttempt,
  LessonSessionError,
  type LessonSessionState,
  type LessonDefinition,
  type LessonStepDefinition,
  type ExecutionOutcome,
} from "../index";
import {
  createDefaultEvaluatorRegistry,
} from "@prism/objectives";
import type { NormalizedTrace, NormalizedTraceEvent } from "@prism/trace-model";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeStep(
  id: string,
  objectives: LessonStepDefinition["objectives"] = [
    { id: `${id}-done`, type: "execution_completed" },
  ],
): LessonStepDefinition {
  return {
    id,
    title: `Step ${id}`,
    content: { explanation: "test" },
    code: { starterSource: "int main() { return 0; }" },
    objectives,
  };
}

function makeLesson(steps: LessonStepDefinition[]): LessonDefinition {
  return {
    id: "test-lesson",
    version: "0.1.0",
    title: "Test Lesson",
    description: "Test description.",
    languageId: "cpp",
    steps,
  };
}

function buildTrace(
  build: (add: (event: NormalizedTraceEvent) => void) => void,
): NormalizedTrace {
  const events: NormalizedTraceEvent[] = [];
  let seq = 0;
  build((add) => {
    seq += 1;
    events.push({ ...add, sequence: seq });
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

const FIXED_NOW = "2026-01-01T00:00:00.000Z";
const now = () => FIXED_NOW;

// ---------------------------------------------------------------------------
// Baseline: startSession initialises attempts to []
// ---------------------------------------------------------------------------

describe("startSession - attempts initialisation (Milestone 2.9)", () => {
  it("initialises every step with empty attempts", () => {
    const state = startSession(makeLesson([makeStep("s1"), makeStep("s2")]));
    for (const step of state.stepStates) {
      expect(step.attempts).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// recordAttempt - successful attempt path
// ---------------------------------------------------------------------------

describe("recordAttempt - successful attempt", () => {
  const registry = createDefaultEvaluatorRegistry();

  const lesson = makeLesson([
    makeStep("s1"),
    makeStep("s2"),
  ]);

  const successfulTrace = buildTrace((add) => {
    add(executionStarted());
    add(scopeEntered());
    add(executionCompleted());
  });

  it("appends an attempt with attemptNumber 1", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(successfulTrace), now },
      registry,
    );
    expect(next.stepStates[0].attempts).toHaveLength(1);
    expect(next.stepStates[0].attempts[0].attemptNumber).toBe(1);
  });

  it("stores submittedAt from the injected clock", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(successfulTrace), now },
      registry,
    );
    expect(next.stepStates[0].attempts[0].submittedAt).toBe(FIXED_NOW);
  });

  it("stores the source and outcome verbatim", () => {
    const state = startSession(lesson);
    const outcome = successOutcome(successfulTrace);
    const next = recordAttempt(
      state,
      lesson,
      { source: "the source", outcome, now },
      registry,
    );
    const attempt = next.stepStates[0].attempts[0];
    expect(attempt.source).toBe("the source");
    expect(attempt.outcome).toBe(outcome);
  });

  it("stores the evaluation produced by evaluateStep", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(successfulTrace), now },
      registry,
    );
    const evaluation = next.stepStates[0].attempts[0].evaluation;
    expect(evaluation.stepId).toBe("s1");
    expect(evaluation.verdict).toBe("complete");
  });

  it("marks the step completed on a satisfying attempt", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(successfulTrace), now },
      registry,
    );
    expect(next.stepStates[0].status).toBe("completed");
  });

  it("unlocks the next step to available on completion", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(successfulTrace), now },
      registry,
    );
    expect(next.stepStates[1].status).toBe("available");
  });

  it("does NOT auto-activate the next step", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(successfulTrace), now },
      registry,
    );
    expect(next.currentStepIndex).toBe(0);
    expect(next.stepStates[1].status).not.toBe("active");
  });
});

// ---------------------------------------------------------------------------
// recordAttempt - unsatisfying attempt path
// ---------------------------------------------------------------------------

describe("recordAttempt - unsatisfying attempt", () => {
  const registry = createDefaultEvaluatorRegistry();

  const lesson = makeLesson([
    makeStep("s1", [
      {
        id: "o-changed",
        type: "entity_value_changed",
        displayName: "x",
        from: 10,
        to: 20,
      },
    ]),
  ]);

  const traceWithoutChange = buildTrace((add) => {
    add(executionStarted());
    add(scopeEntered());
    add(entityCreated("var_x_1", "x", 10));
    add(executionCompleted());
  });

  it("appends the attempt but leaves the step active", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(traceWithoutChange), now },
      registry,
    );
    expect(next.stepStates[0].attempts).toHaveLength(1);
    expect(next.stepStates[0].status).toBe("active");
  });

  it("records evaluation verdict as incomplete", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(traceWithoutChange), now },
      registry,
    );
    expect(next.stepStates[0].attempts[0].evaluation.verdict).toBe("incomplete");
  });

  it("allows a second attempt and numbers it 2", () => {
    const state = startSession(lesson);
    const s1 = recordAttempt(
      state,
      lesson,
      { source: "src1", outcome: successOutcome(traceWithoutChange), now },
      registry,
    );
    const s2 = recordAttempt(
      s1,
      lesson,
      { source: "src2", outcome: successOutcome(traceWithoutChange), now },
      registry,
    );
    expect(s2.stepStates[0].attempts).toHaveLength(2);
    expect(s2.stepStates[0].attempts[1].attemptNumber).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// recordAttempt - execution failure path (handoff S25)
// ---------------------------------------------------------------------------

describe("recordAttempt - execution failure", () => {
  const registry = createDefaultEvaluatorRegistry();

  const lesson = makeLesson([makeStep("s1")]);

  it("appends the attempt but does not complete the step", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "bad code", outcome: failureOutcome(), now },
      registry,
    );
    expect(next.stepStates[0].attempts).toHaveLength(1);
    expect(next.stepStates[0].status).toBe("active");
  });

  it("records evaluation verdict as execution_failed", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "bad code", outcome: failureOutcome(), now },
      registry,
    );
    expect(next.stepStates[0].attempts[0].evaluation.verdict).toBe(
      "execution_failed",
    );
  });

  it("preserves the failure category and message on the evaluation", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "bad code", outcome: failureOutcome(), now },
      registry,
    );
    expect(next.stepStates[0].attempts[0].evaluation.failure).toEqual({
      category: "compilation_failed",
      message: "test failure",
    });
  });

  it("does not mark objectives as unsatisfied on failure (they are not_evaluated)", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "bad code", outcome: failureOutcome(), now },
      registry,
    );
    for (const outcome of next.stepStates[0].attempts[0].evaluation.outcomes) {
      expect(outcome.status).toBe("not_evaluated");
    }
  });
});

// ---------------------------------------------------------------------------
// recordAttempt - final step completion
// ---------------------------------------------------------------------------

describe("recordAttempt - final step completion", () => {
  const registry = createDefaultEvaluatorRegistry();
  const lesson = makeLesson([makeStep("only")]);

  const goodTrace = buildTrace((add) => {
    add(executionStarted());
    add(executionCompleted());
  });

  it("completes the session when the final step is satisfied", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(goodTrace), now },
      registry,
    );
    expect(next.stepStates[0].status).toBe("completed");
    expect(next.status).toBe("completed");
  });

  it("does not create a nonexistent next step", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(goodTrace), now },
      registry,
    );
    expect(next.stepStates).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// recordAttempt - invalid transitions
// ---------------------------------------------------------------------------

describe("recordAttempt - invalid transitions", () => {
  const registry = createDefaultEvaluatorRegistry();
  const lesson = makeLesson([makeStep("only")]);

  const goodTrace = buildTrace((add) => {
    add(executionStarted());
    add(executionCompleted());
  });

  it("rejects when the session is already completed", () => {
    const state = startSession(lesson);
    const completed = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(goodTrace), now },
      registry,
    );
    expect(() =>
      recordAttempt(
        completed,
        lesson,
        { source: "src", outcome: successOutcome(goodTrace), now },
        registry,
      ),
    ).toThrow(LessonSessionError);
  });

  it("error code is LESSON_ALREADY_COMPLETED", () => {
    const state = startSession(lesson);
    const completed = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(goodTrace), now },
      registry,
    );
    try {
      recordAttempt(
        completed,
        lesson,
        { source: "src", outcome: successOutcome(goodTrace), now },
        registry,
      );
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonSessionError).code).toBe("LESSON_ALREADY_COMPLETED");
    }
  });

  it("rejects when the provided lesson id does not match the session", () => {
    const state = startSession(lesson);
    const otherLesson: LessonDefinition = { ...lesson, id: "other-lesson" };
    expect(() =>
      recordAttempt(
        state,
        otherLesson,
        { source: "src", outcome: successOutcome(goodTrace), now },
        registry,
      ),
    ).toThrow(LessonSessionError);
  });

  it("error code is LESSON_MISMATCH", () => {
    const state = startSession(lesson);
    const otherLesson: LessonDefinition = { ...lesson, id: "other-lesson" };
    try {
      recordAttempt(
        state,
        otherLesson,
        { source: "src", outcome: successOutcome(goodTrace), now },
        registry,
      );
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonSessionError).code).toBe("LESSON_MISMATCH");
    }
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe("recordAttempt - immutability", () => {
  const registry = createDefaultEvaluatorRegistry();
  const lesson = makeLesson([makeStep("s1"), makeStep("s2")]);
  const goodTrace = buildTrace((add) => {
    add(executionStarted());
    add(executionCompleted());
  });

  it("returns a new state object", () => {
    const state = startSession(lesson);
    const next = recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(goodTrace), now },
      registry,
    );
    expect(next).not.toBe(state);
  });

  it("does not mutate the original attempts array", () => {
    const state = startSession(lesson);
    const originalAttempts = state.stepStates[0].attempts;
    recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(goodTrace), now },
      registry,
    );
    expect(state.stepStates[0].attempts).toBe(originalAttempts);
    expect(state.stepStates[0].attempts).toHaveLength(0);
  });

  it("does not mutate the original step status", () => {
    const state = startSession(lesson);
    recordAttempt(
      state,
      lesson,
      { source: "src", outcome: successOutcome(goodTrace), now },
      registry,
    );
    expect(state.stepStates[0].status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// Full progression flow via recordAttempt + activateStep
// ---------------------------------------------------------------------------

describe("recordAttempt - full progression via orchestrator", () => {
  const registry = createDefaultEvaluatorRegistry();
  const lesson = makeLesson([makeStep("s1"), makeStep("s2")]);
  const goodTrace = buildTrace((add) => {
    add(executionStarted());
    add(executionCompleted());
  });

  it("supports satisfying step 1, then activating and satisfying step 2", async () => {
    let state: LessonSessionState = startSession(lesson);

    state = recordAttempt(
      state,
      lesson,
      { source: "src1", outcome: successOutcome(goodTrace), now },
      registry,
    );
    expect(state.stepStates[0].status).toBe("completed");
    expect(state.stepStates[1].status).toBe("available");

    // Activate step 2 via the existing 2.4 engine transition.
    const { activateStep } = await import("../session/engine");
    state = activateStep(state, "s2");
    expect(state.currentStepIndex).toBe(1);
    expect(state.stepStates[1].status).toBe("active");

    state = recordAttempt(
      state,
      lesson,
      { source: "src2", outcome: successOutcome(goodTrace), now },
      registry,
    );
    expect(state.status).toBe("completed");
    expect(state.stepStates.every((s) => s.status === "completed")).toBe(true);
  });
});
