import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-mastery-pending-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-mastery-pending-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'mastery-pending-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

      export async function runMasteryPendingSmoke(dataRoot) {
        const store1 = new OmniEduStore(dataRoot); await store1.init();
        const created = await store1.createStudent({ displayName: 'pending-student', grade: 'G7', subjects: ['math'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] });
        const student = created.find((item) => item.displayName === 'pending-student');
        assert.ok(student?.id);
        await store1.createRecord({ studentId: student.id, recordType: 'mastery_attempt', subject: 'math', title: 'structured evidence', content: JSON.stringify({ knowledgePoint: 'linear function', knowledgeType: 'procedure', isCorrect: false }), tags: ['mastery_attempt'] });
        const router = routeAiPrompt('给当前学生做一道掌握度小测', { hasStudent: true });
        assert.ok(router.allowedTools.includes('mastery_quiz'));
        const state = createAiToolExecutionState(router, { resolvedStudentId: student.id });
        const runId = await store1.startAiAgentRun({ prompt: 'mastery pending smoke', route: router.route, subIntent: router.subIntent, model: 'smoke', studentId: student.id });
        const quiz = await executeAiToolCall({ store: store1, prompt: '给当前学生做一道掌握度小测', router, state, allowManagedWrite: true, executionContext: { runId, turnId: 'turn_pending' }, call: { name: 'mastery_quiz', arguments: { studentId: student.id } } });
        assert.equal(quiz.toolRun.status, 'used');
        const questionId = String(quiz.modelResult.questionId);
        assert.ok(questionId.startsWith('mastery_question_'));
        const statusBefore = await executeAiToolCall({ store: store1, prompt: '查看掌握度状态', router, state, call: { name: 'mastery_status', arguments: { studentId: student.id } } });
        assert.equal(statusBefore.toolRun.status, 'used');
        assert.equal(statusBefore.modelResult.pendingQuestion.id, questionId);
        assert.equal(statusBefore.modelResult.pendingQuestion.answerSubmitted, false);
        assert.equal(JSON.stringify(statusBefore.modelResult).includes('expectedAnswer'), false);
        await store1.answerAiMasteryQuestion(questionId, 'A');
        await store1.close();

        const store2 = new OmniEduStore(dataRoot); await store2.init();
        const resumed = await executeAiToolCall({ store: store2, prompt: '查看掌握度状态', router, state, call: { name: 'mastery_status', arguments: { studentId: student.id } } });
        assert.equal(resumed.modelResult.pendingQuestion.status, 'answered');
        assert.equal(resumed.modelResult.pendingQuestion.answerSubmitted, true);
        const graded = await executeAiToolCall({ store: store2, prompt: '评分当前掌握度小测', router, state, allowManagedWrite: true, call: { name: 'mastery_grade', arguments: { answer: 'A' } } });
        assert.equal(graded.toolRun.status, 'used');
        assert.equal(graded.modelResult.expectedAnswerIncluded, false);
        const afterGrade = await executeAiToolCall({ store: store2, prompt: '查看掌握度状态', router, state, call: { name: 'mastery_status', arguments: { studentId: student.id } } });
        assert.equal(afterGrade.modelResult.pendingQuestion, null);

        const other = (await store2.createStudent({ displayName: 'other-student', grade: 'G7', subjects: ['math'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] })).find((item) => item.displayName === 'other-student');
        assert.ok(other?.id);
        const otherState = createAiToolExecutionState(router, { resolvedStudentId: other.id });
        const crossStudent = await executeAiToolCall({ store: store2, prompt: '评分掌握度小测', router, state: otherState, allowManagedWrite: true, call: { name: 'mastery_grade', arguments: { questionId, answer: 'A' } } });
        assert.equal(crossStudent.toolRun.status, 'blocked');
        assert.equal(crossStudent.modelResult.reason, 'student_scope_mismatch');
        await store2.close();
        return { ok: true, cases: 14, pendingVisible: true, answerStatePersisted: true, restartSafe: true, gradeFallback: true, noExpectedAnswerLeak: true, crossStudentBlocked: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runMasteryPendingSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runMasteryPendingSmoke(dataRoot)));
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const target of [bundleRoot, dataRoot]) {
      try { rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* sqlite may release a handle after process exit */ }
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
