import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-model-grader-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-model-grader-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-model-grader-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { gradeAiReplyWithModelProxy } from './src/main/ai-harness/model-grader';

          export async function runAiModelGraderSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const goodStudentDiagnosis = gradeAiReplyWithModelProxy({
                sampleId: 'model_grader_student_good_001',
                prompt: '请看小A最近三次数学错题，给我今天能做的补救步骤。',
                answerMarkdown: [
                  '小A当前更像是“分数应用题读题信息定位不稳”，不是态度问题。',
                  '## 依据',
                  '- 已检查最近三次数学错题：都集中在单位换算和条件筛选。',
                  '## 下一步',
                  '- 今天先做 2 道单位换算口头解释，再做 1 道相似题。',
                  '- 老师确认后再把这组练习保存成三元题组草稿。',
                ].join('\\n'),
                route: 'student_diagnosis',
                subIntent: 'student_progress',
                targetGrade: '小学五年级',
                modelUnderReview: 'deepseek-after',
                reviewedAt: '2026-07-29T10:00:00.000Z',
              });
              assert.equal(goodStudentDiagnosis.issueCodes.length, 0);
              const savedGood = await store.createAiModelGrade(goodStudentDiagnosis);
              assert.equal(savedGood.passed, true);
              assert.equal(savedGood.gradeAppropriatenessScore, 5);

              const goodPractice = gradeAiReplyWithModelProxy({
                sampleId: 'model_grader_practice_good_002',
                prompt: '基于小A错题出一组三元题组。',
                answerMarkdown: [
                  '这组题先覆盖原题结构，再做相似变式，最后做条件反转。',
                  '## 依据',
                  '- 来源：本地题库相似题命中 2 条，知识点为分数应用题。',
                  '## 下一步',
                  '- 先让小A说出每题条件和问题，再限时完成。',
                  '## 需要老师确认',
                  '- 老师确认后保存为三元题组草稿，可修改题干。',
                ].join('\\n'),
                route: 'practice_design',
                subIntent: 'triplet_practice',
                targetGrade: '小学五年级',
                modelUnderReview: 'deepseek-after',
                reviewedAt: '2026-07-29T10:01:00.000Z',
              });
              await store.createAiModelGrade(goodPractice);

              const bad = gradeAiReplyWithModelProxy({
                sampleId: 'model_grader_bad_003',
                prompt: '请看小A的错题。',
                answerMarkdown: '当前为普通问答模式，无法自动切换，请手动选择左侧导航中的学生数据。小A就是不努力。',
                route: 'student_diagnosis',
                subIntent: 'student_progress',
                targetGrade: '小学五年级',
                modelUnderReview: 'deepseek-before',
                reviewedAt: '2026-07-29T10:02:00.000Z',
              });
              assert.ok(bad.issueCodes.includes('manual_module_switch_fallback'));
              assert.ok(bad.issueCodes.includes('unsafe_student_label'));
              assert.ok(bad.actionabilityScore <= 1);
              assert.ok(bad.safetyScore <= 1);

              const list = await store.listAiModelGrades();
              assert.equal(list.length, 2);
              const summary = await store.buildAiModelGradeSummary();
              assert.equal(summary.sampleCount, 2);
              assert.equal(summary.passedCount, 2);
              assert.equal(summary.failedCount, 0);
              assert.equal(summary.averageOverallScore, 5);
              assert.equal(summary.averageGradeAppropriatenessScore, 5);
              assert.equal(summary.graderModeCounts.deterministic_proxy, 2);

              const snapshot = await store.buildAiTelemetrySnapshot();
              assert.deepEqual(snapshot.modelGrader, summary);

              const report = await store.createAiRegressionReport({
                title: 'Phase 12 v1.5 model grader smoke',
                minimumModelGradeSamples: 2,
                minimumModelGradeScore: 4,
                minimumGradeAppropriatenessScore: 4,
              });
              const modelGate = report.gates.find((gate) => gate.id === 'model_grader_quality_gate');
              assert.ok(modelGate, 'model_grader_quality_gate should be present');
              assert.equal(modelGate.status, 'passed');

              return {
                ok: true,
                sampleCount: summary.sampleCount,
                averageOverallScore: summary.averageOverallScore,
                averageGradeAppropriatenessScore: summary.averageGradeAppropriatenessScore,
                badIssueCodes: bad.issueCodes,
                modelGate: {
                  id: modelGate.id,
                  status: modelGate.status,
                  detail: modelGate.detail,
                },
              };
            } finally {
              await store.close();
            }
          }
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

    const { runAiModelGraderSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiModelGraderSmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
