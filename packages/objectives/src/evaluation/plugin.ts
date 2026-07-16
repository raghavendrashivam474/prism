/**
 * Objective evaluator plugin contract — Milestone 2.6.
 *
 * Every runtime objective type is evaluated by exactly one plugin.
 * Plugins are registered with the ObjectiveEvaluatorRegistry.
 *
 * A plugin declares:
 *   - which ObjectiveType it handles
 *   - how to evaluate a single ObjectiveDefinition of that type
 *
 * Plugins MUST:
 *   - be pure (given the same context + definition, return the same result)
 *   - not throw for unsatisfied objectives — return satisfied=false instead
 *   - not produce learner-facing wording
 *   - not mutate the context or its arrays
 *
 * Plugins MAY:
 *   - inspect trace events
 *   - inspect visual state snapshots
 *   - attach runtime evidence to their result
 */

import type { ObjectiveDefinition, ObjectiveType } from "../domain/types";
import type {
  ObjectiveEvaluationContext,
  ObjectiveEvaluationResult,
} from "./types";

/**
 * A single-type evaluator plugin.
 *
 * The `objectiveType` field is used by the registry as the plugin's identity.
 * At most one plugin may be registered per objective type.
 */
export interface ObjectiveEvaluatorPlugin<
  T extends ObjectiveType = ObjectiveType,
> {
  readonly objectiveType: T;

  evaluate(
    definition: Extract<ObjectiveDefinition, { type: T }>,
    context: ObjectiveEvaluationContext,
  ): ObjectiveEvaluationResult;
}
