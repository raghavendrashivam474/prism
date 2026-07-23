/**
 * Storage keys for @prism/learner.
 *
 * Every persistent record written by this package uses a key
 * declared here. No storage key should appear as a string literal
 * anywhere else in the package. This convention:
 *
 *   - eliminates typos ("learner-profile" vs "learnerProfile")
 *   - makes a schema migration trivially discoverable (change the
 *     key, all callers move together)
 *   - documents the full persistence footprint of the package in
 *     one file
 *
 * Prefix rules:
 *
 *   All keys start with "prism.learner." so that PRISM's storage
 *   footprint is scannable from browser devtools and cannot
 *   collide with third-party libraries using the same
 *   Web Storage bucket.
 *
 * Namespacing note:
 *
 *   Repositories that store per-learner data append the learnerId
 *   as a suffix (see EVENT_STORE_KEY_FOR below). This keeps a
 *   single localStorage instance capable of holding events for
 *   multiple learner profiles if we ever grow past the single-
 *   profile model without a data migration.
 */

import type { LearnerId } from "../domain/ids";

const PREFIX = "prism.learner." as const;

export const STORAGE_KEYS = {
  /**
   * The active learner's profile record. Exactly one profile is
   * stored under this key. Multi-profile is out of scope for
   * Sprint 3 (see docs/sprint-3/known-limitations.md).
   */
  activeProfile: `${PREFIX}profile.active` as const,

  /**
   * Per-learner event log prefix. Actual keys are constructed by
   * EVENT_STORE_KEY_FOR(learnerId) to keep learners' event
   * streams independent.
   */
  eventStorePrefix: `${PREFIX}events.` as const,
} as const;

/**
 * Compute the localStorage key that holds a specific learner's
 * append-only event log.
 *
 * Kept as a function rather than a template string in the caller
 * so the composition rule lives in exactly one place.
 */
export function EVENT_STORE_KEY_FOR(learnerId: LearnerId): string {
  if (typeof learnerId !== "string" || learnerId.length === 0) {
    throw new Error(
      "EVENT_STORE_KEY_FOR requires a non-empty LearnerId.",
    );
  }
  return `${STORAGE_KEYS.eventStorePrefix}${learnerId}`;
}