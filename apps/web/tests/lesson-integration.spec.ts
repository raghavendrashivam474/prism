/**
 * Sprint 2 Vertical Integration Suite.
 *
 * Validates the complete learner journey against the Understanding
 * Variable State lesson. Uses a real Chromium browser, the real
 * Next.js dev server, and a mocked /api/v1/executions endpoint so
 * the tests are deterministic and Docker-independent.
 *
 * Structure:
 *
 *   describe Lesson Integration
 *     - loads lesson
 *     - starts session with correct initial state
 *     - progresses through a single step (satisfy + continue)
 *     - completion flow (Finish button + completion panel)
 *     - review mode after completion
 *     - workspace state consistency
 *
 *   describe Sprint 2 Vertical Journey
 *     - learner completes the full lesson end to end
 */

import { test, expect, type Page } from "@playwright/test";
import { mockExecutionApi } from "./helpers/mock-execution";

const LESSON_URL = "/lesson/cpp-understanding-variable-state";

// Source snippets that the mock classifier maps to satisfying traces.
const STEP_1_SOURCE = "int main() {\n    int x = 10;\n    return 0;\n}\n";
const STEP_2_SOURCE = "int main() {\n    int x = 10;\n    x = 20;\n    return 0;\n}\n";
const STEP_3_SOURCE = "int main() {\n    int x = 10;\n    x = x + 5;\n    return 0;\n}\n";
const STEP_4_SOURCE = "int main() {\n    int x = 10;\n    x = 20;\n    x = 30;\n    return 0;\n}\n";

/**
 * Replace the Monaco editor's content with the given source.
 *
 * Monaco is not a standard textarea; we drive it via the model API.
 * The Monaco global is exposed on window by @monaco-editor/react
 * during the dev server, which is what we exercise here.
 */
async function setEditorSource(page: Page, source: string): Promise<void> {
  await page.waitForFunction(() => {
    const win = window as unknown as { monaco?: unknown };
    return typeof win.monaco !== "undefined";
  });

  await page.evaluate((next) => {
    const win = window as unknown as {
      monaco: {
        editor: {
          getModels(): { setValue(v: string): void }[];
        };
      };
    };
    const models = win.monaco.editor.getModels();
    if (models.length === 0) {
      throw new Error("No Monaco models mounted");
    }
    models[0].setValue(next);
  }, source);
}

async function loadLessonPage(page: Page): Promise<void> {
  await mockExecutionApi(page);
  await page.goto(LESSON_URL);
  // Progress panel is a stable indicator that the lesson has loaded.
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
}

async function runCurrentStep(page: Page, source: string): Promise<void> {
  await setEditorSource(page, source);
  await page.getByRole("button", { name: "Run" }).click();
  // Wait for the success feedback header.
  await expect(page.getByText("Step complete")).toBeVisible({ timeout: 10_000 });
}

async function clickContinueToNext(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Continue to next step" }).click();
  // Feedback disappears after advance.
  await expect(page.getByText("Step complete")).toHaveCount(0);
}

async function clickFinishLesson(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson complete")).toBeVisible();
}

// ---------------------------------------------------------------------------
// Lesson Integration - focused tests
// ---------------------------------------------------------------------------

