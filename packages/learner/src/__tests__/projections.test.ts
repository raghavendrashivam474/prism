import { describe, it, expect } from "vitest";
import {
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
  projectCompletedLessonIds,
  projectLearnerStatistics,
  projectLessonHistory,
  projectLessonHistoryFor,
  projectLessonProgress,
  projectStartedLessonIds,
  type LearningEvent,
} from "../index";

// ---------------------------------------------------------------------------
// Deterministic context + fixture helpers
// ---------------------------------------------------------------------------

const learnerA = asLearnerId("learner-A");
const learnerB = asLearnerId("learner-B");
const lessonX = asLessonId("lesson-X");
const lessonY = asLessonId("lesson-Y");
const step1 = asStepId("step-1");
const objA = asObjectiveId("obj-A");
const objB = asObjectiveId("obj-B");
const objC = asObjectiveId("obj-C");

let now = 0;
function makeCtx() {
  return {
    now: () => `2026-01-01T00:00:${String(now++).padStart(2, "0")}.000Z`,
    idGenerator: () => `gen-${now}`,
  };
}

function seedLearner(events: LearningEvent[]): void {
  events.push(
    createLearnerCreatedEvent(
      { learnerId: learnerA, displayName: "Alice" },
      makeCtx(),
    ),
  );
}

// ---------------------------------------------------------------------------
// projectLessonHistory
// ---------------------------------------------------------------------------

