/**
 * Lesson registry for the web app - Milestone 2.13b.
 *
 * This is a temporary in-app inline lesson used ONLY to exercise the
 * lesson workspace composition. The real Sprint 2 lesson
 * (cpp-understanding-variable-state) is delivered by Milestone 2.14
 * and will replace this content.
 *
 * The lesson uses only the Sprint 0 supported C++ profile:
 *   - int main()
 *   - local int variables
 *   - assignment
 *   - integer arithmetic
 *   - return 0
 *
 * The registry exposes a StaticLessonLoader singleton so both the
 * hook and any future preview UIs pull from the same source of truth.
 */

import {
  StaticLessonLoader,
  type LessonDefinition,
} from "@prism/lessons";

// A minimal two-step lesson that exercises:
//   - starter code shown in the editor
//   - entity_exists objective
//   - entity_value_changed objective
//   - execution_completed objective
//   - a step transition on satisfying attempts
const TEST_LESSON: LessonDefinition = {
  id: "cpp-variable-basics-test",
  version: "0.0.1",
  title: "Variable Basics (Test Lesson)",
  description:
    "A temporary test lesson used to verify the Sprint 2 lesson workspace composition. Replaced by the real lesson in Milestone 2.14.",
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
        {
          id: "obj-run",
          type: "execution_completed",
        },
      ],
    },
  ],
};

const loader = new StaticLessonLoader([TEST_LESSON]);

export function getLessonLoader(): StaticLessonLoader {
  return loader;
}

export function knownLessonIds(): string[] {
  return loader.knownLessonIds();
}
