import { describe, it, expect } from "vitest";
import {
  StaticLessonLoader,
  StaticLessonCatalog,
  LessonNotFoundError,
  LessonValidationError,
  type LessonDefinition,
  type LessonStepDefinition,
} from "../index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function baseStep(overrides: Partial<LessonStepDefinition> = {}): LessonStepDefinition {
  return {
    id: "step-1",
    title: "Introduction",
    content: {
      explanation: "A variable stores a value while a program executes.",
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

function lesson(id: string, title = "Test Lesson"): LessonDefinition {
  return {
    id,
    version: "0.1.0",
    title,
    description: "Test description.",
    languageId: "cpp",
    steps: [baseStep()],
  };
}

// ---------------------------------------------------------------------------
// StaticLessonLoader
// ---------------------------------------------------------------------------

describe("StaticLessonLoader", () => {

  describe("construction", () => {
    it("accepts an empty lesson list", () => {
      const loader = new StaticLessonLoader();
      expect(loader.knownLessonIds()).toEqual([]);
    });

    it("registers valid lessons passed to constructor", () => {
      const loader = new StaticLessonLoader([lesson("a"), lesson("b")]);
      expect(loader.knownLessonIds().sort()).toEqual(["a", "b"]);
    });

    it("throws when constructed with a malformed lesson", () => {
      const bad = { ...lesson("bad"), id: "" };
      expect(() => new StaticLessonLoader([bad])).toThrow(LessonValidationError);
    });
  });

  describe("register()", () => {
    it("adds a lesson after construction", () => {
      const loader = new StaticLessonLoader();
      loader.register(lesson("late"));
      expect(loader.knownLessonIds()).toContain("late");
    });

    it("throws on invalid lesson", () => {
      const loader = new StaticLessonLoader();
      const invalid = { ...lesson("x"), version: "" };
      expect(() => loader.register(invalid)).toThrow(LessonValidationError);
    });

    it("replaces a previously registered lesson with same id", () => {
      const loader = new StaticLessonLoader();
      loader.register(lesson("l1", "First"));
      loader.register(lesson("l1", "Second"));
      expect(loader.knownLessonIds()).toEqual(["l1"]);
      // Second call replaces the first — verified by loading below
    });
  });

  describe("load()", () => {
    it("resolves a known lesson id", async () => {
      const loader = new StaticLessonLoader([lesson("cpp-1")]);
      const resolved = await loader.load("cpp-1");
      expect(resolved.id).toBe("cpp-1");
    });

    it("returns a validated lesson definition", async () => {
      const loader = new StaticLessonLoader([lesson("cpp-1")]);
      const resolved = await loader.load("cpp-1");
      expect(resolved.steps.length).toBeGreaterThan(0);
      expect(resolved.title).toBe("Test Lesson");
    });

    it("rejects an unknown lesson id", async () => {
      const loader = new StaticLessonLoader([lesson("cpp-1")]);
      await expect(loader.load("does-not-exist")).rejects.toThrow(
        LessonNotFoundError,
      );
    });

    it("throws LessonNotFoundError with correct id", async () => {
      const loader = new StaticLessonLoader([lesson("cpp-1")]);
      try {
        await loader.load("missing");
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LessonNotFoundError);
        expect((e as LessonNotFoundError).lessonId).toBe("missing");
      }
    });

    it("returns the most recently registered lesson when id is replaced", async () => {
      const loader = new StaticLessonLoader();
      loader.register(lesson("l1", "First"));
      loader.register(lesson("l1", "Second"));
      const resolved = await loader.load("l1");
      expect(resolved.title).toBe("Second");
    });
  });

  describe("knownLessons()", () => {
    it("returns registered lessons", () => {
      const loader = new StaticLessonLoader([lesson("a"), lesson("b")]);
      const lessons = loader.knownLessons();
      expect(lessons).toHaveLength(2);
      expect(lessons.map((l) => l.id).sort()).toEqual(["a", "b"]);
    });
  });
});

// ---------------------------------------------------------------------------
// StaticLessonCatalog
// ---------------------------------------------------------------------------

describe("StaticLessonCatalog", () => {

  it("lists summaries for all registered lessons", () => {
    const catalog = new StaticLessonCatalog([lesson("a"), lesson("b")]);
    const summaries = catalog.list();
    expect(summaries).toHaveLength(2);
    expect(summaries.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("hasLesson returns true for known lesson", () => {
    const catalog = new StaticLessonCatalog([lesson("cpp-1")]);
    expect(catalog.hasLesson("cpp-1")).toBe(true);
  });

  it("hasLesson returns false for unknown lesson", () => {
    const catalog = new StaticLessonCatalog([lesson("cpp-1")]);
    expect(catalog.hasLesson("nope")).toBe(false);
  });

  it("summaries do NOT include steps", () => {
    const catalog = new StaticLessonCatalog([lesson("a")]);
    const summary = catalog.list()[0] as Record<string, unknown>;
    expect(summary.steps).toBeUndefined();
  });

  it("summaries do NOT include version", () => {
    const catalog = new StaticLessonCatalog([lesson("a")]);
    const summary = catalog.list()[0] as Record<string, unknown>;
    expect(summary.version).toBeUndefined();
  });

  it("summaries contain expected catalog fields", () => {
    const catalog = new StaticLessonCatalog([lesson("cpp-1", "My Lesson")]);
    const summary = catalog.list()[0];
    expect(summary.id).toBe("cpp-1");
    expect(summary.title).toBe("My Lesson");
    expect(summary.description).toBe("Test description.");
    expect(summary.languageId).toBe("cpp");
  });

  it("empty catalog returns empty list", () => {
    const catalog = new StaticLessonCatalog([]);
    expect(catalog.list()).toEqual([]);
  });
});