describe("projectLessonHistory", () => {
  it("returns an empty history for an empty stream", () => {
    now = 0;
    const h = projectLessonHistory([]);
    expect(h.learnerId).toBeNull();
    expect(h.attempts).toEqual([]);
    expect(h.totalAttemptCount).toBe(0);
  });

  it("groups objective_evaluated events by attemptId", () => {
    now = 0;
    const attemptId = asAttemptId("a1");
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createLessonStartedEvent(
        { learnerId: learnerA, lessonId: lessonX },
        makeCtx(),
      ),
    );
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId,
          attemptNumber: 1,
          objectiveId: objB,
          objectiveType: "execution_completed",
          satisfied: false,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );

    const h = projectLessonHistory(events);
    expect(h.learnerId).toBe(learnerA);
    expect(h.attempts).toHaveLength(1);

    const r = h.attempts[0];
    expect(r.attemptId).toBe(attemptId);
    expect(r.attemptNumber).toBe(1);
    expect(r.lessonId).toBe(lessonX);
    expect(r.stepId).toBe(step1);
    expect(r.satisfiedObjectiveIds).toEqual([objA]);
    expect(r.unsatisfiedObjectiveIds).toEqual([objB]);
    expect(r.notEvaluatedObjectiveIds).toEqual([]);
    expect(r.verdict).toBe("incomplete");
  });

  it("marks verdict complete when every objective satisfied", () => {
    now = 0;
    const attemptId = asAttemptId("a1");
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId,
          attemptNumber: 1,
          objectiveId: objB,
          objectiveType: "execution_completed",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    const h = projectLessonHistory(events);
    expect(h.attempts[0].verdict).toBe("complete");
  });

  it("marks verdict execution_failed when any objective was not evaluated", () => {
    now = 0;
    const attemptId = asAttemptId("a1");
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: false,
          executionFailed: true,
        },
        makeCtx(),
      ),
    );
    const h = projectLessonHistory(events);
    expect(h.attempts[0].verdict).toBe("execution_failed");
    expect(h.attempts[0].notEvaluatedObjectiveIds).toEqual([objA]);
  });

  it("preserves attempt order by first-event time", () => {
    now = 0;
    const a1 = asAttemptId("a1");
    const a2 = asAttemptId("a2");
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId: a1,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId: a2,
          attemptNumber: 2,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    const h = projectLessonHistory(events);
    expect(h.attempts.map((r) => r.attemptId)).toEqual([a1, a2]);
  });

  it("returns learnerId null when events belong to multiple learners", () => {
    now = 0;
    const events: LearningEvent[] = [];
    events.push(
      createLearnerCreatedEvent(
        { learnerId: learnerA, displayName: "Alice" },
        makeCtx(),
      ),
    );
    events.push(
      createLearnerCreatedEvent(
        { learnerId: learnerB, displayName: "Bob" },
        makeCtx(),
      ),
    );
    const h = projectLessonHistory(events);
    expect(h.learnerId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// projectLessonHistoryFor
// ---------------------------------------------------------------------------

describe("projectLessonHistoryFor", () => {
  it("filters attempts to one lesson", () => {
    now = 0;
    const a1 = asAttemptId("a1");
    const a2 = asAttemptId("a2");
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId: a1,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonY,
          stepId: step1,
          attemptId: a2,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    const hx = projectLessonHistoryFor(events, lessonX);
    expect(hx.attempts).toHaveLength(1);
    expect(hx.attempts[0].lessonId).toBe(lessonX);
  });
});

// ---------------------------------------------------------------------------
// projectStartedLessonIds / projectCompletedLessonIds
// ---------------------------------------------------------------------------

describe("lesson id sets", () => {
  it("started ids: unique, appearance order", () => {
    now = 0;
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createLessonStartedEvent(
        { learnerId: learnerA, lessonId: lessonX },
        makeCtx(),
      ),
    );
    events.push(
      createLessonStartedEvent(
        { learnerId: learnerA, lessonId: lessonX },
        makeCtx(),
      ),
    );
    events.push(
      createLessonStartedEvent(
        { learnerId: learnerA, lessonId: lessonY },
        makeCtx(),
      ),
    );
    const s = projectStartedLessonIds(events);
    expect(s.size).toBe(2);
    expect(s.has(lessonX)).toBe(true);
    expect(s.has(lessonY)).toBe(true);
  });

  it("completed ids from lesson_completed events only", () => {
    now = 0;
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createLessonCompletedEvent(
        { learnerId: learnerA, lessonId: lessonX, totalAttempts: 1, durationMs: 1000 },
        makeCtx(),
      ),
    );
    const c = projectCompletedLessonIds(events);
    expect(c.has(lessonX)).toBe(true);
    expect(c.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// projectLearnerStatistics
// ---------------------------------------------------------------------------

describe("projectLearnerStatistics", () => {
  it("counts distinct attempts and satisfied objectives correctly", () => {
    now = 0;
    const a1 = asAttemptId("a1");
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createLessonStartedEvent(
        { learnerId: learnerA, lessonId: lessonX },
        makeCtx(),
      ),
    );
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId: a1,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId: a1,
          attemptNumber: 1,
          objectiveId: objB,
          objectiveType: "execution_completed",
          satisfied: false,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    events.push(
      createLessonCompletedEvent(
        { learnerId: learnerA, lessonId: lessonX, totalAttempts: 1, durationMs: null },
        makeCtx(),
      ),
    );
    const s = projectLearnerStatistics(events);
    expect(s.lessonsStarted).toBe(1);
    expect(s.lessonsCompleted).toBe(1);
    expect(s.totalAttemptCount).toBe(1);
    expect(s.totalObjectiveEvaluations).toBe(2);
    expect(s.totalSatisfiedObjectives).toBe(1);
    expect(s.completionRate).toBe(1);
  });

  it("completionRate is 0 when nothing was started", () => {
    const s = projectLearnerStatistics([]);
    expect(s.completionRate).toBe(0);
  });

  it("failed executions do not count as satisfied", () => {
    now = 0;
    const a1 = asAttemptId("a1");
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId: a1,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: false,
          executionFailed: true,
        },
        makeCtx(),
      ),
    );
    const s = projectLearnerStatistics(events);
    expect(s.totalSatisfiedObjectives).toBe(0);
    expect(s.totalObjectiveEvaluations).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// projectLessonProgress
// ---------------------------------------------------------------------------

describe("projectLessonProgress", () => {
  it("returns empty progress for an unseen lesson", () => {
    now = 0;
    const events: LearningEvent[] = [];
    seedLearner(events);
    const p = projectLessonProgress(events, lessonX);
    expect(p.started).toBe(false);
    expect(p.completedAtLeastOnce).toBe(false);
    expect(p.attemptCount).toBe(0);
    expect(p.lastCompletedAt).toBeNull();
    expect(p.totalCompletionCount).toBe(0);
  });

  it("summarizes a started, twice-completed lesson", () => {
    now = 0;
    const a1 = asAttemptId("a1");
    const a2 = asAttemptId("a2");
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createLessonStartedEvent(
        { learnerId: learnerA, lessonId: lessonX },
        makeCtx(),
      ),
    );
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId: a1,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    events.push(
      createLessonCompletedEvent(
        { learnerId: learnerA, lessonId: lessonX, totalAttempts: 1, durationMs: 100 },
        makeCtx(),
      ),
    );
    events.push(
      createLessonResetEvent(
        { learnerId: learnerA, lessonId: lessonX },
        makeCtx(),
      ),
    );
    events.push(
      createObjectiveEvaluatedEvent(
        {
          learnerId: learnerA,
          lessonId: lessonX,
          stepId: step1,
          attemptId: a2,
          attemptNumber: 1,
          objectiveId: objA,
          objectiveType: "entity_exists",
          satisfied: true,
          executionFailed: false,
        },
        makeCtx(),
      ),
    );
    const lastCompletion = createLessonCompletedEvent(
      { learnerId: learnerA, lessonId: lessonX, totalAttempts: 1, durationMs: 200 },
      makeCtx(),
    );
    events.push(lastCompletion);

    const p = projectLessonProgress(events, lessonX);
    expect(p.started).toBe(true);
    expect(p.completedAtLeastOnce).toBe(true);
    expect(p.totalCompletionCount).toBe(2);
    expect(p.attemptCount).toBe(2);
    expect(p.lastCompletedAt).toBe(lastCompletion.occurredAt);
  });

  it("ignores events for other lessons", () => {
    now = 0;
    const events: LearningEvent[] = [];
    seedLearner(events);
    events.push(
      createLessonStartedEvent(
        { learnerId: learnerA, lessonId: lessonY },
        makeCtx(),
      ),
    );
    const p = projectLessonProgress(events, lessonX);
    expect(p.started).toBe(false);
  });
});