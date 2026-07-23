/**
 * @prism/learner public exports.
 *
 * Consumers of this package must only import from the package
 * root. Reaching into internal paths (e.g. .../src/history/...)
 * is not supported and will break without notice.
 *
 * Organized by concern to match the internal folder structure.
 */

// ---------------------------------------------------------------------------
// Domain IDs
// ---------------------------------------------------------------------------

export type {
  AttemptId,
  ConceptId,
  IdGenerator,
  LearnerId,
  LessonId,
  ObjectiveId,
  StepId,
} from "./domain/ids";

export {
  asAttemptId,
  asConceptId,
  asLearnerId,
  asLessonId,
  asObjectiveId,
  asStepId,
  defaultIdGenerator,
  newAttemptId,
  newLearnerId,
} from "./domain/ids";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type {
  CreateLearnerProfileInput,
  LearnerProfile,
} from "./domain/profile";

export {
  PROFILE_VERSION,
  createLearnerProfile,
  isLearnerProfile,
  renameLearner,
} from "./domain/profile";

// ---------------------------------------------------------------------------
// Learning events
// ---------------------------------------------------------------------------

export type {
  LearnerCreatedEvent,
  LearningEvent,
  LearningEventBase,
  LearningEventKind,
  LearningEventVersion,
  LessonCompletedEvent,
  LessonResetEvent,
  LessonStartedEvent,
  ObjectiveEvaluatedEvent,
} from "./events/types";

export {
  LEARNING_EVENT_VERSION,
  isLearningEvent,
} from "./events/types";

export type {
  CreateLearnerCreatedEventInput,
  CreateLessonCompletedEventInput,
  CreateLessonResetEventInput,
  CreateLessonStartedEventInput,
  CreateObjectiveEvaluatedEventInput,
  EventEmitContext,
} from "./events/factory";

export {
  createLearnerCreatedEvent,
  createLessonCompletedEvent,
  createLessonResetEvent,
  createLessonStartedEvent,
  createObjectiveEvaluatedEvent,
  defaultEventEmitContext,
  nextAttemptId,
} from "./events/factory";

// ---------------------------------------------------------------------------
// History projections
// ---------------------------------------------------------------------------

export type {
  LessonAttemptRecord,
  LessonAttemptVerdict,
} from "./history/attempt-record";

export { computeAttemptVerdict } from "./history/attempt-record";

export type {
  LearnerStatistics,
  LessonHistory,
  LessonProgress,
} from "./history/projections";

export {
  projectCompletedLessonIds,
  projectLearnerStatistics,
  projectLessonHistory,
  projectLessonHistoryFor,
  projectLessonProgress,
  projectStartedLessonIds,
} from "./history/projections";

// ---------------------------------------------------------------------------
// Repository interfaces + implementations
// ---------------------------------------------------------------------------

export type {
  LearnerEventStore,
  LearnerProfileRepository,
} from "./repository/types";

export {
  LEARNER_REPOSITORY_ERROR_CODES,
  LearnerRepositoryError,
} from "./repository/types";

export {
  EVENT_STORE_KEY_FOR,
  STORAGE_KEYS,
} from "./repository/keys";

export {
  InMemoryLearnerEventStore,
  InMemoryLearnerProfileRepository,
} from "./repository/memory";

export type { StorageLike } from "./repository/local-storage";

export {
  LocalStorageLearnerEventStore,
  LocalStorageLearnerProfileRepository,
} from "./repository/local-storage";