import { describe, it, expect } from "vitest";
import {
  startSession,
  completeActiveStep,
  activateStep,
  resetSession,
  currentStepState,
  isLessonComplete,
  LessonSessionError,
  type LessonDefinition,
  type LessonStepDefinition,
} from "../index";

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeStep(id: string): LessonStepDefinition {
  return {
    id,
    title: `Step ${id}`,
    content: { explanation: "test explanation" },
    code: { starterSource: "int main() { return 0; }" },
    objectives: [{ id: `${id}-obj`, type: "execution_completed" }],
  };
}

function makeLesson(stepIds: string[] = ["s1", "s2", "s3"]): LessonDefinition {
  return {
    id: "test-lesson",
    version: "0.1.0",
    title: "Test Lesson",
    description: "Test description.",
    languageId: "cpp",
    steps: stepIds.map(makeStep),
  };
}

// ---------------------------------------------------------------------------
// startSession
// ---------------------------------------------------------------------------

describe("startSession", () => {
  it("sets session status to active", () => {
    const state = startSession(makeLesson());
    expect(state.status).toBe("active");
  });

  it("sets currentStepIndex to 0", () => {
    const state = startSession(makeLesson());
    expect(state.currentStepIndex).toBe(0);
  });

  it("sets first step to active", () => {
    const state = startSession(makeLesson());
    expect(state.stepStates[0].status).toBe("active");
  });

  it("sets all later steps to locked", () => {
    const state = startSession(makeLesson(["a", "b", "c", "d"]));
    expect(state.stepStates[1].status).toBe("locked");
    expect(state.stepStates[2].status).toBe("locked");
    expect(state.stepStates[3].status).toBe("locked");
  });

  it("stores lessonId", () => {
    const state = startSession(makeLesson());
    expect(state.lessonId).toBe("test-lesson");
  });

  it("creates correct number of step states", () => {
    const state = startSession(makeLesson(["a", "b"]));
    expect(state.stepStates).toHaveLength(2);
  });

  it("preserves step IDs in order", () => {
    const state = startSession(makeLesson(["x", "y", "z"]));
    expect(state.stepStates.map((s) => s.stepId)).toEqual(["x", "y", "z"]);
  });

  it("throws on lesson with no steps", () => {
    const bad = { ...makeLesson(), steps: [] };
    expect(() => startSession(bad)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// completeActiveStep
// ---------------------------------------------------------------------------

describe("completeActiveStep", () => {
  it("marks active step as completed", () => {
    const state = startSession(makeLesson());
    const next = completeActiveStep(state);
    expect(next.stepStates[0].status).toBe("completed");
  });

  it("unlocks next locked step to available", () => {
    const state = startSession(makeLesson());
    const next = completeActiveStep(state);
    expect(next.stepStates[1].status).toBe("available");
  });

  it("does NOT auto-activate next step", () => {
    const state = startSession(makeLesson());
    const next = completeActiveStep(state);
    expect(next.stepStates[1].status).not.toBe("active");
  });

  it("keeps currentStepIndex unchanged", () => {
    const state = startSession(makeLesson());
    const next = completeActiveStep(state);
    expect(next.currentStepIndex).toBe(0);
  });

  it("keeps later steps locked beyond the next one", () => {
    const state = startSession(makeLesson(["a", "b", "c"]));
    const next = completeActiveStep(state);
    expect(next.stepStates[2].status).toBe("locked");
  });

  it("completing final step marks session completed", () => {
    let state = startSession(makeLesson(["only"]));
    state = completeActiveStep(state);
    expect(state.status).toBe("completed");
    expect(state.stepStates[0].status).toBe("completed");
  });

  it("final step completion keeps currentStepIndex valid", () => {
    let state = startSession(makeLesson(["only"]));
    state = completeActiveStep(state);
    expect(state.currentStepIndex).toBe(0);
  });

  it("does not create a nonexistent next step after final completion", () => {
    let state = startSession(makeLesson(["only"]));
    state = completeActiveStep(state);
    expect(state.stepStates).toHaveLength(1);
  });

  it("rejects when session is already completed", () => {
    let state = startSession(makeLesson(["only"]));
    state = completeActiveStep(state);
    expect(() => completeActiveStep(state)).toThrow(LessonSessionError);
  });

  it("error code is LESSON_ALREADY_COMPLETED", () => {
    let state = startSession(makeLesson(["only"]));
    state = completeActiveStep(state);
    try {
      completeActiveStep(state);
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonSessionError).code).toBe("LESSON_ALREADY_COMPLETED");
    }
  });

  it("rejects when current step is not active (already completed mid-lesson)", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    // Step 0 is now completed, step 1 is available, no step is active yet
    expect(() => completeActiveStep(state)).toThrow(LessonSessionError);
  });
});

// ---------------------------------------------------------------------------
// activateStep
// ---------------------------------------------------------------------------

describe("activateStep", () => {
  it("activates an available step", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    state = activateStep(state, "s2");
    expect(state.stepStates[1].status).toBe("active");
  });

  it("updates currentStepIndex to activated step", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    state = activateStep(state, "s2");
    expect(state.currentStepIndex).toBe(1);
  });

  it("rejects activation of a locked step", () => {
    const state = startSession(makeLesson());
    expect(() => activateStep(state, "s2")).toThrow(LessonSessionError);
  });

  it("error code is STEP_LOCKED for locked step", () => {
    const state = startSession(makeLesson());
    try {
      activateStep(state, "s2");
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonSessionError).code).toBe("STEP_LOCKED");
    }
  });

  it("rejects activation of a completed step", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    state = activateStep(state, "s2");
    state = completeActiveStep(state);
    // s1 is completed — cannot reactivate
    expect(() => activateStep(state, "s1")).toThrow(LessonSessionError);
  });

  it("error code is STEP_ALREADY_COMPLETED for completed step", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    state = activateStep(state, "s2");
    state = completeActiveStep(state);
    try {
      activateStep(state, "s1");
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonSessionError).code).toBe("STEP_ALREADY_COMPLETED");
    }
  });

  it("rejects redundant activation of already active step", () => {
    const state = startSession(makeLesson());
    expect(() => activateStep(state, "s1")).toThrow(LessonSessionError);
  });

  it("error code is STEP_ALREADY_ACTIVE for active step", () => {
    const state = startSession(makeLesson());
    try {
      activateStep(state, "s1");
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonSessionError).code).toBe("STEP_ALREADY_ACTIVE");
    }
  });

  it("rejects activation of unknown step ID", () => {
    const state = startSession(makeLesson());
    expect(() => activateStep(state, "nonexistent")).toThrow(LessonSessionError);
  });

  it("error code is STEP_NOT_FOUND for unknown step", () => {
    const state = startSession(makeLesson());
    try {
      activateStep(state, "nonexistent");
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonSessionError).code).toBe("STEP_NOT_FOUND");
    }
  });

  it("rejects activation when session is completed", () => {
    let state = startSession(makeLesson(["only"]));
    state = completeActiveStep(state);
    expect(() => activateStep(state, "only")).toThrow(LessonSessionError);
  });
});

