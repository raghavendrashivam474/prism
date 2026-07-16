import { describe, it, expect } from "vitest";
import {
  ObjectiveEvaluatorRegistry,
  ObjectiveEvaluatorRegistryError,
  type ObjectiveEvaluatorPlugin,
  type ObjectiveEvaluationContext,
  type ObjectiveEvaluationResult,
  type ObjectiveDefinition,
} from "../index";

// ---------------------------------------------------------------------------
// Test doubles
//
// These fake plugins are structurally identical to what real 2.7 plugins
// will look like, but they contain NO real semantics. They only prove
// that the registry routes definitions to the correct plugin and returns
// the plugin's result unchanged.
// ---------------------------------------------------------------------------

const emptyContext: ObjectiveEvaluationContext = {
  trace: {
    irVersion: "learning-ir/v0.1",
    executionId: "test-exec",
    languageId: "cpp",
    events: [],
  } as unknown as ObjectiveEvaluationContext["trace"],
  snapshots: [],
};

function makeEntityExistsPlugin(
  satisfied: boolean,
): ObjectiveEvaluatorPlugin<"entity_exists"> {
  return {
    objectiveType: "entity_exists",
    evaluate: (definition, _context) => ({
      objectiveId: definition.id,
      satisfied,
      evidence: [],
    }),
  };
}

function makeExecutionCompletedPlugin(
  satisfied: boolean,
): ObjectiveEvaluatorPlugin<"execution_completed"> {
  return {
    objectiveType: "execution_completed",
    evaluate: (definition, _context) => ({
      objectiveId: definition.id,
      satisfied,
      evidence: [
        {
          sequence: 42,
          observed: { note: "test-only synthetic evidence" },
        },
      ],
    }),
  };
}

function makeThrowingPlugin(): ObjectiveEvaluatorPlugin<"entity_value_equals"> {
  return {
    objectiveType: "entity_value_equals",
    evaluate: () => {
      throw new Error("evaluator intentionally threw");
    },
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("ObjectiveEvaluatorRegistry — registration", () => {
  it("starts empty", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    expect(registry.registeredTypes()).toEqual([]);
  });

  it("registers a plugin by its declared objective type", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(true));
    expect(registry.has("entity_exists")).toBe(true);
    expect(registry.registeredTypes()).toEqual(["entity_exists"]);
  });

  it("registers plugins for multiple objective types", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(true));
    registry.register(makeExecutionCompletedPlugin(true));
    expect(registry.has("entity_exists")).toBe(true);
    expect(registry.has("execution_completed")).toBe(true);
    expect(registry.registeredTypes()).toEqual([
      "entity_exists",
      "execution_completed",
    ]);
  });

  it("rejects duplicate registration for the same objective type", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(true));
    expect(() => registry.register(makeEntityExistsPlugin(false))).toThrow(
      ObjectiveEvaluatorRegistryError,
    );
  });

  it("error code for duplicate registration is OBJECTIVE_TYPE_ALREADY_REGISTERED", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(true));
    try {
      registry.register(makeEntityExistsPlugin(false));
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as ObjectiveEvaluatorRegistryError).code).toBe(
        "OBJECTIVE_TYPE_ALREADY_REGISTERED",
      );
    }
  });

  it("replace() installs a plugin for a new type", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.replace(makeEntityExistsPlugin(true));
    expect(registry.has("entity_exists")).toBe(true);
  });

  it("replace() deliberately overwrites an existing plugin", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(true));
    registry.replace(makeEntityExistsPlugin(false));

    const definition: ObjectiveDefinition = {
      id: "obj-1",
      type: "entity_exists",
      displayName: "x",
    };

    const result = registry.evaluate(definition, emptyContext);
    expect(result.satisfied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

describe("ObjectiveEvaluatorRegistry — resolution", () => {
  it("resolves the plugin for a matching objective definition", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    const plugin = makeEntityExistsPlugin(true);
    registry.register(plugin);

    const definition: ObjectiveDefinition = {
      id: "obj-1",
      type: "entity_exists",
      displayName: "x",
    };

    expect(registry.resolve(definition)).toBe(plugin);
  });

  it("throws NO_EVALUATOR_REGISTERED when no plugin exists for a type", () => {
    const registry = new ObjectiveEvaluatorRegistry();

    const definition: ObjectiveDefinition = {
      id: "obj-1",
      type: "entity_exists",
      displayName: "x",
    };

    try {
      registry.resolve(definition);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ObjectiveEvaluatorRegistryError);
      expect((e as ObjectiveEvaluatorRegistryError).code).toBe(
        "NO_EVALUATOR_REGISTERED",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Single evaluation
// ---------------------------------------------------------------------------

describe("ObjectiveEvaluatorRegistry — evaluate()", () => {
  it("returns the plugin's satisfied=true result unchanged", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(true));

    const definition: ObjectiveDefinition = {
      id: "obj-1",
      type: "entity_exists",
      displayName: "x",
    };

    const result: ObjectiveEvaluationResult = registry.evaluate(
      definition,
      emptyContext,
    );
    expect(result.objectiveId).toBe("obj-1");
    expect(result.satisfied).toBe(true);
    expect(result.evidence).toEqual([]);
  });

  it("returns the plugin's satisfied=false result unchanged", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(false));

    const definition: ObjectiveDefinition = {
      id: "obj-2",
      type: "entity_exists",
      displayName: "y",
    };

    const result = registry.evaluate(definition, emptyContext);
    expect(result.satisfied).toBe(false);
  });

  it("preserves evidence returned by the plugin", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeExecutionCompletedPlugin(true));

    const definition: ObjectiveDefinition = {
      id: "obj-3",
      type: "execution_completed",
    };

    const result = registry.evaluate(definition, emptyContext);
    expect(result.satisfied).toBe(true);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].sequence).toBe(42);
    expect(result.evidence[0].observed).toEqual({
      note: "test-only synthetic evidence",
    });
  });

  it("evaluate() throws NO_EVALUATOR_REGISTERED for an unregistered type", () => {
    const registry = new ObjectiveEvaluatorRegistry();

    const definition: ObjectiveDefinition = {
      id: "obj-4",
      type: "execution_completed",
    };

    expect(() => registry.evaluate(definition, emptyContext)).toThrow(
      ObjectiveEvaluatorRegistryError,
    );
  });

  it("plugin errors propagate — the registry does not swallow them", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeThrowingPlugin());

    const definition: ObjectiveDefinition = {
      id: "obj-5",
      type: "entity_value_equals",
      displayName: "x",
      value: 20,
    };

    expect(() => registry.evaluate(definition, emptyContext)).toThrow(
      "evaluator intentionally threw",
    );
  });
});

