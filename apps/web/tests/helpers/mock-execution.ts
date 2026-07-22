/**
 * Playwright helper that mocks the /api/v1/executions endpoint.
 *
 * The mock inspects the submitted source code and returns the right
 * canned trace for each of the four Understanding Variable State
 * lesson steps. Any source that does not match a known pattern falls
 * through to a generic empty-success trace so tests do not silently
 * hit the real backend.
 */

import type { Page, Route } from "@playwright/test";
import {
  traceForStep1Success,
  traceForStep2Success,
  traceForStep3Success,
  traceForStep4Success,
  type RawTrace,
} from "./traces";

/**
 * Best-effort classification of learner source into a step trace.
 *
 * The lesson steps expect these solutions:
 *   Step 1: creates x with value 10 (no reassignment)
 *   Step 2: reassigns x from 10 to 20 (single direct assignment)
 *   Step 3: reassigns x using an expression involving x itself (10 -> 15)
 *   Step 4: two direct changes: 10 -> 20 and 20 -> 30
 *
 * Detection is heuristic. We do not compile the code; we only pick
 * the right canned trace based on source patterns that clearly
 * indicate the learner's intent.
 */
function classifySource(source: string): RawTrace {
  const s = source.replace(/\s+/g, "");

  // Step 4: two assignments producing 10 -> 20 -> 30
  //   accepts "x=20;x=30;", "x=2*x;x=x+10;", or any pair that clearly
  //   produces two transitions to 20 then 30
  const hasTo20 = /x=20;|x=2\*x;|x=x\+10;/.test(s) && /x=10/.test(s);
  const hasTo30 = /x=30;|x=x\+10;|x=20\+10;/.test(s);
  if (hasTo20 && hasTo30) {
    return traceForStep4Success();
  }

  // Step 3: uses x on the right-hand side to become 15
  //   accepts "x=x+5;", "x=5+x;"
  if (/x=x\+5;|x=5\+x;/.test(s) && /x=10/.test(s)) {
    return traceForStep3Success();
  }

  // Step 2: reassigns x to 20 (direct)
  if (/x=20;/.test(s) && /x=10/.test(s)) {
    return traceForStep2Success();
  }

  // Step 1: creates x = 10 (no reassignment)
  if (/intx=10;/.test(s)) {
    return traceForStep1Success();
  }

  // Fallback: minimal successful trace (no variables, program just runs)
  return {
    irVersion: "0.1",
    executionId: "test-fallback",
    languageId: "cpp",
    events: [
      {
        irVersion: "0.1",
        sequence: 1,
        type: "execution.started",
        source: { line: 1 },
        payload: {},
      },
      {
        irVersion: "0.1",
        sequence: 2,
        type: "execution.completed",
        source: { line: 1 },
        payload: {},
      },
    ],
  };
}

/**
 * Install the mock. Call this once per test, typically inside
 * beforeEach or at the top of an it() block, BEFORE navigating.
 */
export async function mockExecutionApi(page: Page): Promise<void> {
  await page.route(
    /\/api\/v1\/executions$/,
    async (route: Route) => {
      const request = route.request();
      let source = "";
      try {
        const body = request.postData();
        if (body) {
          const parsed = JSON.parse(body) as { source?: string };
          source = parsed.source ?? "";
        }
      } catch {
        source = "";
      }

      const trace = classifySource(source);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
        },
        body: JSON.stringify({ trace }),
      });
    },
  );
}