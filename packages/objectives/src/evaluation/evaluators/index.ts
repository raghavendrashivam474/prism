/**
 * Concrete objective evaluator plugins - Milestone 2.7.
 *
 * Also exposes createDefaultEvaluatorRegistry() as a convenience:
 * returns a ObjectiveEvaluatorRegistry pre-populated with all four
 * Sprint 2 evaluators.
 */

import { ObjectiveEvaluatorRegistry } from "../registry";
import { EntityExistsEvaluator } from "./entity-exists";
import { EntityValueEqualsEvaluator } from "./entity-value-equals";
import { EntityValueChangedEvaluator } from "./entity-value-changed";
import { ExecutionCompletedEvaluator } from "./execution-completed";

export { EntityExistsEvaluator } from "./entity-exists";
export { EntityValueEqualsEvaluator } from "./entity-value-equals";
export { EntityValueChangedEvaluator } from "./entity-value-changed";
export { ExecutionCompletedEvaluator } from "./execution-completed";

export function createDefaultEvaluatorRegistry(): ObjectiveEvaluatorRegistry {
  const registry = new ObjectiveEvaluatorRegistry();
  registry.register(new EntityExistsEvaluator());
  registry.register(new EntityValueEqualsEvaluator());
  registry.register(new EntityValueChangedEvaluator());
  registry.register(new ExecutionCompletedEvaluator());
  return registry;
}
