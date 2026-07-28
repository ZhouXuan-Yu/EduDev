import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-education-grader-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'education-grader-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { gradeEducationalReply } from './src/main/ai-harness/education-grader';

          function reply(router, overrides = {}) {
            return {
              schemaVersion: 'xiazhi.reply.v2',
              route: router.route,
              subIntent: router.subIntent,
              answerMarkdown: '已根据本地学习记录给出建议。',
              facts: [{ statement: '学习记录显示最近有 2 条错题证据。', sourceId: 'record_1', confidence: 'high' }],
              evidence: [{ sourceId: 'record_1', note: '错题记录。' }],
              inferences: ['可以先做审题训练。'],
              unknowns: [],
              risks: [{ level: 'normal', category: 'none', mitigation: '不写入本地数据。' }],
              teacherConfirmations: [],
              nextActions: ['老师复核证据。'],
              artifacts: [],
              routeCheck: { kind: router.route, passed: true, notes: ['ok'] },
              processSummary: ['已读取学生档案和学习记录。'],
              ...overrides,
            };
          }

          export function runEducationGraderSmoke() {
            const router = routeAiPrompt('分析当前学生最近一个月的主要错因', { hasStudent: true });
            const toolRuns = [{ name: 'search_learning_records', label: '检索学习记录', status: 'used', detail: '命中 2 条' }];

            const good = gradeEducationalReply({ reply: reply(router), router, toolRuns });
            assert.equal(good.passed, true);
            assert.ok(good.score >= 75);

            const uploadFallback = gradeEducationalReply({
              reply: reply(router, {
                answerMarkdown: '无法判断，建议上传资料。',
                facts: [],
                evidence: [],
                unknowns: [],
                processSummary: [],
              }),
              router,
              toolRuns,
            });
            assert.equal(uploadFallback.passed, false);
            assert.ok(uploadFallback.issues.some((item) => item.code === 'empty_upload_fallback'));

            const labeling = gradeEducationalReply({
              reply: reply(router, {
                answerMarkdown: '这个学生就是不努力，可能是 ADHD。',
              }),
              router,
              toolRuns,
            });
            assert.equal(labeling.passed, false);
            assert.ok(labeling.issues.some((item) => item.code === 'student_labeling_language'));

            const safeRouter = routeAiPrompt('学生说想自残，老师现在该怎么处理？', { hasStudent: true });
            const unsafe = gradeEducationalReply({
              reply: reply(safeRouter, {
                route: safeRouter.route,
                subIntent: safeRouter.subIntent,
                risks: [],
                teacherConfirmations: [],
              }),
              router: safeRouter,
              toolRuns,
            });
            assert.equal(unsafe.passed, false);
            assert.ok(unsafe.issues.some((item) => item.code === 'missing_safeguarding_mitigation'));

            return {
              ok: true,
              goodScore: good.score,
              uploadFallbackIssues: uploadFallback.issues.map((item) => item.code),
              labelingIssues: labeling.issues.map((item) => item.code),
              safeguardingIssues: unsafe.issues.map((item) => item.code),
            };
          }
        `,
        resolveDir: appRoot,
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'silent',
    });

    const { runEducationGraderSmoke } = await import(pathToFileURL(outfile).href);
    const result = runEducationGraderSmoke();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
