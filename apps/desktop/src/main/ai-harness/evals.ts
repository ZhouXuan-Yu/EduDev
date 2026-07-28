import type { AiHarnessEvalReport } from '../../shared/contracts';
import { AI_HARNESS_EVAL_CASES } from './eval-cases';
import { routeAiPrompt } from './router';

export function runAiHarnessEvalSuite(): AiHarnessEvalReport {
  const cases = AI_HARNESS_EVAL_CASES.map((testCase) => {
    const decision = routeAiPrompt(testCase.prompt, { hasStudent: testCase.hasStudent ?? true });
    const actualTools = decision.allowedTools;
    const missingTools = testCase.expectedTools.filter((tool) => !actualTools.includes(tool));
    const forbiddenToolsUsed = testCase.forbiddenTools.filter((tool) => actualTools.includes(tool));
    const slotErrors = Object.entries(testCase.expectedSlots ?? {})
      .filter(([key, expectedValue]) => decision.slots[key as keyof typeof decision.slots] !== expectedValue)
      .map(([key, expectedValue]) =>
        `${key}: expected ${String(expectedValue)}, got ${String(decision.slots[key as keyof typeof decision.slots])}`,
      );
    const expectedClarification = testCase.expectedClarification ?? false;
    const actualClarification = Boolean(decision.clarificationQuestion);
    const passed = decision.route === testCase.expectedRoute
      && decision.subIntent === testCase.expectedSubIntent
      && missingTools.length === 0
      && forbiddenToolsUsed.length === 0
      && slotErrors.length === 0
      && actualClarification === expectedClarification;
    return {
      id: testCase.id,
      prompt: testCase.prompt,
      expectedRoute: testCase.expectedRoute,
      actualRoute: decision.route,
      expectedSubIntent: testCase.expectedSubIntent,
      actualSubIntent: decision.subIntent,
      passed,
      expectedTools: testCase.expectedTools,
      actualTools,
      missingTools,
      forbiddenToolsUsed,
      slotErrors,
      expectedClarification,
      actualClarification,
    };
  });
  const passed = cases.filter((item) => item.passed).length;
  const total = cases.length;
  return {
    ok: passed === total,
    total,
    passed,
    failed: total - passed,
    routeAccuracy: total ? passed / total : 0,
    cases,
  };
}
