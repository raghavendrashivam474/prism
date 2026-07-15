import { describe, it, expect } from "vitest";
import {
  OBJECTIVE_TYPES,
  SUPPORTED_OBJECTIVE_TYPES,
  isObjectiveType,
  type ObjectiveDefinition,
  type EntityExistsObjectiveDefinition,
  type EntityValueEqualsObjectiveDefinition,
  type EntityValueChangedObjectiveDefinition,
  type ExecutionCompletedObjectiveDefinition,
} from "../index";

function assertNever(value: never): never {
  throw new Error(`Unexpected objective variant: ${JSON.stringify(value)}`);
}

function summarizeObjective(objective: ObjectiveDefinition): string {
  switch (objective.type) {
    case "entity_exists":
      return `exists:${objective.displayName}`;
    case "entity_value_equals":
      return `equals:${objective.displayName}=${objective.value}`;
    case "entity_value_changed":
      return `changed:${objective.displayName}:${objective.from}->${objective.to}`;
    case "execution_completed":
      return "execution_completed";
    default:
      return assertNever(objective);
  }
}

describe("@prism/objectives runtime objective model", () => {
  it("exports the four supported objective type identifiers in order", () => {
    expect(OBJECTIVE_TYPES).toEqual([
      "entity_exists",
      "entity_value_equals",
      "entity_value_changed",
      "execution_completed",
    ]);
  });

  it("supported objective type set contains all four identifiers", () => {
    expect(SUPPORTED_OBJECTIVE_TYPES.has("entity_exists")).toBe(true);
    expect(SUPPORTED_OBJECTIVE_TYPES.has("entity_value_equals")).toBe(true);
    expect(SUPPORTED_OBJECTIVE_TYPES.has("entity_value_changed")).toBe(true);
    expect(SUPPORTED_OBJECTIVE_TYPES.has("execution_completed")).toBe(true);
  });

  it("isObjectiveType returns true for a supported objective type", () => {
    expect(isObjectiveType("entity_exists")).toBe(true);
    expect(isObjectiveType("entity_value_equals")).toBe(true);
    expect(isObjectiveType("entity_value_changed")).toBe(true);
    expect(isObjectiveType("execution_completed")).toBe(true);
  });

  it("isObjectiveType returns false for an unsupported objective type", () => {
    expect(isObjectiveType("make_coffee")).toBe(false);
  });

  it("models entity_exists as a discriminated objective definition", () => {
    const objective: EntityExistsObjectiveDefinition = {
      id: "obj-1",
      type: "entity_exists",
      displayName: "x",
    };

    expect(summarizeObjective(objective)).toBe("exists:x");
  });

  it("models entity_value_equals as a discriminated objective definition", () => {
    const objective: EntityValueEqualsObjectiveDefinition = {
      id: "obj-2",
      type: "entity_value_equals",
      displayName: "x",
      value: 20,
    };

    expect(summarizeObjective(objective)).toBe("equals:x=20");
  });

  it("models entity_value_changed as a discriminated objective definition", () => {
    const objective: EntityValueChangedObjectiveDefinition = {
      id: "obj-3",
      type: "entity_value_changed",
      displayName: "x",
      from: 10,
      to: 20,
    };

    expect(summarizeObjective(objective)).toBe("changed:x:10->20");
  });

  it("models execution_completed as a discriminated objective definition", () => {
    const objective: ExecutionCompletedObjectiveDefinition = {
      id: "obj-4",
      type: "execution_completed",
    };

    expect(summarizeObjective(objective)).toBe("execution_completed");
  });

  it("supports arrays of mixed objective definitions", () => {
    const objectives: ObjectiveDefinition[] = [
      { id: "a", type: "entity_exists", displayName: "x" },
      { id: "b", type: "entity_value_equals", displayName: "x", value: 10 },
      { id: "c", type: "entity_value_changed", displayName: "x", from: 10, to: 20 },
      { id: "d", type: "execution_completed" },
    ];

    expect(objectives.map(summarizeObjective)).toEqual([
      "exists:x",
      "equals:x=10",
      "changed:x:10->20",
      "execution_completed",
    ]);
  });
});
