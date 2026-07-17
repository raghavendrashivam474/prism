/**
 * Lesson registry for the web app.
 *
 * Registers two lessons:
 *
 *   cpp-understanding-variable-state
 *     The Sprint 2 lesson from handoff section 26. Four steps that walk
 *     the learner through variable storage, mutation, self-referential
 *     update, and multi-step state transitions. Each step is scoped to
 *     the Sprint 0 supported C++ profile (int main, int locals, integer
 *     literals, assignment, integer arithmetic, sequential execution,
 *     return 0).
 *
 *   cpp-variable-basics-test
 *     A deliberately minimal two-step lesson used as a smoke test for
 *     the lesson workspace pipeline. Kept alongside the real lesson so
 *     that future workspace refactors can be validated against a small
 *     predictable target without depending on the real lesson content.
 *
 * The registry exposes a StaticLessonLoader singleton so both the hook
 * and any future preview UIs pull from the same source of truth.
 *
 * Note: for Sprint 2 the lesson content lives inline. A dedicated
 * content boundary (JSON files, database, CMS) is a Sprint 3+ concern.
 */

import {
  StaticLessonLoader,
  type LessonDefinition,
} from "@prism/lessons";

// ---------------------------------------------------------------------------
// The Sprint 2 lesson: Understanding Variable State
// ---------------------------------------------------------------------------

