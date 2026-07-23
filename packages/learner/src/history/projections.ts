/**
 * Projections over the LearningEvent stream.
 *
 * Every read model in the learner package is computed here from the
 * canonical event stream. Nothing here mutates events. Nothing here
 * caches - callers memoize at their layer (e.g. React with useMemo).
 *
 * Projections defined:
 *
 *   projectLessonHistory       - full attempt history grouped by
 *                                (lesson, step, attemptId)
 *   projectLessonHistoryFor    - attempts filtered to a single lesson
 *   projectLearnerStatistics   - aggregate counts across all lessons
 *   projectLessonProgress      - per-lesson progress summary
 *   projectStartedLessonIds    - the set of lessons the learner
 *                                has ever started
 *   projectCompletedLessonIds  - the set of lessons the learner
 *                                has ever completed
 *
 * Determinism guarantee:
 *
 *   Given the same LearningEvent[] input, every projection returns
 *   deeply-equal output regardless of when or how often it is
 *   called. Projections never call Date.now() or Math.random().
 *
 * Ordering assumption:
 *
 *   Projections DO NOT sort events. They process them in the order
 *   the caller supplies. The event store implementation is
 *   responsible for returning events in append order; every store
 *   in this package preserves that.
 */

import type {
  AttemptId,
  LearnerId,
  LessonId,
  ObjectiveId,
  StepId,
} from "../domain/ids";
import type {
  LearningEvent,
  ObjectiveEvaluatedEvent,
} from "../events/types";
import {
  computeAttemptVerdict,
  type LessonAttemptRecord,
  type LessonAttemptVerdict,
} from "./attempt-record";

// ---------------------------------------------------------------------------
// LessonHistory
// ---------------------------------------------------------------------------

export interface LessonHistory {
  readonly learnerId: LearnerId | null;
  readonly attempts: readonly LessonAttemptRecord[];
  readonly totalAttemptCount: number;
}

/**
 * Fold objective_evaluated events into per-attempt records.
 *
 * Grouping key: attemptId. Every objective_evaluated event carries
 * an attemptId that is unique to the (lesson, step, attempt-number)
 * triple - the workspace mints one attemptId per submitted attempt
 * and reuses it for every objective evaluated within that attempt.
 *
 * Attempts appear in the returned array in the order their FIRST
 * objective_evaluated event appeared in the stream. Within each
 * attempt, the objective id lists follow event order.
 */
export function projectLessonHistory(
  events: readonly LearningEvent[],
): LessonHistory {
  // learnerId is uniform across a single-learner event stream;
  // if events come from multiple learners, we surface null and
  // let callers slice by learnerId themselves.
  let learnerId: LearnerId | null = null;
  let learnerIdConsistent = true;

  interface AttemptBuffer {
    readonly attemptId: AttemptId;
    readonly attemptNumber: number;
    readonly lessonId: LessonId;
    readonly stepId: StepId;
    readonly satisfiedObjectiveIds: ObjectiveId[];
    readonly unsatisfiedObjectiveIds: ObjectiveId[];
    readonly notEvaluatedObjectiveIds: ObjectiveId[];
    firstEventAt: string;
    lastEventAt: string;
  }

  const attemptOrder: AttemptId[] = [];
  const buffers = new Map<AttemptId, AttemptBuffer>();

  for (const event of events) {
    if (learnerId === null) {
      learnerId = event.learnerId;
    } else if (learnerId !== event.learnerId) {
      learnerIdConsistent = false;
    }

    if (event.kind !== "objective_evaluated") continue;
    const ev: ObjectiveEvaluatedEvent = event;

    let buf = buffers.get(ev.attemptId);
    if (!buf) {
      buf = {
        attemptId: ev.attemptId,
        attemptNumber: ev.attemptNumber,
        lessonId: ev.lessonId,
        stepId: ev.stepId,
        satisfiedObjectiveIds: [],
        unsatisfiedObjectiveIds: [],
        notEvaluatedObjectiveIds: [],
        firstEventAt: ev.occurredAt,
        lastEventAt: ev.occurredAt,
      };
      buffers.set(ev.attemptId, buf);
      attemptOrder.push(ev.attemptId);
    }

    buf.lastEventAt = ev.occurredAt;

    if (ev.executionFailed) {
      buf.notEvaluatedObjectiveIds.push(ev.objectiveId);
    } else if (ev.satisfied) {
      buf.satisfiedObjectiveIds.push(ev.objectiveId);
    } else {
      buf.unsatisfiedObjectiveIds.push(ev.objectiveId);
    }
  }

  const attempts: LessonAttemptRecord[] = attemptOrder.map((id) => {
    const buf = buffers.get(id)!;
    const verdict: LessonAttemptVerdict = computeAttemptVerdict({
      satisfiedCount: buf.satisfiedObjectiveIds.length,
      unsatisfiedCount: buf.unsatisfiedObjectiveIds.length,
      notEvaluatedCount: buf.notEvaluatedObjectiveIds.length,
    });
    return {
      attemptId: buf.attemptId,
      attemptNumber: buf.attemptNumber,
      lessonId: buf.lessonId,
      stepId: buf.stepId,
      satisfiedObjectiveIds: [...buf.satisfiedObjectiveIds],
      unsatisfiedObjectiveIds: [...buf.unsatisfiedObjectiveIds],
      notEvaluatedObjectiveIds: [...buf.notEvaluatedObjectiveIds],
      verdict,
      firstEventAt: buf.firstEventAt,
      lastEventAt: buf.lastEventAt,
    };
  });

  return {
    learnerId: learnerIdConsistent ? learnerId : null,
    attempts,
    totalAttemptCount: attempts.length,
  };
}

