/**
 * Singleton evaluator registry for the web app - Milestone 2.13b.
 *
 * The lesson workspace and any future lesson-aware surfaces share one
 * evaluator registry so evaluator identity is stable across hook
 * instances. Registered evaluators are the four Sprint 2 defaults.
 */

import {
  createDefaultEvaluatorRegistry,
  type ObjectiveEvaluatorRegistry,
} from "@prism/objectives";

let cached: ObjectiveEvaluatorRegistry | null = null;

export function getEvaluatorRegistry(): ObjectiveEvaluatorRegistry {
  if (cached === null) {
    cached = createDefaultEvaluatorRegistry();
  }
  return cached;
}
