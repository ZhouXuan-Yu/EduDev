import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-attached-source-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-attached-source-'));
const sourceFile = join(dataRoot, '错题材料.png');
writeFileSync(sourceFile, '题目材料：一次函数 y=2x+1。学生电话 13812345678。', 'utf8');

async function run() {
  try {
    const outfile = join(bundleRoot, 'attached-source-explore-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

      export async function runAttachedSourceExploreSmoke(dataRoot, sourceFile) {
        const store = new OmniEduStore(dataRoot); await store.init();
        const student = (await store.createStudent({ displayName: 'source-student', grade: 'G7', subjects: ['math'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] })).find((item) => item.displayName === 'source-student');
        assert.ok(student?.id);
        const records = await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: 'math', title: '附件错题', content: '老师已上传一份错题材料。', tags: ['attachment'] });
        const record = records.find((item) => item.title === '附件错题');
        assert.ok(record?.id);
        const imported = await store.importAttachments(student.id, record.id, [sourceFile]);
        assert.equal(imported.status, 'succeeded');
        const attachment = imported.records.find((item) => item.id === record.id)?.attachments[0];
        assert.ok(attachment?.id);
        const analysis = await store.createMistakeImageAnalysis({ studentId: student.id, recordId: record.id, attachmentId: attachment.id, extractedText: '一次函数 y=2x+1。学生电话 13812345678。' });
        assert.equal(analysis.ocrStatus, 'sanitized');
        assert.equal(analysis.sanitizedText.includes('[手机号]'), true);

        const router = routeAiPrompt('根据小A附件中的题目分析错误', { hasStudent: true });
        assert.equal(router.route, 'error_analysis');
        assert.equal(router.subIntent, 'attached_source_exploration');
        assert.equal(router.contextPolicy.include.includes('attached_sources'), true);
        assert.equal(router.allowedTools.includes('explore_attached_sources'), true);
        assert.equal(router.allowedTools.includes('search_learning_records'), false);
        const state = createAiToolExecutionState(router, { resolvedStudentId: student.id });
        const explored = await executeAiToolCall({ store, prompt: '根据附件探索一次函数', router, state, call: { name: 'explore_attached_sources', arguments: { query: '一次函数', limit: 3 } } });
        assert.equal(explored.toolRun.status, 'used');
        assert.equal(explored.modelResult.schemaVersion, 'omni.attached.sources.exploration.v1');
        assert.equal(explored.modelResult.sources.length, 1);
        assert.equal(explored.modelResult.sources[0].sourceHandle, 'attachment:' + attachment.id);
        assert.equal(explored.modelResult.sources[0].snippet.includes('[手机号]'), true);
        assert.equal(JSON.stringify(explored.modelResult).includes('13812345678'), false);
        assert.equal(explored.modelResult.rawFilesIncluded, false);
        assert.equal(explored.modelResult.localPathsIncluded, false);

        const wrongAttachment = await executeAiToolCall({ store, prompt: '根据附件探索', router, state, call: { name: 'explore_attached_sources', arguments: { attachmentIds: ['attachment_outside_scope'], query: '一次函数' } } });
        assert.equal(wrongAttachment.toolRun.status, 'blocked');
        assert.equal(wrongAttachment.modelResult.reason, 'attachment_scope_mismatch');
        const wrongStudentState = createAiToolExecutionState(router, { resolvedStudentId: 'student_other' });
        const wrongStudent = await executeAiToolCall({ store, prompt: '根据附件探索', router, state: wrongStudentState, call: { name: 'explore_attached_sources', arguments: { studentId: student.id, query: '一次函数' } } });
        assert.equal(wrongStudent.toolRun.status, 'blocked');
        assert.equal(wrongStudent.modelResult.reason, 'student_scope_mismatch');
        const noMatch = await executeAiToolCall({ store, prompt: '根据附件探索', router, state, call: { name: 'explore_attached_sources', arguments: { query: '不存在的关键词' } } });
        assert.equal(noMatch.toolRun.status, 'blocked');
        assert.equal(noMatch.modelResult.ok, false);
        const noStudent = routeAiPrompt('根据附件回答这个问题', { hasStudent: false });
        assert.equal(noStudent.subIntent, 'attached_source_exploration');
        assert.ok(noStudent.clarificationQuestion);
        const emptyState = createAiToolExecutionState(router, { resolvedStudentId: student.id });
        const empty = await executeAiToolCall({ store, prompt: '根据附件探索', router, state: emptyState, call: { name: 'explore_attached_sources', arguments: { attachmentIds: ['attachment_unknown'] } } });
        assert.equal(empty.toolRun.status, 'blocked');
        await store.close();
        return { ok: true, cases: 18, routeIsolated: true, sanitizedSnippet: true, sourceHandleBound: true, rawPathRedacted: true, scopeBlocked: true, noMatchBounded: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runAttachedSourceExploreSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runAttachedSourceExploreSmoke(dataRoot, sourceFile)));
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try { rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* sqlite may release a handle after process exit */ }
    try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* sqlite may release a handle after process exit */ }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
