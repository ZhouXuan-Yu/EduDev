import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-progressive-tools-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-progressive-tools-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'progressive-tools.mjs');
    await build({
      stdin: {
        contents: `
          export { OmniEduStore } from './src/main/db';
          export { routeAiPrompt } from './src/main/ai-harness/router';
          export {
            createAiToolExecutionState,
            executeAiToolCall,
            getModelToolDefinitions,
            getProgressiveModelToolDefinitions,
          } from './src/main/ai-harness/tool-registry';
          export { runDeepSeekChat } from './src/main/deepseek';
        `,
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
    const {
      OmniEduStore,
      routeAiPrompt,
      createAiToolExecutionState,
      executeAiToolCall,
      getModelToolDefinitions,
      getProgressiveModelToolDefinitions,
      runDeepSeekChat,
    } = await import(pathToFileURL(outfile).href);

    const store = new OmniEduStore(dataRoot);
    await store.init();
    const practice = routeAiPrompt('请根据小A最近的学习记录设计数学三元题组', { hasStudent: false });
    const initial = getProgressiveModelToolDefinitions(practice).map((tool) => tool.function.name);
    assert.ok(initial.includes('load_tools'), 'progressive registry must expose loader');
    assert.ok(initial.includes('resolve_student_reference'), 'student reference resolver is a safe core tool');
    assert.equal(initial.includes('search_learning_records'), false, 'large learning schema must not be exposed initially');

    const state = createAiToolExecutionState(practice);
    const loaded = await executeAiToolCall({
      store,
      prompt: '请根据小A最近的学习记录设计数学三元题组',
      router: practice,
      state,
      call: { name: 'load_tools', arguments: { groups: ['learning'] } },
    });
    assert.equal(loaded.review.ok, true);
    assert.equal(loaded.toolRun.status, 'used');
    assert.equal(loaded.modelResult.toolsExecuted, false);
    assert.ok(loaded.modelResult.loadedToolNames.includes('search_learning_records'));
    const expanded = getModelToolDefinitions(practice, {
      includeLoader: true,
      toolNames: ['load_tools', ...loaded.modelResult.loadedToolNames],
    }).map((tool) => tool.function.name);
    assert.ok(expanded.includes('search_learning_records'), 'loaded schema must be visible on the next round');

    const knowledge = routeAiPrompt('查找老师知识库中关于一次函数的资料', { hasStudent: false });
    const forbiddenLoad = await executeAiToolCall({
      store,
      prompt: '查找老师知识库中关于一次函数的资料',
      router: knowledge,
      state: createAiToolExecutionState(knowledge),
      call: { name: 'load_tools', arguments: { groups: ['student'] } },
    });
    assert.equal(forbiddenLoad.review.ok, true, 'loader itself is route-safe');
    assert.equal(forbiddenLoad.toolRun.status, 'blocked', 'disallowed tool group must not load');
    assert.equal(forbiddenLoad.modelResult.loadedToolNames.length, 0);
    assert.equal(forbiddenLoad.modelResult.toolDefinitions.some((tool) => tool.function.name === 'get_student_profile'), false);

    const reply = {
      schemaVersion: 'xiazhi.reply.v2',
      route: practice.route,
      subIntent: practice.subIntent,
      answerMarkdown: '## 原题\\n已读取证据。\\n## 相似题\\n用于巩固。\\n## 变式题\\n用于迁移。',
      facts: [], evidence: [], inferences: [], unknowns: ['当前本地记录不足，需老师复核。'],
      risks: [{ level: 'normal', category: 'evidence_gap', mitigation: '老师确认题目范围。' }],
      teacherConfirmations: [], nextActions: ['请老师确认。'], artifacts: [],
      routeCheck: { kind: practice.route, passed: true, notes: [] },
      processSummary: ['先加载必要工具，再执行学生证据读取。'],
    };
    const toolCall = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
    const responses = [
      { choices: [{ message: { content: null, tool_calls: [toolCall('p1', 'load_tools', { groups: ['learning'] })] } }] },
      { choices: [{ message: { content: null, tool_calls: [toolCall('p2', 'search_learning_records', { limit: 8 })] } }] },
      { choices: [{ message: { content: JSON.stringify(reply), tool_calls: [] } }] },
    ];
    const requestBodies = [];
    let responseIndex = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      requestBodies.push(JSON.parse(options.body));
      return { ok: true, status: 200, json: async () => responses[responseIndex++] };
    };
    try {
      const result = await runDeepSeekChat({
        store,
        prompt: '请根据小A最近的学习记录设计数学三元题组',
        router: practice,
        records: [], knowledgeSnippets: [], graphNodes: [], similarQuestions: [], sources: [], toolRuns: [],
        selectedContext: practice.contextPolicy.include,
        trace: [],
      }, 'test-key', 'fake-model');
      assert.equal(result.ok, true, result.errorMessage);
      assert.equal(requestBodies.length, 3);
      const firstNames = requestBodies[0].tools.map((tool) => tool.function.name);
      const secondNames = requestBodies[1].tools.map((tool) => tool.function.name);
      assert.equal(firstNames.includes('search_learning_records'), false);
      assert.equal(secondNames.includes('search_learning_records'), true);
      assert.ok(result.harness.trace.some((step) => step.label.includes('按需工具 schema 已加载')));
      assert.ok(result.toolRuns.some((tool) => tool.name === 'load_tools' && tool.outputSummary?.toolsExecuted === false));
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log(JSON.stringify({
      ok: true,
      cases: 18,
      initialSchemasGated: true,
      loadedSchemasExpanded: true,
      routePermissionPreserved: true,
      toolExecutionDeferred: true,
      deepSeekLoopVerified: true,
    }));
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