const UNDERSTANDING_VARIABLE_STATE: LessonDefinition = {
  id: "cpp-understanding-variable-state",
  version: "0.1.0",
  title: "Understanding Variable State",
  description:
    "Learn how variables store, change, and depend on their own state as a program executes. Each step introduces one concept and lets you observe it directly in the execution timeline.",
  languageId: "cpp",
  steps: [
    // -----------------------------------------------------------------------
    // Step 1: A Variable Receives a Value
    // Learning outcome: Variables can store values.
    // -----------------------------------------------------------------------
    {
      id: "step-1-receive",
      title: "A Variable Receives a Value",
      content: {
        explanation:
          "Learning outcome: variables can store values.\n\nIn C++, a variable is a named location in memory that holds a value while the program runs. Creating a variable gives it an initial value that persists until something changes it.",
        instruction:
          "Declare an int variable named x and initialize it with the value 10.",
        observationPrompt:
          "After you run, look at the variable panel. At which step of the timeline does x first appear, and what value does it hold when it appears?",
      },
      code: {
        starterSource:
          "int main() {\n    // Create an int variable named x with value 10\n    return 0;\n}\n",
      },
      objectives: [
        {
          id: "obj-x-exists",
          type: "entity_exists",
          displayName: "x",
        },
        {
          id: "obj-run",
          type: "execution_completed",
        },
      ],
    },

    // -----------------------------------------------------------------------
    // Step 2: A Variable Can Change
    // Learning outcome: Variables are mutable.
    // -----------------------------------------------------------------------
    {
      id: "step-2-change",
      title: "A Variable Can Change",
      content: {
        explanation:
          "Learning outcome: variables are mutable.\n\nA variable's value is not fixed. Assigning a new value replaces the old one. The variable itself continues to exist; only the value it stores changes.",
        instruction:
          "x is already created with the value 10. Reassign x to the value 20 on a new line after the declaration.",
        observationPrompt:
          "Step through the timeline. You should see x transition from 10 to 20 at the moment of the assignment. Compare the previous value and the new value in the variable panel.",
      },
      code: {
        starterSource:
          "int main() {\n    int x = 10;\n    // Change x to 20 here\n    return 0;\n}\n",
      },
      objectives: [
        {
          id: "obj-x-changed",
          type: "entity_value_changed",
          displayName: "x",
          from: 10,
          to: 20,
        },
        {
          id: "obj-run",
          type: "execution_completed",
        },
      ],
    },

    // -----------------------------------------------------------------------
    // Step 3: A New Value Can Depend on Current State
    // Learning outcome: Variables can be updated using their own current state.
    // -----------------------------------------------------------------------
    {
      id: "step-3-depend",
      title: "A New Value Can Depend on Current State",
      content: {
        explanation:
          "Learning outcome: variables can be updated using their own current state.\n\nA new value can be computed from the variable's current value. This is different from assigning a plain literal. The right-hand side of the assignment reads the variable first, then writes the computed result back.",
        instruction:
          "Update x so that its new value is 15, but compute the new value from x's current value. Do NOT write `x = 15;` directly - that ignores the current state. Use an expression such as `x + something` on the right-hand side.",
        observationPrompt:
          "In the variable panel, look at the previousValue and value of the transition. The event should show 10 -> 15, produced by an expression that used x itself.",
      },
      code: {
        starterSource:
          "int main() {\n    int x = 10;\n    // Make x become 15 by using its current value\n    return 0;\n}\n",
      },
      objectives: [
        {
          id: "obj-x-updated",
          type: "entity_value_changed",
          displayName: "x",
          from: 10,
          to: 15,
        },
        {
          id: "obj-run",
          type: "execution_completed",
        },
      ],
    },

    // -----------------------------------------------------------------------
    // Step 4: Follow Multiple State Changes
    // Learning outcome: Program execution is a sequence of state transitions.
    // -----------------------------------------------------------------------
    {
      id: "step-4-follow",
      title: "Follow Multiple State Changes",
      content: {
        explanation:
          "Learning outcome: program execution is a sequence of state transitions.\n\nA program is not a single snapshot. It is a sequence of moments, and a variable's value can move through several stages during execution. PRISM records each transition and lets you scrub through them to watch the state change over time.",
        instruction:
          "Starting from x = 10, change x twice: first to 20, then to 30. When you run, the timeline should record two distinct transitions on x.",
        observationPrompt:
          "After running, click each satisfied objective's 'jump to evidence' link. Each link takes you to a different moment in the timeline where that specific transition happened. Notice that the two transitions occupy different snapshots.",
      },
      code: {
        starterSource:
          "int main() {\n    int x = 10;\n    // Change x to 20, then change x again to 30\n    return 0;\n}\n",
      },
      objectives: [
        {
          id: "obj-x-10-to-20",
          type: "entity_value_changed",
          displayName: "x",
          from: 10,
          to: 20,
        },
        {
          id: "obj-x-20-to-30",
          type: "entity_value_changed",
          displayName: "x",
          from: 20,
          to: 30,
        },
        {
          id: "obj-run",
          type: "execution_completed",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// The smoke-test lesson (kept from Milestone 2.13b)
// ---------------------------------------------------------------------------

const TEST_LESSON: LessonDefinition = {
  id: "cpp-variable-basics-test",
  version: "0.0.1",
  title: "Variable Basics (Test Lesson)",
  description:
    "A minimal two-step lesson used as a smoke test for the lesson workspace pipeline. Kept alongside the real Sprint 2 lesson so future workspace changes can be validated against a small predictable target.",
  languageId: "cpp",
  steps: [
    {
      id: "step-1-create",
      title: "Create a variable",
      content: {
        explanation:
          "In C++, a variable is a named storage location that holds a value while the program runs. Create an int variable named x and give it the value 10.",
        instruction: "Declare int x = 10; inside main.",
        observationPrompt:
          "After running, look at the variable panel. Does x exist?",
      },
      code: {
        starterSource:
          "int main() {\n    // Create an int variable named x with value 10\n    return 0;\n}\n",
      },
      objectives: [
        { id: "obj-x-exists", type: "entity_exists", displayName: "x" },
        { id: "obj-run", type: "execution_completed" },
      ],
    },
    {
      id: "step-2-change",
      title: "Change the variable",
      content: {
        explanation:
          "A variable can be reassigned. After creating x with 10, change it to 20.",
        instruction: "Assign x = 20; on a new line after the declaration.",
        observationPrompt:
          "Step through the timeline. Do you see x transition from 10 to 20?",
      },
      code: {
        starterSource:
          "int main() {\n    int x = 10;\n    // Change x to 20 here\n    return 0;\n}\n",
      },
      objectives: [
        {
          id: "obj-x-changed",
          type: "entity_value_changed",
          displayName: "x",
          from: 10,
          to: 20,
        },
        { id: "obj-run", type: "execution_completed" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const loader = new StaticLessonLoader([
  UNDERSTANDING_VARIABLE_STATE,
  TEST_LESSON,
]);

export function getLessonLoader(): StaticLessonLoader {
  return loader;
}

export function knownLessonIds(): string[] {
  return loader.knownLessonIds();
}