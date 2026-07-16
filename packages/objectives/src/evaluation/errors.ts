/**
 * Errors raised by the objective evaluator registry.
 *
 * Uses a machine-readable `code` field so callers can react to specific
 * failure modes without string-matching messages.
 */

export class ObjectiveEvaluatorRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ObjectiveEvaluatorRegistryError";
  }
}
