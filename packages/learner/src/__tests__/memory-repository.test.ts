import { describe, it, expect } from "vitest";
import {
  InMemoryLearnerEventStore,
  InMemoryLearnerProfileRepository,
  asLearnerId,
  asLessonId,
  createLearnerCreatedEvent,
  createLearnerProfile,
  createLessonStartedEvent,
} from "../index";

const fixedCtx = {
  now: () => "2026-01-01T00:00:00.000Z",
  idGenerator: () => "id-fixed",
};

describe("InMemoryLearnerProfileRepository", () => {
  it("returns null when empty", async () => {
    const repo = new InMemoryLearnerProfileRepository();
    expect(await repo.load()).toBeNull();
  });

  it("save then load round-trips exactly", async () => {
    const profile = createLearnerProfile({
      displayName: "Alice",
      now: () => "2026-01-01T00:00:00.000Z",
      idGenerator: () => "learner-1",
    });
    const repo = new InMemoryLearnerProfileRepository();
    await repo.save(profile);
    const loaded = await repo.load();
    expect(loaded).toEqual(profile);
  });

  it("reset clears the stored profile", async () => {
    const profile = createLearnerProfile({
      idGenerator: () => "learner-2",
    });
    const repo = new InMemoryLearnerProfileRepository(profile);
    expect(await repo.load()).not.toBeNull();
    await repo.reset();
    expect(await repo.load()).toBeNull();
  });

  it("peek returns internal state without going through async", () => {
    const profile = createLearnerProfile({ idGenerator: () => "l" });
    const repo = new InMemoryLearnerProfileRepository(profile);
    expect(repo.peek()).toBe(profile);
  });
});

describe("InMemoryLearnerEventStore", () => {
  const learnerId = asLearnerId("learner-1");
  const otherLearner = asLearnerId("learner-2");
  const lessonId = asLessonId("lesson-1");

  it("returns empty array for an unknown learner", async () => {
    const store = new InMemoryLearnerEventStore();
    expect(await store.loadForLearner(learnerId)).toEqual([]);
  });

  it("append preserves order", async () => {
    const store = new InMemoryLearnerEventStore();
    const a = createLearnerCreatedEvent(
      { learnerId, displayName: "A" },
      { now: () => "t1", idGenerator: () => "g" },
    );
    const b = createLessonStartedEvent(
      { learnerId, lessonId },
      { now: () => "t2", idGenerator: () => "g" },
    );
    await store.append(a);
    await store.append(b);
    const loaded = await store.loadForLearner(learnerId);
    expect(loaded).toEqual([a, b]);
  });

  it("keeps different learners' streams independent", async () => {
    const store = new InMemoryLearnerEventStore();
    const eA = createLearnerCreatedEvent(
      { learnerId, displayName: "A" },
      fixedCtx,
    );
    const eB = createLearnerCreatedEvent(
      { learnerId: otherLearner, displayName: "B" },
      fixedCtx,
    );
    await store.append(eA);
    await store.append(eB);
    expect(await store.loadForLearner(learnerId)).toEqual([eA]);
    expect(await store.loadForLearner(otherLearner)).toEqual([eB]);
  });

  it("clearForLearner removes only that learner's events", async () => {
    const store = new InMemoryLearnerEventStore();
    const eA = createLearnerCreatedEvent(
      { learnerId, displayName: "A" },
      fixedCtx,
    );
    const eB = createLearnerCreatedEvent(
      { learnerId: otherLearner, displayName: "B" },
      fixedCtx,
    );
    await store.append(eA);
    await store.append(eB);
    await store.clearForLearner(learnerId);
    expect(await store.loadForLearner(learnerId)).toEqual([]);
    expect(await store.loadForLearner(otherLearner)).toEqual([eB]);
  });

  it("seed constructor accepts pre-existing events", async () => {
    const eA = createLearnerCreatedEvent(
      { learnerId, displayName: "A" },
      fixedCtx,
    );
    const store = new InMemoryLearnerEventStore([eA]);
    expect(await store.loadForLearner(learnerId)).toEqual([eA]);
    expect(store.totalEventCount()).toBe(1);
    expect(store.knownLearnerIds()).toEqual([learnerId]);
  });

  it("load returns a copy the caller cannot use to mutate internal state", async () => {
    const store = new InMemoryLearnerEventStore();
    const e = createLearnerCreatedEvent(
      { learnerId, displayName: "A" },
      fixedCtx,
    );
    await store.append(e);
    const loaded = (await store.loadForLearner(learnerId)) as unknown[];
    (loaded as unknown[]).push(e);
    const reloaded = await store.loadForLearner(learnerId);
    expect(reloaded.length).toBe(1);
  });
});