/**
 * LearningEvent.
 *
 * The source of truth for the learner intelligence layer.
 *
 * Everything downstream (lesson history, learner statistics,
 * mastery in @prism/mastery, and any future analytics) is a
 * projection over this event stream. Events are:
 *
 *   - append-only     : never mutated after being written
 *   - versioned       : every event carries a schema version
 *                       (currently v1) so future evolutions can
 *                       upcast without breaking prior history
 *   - deterministic   : payloads never contain non-deterministic
 *                       fields (Date.now(), Math.random()) - those
 *                       are always injected by the factory
 *   - self-describing : each event carries the learnerId it belongs
 *                       to, so a single event store can hold events
 *                       for multiple learners without ambiguity
 *
 * Naming convention:
 *   - kind is a lowercase_snake_case verb-phrase past-tense fact
 *     ("lesson_completed", not "completeLesson")
 *   - payload fields are grouped by concept and never nest more
 *     than one level deep
 *
 * Deliberately NOT here:
 *   - LessonAttemptRecord   -> that is a projection (history/attempt-record.ts)
 *   - LearnerStatistics     -> that is a projection (history/projections.ts)
 *   - MasteryNode           -> that is a projection (@prism/mastery)
 */

import type {
  LearnerId,
  LessonId,
  StepId,
  ObjectiveId,
  AttemptId,
} from "../domain/ids";

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export const LEARNING_EVENT_VERSION = 1 as const;
export type LearningEventVersion = typeof LEARNING_EVENT_VERSION;

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

/**
 * Fields shared by every LearningEvent regardless of kind.
 */
export interface LearningEventBase {
  readonly version: LearningEventVersion;
  readonly learnerId: LearnerId;
  readonly occurredAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Event variants
// ---------------------------------------------------------------------------

/**
 * Emitted exactly once, at learner profile creation.
 *
 * The event stream for a given learner should always begin with
 * this event. Projections that need the earliest known moment for
 * a learner (e.g. "learner since ...") should read it here.
 */
export interface LearnerCreatedEvent extends LearningEventBase {
  readonly kind: "learner_created";
  readonly displayName: string;
}

/**
 * Emitted when the learner opens a lesson for a new session.
 *
 * A single lesson may be started many times. Each fresh session
 * (loading /lesson/[id]) emits one lesson_started event.
 */
export interface LessonStartedEvent extends LearningEventBase {
  readonly kind: "lesson_started";
  readonly lessonId: LessonId;
}

/**
 * Emitted once per objective per attempt.
 *
 * Kept granular (per-objective rather than per-attempt) so mastery
 * and analytics projections can reason about individual objective
 * outcomes without having to un-flatten a bulk "attempt" event.
 *
 *   satisfied === true  -> the objective's evaluator returned
 *                          satisfied=true against the attempt trace
 *   satisfied === false -> the evaluator returned unsatisfied, OR
 *                          the attempt failed to execute at all.
 *                          The `executionFailed` field distinguishes
 *                          these cases.
 *
 * When executionFailed === true, the satisfied field will be false
 * and callers should treat the objective as "not_evaluated" for
 * pedagogical purposes (handoff Section 25). The event still
 * exists in the stream so history / analytics can count attempted
 * evaluations, but mastery projections should exclude these events
 * from their denominator.
 */
export interface ObjectiveEvaluatedEvent extends LearningEventBase {
  readonly kind: "objective_evaluated";
  readonly lessonId: LessonId;
  readonly stepId: StepId;
  readonly attemptId: AttemptId;
  readonly attemptNumber: number;
  readonly objectiveId: ObjectiveId;
  readonly objectiveType: string;
  readonly satisfied: boolean;
  readonly executionFailed: boolean;
}

/**
 * Emitted when the lesson session transitions to `completed`
 * (final step satisfied and, per Milestone 2.16, the learner
 * explicitly pressed Finish).
 *
 * totalAttempts is the sum of attempts across every step of the
 * lesson at completion time. Duration is optional because the
 * caller decides whether to compute it (the workspace tracks
 * session start time; other callers may not).
 */
export interface LessonCompletedEvent extends LearningEventBase {
  readonly kind: "lesson_completed";
  readonly lessonId: LessonId;
  readonly totalAttempts: number;
  readonly durationMs: number | null;
}

/**
 * Emitted when the learner resets the lesson from within a
 * session (Reset button in the workspace).
 *
 * Retained separately from lesson_started so analytics can
 * distinguish "opened fresh" from "restarted mid-attempt".
 */
export interface LessonResetEvent extends LearningEventBase {
  readonly kind: "lesson_reset";
  readonly lessonId: LessonId;
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export type LearningEvent =
  | LearnerCreatedEvent
  | LessonStartedEvent
  | ObjectiveEvaluatedEvent
  | LessonCompletedEvent
  | LessonResetEvent;

export type LearningEventKind = LearningEvent["kind"];

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Runtime guard for arbitrary JSON blobs returning from persistence.
 *
 * Verifies:
 *   - value is an object
 *   - version matches LEARNING_EVENT_VERSION exactly (rejects
 *     unknown future versions rather than silently misreading them)
 *   - learnerId, occurredAt, kind are present and typed correctly
 *   - kind is one of the known kinds
 *
 * Kind-specific payload validation lives on the event factory, not
 * here - by the time we deserialize, the payload was produced by
 * an earlier factory call and is trusted.
 */
const KNOWN_KINDS: ReadonlySet<string> = new Set<string>([
  "learner_created",
  "lesson_started",
  "objective_evaluated",
  "lesson_completed",
  "lesson_reset",
]);

export function isLearningEvent(value: unknown): value is LearningEvent {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.version === LEARNING_EVENT_VERSION &&
    typeof obj.learnerId === "string" &&
    obj.learnerId.length > 0 &&
    typeof obj.occurredAt === "string" &&
    typeof obj.kind === "string" &&
    KNOWN_KINDS.has(obj.kind)
  );
}