import { describe, it, expect } from "vitest";
import {
  LEARNING_EVENT_VERSION,
  asAttemptId,
  asLearnerId,
  asLessonId,
  asObjectiveId,
  asStepId,
  createLearnerCreatedEvent,
  createLessonCompletedEvent,
  createLessonResetEvent,
  createLessonStartedEvent,
  createObjectiveEvaluatedEvent,
  defaultEventEmitContext,
  isLearningEvent,
} from "../index";

const learnerId = asLearnerId("learner-1");
const lessonId = asLessonId("lesson-1");
const stepId = asStepId("step-1");
const attemptId = asAttemptId("attempt-1");
const objectiveId = asObjectiveId("obj-1");

const fixedCtx = {
  now: () => "2026-01-01T00:00:00.000Z",
  idGenerator: () => "id-fixed",
};

describe("event factories", () => {
  it("learner_created produces a frozen v1 event", () => {
    const ev = createLearnerCreatedEvent(
      { learnerId, displayName: "Alice" },
      fixedCtx,
    );
    expect(ev.kind).toBe("learner_created");
    expect(ev.version).toBe(LEARNING_EVENT_VERSION);
    expect(ev.learnerId).toBe(learnerId);
    expect(ev.occurredAt).toBe("2026-01-01T00:00:00.000Z");
    expect(ev.displayName).toBe("Alice");
    expect(Object.isFrozen(ev)).toBe(true);
  });

  it("learner_created rejects empty displayName", () => {
    expect(() =>
      createLearnerCreatedEvent(
        { learnerId, displayName: "" },
        fixedCtx,
      ),
    ).toThrow(/displayName/);
  });

  it("lesson_started produces expected payload", () => {
    const ev = createLessonStartedEvent({ learnerId, lessonId }, fixedCtx);
    expect(ev.kind).toBe("lesson_started");
    expect(ev.lessonId).toBe(lessonId);
    expect(ev.occurredAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("objective_evaluated preserves every field", () => {
    const ev = createObjectiveEvaluatedEvent(
      {
        learnerId,
        lessonId,
        stepId,
        attemptId,
        attemptNumber: 1,
        objectiveId,
        objectiveType: "entity_exists",
        satisfied: true,
        executionFailed: false,
      },
      fixedCtx,
    );
    expect(ev.kind).toBe("objective_evaluated");
    expect(ev.satisfied).toBe(true);
    expect(ev.executionFailed).toBe(false);
    expect(ev.attemptNumber).toBe(1);
    expect(ev.objectiveType).toBe("entity_exists");
  });

  it("objective_evaluated rejects zero attemptNumber", () => {
    expect(() =>
      createObjectiveEvaluatedEvent(
        {
          learnerId,
          lessonId,
          stepId,
          attemptId,
          attemptNumber: 0,
          objectiveId,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        fixedCtx,
      ),
    ).toThrow(/attemptNumber/);
  });

  it("lesson_completed accepts null durationMs", () => {
    const ev = createLessonCompletedEvent(
      { learnerId, lessonId, totalAttempts: 3, durationMs: null },
      fixedCtx,
    );
    expect(ev.durationMs).toBeNull();
    expect(ev.totalAttempts).toBe(3);
  });

  it("lesson_completed rejects negative duration", () => {
    expect(() =>
      createLessonCompletedEvent(
        { learnerId, lessonId, totalAttempts: 3, durationMs: -1 },
        fixedCtx,
      ),
    ).toThrow(/durationMs/);
  });

  it("lesson_reset produces expected payload", () => {
    const ev = createLessonResetEvent({ learnerId, lessonId }, fixedCtx);
    expect(ev.kind).toBe("lesson_reset");
  });

  it("defaultEventEmitContext produces working defaults", () => {
    const ctx = defaultEventEmitContext();
    const before = new Date().toISOString();
    const nowValue = ctx.now();
    // ISO 8601 shape is enough.
    expect(nowValue).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // ordering: nowValue is >= before (string comparison works for ISO)
    expect(nowValue >= before).toBe(true);
    expect(typeof ctx.idGenerator()).toBe("string");
  });

  it("isLearningEvent accepts a factory-produced event", () => {
    const ev = createLessonStartedEvent({ learnerId, lessonId }, fixedCtx);
    expect(isLearningEvent(ev)).toBe(true);
  });

  it("isLearningEvent rejects wrong version", () => {
    const bad = {
      version: 999,
      kind: "lesson_started",
      learnerId: "x",
      occurredAt: "t",
      lessonId: "y",
    };
    expect(isLearningEvent(bad)).toBe(false);
  });

  it("isLearningEvent rejects unknown kind", () => {
    const bad = {
      version: LEARNING_EVENT_VERSION,
      kind: "not_a_real_kind",
      learnerId: "x",
      occurredAt: "t",
    };
    expect(isLearningEvent(bad)).toBe(false);
  });

  it("isLearningEvent rejects non-object", () => {
    expect(isLearningEvent(null)).toBe(false);
    expect(isLearningEvent("string")).toBe(false);
    expect(isLearningEvent(42)).toBe(false);
  });
});