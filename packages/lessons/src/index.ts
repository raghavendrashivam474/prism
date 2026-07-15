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