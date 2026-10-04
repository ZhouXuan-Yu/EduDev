import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';

const output = join(process.cwd(), '.triplet-graph-smoke.mjs');
await build({ entryPoints: ['src/main/ai-harness/triplet-graph.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
try {
  const { isTripletGraphRequest, runTripletGraph, TRIPLET_GRAPH_VERSION } = await import(`file:///${output.replaceAll('\\', '/')}`);
  const prompt = '请分析当前学生的错题，并基于以下脱敏题目文本检索本地相似题，生成原题、相似题、变式题三元题组草稿。只使用可验证来源，保留 generated/source 标记，不要自动保存。\n\n脱敏题目：\n求 2 + 3。';
  const store = {
    runs: [], events: [], completed: [], results: [], searches: 0,
    async startAiAgentRun(input) { this.runs.push(input); return 'run-1'; },
    async recordAiAgentEvent(id, event) { this.events.push({ id, event }); },
    async completeAiAgentRun(id, status, error) { this.completed.push({ id, status, error }); },
    async recordAiConsoleRun(input, result) { this.results.push({ input, result }); },
    async searchQuestionBank() { this.searches += 1; return []; },
    async sanitizeProblemText(text) { return { sanitizedText: text, redactions: [], containsSensitiveData: false }; },
  };
  const input = { prompt, intent: 'mistake_triplet', sessionId: 'session-1', studentId: 'student-1' };
  const noKey = await runTripletGraph({ store, input, model: 'test-model', checkpoint: false });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.harness.harnessVersion, TRIPLET_GRAPH_VERSION);
  assert.equal(store.searches, 0);
  assert.equal(store.completed[0].status, 'failed');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"schemaVersion":"invalid"}' } }] }) });
  try {
    const badSchema = await runTripletGraph({ store, input, model: 'test-model', apiKey: 'test-only-key', checkpoint: false });
    assert.equal(badSchema.ok, false);
    assert.equal(store.searches, 1);
    assert.equal(store.completed[1].status, 'failed');
    assert.ok(store.events.some(({ event }) => event.phase === 'guardrail' && event.status === 'blocked'));
  } finally {
    globalThis.fetch = originalFetch;
  }
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  try {
    const offline = await runTripletGraph({ store, input, model: 'test-model', apiKey: 'test-only-key', checkpoint: false });
    assert.equal(offline.ok, false);
    assert.match(offline.errorMessage, /无法连接 DeepSeek API/);
    assert.doesNotMatch(offline.errorMessage, /test-only-key|TypeError: fetch failed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const validReply = {
    schemaVersion: 'xiazhi.reply.v2', route: 'practice_design', subIntent: 'triplet_practice',
    answerMarkdown: '## 原题\n求 2 + 3。\n## 相似题\n求 3 + 4。\n## 变式题\n求 2 + 3 + 4。\n本地题库未命中，以上为 generated 草稿，答案与解析请教师校正。',
    facts: [], evidence: [], inferences: [], unknowns: ['本地题库未命中相似题。'],
    risks: [{ level: 'normal', category: 'evidence_gap', mitigation: '不将生成题标记为本地题库来源。' }],
    teacherConfirmations: ['保存题组前请教师确认。'], nextActions: ['请老师校正题干、答案与解析。'],
    artifacts: [], routeCheck: { kind: 'practice_design', passed: true, notes: ['题组草稿已通过路由检查。'] },
    processSummary: ['检索本地题库，没有命中。'],
    exerciseSetDraft: {
      title: '加法三元题组', subject: '数学', knowledgePoint: '整数加法', contentMd: '原题、相似题、变式题',
      items: ['original', 'similar', 'variant'].map((role, index) => ({ role, sourceKind: 'generated', stem: `求 ${index + 2} + 3。`, answer: String(index + 5), analysis: '按整数加法计算。', knowledgePoint: '整数加法', difficulty: 'easy', teacherObservation: '请老师检查。' })),
    },
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(validReply) } }] }) });
  try {
    const success = await runTripletGraph({ store, input, model: 'test-model', apiKey: 'test-only-key', checkpoint: false });
    assert.equal(success.ok, true, success.errorMessage);
    assert.equal(success.harness.schemaValid, true);
    assert.ok(success.structuredReply.artifacts.some((item) => item.type === 'exercise_set' && item.requiresTeacherConfirmation));
    assert.equal(store.completed[3].status, 'succeeded');
  } finally {
    globalThis.fetch = originalFetch;
  }
  const fixableReply = structuredClone(validReply);
  fixableReply.exerciseSetDraft.items[0].role = '原题';
  fixableReply.exerciseSetDraft.items[0].difficulty = '简单';
  let repairRequests = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(++repairRequests === 1 ? fixableReply : validReply) } }] }) });
  try {
    const repaired = await runTripletGraph({ store, input, model: 'test-model', apiKey: 'test-only-key', checkpoint: false });
    assert.equal(repaired.ok, true, repaired.errorMessage);
    assert.equal(repairRequests, 2, 'invalid model enum must trigger one bounded repair request');
    assert.ok(repaired.harness.trace.some((event) => event.label === '结构化草稿受控修复' && event.status === 'succeeded'));
  } finally {
    globalThis.fetch = originalFetch;
  }
  const forgedSourceReply = structuredClone(validReply);
  forgedSourceReply.exerciseSetDraft.items[0].sourceKind = 'local_bank';
  forgedSourceReply.exerciseSetDraft.items[0].questionId = 'not-in-local-retrieval';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(forgedSourceReply) } }] }) });
  try {
    const forged = await runTripletGraph({ store, input, model: 'test-model', apiKey: 'test-only-key', checkpoint: false });
    assert.equal(forged.ok, false);
    assert.match(forged.errorMessage, /本地题库来源未在本轮召回/);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(isTripletGraphRequest('你好', 'mistake_triplet'), false);
  console.log('Triplet LangGraph smoke: missing-key, invalid-schema, network-failure, generated-draft, bounded-repair, and forged-source paths passed.');
} finally {
  await unlink(output).catch(() => {});
}
