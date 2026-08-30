import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-mastery-quiz-queue-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-mastery-quiz-queue-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'mastery-quiz-queue-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall, reviewModelToolCall } from './src/main/ai-harness/tool-registry';

      export async function runMasteryQuizQueueSmoke(dataRoot) {
        const store1 = new OmniEduStore(dataRoot); await store1.init();
        const student = (await store1.createStudent({ displayName: 'quiz-queue-student', grade: 'G8', subjects: ['math'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] })).find((item) => item.displayName === 'quiz-queue-student');
        assert.ok(student?.id);
        for (const [knowledgePoint, type] of [['linear function', 'procedure'], ['slope', 'procedure'], ['intercept', 'concept']]) {
          await store1.createRecord({ studentId: student.id, recordType: 'mastery_attempt', subject: 'math', title: knowledgePoint, content: JSON.stringify({ knowledgePoint, knowledgeType: type, isCorrect: false }), tags: ['mastery_attempt'] });
        }
        const router = routeAiPrompt('给当前学生连续做三道掌握度小测', { hasStudent: true });
        const state = createAiToolExecutionState(router, { resolvedStudentId: student.id });
        const invalidReview = reviewModelToolCall({ name: 'mastery_quiz', arguments: { studentId: student.id, questionCount: 6 } }, router);
        assert.equal(invalidReview.ok, false);
        const runId = await store1.startAiAgentRun({ prompt: 'mastery quiz queue smoke', route: router.route, subIntent: router.subIntent, model: 'smoke', studentId: student.id });
        const quiz = await executeAiToolCall({ store: store1, prompt: '连续掌握度小测', router, state, allowManagedWrite: true, executionContext: { runId, turnId: 'turn_queue' }, call: { name: 'mastery_quiz', arguments: { studentId: student.id, questionCount: 3 } } });
        assert.equal(quiz.toolRun.status, 'used');
        assert.equal(quiz.modelResult.questionCount, 3);
        assert.equal(quiz.modelResult.remainingQuestionCount, 2);
        assert.equal(Object.hasOwn(quiz.modelResult, 'expectedAnswer'), false);
        const firstId = String(quiz.modelResult.questionId);
        const firstStatus = await executeAiToolCall({ store: store1, prompt: '查看掌握度状态', router, state, call: { name: 'mastery_status', arguments: { studentId: student.id } } });
        assert.equal(firstStatus.modelResult.pendingQuestionCount, 3);
        assert.equal(firstStatus.modelResult.pendingQuestion.id, firstId);
        const duplicateQueue = await executeAiToolCall({ store: store1, prompt: '再来一组小测', router, state, allowManagedWrite: true, executionContext: { runId, turnId: 'turn_queue_2' }, call: { name: 'mastery_quiz', arguments: { studentId: student.id, questionCount: 2 } } });
        assert.equal(duplicateQueue.toolRun.status, 'blocked');
        assert.equal(duplicateQueue.modelResult.reason, 'pending_question_exists');

        await store1.answerAiMasteryQuestion(firstId, 'A');
        const firstGrade = await executeAiToolCall({ store: store1, prompt: '评分当前题', router, state, allowManagedWrite: true, call: { name: 'mastery_grade', arguments: { answer: 'A' } } });
        assert.equal(firstGrade.toolRun.status, 'used');
        const secondStatus = await executeAiToolCall({ store: store1, prompt: '查看下一题', router, state, call: { name: 'mastery_status', arguments: { studentId: student.id } } });
        assert.equal(secondStatus.modelResult.pendingQuestionCount, 2);
        const secondId = String(secondStatus.modelResult.pendingQuestion.id);
        assert.notEqual(secondId, firstId);
        await store1.answerAiMasteryQuestion(secondId, 'B');
        const secondGrade = await executeAiToolCall({ store: store1, prompt: '评分下一题', router, state, allowManagedWrite: true, call: { name: 'mastery_grade', arguments: { questionId: secondId, answer: 'B' } } });
        assert.equal(secondGrade.toolRun.status, 'used');
        await store1.close();

        const store2 = new OmniEduStore(dataRoot); await store2.init();
        const resumed = await executeAiToolCall({ store: store2, prompt: '重启后查看下一题', router, state, call: { name: 'mastery_status', arguments: { studentId: student.id } } });
        assert.equal(resumed.modelResult.pendingQuestionCount, 1);
        assert.notEqual(resumed.modelResult.pendingQuestion.id, firstId);
        assert.notEqual(resumed.modelResult.pendingQuestion.id, secondId);
        assert.equal(Object.hasOwn(resumed.modelResult, 'expectedAnswer'), false);
        const thirdId = String(resumed.modelResult.pendingQuestion.id);
        await store2.answerAiMasteryQuestion(thirdId, 'A');
        const thirdGrade = await executeAiToolCall({ store: store2, prompt: '评分最后一题', router, state, allowManagedWrite: true, call: { name: 'mastery_grade', arguments: { answer: 'A' } } });
        assert.equal(thirdGrade.toolRun.status, 'used');
        const done = await executeAiToolCall({ store: store2, prompt: '查看掌握度状态', router, state, call: { name: 'mastery_status', arguments: { studentId: student.id } } });
        assert.equal(done.modelResult.pendingQuestion, null);
        assert.equal(done.modelResult.pendingQuestionCount, 0);
        const orderedStudent = (await store2.createStudent({ displayName: 'ordered-quiz-student', grade: 'G8', subjects: ['math'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] })).find((item) => item.displayName === 'ordered-quiz-student');
        assert.ok(orderedStudent?.id);
        await store2.createRecord({ studentId: orderedStudent.id, recordType: 'mastery_attempt', subject: 'math', title: 'ordered point one', content: JSON.stringify({ knowledgePoint: 'ordered point one', knowledgeType: 'procedure', isCorrect: false }), tags: ['mastery_attempt'] });
        await store2.createRecord({ studentId: orderedStudent.id, recordType: 'mastery_attempt', subject: 'math', title: 'ordered point two', content: JSON.stringify({ knowledgePoint: 'ordered point two', knowledgeType: 'procedure', isCorrect: false }), tags: ['mastery_attempt'] });
        const orderedState = createAiToolExecutionState(router, { resolvedStudentId: orderedStudent.id });
        const orderedRun = await store2.startAiAgentRun({ prompt: 'ordered quiz smoke', route: router.route, subIntent: router.subIntent, model: 'smoke', studentId: orderedStudent.id });
        const orderedQuiz = await executeAiToolCall({ store: store2, prompt: '连续掌握度小测', router, state: orderedState, allowManagedWrite: true, executionContext: { runId: orderedRun, turnId: 'turn_ordered' }, call: { name: 'mastery_quiz', arguments: { studentId: orderedStudent.id, questionCount: 2 } } });
        assert.equal(orderedQuiz.toolRun.status, 'used');
        const orderedQuestions = await store2.getPendingAiMasteryQuestions(orderedStudent.id, 5);
        assert.equal(orderedQuestions.length, 2);
        await store2.answerAiMasteryQuestion(orderedQuestions[1].id, 'A');
        const outOfOrder = await executeAiToolCall({ store: store2, prompt: '跳过第一题评分', router, state: orderedState, allowManagedWrite: true, call: { name: 'mastery_grade', arguments: { questionId: orderedQuestions[1].id, answer: 'A' } } });
        assert.equal(outOfOrder.toolRun.status, 'blocked');
        assert.equal(outOfOrder.modelResult.reason, 'question_order_mismatch');
        await store2.answerAiMasteryQuestion(orderedQuestions[0].id, 'A');
        const orderedFirstGrade = await executeAiToolCall({ store: store2, prompt: '评分第一题', router, state: orderedState, allowManagedWrite: true, call: { name: 'mastery_grade', arguments: { answer: 'A' } } });
        assert.equal(orderedFirstGrade.toolRun.status, 'used');
        const orderedSecondGrade = await executeAiToolCall({ store: store2, prompt: '评分第二题', router, state: orderedState, allowManagedWrite: true, call: { name: 'mastery_grade', arguments: { questionId: orderedQuestions[1].id, answer: 'A' } } });
        assert.equal(orderedSecondGrade.toolRun.status, 'used');
        await store2.close();
        return { ok: true, cases: 23, batchCreated: true, sequentialGrade: true, duplicateBatchBlocked: true, restartSafe: true, answerRedaction: true, outOfOrderBlocked: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runMasteryQuizQueueSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runMasteryQuizQueueSmoke(dataRoot)));
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const target of [bundleRoot, dataRoot]) {
      try { rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* sqlite may release a handle after process exit */ }
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
