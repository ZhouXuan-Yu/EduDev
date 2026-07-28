import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-structured-reply-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'structured-reply-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { parseStructuredReply, structuredReplyToMarkdown } from './src/main/ai-harness/schema';

          function baseReply(router, overrides = {}) {
            return {
              schemaVersion: 'xiazhi.reply.v2',
              route: router.route,
              subIntent: router.subIntent,
              answerMarkdown: '## 回答\\\\n基于已读取证据给出工作台建议。',
              facts: [{ statement: '已读取本地学习记录摘要。', sourceId: 'record_1', confidence: 'high' }],
              evidence: [{ sourceId: 'record_1', note: '学习记录摘要。' }],
              inferences: ['需要继续观察。'],
              unknowns: [],
              risks: [{ level: 'normal', category: 'none', mitigation: '不写入任何本地数据。' }],
              teacherConfirmations: [],
              nextActions: ['请老师确认是否继续。'],
              artifacts: [],
              routeCheck: { kind: router.route, passed: true, notes: ['route/subIntent 已匹配。'] },
              processSummary: ['Router 已完成。'],
              ...overrides,
            };
          }

          export function runStructuredReplySmoke() {
            const diagnosisRouter = routeAiPrompt('分析当前学生最近一个月的主要错因', { hasStudent: true });
            const valid = parseStructuredReply(JSON.stringify(baseReply(diagnosisRouter)), diagnosisRouter);
            assert.ok(valid.reply, valid.errors.join(';'));
            assert.match(structuredReplyToMarkdown(valid.reply), /## 依据/);

            const routeMismatch = parseStructuredReply(JSON.stringify(baseReply(diagnosisRouter, { route: 'general_qa' })), diagnosisRouter);
            assert.ok(!routeMismatch.reply);
            assert.ok(routeMismatch.errors.some((error) => error.includes('route 必须匹配')));

            const noFactsNoUnknowns = parseStructuredReply(JSON.stringify(baseReply(diagnosisRouter, { facts: [], unknowns: [] })), diagnosisRouter);
            assert.ok(!noFactsNoUnknowns.reply);
            assert.ok(noFactsNoUnknowns.errors.some((error) => error.includes('facts 或 unknowns')));

            const tripletRouter = routeAiPrompt('生成三元题组：原题、相似题、变式题', { hasStudent: true });
            const badTriplet = parseStructuredReply(JSON.stringify(baseReply(tripletRouter, {
              answerMarkdown: '这里只给普通练习建议。',
              facts: [],
              unknowns: ['缺少题库题目。'],
            })), tripletRouter);
            assert.ok(!badTriplet.reply);
            assert.ok(badTriplet.errors.some((error) => error.includes('三元题组')));

            const goodTriplet = parseStructuredReply(JSON.stringify(baseReply(tripletRouter, {
              answerMarkdown: '## 原题\\\\n1. 原题占位\\\\n## 相似题\\\\n1. 相似题占位\\\\n## 变式题\\\\n1. 变式题占位',
              facts: [],
              unknowns: ['缺少真实题库题目，只能生成草稿结构。'],
              artifacts: [{ id: 'ex_1', title: '三元题组草稿', type: 'exercise_set', fileName: 'exercise.md', description: '待确认', requiresTeacherConfirmation: true }],
            })), tripletRouter);
            assert.ok(goodTriplet.reply, goodTriplet.errors.join(';'));

            const reportRouter = routeAiPrompt('给小A生成月报并保存', { hasStudent: false });
            const badReport = parseStructuredReply(JSON.stringify(baseReply(reportRouter, {
              teacherConfirmations: [],
              artifacts: [{ id: 'report_1', title: '月报草稿', type: 'report_draft', fileName: 'report.md', description: '待确认', requiresTeacherConfirmation: true }],
            })), reportRouter);
            assert.ok(!badReport.reply);
            assert.ok(badReport.errors.some((error) => error.includes('teacherConfirmations')));

            return {
              ok: true,
              validSchemaVersion: valid.reply.schemaVersion,
              routeMismatchErrors: routeMismatch.errors,
              tripletArtifactCount: goodTriplet.reply.artifacts.length,
              reportWriteErrors: badReport.errors,
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

    const { runStructuredReplySmoke } = await import(pathToFileURL(outfile).href);
    const result = runStructuredReplySmoke();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
