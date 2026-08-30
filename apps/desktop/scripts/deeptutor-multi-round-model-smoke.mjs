import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-multi-round-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-deeptutor-multi-round-db-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'multi-round.mjs');
    await build({
      stdin: {
        contents: "export { runDeepSeekChat } from './src/main/deepseek'; export { OmniEduStore } from './src/main/db'; export { routeAiPrompt } from './src/main/ai-harness/router';",
        resolveDir: appRoot,
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      external: ['sqlite3'],
      logLevel: 'silent',
    });
    const { OmniEduStore, routeAiPrompt, runDeepSeekChat } = await import(pathToFileURL(outfile).href);
    const store = new OmniEduStore(dataRoot);
    await store.init();
    const router = routeAiPrompt('请根据小A最近的学习记录设计数学三元题组', { hasStudent: false });
    const baseContext = () => ({
      store,
      prompt: '请根据小A最近的学习记录设计数学三元题组',
      router,
      records: [],
      knowledgeSnippets: [],
      graphNodes: [],
      similarQuestions: [],
      sources: [],
      toolRuns: [],
      selectedContext: router.contextPolicy.include,
      trace: [],
    });
    const reply = () => ({
      schemaVersion: 'xiazhi.reply.v2',
      route: router.route,
      subIntent: router.subIntent,
      answerMarkdown: '## 原题\\n基于已读取证据。\\n## 相似题\\n用于巩固。\\n## 变式题\\n用于迁移。',
      facts: [],
      evidence: [],
      inferences: [],
      unknowns: ['本地样例记录不足，需老师继续补充证据。'],
      risks: [{ level: 'normal', category: 'evidence_gap', mitigation: '老师确认题目和证据范围。' }],
      teacherConfirmations: [],
      nextActions: ['请老师核对题干与难度。'],
      artifacts: [],
      routeCheck: { kind: router.route, passed: true, notes: [] },
      processSummary: ['已执行多轮工具观察。'],
    });
    const toolCall = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });

    let calls = [
      { choices: [{ message: { content: null, tool_calls: [toolCall('r1', 'resolve_student_reference', { studentName: '小A' })] } }] },
      { choices: [{ message: { content: null, tool_calls: [toolCall('r2', 'search_learning_records', { limit: 8 })] } }] },
      { choices: [{ message: { content: JSON.stringify(reply()), tool_calls: [] } }] },
    ];
    let index = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => calls[index++] ?? calls[calls.length - 1] });
    try {
      const result = await runDeepSeekChat(baseContext(), 'test-key', 'fake-model');
      assert.equal(result.ok, true, result.errorMessage);
      assert.equal(index, 3, 'two tool rounds should require two observations and one final response');
      assert.ok(result.toolRuns.some((item) => item.name === 'resolve_student_reference'));
      assert.ok(result.toolRuns.some((item) => item.name === 'search_learning_records'));
      assert.ok(result.harness?.trace.some((step) => step.label.includes('第 2 轮工具计划')));

      calls = [
        { choices: [{ message: { content: null, tool_calls: [toolCall('b1', 'resolve_student_reference', { studentName: '小A' })] } }] },
        { choices: [{ message: { content: null, tool_calls: [toolCall('b2', 'search_learning_records', { limit: 8 })] } }] },
        { choices: [{ message: { content: null, tool_calls: [toolCall('b3', 'search_learning_records', { limit: 8 })] } }] },
        { choices: [{ message: { content: null, tool_calls: [toolCall('b4', 'search_learning_records', { limit: 8 })] } }] },
        { choices: [{ message: { content: JSON.stringify(reply()), tool_calls: [] } }] },
      ];
      index = 0;
      const bounded = await runDeepSeekChat(baseContext(), 'test-key', 'fake-model');
      assert.equal(bounded.ok, true, bounded.errorMessage);
      assert.equal(index, 5, 'hard-stop path should request one final no-tool response after the cap');
      const guardrail = bounded.harness?.trace.find((step) => step.label.includes('工具预算硬终止'));
      assert.ok(guardrail, 'tool budget hard stop must be observable');
      assert.equal(guardrail.outputSummary?.hardStop, true);

      console.log(JSON.stringify({
        ok: true,
        cases: 10,
        multiRoundSucceeded: true,
        observedToolRounds: 2,
        toolsReviewedByHost: 2,
        hardStopObservable: true,
        hardStopFinalized: true,
      }));
    } finally {
      globalThis.fetch = originalFetch;
    }
    await store.close();
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
    rmSync(dataRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