// ---------------------------------------------------------------------------
// Batch evaluation
// ---------------------------------------------------------------------------

describe("ObjectiveEvaluatorRegistry — evaluateAll()", () => {
  it("returns results in the same order as the input definitions", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(true));
    registry.register(makeExecutionCompletedPlugin(false));

    const definitions: ObjectiveDefinition[] = [
      { id: "a", type: "entity_exists", displayName: "x" },
      { id: "b", type: "execution_completed" },
      { id: "c", type: "entity_exists", displayName: "y" },
    ];

    const results = registry.evaluateAll(definitions, emptyContext);
    expect(results.map((r) => r.objectiveId)).toEqual(["a", "b", "c"]);
  });

  it("mixes satisfied results correctly", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(true));
    registry.register(makeExecutionCompletedPlugin(false));

    const definitions: ObjectiveDefinition[] = [
      { id: "a", type: "entity_exists", displayName: "x" },
      { id: "b", type: "execution_completed" },
    ];

    const results = registry.evaluateAll(definitions, emptyContext);
    expect(results[0].satisfied).toBe(true);
    expect(results[1].satisfied).toBe(false);
  });

  it("empty input returns empty output", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    const results = registry.evaluateAll([], emptyContext);
    expect(results).toEqual([]);
  });

  it("fails the whole batch when any objective has no registered evaluator", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeEntityExistsPlugin(true));
    // execution_completed intentionally NOT registered

    const definitions: ObjectiveDefinition[] = [
      { id: "a", type: "entity_exists", displayName: "x" },
      { id: "b", type: "execution_completed" },
    ];

    expect(() => registry.evaluateAll(definitions, emptyContext)).toThrow(
      ObjectiveEvaluatorRegistryError,
    );
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("ObjectiveEvaluatorRegistry — determinism", () => {
  it("repeated evaluations of the same definition return equivalent results", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeExecutionCompletedPlugin(true));

    const definition: ObjectiveDefinition = {
      id: "obj-1",
      type: "execution_completed",
    };

    const first = registry.evaluate(definition, emptyContext);
    const second = registry.evaluate(definition, emptyContext);
    expect(first).toEqual(second);
  });

  it("registeredTypes() reflects insertion order", () => {
    const registry = new ObjectiveEvaluatorRegistry();
    registry.register(makeExecutionCompletedPlugin(true));
    registry.register(makeEntityExistsPlugin(true));
    expect(registry.registeredTypes()).toEqual([
      "execution_completed",
      "entity_exists",
    ]);
  });
});
