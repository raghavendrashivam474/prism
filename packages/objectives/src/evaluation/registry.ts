/**
 * ObjectiveEvaluatorRegistry — Milestone 2.6.
 *
 * The registry owns the mapping from ObjectiveType to evaluator plugin.
 *
 * It does NOT:
 *   - implement evaluator semantics
 *   - execute code
 *   - reconstruct visual state
 *   - format learner-facing feedback
 *   - drive lesson progression
 *
 * It DOES:
 *   - register a plugin for a specific ObjectiveType
 *   - reject duplicate registration for the same type
 *   - resolve an evaluator for a definition (by its `type`)
 *   - evaluate a single definition through the resolved plugin
 *   - evaluate a batch of definitions and return per-definition results
 *   - report registered objective types (for diagnostics)
 *
 * The registry is deterministic: same registrations + same inputs produce
 * the same outputs.
 *
 * Concrete evaluator plugins (entity_exists, entity_value_equals,
 * entity_value_changed, execution_completed) arrive in Milestone 2.7.
 */

import type { ObjectiveDefinition, ObjectiveType } from "../domain/types";
import type {
  ObjectiveEvaluationContext,
  ObjectiveEvaluationResult,
} from "./types";
import type { ObjectiveEvaluatorPlugin } from "./plugin";
import { ObjectiveEvaluatorRegistryError } from "./errors";

export class ObjectiveEvaluatorRegistry {
  private readonly _plugins: Map<
    ObjectiveType,
    ObjectiveEvaluatorPlugin<ObjectiveType>
  > = new Map();

  /**
   * Register a plugin for its declared objective type.
   *
   * Throws OBJECTIVE_TYPE_ALREADY_REGISTERED if a plugin for the same
   * type is already registered. Re-registration is intentionally rejected
   * so evaluation semantics cannot silently shift under running lessons.
   *
   * Use `replace()` when deliberate replacement is desired.
   */
  register<T extends ObjectiveType>(plugin: ObjectiveEvaluatorPlugin<T>): void {
    if (this._plugins.has(plugin.objectiveType)) {
      throw new ObjectiveEvaluatorRegistryError(
        `An evaluator for objective type '${plugin.objectiveType}' is already registered.`,
        "OBJECTIVE_TYPE_ALREADY_REGISTERED",
        { objectiveType: plugin.objectiveType },
      );
    }
    this._plugins.set(
      plugin.objectiveType,
      plugin as ObjectiveEvaluatorPlugin<ObjectiveType>,
    );
  }

  /**
   * Deliberately replace (or install) a plugin for a specific objective type.
   *
   * Intended for testing and future dynamic reconfiguration.
   * Production callers should prefer `register()`.
   */
  replace<T extends ObjectiveType>(plugin: ObjectiveEvaluatorPlugin<T>): void {
    this._plugins.set(
      plugin.objectiveType,
      plugin as ObjectiveEvaluatorPlugin<ObjectiveType>,
    );
  }

  /**
   * Whether a plugin is registered for the given objective type.
   */
  has(objectiveType: ObjectiveType): boolean {
    return this._plugins.has(objectiveType);
  }

  /**
   * All currently registered objective types, in insertion order.
   */
  registeredTypes(): ObjectiveType[] {
    return [...this._plugins.keys()];
  }

  /**
   * Resolve the evaluator plugin for a definition.
   *
   * Throws NO_EVALUATOR_REGISTERED if no plugin is registered for the
   * definition's type.
   */
  resolve(
    definition: ObjectiveDefinition,
  ): ObjectiveEvaluatorPlugin<ObjectiveType> {
    const plugin = this._plugins.get(definition.type);
    if (!plugin) {
      throw new ObjectiveEvaluatorRegistryError(
        `No evaluator registered for objective type '${definition.type}'.`,
        "NO_EVALUATOR_REGISTERED",
        { objectiveType: definition.type, objectiveId: definition.id },
      );
    }
    return plugin;
  }

  /**
   * Evaluate a single objective definition.
   *
   * The registry itself performs no semantic checks — it delegates entirely
   * to the resolved plugin. This preserves Boundary F: evaluators own
   * semantic checks.
   */
  evaluate(
    definition: ObjectiveDefinition,
    context: ObjectiveEvaluationContext,
  ): ObjectiveEvaluationResult {
    const plugin = this.resolve(definition);
    return plugin.evaluate(
      definition as Extract<ObjectiveDefinition, { type: ObjectiveType }>,
      context,
    );
  }

  /**
   * Evaluate an ordered batch of definitions.
   *
   * Returns per-definition results in the same order as the input. If any
   * definition has no registered evaluator, the whole batch fails with the
   * standard NO_EVALUATOR_REGISTERED error — partial batches are intentionally
   * not supported. Lesson-level "some objectives satisfied" semantics belong
   * in a later milestone, not here.
   */
  evaluateAll(
    definitions: readonly ObjectiveDefinition[],
    context: ObjectiveEvaluationContext,
  ): ObjectiveEvaluationResult[] {
    return definitions.map((def) => this.evaluate(def, context));
  }
}
