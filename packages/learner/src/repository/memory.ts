/**
 * In-memory implementations of the learner repositories.
 *
 * Purpose:
 *   - Unit tests for projections, hooks, and orchestration should
 *     not touch localStorage. These implementations satisfy the
 *     same async contracts as the browser implementations, so
 *     tests exercise real repository code paths.
 *   - The event store preserves append order via a plain array.
 *     No sorting, no deduplication, no reordering.
 *
 * Non-goals:
 *   - Not thread-safe. Node has no meaningful concurrency here,
 *     and browsers don't share module state across tabs.
 *   - Not persistent. Everything vanishes when the instance
 *     is garbage-collected.
 *   - No versioning or upcasting. Version handling belongs to the
 *     serialization layer (local-storage.ts).
 */

import type { LearnerId } from "../domain/ids";
import type { LearnerProfile } from "../domain/profile";
import type { LearningEvent } from "../events/types";
import type {
  LearnerEventStore,
  LearnerProfileRepository,
} from "./types";

// ---------------------------------------------------------------------------
// InMemoryLearnerProfileRepository
// ---------------------------------------------------------------------------

export class InMemoryLearnerProfileRepository
  implements LearnerProfileRepository
{
  private _profile: LearnerProfile | null;

  /**
   * Seed the repository with a pre-existing profile (typically
   * useful for tests that need to start "after learner creation").
   */
  constructor(seed: LearnerProfile | null = null) {
    this._profile = seed;
  }

  async load(): Promise<LearnerProfile | null> {
    return this._profile;
  }

  async save(profile: LearnerProfile): Promise<void> {
    this._profile = profile;
  }

  async reset(): Promise<void> {
    this._profile = null;
  }

  // ---- test-only introspection ---------------------------------------------

  /**
   * Synchronous peek at the current stored profile. Intended for
   * assertions in tests; not part of the public repository
   * contract.
   */
  peek(): LearnerProfile | null {
    return this._profile;
  }
}

// ---------------------------------------------------------------------------
// InMemoryLearnerEventStore
// ---------------------------------------------------------------------------

export class InMemoryLearnerEventStore implements LearnerEventStore {
  private readonly _byLearner: Map<LearnerId, LearningEvent[]> = new Map();

  /**
   * Seed the store with pre-existing events for one or more
   * learners (useful for projection tests that need a specific
   * event history).
   *
   * Seed events are appended in the order supplied.
   */
  constructor(seed: readonly LearningEvent[] = []) {
    for (const event of seed) {
      const arr = this._byLearner.get(event.learnerId) ?? [];
      arr.push(event);
      this._byLearner.set(event.learnerId, arr);
    }
  }

  async append(event: LearningEvent): Promise<void> {
    const arr = this._byLearner.get(event.learnerId) ?? [];
    arr.push(event);
    this._byLearner.set(event.learnerId, arr);
  }

  async loadForLearner(
    learnerId: LearnerId,
  ): Promise<readonly LearningEvent[]> {
    const arr = this._byLearner.get(learnerId);
    if (!arr) return [];
    // Return a shallow copy so callers cannot mutate our internal
    // buffer by accident. Events themselves are frozen by the
    // factory, so the shallow copy is sufficient.
    return arr.slice();
  }

  async clearForLearner(learnerId: LearnerId): Promise<void> {
    this._byLearner.delete(learnerId);
  }

  // ---- test-only introspection ---------------------------------------------

  /**
   * Count events across all learners. Diagnostic use in tests.
   */
  totalEventCount(): number {
    let total = 0;
    for (const arr of this._byLearner.values()) total += arr.length;
    return total;
  }

  /**
   * Learners known to the store, in insertion order. Diagnostic
   * use in tests.
   */
  knownLearnerIds(): readonly LearnerId[] {
    return [...this._byLearner.keys()];
  }
}