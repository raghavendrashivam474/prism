/**
 * Supported objective type identifiers.
 *
 * Temporary constant for Milestone 2.2.
 * From Milestone 2.5 onwards, this will be imported from @prism/objectives.
 *
 * Kept here so the lesson validator can reject unknown objective types
 * before the objectives package is fully populated.
 */

export const SUPPORTED_OBJECTIVE_TYPES = new Set<string>([
  "entity_exists",
  "entity_value_equals",
  "entity_value_changed",
  "execution_completed",
]);