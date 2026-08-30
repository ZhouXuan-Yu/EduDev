import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-review-queue-'));

const student = {
  id: 's1', displayName: '小A', realName: '', grade: '五年级', school: '', subjects: ['数学'], goals: '', currentIssues: '',
  parentConcerns: '', teacherNotes: '', tags: [], status: 'active', createdAt: '', updatedAt: '', recordCount: 2, attachmentBytes: 0,
};
const now = Date.now();
const records = [
  { id: 'r1', studentId: 's1', recordType: 'mastery_attempt', subject: '数学', title: '一次函数', content: JSON.stringify({ knowledgePoint: '一次函数', knowledgeType: 'procedure', isCorrect: true }), summary: '', tags: ['mastery_attempt'], occurredAt: new Date(now - 8 * 86_400_000).toISOString(), createdAt: '', updatedAt: '', attachments: [] },
  { id: 'r2', studentId: 's1', recordType: 'mastery_attempt', subject: '数学', title: '分数', content: JSON.stringify({ knowledgePoint: '分数', knowledgeType: 'memory', isCorrect: false }), summary: '', tags: ['mastery_attempt'], occurredAt: new Date(now - 2 * 86_400_000).toISOString(), createdAt: '', updatedAt: '', attachments: [] },
];

async function run() {
  try {
    await build({
      entryPoints: [join(appRoot, 'src/main/ai-harness/tool-registry.ts'), join(appRoot, 'src/main/ai-harness/router.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outdir: bundleRoot,
      splitting: false,
      outExtension: { '.js': '.mjs' },
      logLevel: 'silent',
    });
    const registry = await import(pathToFileURL(join(bundleRoot, 'tool-registry.mjs')).href);
    const routerModule = await import(pathToFileURL(join(bundleRoot, 'router.mjs')).href);
    const router = routerModule.routeAiPrompt('查看当前学生今天到期的复习队列', { hasStudent: true });
    assert.equal(router.route, 'student_diagnosis');
    assert.equal(router.subIntent, 'review_queue');
    assert.ok(router.allowedTools.includes('get_review_queue'));
    const state = registry.createAiToolExecutionState(router, { resolvedStudentId: 's1' });
    const store = {
      listStudents: async () => [student],
      listRecords: async () => records,
      getAiMasteryPath: async () => null,
    };
    const result = await registry.executeAiToolCall({
      store,
      prompt: '查看当前学生今天到期的复习队列',
      router,
      state,
      call: { name: 'get_review_queue', arguments: { studentId: 's1', limit: 20, timezone: 'Asia/Shanghai' } },
    });
    assert.equal(result.review.ok, true);
    assert.equal(result.toolRun.status, 'used');
    assert.equal(result.modelResult.schemaVersion, 'omni.review.queue.v1');
    assert.equal(result.modelResult.timezoneInvariant, true);
    assert.equal(result.modelResult.rawRecordsIncluded, false);
    assert.ok(Array.isArray(result.modelResult.queue));
    assert.ok(result.modelResult.queue.every((item) => typeof item.id === 'string' && !('content' in item)));

    const missing = await registry.executeAiToolCall({
      store,
      prompt: '查看复习队列',
      router,
      state: registry.createAiToolExecutionState(router),
      call: { name: 'get_review_queue', arguments: {} },
    });
    assert.equal(missing.toolRun.status, 'blocked');
    const invalid = registry.reviewModelToolCall({ name: 'get_review_queue', arguments: { limit: 999 } }, router);
    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.some((error) => error.includes('超过最大值')));
    const wrongRoute = registry.reviewModelToolCall({ name: 'get_review_queue', arguments: {} }, routerModule.routeAiPrompt('请查找知识库资料', { hasStudent: false }));
    assert.equal(wrongRoute.ok, false);

    console.log(JSON.stringify({ ok: true, cases: 14, routed: true, hostToolUsed: true, bounded: true, noRawRecords: true, failClosed: true }));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
