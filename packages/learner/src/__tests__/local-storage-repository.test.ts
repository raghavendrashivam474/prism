import { describe, it, expect } from "vitest";
import {
  LEARNER_REPOSITORY_ERROR_CODES,
  LearnerRepositoryError,
  LocalStorageLearnerEventStore,
  LocalStorageLearnerProfileRepository,
  STORAGE_KEYS,
  asLearnerId,
  asLessonId,
  createLearnerCreatedEvent,
  createLearnerProfile,
  createLessonStartedEvent,
  type StorageLike,
} from "../index";

// ---------------------------------------------------------------------------
// StorageLike stub
// ---------------------------------------------------------------------------

class StubStorage implements StorageLike {
  private readonly _map = new Map<string, string>();

  getItem(key: string): string | null {
    return this._map.has(key) ? this._map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this._map.set(key, value);
  }
  removeItem(key: string): void {
    this._map.delete(key);
  }

  /** test-only introspection */
  keys(): string[] {
    return [...this._map.keys()];
  }
}

const fixedCtx = {
  now: () => "2026-01-01T00:00:00.000Z",
  idGenerator: () => "id-fixed",
};

// ---------------------------------------------------------------------------
// LocalStorageLearnerProfileRepository
// ---------------------------------------------------------------------------

describe("LocalStorageLearnerProfileRepository", () => {
  it("returns null when nothing stored", async () => {
    const storage = new StubStorage();
    const repo = new LocalStorageLearnerProfileRepository(storage);
    expect(await repo.load()).toBeNull();
  });

  it("save then load round-trips", async () => {
    const storage = new StubStorage();
    const repo = new LocalStorageLearnerProfileRepository(storage);
    const profile = createLearnerProfile({
      displayName: "Alice",
      now: () => "2026-01-01T00:00:00.000Z",
      idGenerator: () => "learner-1",
    });
    await repo.save(profile);
    const loaded = await repo.load();
    expect(loaded).toEqual(profile);
  });

  it("save writes under the canonical key", async () => {
    const storage = new StubStorage();
    const repo = new LocalStorageLearnerProfileRepository(storage);
    const profile = createLearnerProfile({ idGenerator: () => "l" });
    await repo.save(profile);
    expect(storage.keys()).toEqual([STORAGE_KEYS.activeProfile]);
  });

  it("reset removes the stored profile", async () => {
    const storage = new StubStorage();
    const repo = new LocalStorageLearnerProfileRepository(storage);
    const profile = createLearnerProfile({ idGenerator: () => "l" });
    await repo.save(profile);
    await repo.reset();
    expect(await repo.load()).toBeNull();
  });

  it("load raises PARSE_ERROR on non-JSON garbage", async () => {
    const storage = new StubStorage();
    storage.setItem(STORAGE_KEYS.activeProfile, "not json");
    const repo = new LocalStorageLearnerProfileRepository(storage);
    try {
      await repo.load();
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(LearnerRepositoryError);
      expect((err as LearnerRepositoryError).code).toBe(
        LEARNER_REPOSITORY_ERROR_CODES.parseError,
      );
    }
  });

  it("load raises UNSUPPORTED_VERSION when envelope schemaVersion differs", async () => {
    const storage = new StubStorage();
    storage.setItem(
      STORAGE_KEYS.activeProfile,
      JSON.stringify({
        schema: "prism.learner.profile",
        schemaVersion: 999,
        profile: {
          id: "l",
          displayName: "L",
          createdAt: "t",
          profileVersion: 999,
        },
      }),
    );
    const repo = new LocalStorageLearnerProfileRepository(storage);
    try {
      await repo.load();
      throw new Error("expected throw");
    } catch (err) {
      expect((err as LearnerRepositoryError).code).toBe(
        LEARNER_REPOSITORY_ERROR_CODES.unsupportedVersion,
      );
    }
  });

  it("save rejects a payload that fails the shape check", async () => {
    const storage = new StubStorage();
    const repo = new LocalStorageLearnerProfileRepository(storage);
    // deliberately malformed profile - wrong profileVersion
    const bad = {
      id: "l",
      displayName: "L",
      createdAt: "t",
      profileVersion: 42,
    } as unknown as Parameters<typeof repo.save>[0];
    try {
      await repo.save(bad);
      throw new Error("expected throw");
    } catch (err) {
      expect((err as LearnerRepositoryError).code).toBe(
        LEARNER_REPOSITORY_ERROR_CODES.invalidPayload,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// LocalStorageLearnerEventStore
// ---------------------------------------------------------------------------

describe("LocalStorageLearnerEventStore", () => {
  const learnerA = asLearnerId("learner-A");
  const learnerB = asLearnerId("learner-B");
  const lessonId = asLessonId("lesson-X");

  it("returns empty for unknown learner", async () => {
    const store = new LocalStorageLearnerEventStore(new StubStorage());
    expect(await store.loadForLearner(learnerA)).toEqual([]);
  });

  it("append then load returns the same event", async () => {
    const storage = new StubStorage();
    const store = new LocalStorageLearnerEventStore(storage);
    const e = createLearnerCreatedEvent(
      { learnerId: learnerA, displayName: "A" },
      fixedCtx,
    );
    await store.append(e);
    const loaded = await store.loadForLearner(learnerA);
    expect(loaded).toEqual([e]);
  });

  it("preserves append order across multiple events", async () => {
    const storage = new StubStorage();
    const store = new LocalStorageLearnerEventStore(storage);
    const e1 = createLearnerCreatedEvent(
      { learnerId: learnerA, displayName: "A" },
      { now: () => "t1", idGenerator: () => "g" },
    );
    const e2 = createLessonStartedEvent(
      { learnerId: learnerA, lessonId },
      { now: () => "t2", idGenerator: () => "g" },
    );
    await store.append(e1);
    await store.append(e2);
    const loaded = await store.loadForLearner(learnerA);
    expect(loaded).toEqual([e1, e2]);
  });

  it("keeps different learners under different keys", async () => {
    const storage = new StubStorage();
    const store = new LocalStorageLearnerEventStore(storage);
    const eA = createLearnerCreatedEvent(
      { learnerId: learnerA, displayName: "A" },
      fixedCtx,
    );
    const eB = createLearnerCreatedEvent(
      { learnerId: learnerB, displayName: "B" },
      fixedCtx,
    );
    await store.append(eA);
    await store.append(eB);
    // 2 distinct keys, both starting with the event-store prefix
    const keys = storage.keys();
    expect(keys.length).toBe(2);
    for (const k of keys) {
      expect(k.startsWith(STORAGE_KEYS.eventStorePrefix)).toBe(true);
    }
  });

  it("clearForLearner removes exactly one learner's log", async () => {
    const storage = new StubStorage();
    const store = new LocalStorageLearnerEventStore(storage);
    const eA = createLearnerCreatedEvent(
      { learnerId: learnerA, displayName: "A" },
      fixedCtx,
    );
    const eB = createLearnerCreatedEvent(
      { learnerId: learnerB, displayName: "B" },
      fixedCtx,
    );
    await store.append(eA);
    await store.append(eB);
    await store.clearForLearner(learnerA);
    expect(await store.loadForLearner(learnerA)).toEqual([]);
    expect(await store.loadForLearner(learnerB)).toEqual([eB]);
  });

  it("load raises UNSUPPORTED_VERSION for a future-versioned envelope", async () => {
    const storage = new StubStorage();
    const key = `${STORAGE_KEYS.eventStorePrefix}${learnerA}`;
    storage.setItem(
      key,
      JSON.stringify({
        schema: "prism.learner.eventLog",
        schemaVersion: 999,
        events: [],
      }),
    );
    const store = new LocalStorageLearnerEventStore(storage);
    try {
      await store.loadForLearner(learnerA);
      throw new Error("expected throw");
    } catch (err) {
      expect((err as LearnerRepositoryError).code).toBe(
        LEARNER_REPOSITORY_ERROR_CODES.unsupportedVersion,
      );
    }
  });

  it("load raises INVALID_PAYLOAD when an event in the log fails shape check", async () => {
    const storage = new StubStorage();
    const key = `${STORAGE_KEYS.eventStorePrefix}${learnerA}`;
    storage.setItem(
      key,
      JSON.stringify({
        schema: "prism.learner.eventLog",
        schemaVersion: 1,
        events: [{ kind: "not_a_real_kind", version: 1 }],
      }),
    );
    const store = new LocalStorageLearnerEventStore(storage);
    try {
      await store.loadForLearner(learnerA);
      throw new Error("expected throw");
    } catch (err) {
      expect((err as LearnerRepositoryError).code).toBe(
        LEARNER_REPOSITORY_ERROR_CODES.invalidPayload,
      );
    }
  });
});