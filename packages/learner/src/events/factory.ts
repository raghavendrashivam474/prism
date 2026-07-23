/**
 * Learning event factories.
 *
 * One factory per event kind. Each factory:
 *   - accepts the domain-typed inputs required by the event
 *   - injects timestamp via a `now` function (defaults to
 *     () => new Date().toISOString())
 *   - injects id generation via IdGenerator when needed
 *     (currently only attemptId is generated at event-emit time;
 *     see EventEmitContext)
 *   - validates its inputs and throws on structural error
 *   - returns a frozen event object
 *
 * Freezing prevents accidental mutation of events after they enter
 * the event store. This matters because projections cache results
 * keyed by event identity; mutating a stored event silently
 * corrupts every downstream projection.
 *
 * Factories never touch persistence. Emitting an event to the
 * store is the caller's responsibility.
 */

import type {
  AttemptId,
  IdGenerator,
  LearnerId,
  LessonId,
  ObjectiveId,
  StepId,
} from "../domain/ids";
import { defaultIdGenerator, newAttemptId } from "../domain/ids";
import {
  LEARNING_EVENT_VERSION,
  type LearnerCreatedEvent,
  type LessonCompletedEvent,
  type LessonResetEvent,
  type LessonStartedEvent,
  type ObjectiveEvaluatedEvent,
} from "./types";

// ---------------------------------------------------------------------------
// Shared event-emission context
// ---------------------------------------------------------------------------

/**
 * Context bag passed to every factory. Groups the injectables so
 * callers construct it once per boot instead of threading `now` and
 * `idGenerator` through every call site.
 */
export interface EventEmitContext {
  readonly now: () => string;
  readonly idGenerator: IdGenerator;
}

export function defaultEventEmitContext(): EventEmitContext {
  return {
    now: () => new Date().toISOString(),
    idGenerator: defaultIdGenerator,
  };
}

// ---------------------------------------------------------------------------
// Small validators
// ---------------------------------------------------------------------------

function assertNonEmptyString(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `LearningEvent field '${field}' must be a non-empty string.`,
    );
  }
}

function assertNonNegativeInt(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `LearningEvent field '${field}' must be a non-negative integer.`,
    );
  }
}

function assertPositiveInt(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `LearningEvent field '${field}' must be a positive integer.`,
    );
  }
}

// ---------------------------------------------------------------------------
// learner_created
// ---------------------------------------------------------------------------

export interface CreateLearnerCreatedEventInput {
  readonly learnerId: LearnerId;
  readonly displayName: string;
}

export function createLearnerCreatedEvent(
  input: CreateLearnerCreatedEventInput,
  ctx: EventEmitContext = defaultEventEmitContext(),
): LearnerCreatedEvent {
  assertNonEmptyString(input.learnerId, "learnerId");
  assertNonEmptyString(input.displayName, "displayName");

  const event: LearnerCreatedEvent = {
    version: LEARNING_EVENT_VERSION,
    kind: "learner_created",
    learnerId: input.learnerId,
    occurredAt: ctx.now(),
    displayName: input.displayName,
  };
  return Object.freeze(event);
}

// ---------------------------------------------------------------------------
// lesson_started
// ---------------------------------------------------------------------------

export interface CreateLessonStartedEventInput {
  readonly learnerId: LearnerId;
  readonly lessonId: LessonId;
}

export function createLessonStartedEvent(
  input: CreateLessonStartedEventInput,
  ctx: EventEmitContext = defaultEventEmitContext(),
): LessonStartedEvent {
  assertNonEmptyString(input.learnerId, "learnerId");
  assertNonEmptyString(input.lessonId, "lessonId");

  const event: LessonStartedEvent = {
    version: LEARNING_EVENT_VERSION,
    kind: "lesson_started",
    learnerId: input.learnerId,
    occurredAt: ctx.now(),
    lessonId: input.lessonId,
  };
  return Object.freeze(event);
}

// ---------------------------------------------------------------------------
// objective_evaluated
// ---------------------------------------------------------------------------

