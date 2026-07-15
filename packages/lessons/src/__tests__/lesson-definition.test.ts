import { describe, it, expect } from "vitest";
import {
  LessonValidationError,
  validateLessonDefinition,
  toLessonSummary,
  type LessonDefinition,
  type LessonStepDefinition,
} from "../index";

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function baseStep(overrides: Partial<LessonStepDefinition> = {}): LessonStepDefinition {
  return {
    id: "step-1",
    title: "Introduction",
    content: {
      explanation: "An int variable stores a value while the program executes.",
      instruction: "Run the program.",
      observationPrompt: "What value does x contain?",
    },
    code: {
      starterSource: "int main() {\n    int x = 10;\n    return 0;\n}\n",
    },
    objectives: [
      { id: "obj-1", type: "entity_exists", displayName: "x" },
    ],
    ...overrides,
  };
}

function baseLesson(overrides: Partial<LessonDefinition> = {}): LessonDefinition {
  return {
    id: "cpp-understanding-variable-state",
    version: "0.1.0",
    title: "Understanding Variable State",
    description: "Learn how variables acquire and change value during execution.",
    languageId: "cpp",
    steps: [baseStep()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid lessons
// ---------------------------------------------------------------------------

describe("validateLessonDefinition — valid lessons", () => {
  it("accepts a minimal valid lesson", () => {
    expect(() => validateLessonDefinition(baseLesson())).not.toThrow();
  });

  it("accepts a lesson with multiple steps", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({ id: "step-1" }),
        baseStep({
          id: "step-2",
          objectives: [
            { id: "obj-1", type: "entity_value_equals", displayName: "x", value: 20 },
          ],
        }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).not.toThrow();
  });

  it("accepts a step with multiple objectives", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          objectives: [
            { id: "obj-1", type: "entity_exists", displayName: "x" },
            { id: "obj-2", type: "entity_value_equals", displayName: "x", value: 10 },
            { id: "obj-3", type: "execution_completed" },
          ],
        }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).not.toThrow();
  });

  it("accepts all four supported objective types", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          objectives: [
            { id: "a", type: "entity_exists", displayName: "x" },
            { id: "b", type: "entity_value_equals", displayName: "x", value: 5 },
            { id: "c", type: "entity_value_changed", displayName: "x", from: 5, to: 10 },
            { id: "d", type: "execution_completed" },
          ],
        }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Lesson-level validation
// ---------------------------------------------------------------------------

describe("validateLessonDefinition — lesson metadata", () => {
  it("rejects an empty lesson id", () => {
    expect(() => validateLessonDefinition(baseLesson({ id: "" }))).toThrow(LessonValidationError);
  });

  it("rejects a whitespace-only lesson id", () => {
    expect(() => validateLessonDefinition(baseLesson({ id: "   " }))).toThrow(LessonValidationError);
  });

  it("rejects an empty lesson version", () => {
    expect(() => validateLessonDefinition(baseLesson({ version: "" }))).toThrow(LessonValidationError);
  });

  it("rejects an empty lesson title", () => {
    expect(() => validateLessonDefinition(baseLesson({ title: "" }))).toThrow(LessonValidationError);
  });

  it("rejects an empty lesson description", () => {
    expect(() => validateLessonDefinition(baseLesson({ description: "" }))).toThrow(LessonValidationError);
  });

  it("rejects an empty languageId", () => {
    expect(() => validateLessonDefinition(baseLesson({ languageId: "" }))).toThrow(LessonValidationError);
  });

  it("rejects a lesson with no steps", () => {
    expect(() => validateLessonDefinition(baseLesson({ steps: [] }))).toThrow(LessonValidationError);
  });

  it("error code is LESSON_STEPS_EMPTY for no-step lesson", () => {
    try {
      validateLessonDefinition(baseLesson({ steps: [] }));
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LessonValidationError);
      expect((e as LessonValidationError).code).toBe("LESSON_STEPS_EMPTY");
    }
  });

  it("rejects duplicate step ids", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({ id: "duplicate" }),
        baseStep({ id: "duplicate" }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).toThrow(LessonValidationError);
  });

  it("error code is STEP_ID_DUPLICATE", () => {
    const lesson = baseLesson({
      steps: [baseStep({ id: "dup" }), baseStep({ id: "dup" })],
    });
    try {
      validateLessonDefinition(lesson);
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonValidationError).code).toBe("STEP_ID_DUPLICATE");
    }
  });
});