/**
 * Filter LessonHistory to a single lesson.
 *
 * Cheap because LessonHistory already carries per-attempt lessonId.
 */
export function projectLessonHistoryFor(
  events: readonly LearningEvent[],
  lessonId: LessonId,
): LessonHistory {
  const full = projectLessonHistory(events);
  const attempts = full.attempts.filter((a) => a.lessonId === lessonId);
  return {
    learnerId: full.learnerId,
    attempts,
    totalAttemptCount: attempts.length,
  };
}

// ---------------------------------------------------------------------------
// Lesson identity sets
// ---------------------------------------------------------------------------

export function projectStartedLessonIds(
  events: readonly LearningEvent[],
): ReadonlySet<LessonId> {
  const set = new Set<LessonId>();
  for (const ev of events) {
    if (ev.kind === "lesson_started") {
      set.add(ev.lessonId);
    }
  }
  return set;
}

export function projectCompletedLessonIds(
  events: readonly LearningEvent[],
): ReadonlySet<LessonId> {
  const set = new Set<LessonId>();
  for (const ev of events) {
    if (ev.kind === "lesson_completed") {
      set.add(ev.lessonId);
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// LearnerStatistics
// ---------------------------------------------------------------------------

/**
 * Aggregate counters computed from the full event stream.
 *
 * Fields:
 *   lessonsStarted             - unique lessons ever started
 *   lessonsCompleted           - unique lessons ever completed
 *   totalAttemptCount          - total attempts across all lessons
 *                                (one per distinct attemptId)
 *   totalObjectiveEvaluations  - total objective_evaluated events
 *                                emitted (across all attempts)
 *   totalSatisfiedObjectives   - objective_evaluated events with
 *                                satisfied=true and executionFailed=false
 *   completionRate             - lessonsCompleted / lessonsStarted
 *                                or 0 when lessonsStarted === 0
 */
export interface LearnerStatistics {
  readonly lessonsStarted: number;
  readonly lessonsCompleted: number;
  readonly totalAttemptCount: number;
  readonly totalObjectiveEvaluations: number;
  readonly totalSatisfiedObjectives: number;
  readonly completionRate: number;
}

export function projectLearnerStatistics(
  events: readonly LearningEvent[],
): LearnerStatistics {
  const started = projectStartedLessonIds(events);
  const completed = projectCompletedLessonIds(events);

  const attemptIds = new Set<AttemptId>();
  let totalObjectiveEvaluations = 0;
  let totalSatisfiedObjectives = 0;

  for (const ev of events) {
    if (ev.kind !== "objective_evaluated") continue;
    attemptIds.add(ev.attemptId);
    totalObjectiveEvaluations += 1;
    if (ev.satisfied && !ev.executionFailed) {
      totalSatisfiedObjectives += 1;
    }
  }

  const lessonsStarted = started.size;
  const lessonsCompleted = completed.size;
  const completionRate =
    lessonsStarted === 0 ? 0 : lessonsCompleted / lessonsStarted;

  return {
    lessonsStarted,
    lessonsCompleted,
    totalAttemptCount: attemptIds.size,
    totalObjectiveEvaluations,
    totalSatisfiedObjectives,
    completionRate,
  };
}

// ---------------------------------------------------------------------------
// LessonProgress
// ---------------------------------------------------------------------------

/**
 * Per-lesson progress summary. Answers UI questions like "how far
 * has the learner gotten on lesson X?" without requiring the caller
 * to walk the attempt list.
 *
 * Fields:
 *   lessonId              - the lesson this summary describes
 *   started               - has this lesson ever emitted lesson_started
 *   completedAtLeastOnce  - has this lesson ever emitted lesson_completed
 *   attemptCount          - total attempts across every step of this lesson
 *   lastCompletedAt       - ISO timestamp of the most recent
 *                           lesson_completed, or null if never completed
 *   totalCompletionCount  - number of lesson_completed events for this
 *                           lesson (learners can complete a lesson
 *                           more than once via reset+redo)
 */
export interface LessonProgress {
  readonly lessonId: LessonId;
  readonly started: boolean;
  readonly completedAtLeastOnce: boolean;
  readonly attemptCount: number;
  readonly lastCompletedAt: string | null;
  readonly totalCompletionCount: number;
}

export function projectLessonProgress(
  events: readonly LearningEvent[],
  lessonId: LessonId,
): LessonProgress {
  let started = false;
  let totalCompletionCount = 0;
  let lastCompletedAt: string | null = null;
  const attemptIds = new Set<AttemptId>();

  for (const ev of events) {
    switch (ev.kind) {
      case "lesson_started":
        if (ev.lessonId === lessonId) started = true;
        break;
      case "lesson_completed":
        if (ev.lessonId === lessonId) {
          totalCompletionCount += 1;
          lastCompletedAt = ev.occurredAt;
        }
        break;
      case "objective_evaluated":
        if (ev.lessonId === lessonId) attemptIds.add(ev.attemptId);
        break;
      default:
        break;
    }
  }

  return {
    lessonId,
    started,
    completedAtLeastOnce: totalCompletionCount > 0,
    attemptCount: attemptIds.size,
    lastCompletedAt,
    totalCompletionCount,
  };
}