// ---------------------------------------------------------------------------
// Full lesson progression
// ---------------------------------------------------------------------------

describe("full lesson progression", () => {
  it("completes a 3-step lesson through valid transitions", () => {
    let state = startSession(makeLesson(["s1", "s2", "s3"]));
    expect(state.status).toBe("active");

    // Complete step 1, activate step 2
    state = completeActiveStep(state);
    expect(state.stepStates[0].status).toBe("completed");
    expect(state.stepStates[1].status).toBe("available");
    state = activateStep(state, "s2");
    expect(state.currentStepIndex).toBe(1);
    expect(state.stepStates[1].status).toBe("active");

    // Complete step 2, activate step 3
    state = completeActiveStep(state);
    expect(state.stepStates[1].status).toBe("completed");
    expect(state.stepStates[2].status).toBe("available");
    state = activateStep(state, "s3");
    expect(state.currentStepIndex).toBe(2);
    expect(state.stepStates[2].status).toBe("active");

    // Complete final step — session completes
    state = completeActiveStep(state);
    expect(state.status).toBe("completed");
    expect(state.stepStates.every((s) => s.status === "completed")).toBe(true);
  });

  it("a 4-step lesson has correct intermediate states", () => {
    let state = startSession(makeLesson(["a", "b", "c", "d"]));

    state = completeActiveStep(state);
    expect(state.stepStates.map((s) => s.status)).toEqual([
      "completed", "available", "locked", "locked",
    ]);

    state = activateStep(state, "b");
    state = completeActiveStep(state);
    expect(state.stepStates.map((s) => s.status)).toEqual([
      "completed", "completed", "available", "locked",
    ]);

    state = activateStep(state, "c");
    state = completeActiveStep(state);
    expect(state.stepStates.map((s) => s.status)).toEqual([
      "completed", "completed", "completed", "available",
    ]);

    state = activateStep(state, "d");
    state = completeActiveStep(state);
    expect(state.status).toBe("completed");
    expect(state.stepStates.map((s) => s.status)).toEqual([
      "completed", "completed", "completed", "completed",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe("immutability", () => {
  it("completeActiveStep returns a new state object", () => {
    const state = startSession(makeLesson());
    const next = completeActiveStep(state);
    expect(next).not.toBe(state);
  });

  it("original state is not mutated by completeActiveStep", () => {
    const state = startSession(makeLesson());
    completeActiveStep(state);
    expect(state.stepStates[0].status).toBe("active");
    expect(state.stepStates[1].status).toBe("locked");
  });

  it("original stepStates array is not mutated", () => {
    const state = startSession(makeLesson());
    const originalStepStates = state.stepStates;
    completeActiveStep(state);
    expect(state.stepStates).toBe(originalStepStates);
    expect(state.stepStates[0].status).toBe("active");
  });

  it("activateStep returns a new state object", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    const next = activateStep(state, "s2");
    expect(next).not.toBe(state);
  });

  it("original state is not mutated by activateStep", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    const beforeIndex = state.currentStepIndex;
    activateStep(state, "s2");
    expect(state.currentStepIndex).toBe(beforeIndex);
    expect(state.stepStates[1].status).toBe("available");
  });

  it("repeated equivalent transitions produce equivalent state", () => {
    const stateA = startSession(makeLesson(["x", "y"]));
    const stateB = startSession(makeLesson(["x", "y"]));

    const nextA = completeActiveStep(stateA);
    const nextB = completeActiveStep(stateB);

    expect(nextA).toEqual(nextB);

    const activatedA = activateStep(nextA, "y");
    const activatedB = activateStep(nextB, "y");

    expect(activatedA).toEqual(activatedB);
  });
});

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

describe("currentStepState", () => {
  it("returns the active step state", () => {
    const state = startSession(makeLesson());
    const current = currentStepState(state);
    expect(current?.stepId).toBe("s1");
    expect(current?.status).toBe("active");
  });

  it("returns completed step when step is completed but not yet advanced", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    const current = currentStepState(state);
    expect(current?.stepId).toBe("s1");
    expect(current?.status).toBe("completed");
  });

  it("returns new active step after activation", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    state = activateStep(state, "s2");
    const current = currentStepState(state);
    expect(current?.stepId).toBe("s2");
    expect(current?.status).toBe("active");
  });
});

describe("isLessonComplete", () => {
  it("is false while session is active", () => {
    const state = startSession(makeLesson());
    expect(isLessonComplete(state)).toBe(false);
  });

  it("is false after completing non-final step", () => {
    let state = startSession(makeLesson());
    state = completeActiveStep(state);
    expect(isLessonComplete(state)).toBe(false);
  });

  it("is true after final step is completed", () => {
    let state = startSession(makeLesson(["only"]));
    state = completeActiveStep(state);
    expect(isLessonComplete(state)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetSession
// ---------------------------------------------------------------------------

describe("resetSession", () => {
  it("returns a fresh session equivalent to startSession", () => {
    const lesson = makeLesson();
    let state = startSession(lesson);
    state = completeActiveStep(state);
    state = activateStep(state, "s2");

    const reset = resetSession(lesson);
    const fresh = startSession(lesson);
    expect(reset).toEqual(fresh);
  });

  it("resets from a partially completed session", () => {
    const lesson = makeLesson();
    let state = startSession(lesson);
    state = completeActiveStep(state);

    const reset = resetSession(lesson);
    expect(reset.currentStepIndex).toBe(0);
    expect(reset.status).toBe("active");
    expect(reset.stepStates[0].status).toBe("active");
    expect(reset.stepStates[1].status).toBe("locked");
  });

  it("resets from a completed session", () => {
    const lesson = makeLesson(["only"]);
    let state = startSession(lesson);
    state = completeActiveStep(state);
    expect(state.status).toBe("completed");

    const reset = resetSession(lesson);
    expect(reset.status).toBe("active");
    expect(reset.stepStates[0].status).toBe("active");
  });
});