// ---------------------------------------------------------------------------
// Step-level validation
// ---------------------------------------------------------------------------

describe("validateLessonDefinition — step structure", () => {
  it("rejects a step with empty id", () => {
    const lesson = baseLesson({ steps: [baseStep({ id: "" })] });
    expect(() => validateLessonDefinition(lesson)).toThrow(LessonValidationError);
  });

  it("rejects a step with empty title", () => {
    const lesson = baseLesson({ steps: [baseStep({ title: "" })] });
    expect(() => validateLessonDefinition(lesson)).toThrow(LessonValidationError);
  });

  it("rejects a step with empty explanation", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          content: { explanation: "" },
        }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).toThrow(LessonValidationError);
  });

  it("rejects a step with missing starter source", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          code: { starterSource: "" },
        }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).toThrow(LessonValidationError);
  });

  it("error code is STEP_STARTER_SOURCE_INVALID for missing starter", () => {
    const lesson = baseLesson({
      steps: [baseStep({ code: { starterSource: "" } })],
    });
    try {
      validateLessonDefinition(lesson);
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonValidationError).code).toBe("STEP_STARTER_SOURCE_INVALID");
    }
  });

  it("rejects a step with no objectives", () => {
    const lesson = baseLesson({ steps: [baseStep({ objectives: [] })] });
    expect(() => validateLessonDefinition(lesson)).toThrow(LessonValidationError);
  });

  it("error code is STEP_OBJECTIVES_EMPTY", () => {
    const lesson = baseLesson({ steps: [baseStep({ objectives: [] })] });
    try {
      validateLessonDefinition(lesson);
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonValidationError).code).toBe("STEP_OBJECTIVES_EMPTY");
    }
  });
});

// ---------------------------------------------------------------------------
// Objective validation
// ---------------------------------------------------------------------------

describe("validateLessonDefinition — objectives", () => {
  it("rejects an objective with empty id", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          objectives: [{ id: "", type: "entity_exists", displayName: "x" }],
        }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).toThrow(LessonValidationError);
  });

  it("rejects duplicate objective ids within a step", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          objectives: [
            { id: "same", type: "entity_exists", displayName: "x" },
            { id: "same", type: "execution_completed" },
          ],
        }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).toThrow(LessonValidationError);
  });

  it("error code is OBJECTIVE_ID_DUPLICATE", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          objectives: [
            { id: "same", type: "entity_exists", displayName: "x" },
            { id: "same", type: "execution_completed" },
          ],
        }),
      ],
    });
    try {
      validateLessonDefinition(lesson);
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonValidationError).code).toBe("OBJECTIVE_ID_DUPLICATE");
    }
  });

  it("rejects an unsupported objective type", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          objectives: [{ id: "obj-1", type: "does_not_exist" }],
        }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).toThrow(LessonValidationError);
  });

  it("error code is OBJECTIVE_TYPE_UNSUPPORTED", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          objectives: [{ id: "obj-1", type: "make_coffee" }],
        }),
      ],
    });
    try {
      validateLessonDefinition(lesson);
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as LessonValidationError).code).toBe("OBJECTIVE_TYPE_UNSUPPORTED");
    }
  });

  it("allows objective ids to repeat across DIFFERENT steps", () => {
    const lesson = baseLesson({
      steps: [
        baseStep({
          id: "step-1",
          objectives: [{ id: "shared-id", type: "entity_exists", displayName: "x" }],
        }),
        baseStep({
          id: "step-2",
          objectives: [{ id: "shared-id", type: "execution_completed" }],
        }),
      ],
    });
    expect(() => validateLessonDefinition(lesson)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Summary projection
// ---------------------------------------------------------------------------

describe("toLessonSummary", () => {
  it("projects catalog fields from a lesson", () => {
    const summary = toLessonSummary(baseLesson());
    expect(summary.id).toBe("cpp-understanding-variable-state");
    expect(summary.title).toBe("Understanding Variable State");
    expect(summary.description).toContain("variables");
    expect(summary.languageId).toBe("cpp");
  });

  it("does not include steps in the summary", () => {
    const summary = toLessonSummary(baseLesson()) as Record<string, unknown>;
    expect(summary.steps).toBeUndefined();
  });

  it("does not include version in the summary (catalog projection only)", () => {
    const summary = toLessonSummary(baseLesson()) as Record<string, unknown>;
    expect(summary.version).toBeUndefined();
  });
});