export interface CreateObjectiveEvaluatedEventInput {
  readonly learnerId: LearnerId;
  readonly lessonId: LessonId;
  readonly stepId: StepId;
  readonly attemptId: AttemptId;
  readonly attemptNumber: number;
  readonly objectiveId: ObjectiveId;
  readonly objectiveType: string;
  readonly satisfied: boolean;
  readonly executionFailed: boolean;
}

export function createObjectiveEvaluatedEvent(
  input: CreateObjectiveEvaluatedEventInput,
  ctx: EventEmitContext = defaultEventEmitContext(),
): ObjectiveEvaluatedEvent {
  assertNonEmptyString(input.learnerId, "learnerId");
  assertNonEmptyString(input.lessonId, "lessonId");
  assertNonEmptyString(input.stepId, "stepId");
  assertNonEmptyString(input.attemptId, "attemptId");
  assertNonEmptyString(input.objectiveId, "objectiveId");
  assertNonEmptyString(input.objectiveType, "objectiveType");
  assertPositiveInt(input.attemptNumber, "attemptNumber");

  if (typeof input.satisfied !== "boolean") {
    throw new Error("LearningEvent field 'satisfied' must be a boolean.");
  }
  if (typeof input.executionFailed !== "boolean") {
    throw new Error(
      "LearningEvent field 'executionFailed' must be a boolean.",
    );
  }

  const event: ObjectiveEvaluatedEvent = {
    version: LEARNING_EVENT_VERSION,
    kind: "objective_evaluated",
    learnerId: input.learnerId,
    occurredAt: ctx.now(),
    lessonId: input.lessonId,
    stepId: input.stepId,
    attemptId: input.attemptId,
    attemptNumber: input.attemptNumber,
    objectiveId: input.objectiveId,
    objectiveType: input.objectiveType,
    satisfied: input.satisfied,
    executionFailed: input.executionFailed,
  };
  return Object.freeze(event);
}

// ---------------------------------------------------------------------------
// lesson_completed
// ---------------------------------------------------------------------------

export interface CreateLessonCompletedEventInput {
  readonly learnerId: LearnerId;
  readonly lessonId: LessonId;
  readonly totalAttempts: number;
  readonly durationMs: number | null;
}

export function createLessonCompletedEvent(
  input: CreateLessonCompletedEventInput,
  ctx: EventEmitContext = defaultEventEmitContext(),
): LessonCompletedEvent {
  assertNonEmptyString(input.learnerId, "learnerId");
  assertNonEmptyString(input.lessonId, "lessonId");
  assertNonNegativeInt(input.totalAttempts, "totalAttempts");

  if (input.durationMs !== null) {
    if (!Number.isFinite(input.durationMs) || input.durationMs < 0) {
      throw new Error(
        "LearningEvent field 'durationMs' must be null or a non-negative number.",
      );
    }
  }

  const event: LessonCompletedEvent = {
    version: LEARNING_EVENT_VERSION,
    kind: "lesson_completed",
    learnerId: input.learnerId,
    occurredAt: ctx.now(),
    lessonId: input.lessonId,
    totalAttempts: input.totalAttempts,
    durationMs: input.durationMs,
  };
  return Object.freeze(event);
}

// ---------------------------------------------------------------------------
// lesson_reset
// ---------------------------------------------------------------------------

export interface CreateLessonResetEventInput {
  readonly learnerId: LearnerId;
  readonly lessonId: LessonId;
}

export function createLessonResetEvent(
  input: CreateLessonResetEventInput,
  ctx: EventEmitContext = defaultEventEmitContext(),
): LessonResetEvent {
  assertNonEmptyString(input.learnerId, "learnerId");
  assertNonEmptyString(input.lessonId, "lessonId");

  const event: LessonResetEvent = {
    version: LEARNING_EVENT_VERSION,
    kind: "lesson_reset",
    learnerId: input.learnerId,
    occurredAt: ctx.now(),
    lessonId: input.lessonId,
  };
  return Object.freeze(event);
}

// ---------------------------------------------------------------------------
// Convenience re-export
// ---------------------------------------------------------------------------

/**
 * Small helper for callers that need to mint a fresh attempt id in
 * the same context as their event emission. Keeps the "one context
 * per boot" pattern intact.
 */
export function nextAttemptId(ctx: EventEmitContext): AttemptId {
  return newAttemptId(ctx.idGenerator);
}