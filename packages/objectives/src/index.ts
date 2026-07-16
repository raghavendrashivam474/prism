// Sprint 2 - Objectives package public exports.

// Domain (Milestone 2.5)
export {
  OBJECTIVE_TYPES,
  SUPPORTED_OBJECTIVE_TYPES,
  isObjectiveType,
} from "./domain/types";

export type {
  ObjectiveType,
  BaseObjectiveDefinition,
  ObjectiveDefinition,
  EntityExistsObjectiveDefinition,
  EntityValueEqualsObjectiveDefinition,
  EntityValueChangedObjectiveDefinition,
  ExecutionCompletedObjectiveDefinition,
} from "./domain/types";

// Evaluation (Milestone 2.6)
export type {
  ObjectiveEvaluationContext,
  ObjectiveEvaluationResult,
  ObjectiveEvidence,
} from "./evaluation/types";

export type { ObjectiveEvaluatorPlugin } from "./evaluation/plugin";

export { ObjectiveEvaluatorRegistry } from "./evaluation/registry";
export { ObjectiveEvaluatorRegistryError } from "./evaluation/errors";
