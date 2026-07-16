// Sprint 2 - Lessons package public exports.

// Domain
export type {
  LessonDefinition,
  LessonStepDefinition,
  LessonContent,
  LessonCodeDefinition,
  LessonSummary,
  ObjectiveDefinitionShape,
} from "./domain/types";

export { toLessonSummary } from "./domain/types";

export { SUPPORTED_OBJECTIVE_TYPES } from "./domain/supported-objectives";

export {
  validateLessonDefinition,
  LessonValidationError,
} from "./domain/validator";

// Loader
export type { LessonLoader } from "./loader/loader";
export {
  StaticLessonLoader,
  LessonNotFoundError,
} from "./loader/loader";

// Catalog
export type { LessonCatalog } from "./loader/catalog";
export { StaticLessonCatalog } from "./loader/catalog";

// Session engine (Milestone 2.4)
export type {
  LessonSessionState,
  LessonSessionStatus,
  LessonStepState,
  LessonStepStatus,
} from "./session/types";

export {
  startSession,
  completeActiveStep,
  activateStep,
  resetSession,
  currentStepState,
  isLessonComplete,
  LessonSessionError,
} from "./session/engine";

// Step evaluation (Milestone 2.8)
export type {
  ExecutionOutcome,
  SuccessfulExecutionOutcome,
  FailedExecutionOutcome,
  StepObjectiveStatus,
  StepObjectiveOutcome,
  StepEvaluationVerdict,
  StepEvaluation,
} from "./evaluation/types";

export { evaluateStep } from "./evaluation/step-evaluator";

// Lesson attempts (Milestone 2.9)
export type { LessonAttempt } from "./session/types";

export type { RecordAttemptInput } from "./session/attempt-orchestrator";
export { recordAttempt } from "./session/attempt-orchestrator";

// Learner feedback (Milestone 2.10)
export type {
  LearnerFeedback,
  LearnerFeedbackTone,
  ObjectiveFeedback,
} from "./feedback/types";

export {
  FeedbackProjector,
  projectStepFeedback,
  projectAttemptFeedback,
} from "./feedback/projector";