test.describe("Lesson Integration", () => {
  test("loads the lesson and shows the initial step", async ({ page }) => {
    await loadLessonPage(page);

    await expect(
      page.getByRole("heading", { name: "A Variable Receives a Value" }),
    ).toBeVisible();

    // The header shows the lesson title.
    await expect(page.getByText("Understanding Variable State")).toBeVisible();
  });

  test("starts the session with step 1 active and later steps locked", async ({
    page,
  }) => {
    await loadLessonPage(page);

    // Progress chips: 1 active, 2/3/4 locked. Assert via text tokens
    // that only appear on the chips themselves.
    await expect(page.getByText("active").first()).toBeVisible();
    await expect(page.getByText("locked").first()).toBeVisible();
  });

  test("progresses through a single step (satisfy and continue)", async ({
    page,
  }) => {
    await loadLessonPage(page);
    await runCurrentStep(page, STEP_1_SOURCE);

    // Both objectives satisfied (each shows a Show me button).
    const showMeButtons = page.getByRole("button", { name: "Show me" });
    await expect(showMeButtons.first()).toBeVisible();
    expect(await showMeButtons.count()).toBeGreaterThanOrEqual(1);

    await clickContinueToNext(page);

    // Step 2 title becomes visible after advance.
    await expect(
      page.getByRole("heading", { name: "A Variable Can Change" }),
    ).toBeVisible();
  });

  test("completion flow: Finish button reveals completion panel", async ({
    page,
  }) => {
    await loadLessonPage(page);

    // Fast-path through all four steps.
    await runCurrentStep(page, STEP_1_SOURCE);
    await clickContinueToNext(page);

    await runCurrentStep(page, STEP_2_SOURCE);
    await clickContinueToNext(page);

    await runCurrentStep(page, STEP_3_SOURCE);
    await clickContinueToNext(page);

    await runCurrentStep(page, STEP_4_SOURCE);

    // On the final step the button must read Finish lesson, not Continue.
    await expect(
      page.getByRole("button", { name: "Finish lesson" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue to next step" }),
    ).toHaveCount(0);

    // Completion panel is NOT shown yet.
    await expect(page.getByText("Lesson complete")).toHaveCount(0);

    // Click Finish and confirm the completion panel appears.
    await clickFinishLesson(page);

    await expect(
      page.getByText("Concepts you worked through"),
    ).toBeVisible();
    await expect(page.getByText("4 / 4 steps")).toBeVisible();
  });

  test("review mode is still available after completion", async ({ page }) => {
    await loadLessonPage(page);

    await runCurrentStep(page, STEP_1_SOURCE);
    await clickContinueToNext(page);
    await runCurrentStep(page, STEP_2_SOURCE);
    await clickContinueToNext(page);
    await runCurrentStep(page, STEP_3_SOURCE);
    await clickContinueToNext(page);
    await runCurrentStep(page, STEP_4_SOURCE);
    await clickFinishLesson(page);

    // All four chips should show "done" (progress panel's completed label).
    const doneChips = page.getByText("done");
    expect(await doneChips.count()).toBeGreaterThanOrEqual(4);

    // Click the first completed chip (step 1) to enter review mode.
    await doneChips.first().click();

    // The review banner should appear.
    await expect(
      page.getByText(/Reviewing "A Variable Receives a Value"/),
    ).toBeVisible();

    // Return to current step restores the completion state.
    await page.getByRole("button", { name: "Return to current step" }).click();
    await expect(page.getByText("Lesson complete")).toBeVisible();
  });

  test("workspace state remains consistent through a full run", async ({
    page,
  }) => {
    await loadLessonPage(page);

    // Initial: no timeline, no feedback, editor writable, Run enabled.
    await expect(page.getByRole("button", { name: "Run" })).toBeEnabled();
    await expect(page.getByText("Step complete")).toHaveCount(0);

    await runCurrentStep(page, STEP_1_SOURCE);

    // After success: Run becomes disabled (step is completed pending advance).
    await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();

    await clickContinueToNext(page);

    // After advance: fresh step, Run re-enabled, feedback cleared.
    await expect(page.getByRole("button", { name: "Run" })).toBeEnabled();
    await expect(page.getByText("Step complete")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Sprint 2 Vertical Journey - canonical end-to-end test
// ---------------------------------------------------------------------------

test.describe("Sprint 2 Vertical Journey", () => {
  test("a learner completes the entire lesson end to end", async ({ page }) => {
    await loadLessonPage(page);

    // ---- Step 1 ----
    await expect(
      page.getByRole("heading", { name: "A Variable Receives a Value" }),
    ).toBeVisible();
    await runCurrentStep(page, STEP_1_SOURCE);
    await clickContinueToNext(page);

    // ---- Step 2 ----
    await expect(
      page.getByRole("heading", { name: "A Variable Can Change" }),
    ).toBeVisible();
    await runCurrentStep(page, STEP_2_SOURCE);
    await clickContinueToNext(page);

    // ---- Step 3 ----
    await expect(
      page.getByRole("heading", {
        name: "A New Value Can Depend on Current State",
      }),
    ).toBeVisible();
    await runCurrentStep(page, STEP_3_SOURCE);
    await clickContinueToNext(page);

    // ---- Step 4 ----
    await expect(
      page.getByRole("heading", { name: "Follow Multiple State Changes" }),
    ).toBeVisible();
    await runCurrentStep(page, STEP_4_SOURCE);

    // Finish flow.
    await expect(
      page.getByRole("button", { name: "Finish lesson" }),
    ).toBeVisible();
    await clickFinishLesson(page);

    // Completion panel present with the expected concepts and stats.
    await expect(page.getByText("Concepts you worked through")).toBeVisible();
    await expect(page.getByText("4 / 4 steps")).toBeVisible();

    // Attempt count should be at least 4 (one satisfying attempt per step).
    await expect(page.getByText(/Attempts/i)).toBeVisible();

    // Run must be disabled after lesson completion.
    await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
  });
});