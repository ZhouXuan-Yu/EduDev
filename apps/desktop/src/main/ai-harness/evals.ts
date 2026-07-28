import type { AiHarnessEvalReport } from '../../shared/contracts';
import { AI_HARNESS_EVAL_CASES } from './eval-cases';
import { routeAiPrompt } from './router';

export function runAiHarnessEvalSuite(): AiHarnessEvalReport {
  const cases = AI_HARNESS_EVAL_CASES.map((testCase) => {
    const decision = routeAiPrompt(testCase.prompt, { hasStudent: true });
    const actualTools = decision.allowedTools;
    const missingTools = testCase.expectedTools.filter((tool) => !actualTools.includes(tool));
    const forbiddenToolsUsed = testCase.forbiddenTools.filter((tool) => actualTools.includes(tool));
    const passed = decision.route === testCase.expectedRoute && missingTools.length === 0 && forbiddenToolsUsed.length === 0;
    return {
      id: testCase.id,
      prompt: testCase.prompt,
      expectedRoute: testCase.expectedRoute,
      actualRoute: decision.route,
      passed,
      expectedTools: testCase.expectedTools,
      actualTools,
      missingTools,
      forbiddenToolsUsed,
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
