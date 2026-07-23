import { describe, it, expect } from "vitest";
import {
  asAttemptId,
  asConceptId,
  asLearnerId,
  asLessonId,
  asObjectiveId,
  asStepId,
  defaultIdGenerator,
  newAttemptId,
  newLearnerId,
} from "../index";

describe("domain IDs", () => {
  it("asLearnerId accepts a non-empty string", () => {
    expect(asLearnerId("abc")).toBe("abc");
  });

  it("asLearnerId rejects empty string", () => {
    expect(() => asLearnerId("")).toThrow(/LearnerId/);
  });

  it("every asXxxId helper rejects empty string", () => {
    expect(() => asLessonId("")).toThrow(/LessonId/);
    expect(() => asStepId("")).toThrow(/StepId/);
    expect(() => asObjectiveId("")).toThrow(/ObjectiveId/);
    expect(() => asAttemptId("")).toThrow(/AttemptId/);
    expect(() => asConceptId("")).toThrow(/ConceptId/);
  });

  it("newLearnerId uses the injected generator", () => {
    const id = newLearnerId(() => "fixed-learner");
    expect(id).toBe("fixed-learner");
  });

  it("newAttemptId uses the injected generator", () => {
    const id = newAttemptId(() => "fixed-attempt");
    expect(id).toBe("fixed-attempt");
  });

  it("defaultIdGenerator returns a non-empty string", () => {
    const id = defaultIdGenerator();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("newLearnerId with defaults returns a fresh id each call", () => {
    const a = newLearnerId();
    const b = newLearnerId();
    expect(a).not.toBe(b);
  });
});