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
          import { boundDeepTutorEventDetail, deepTutorEventDetailLimits } from './src/main/ai-harness/deeptutor-event-bounds';
          import { recoverStructuredJsonCompletion, requestStructuredReplyRepair } from './src/main/deepseek';

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

          export async function runStructuredReplySmoke() {
            const diagnosisRouter = routeAiPrompt('分析当前学生最近一个月的主要错因', { hasStudent: true });
            const valid = parseStructuredReply(JSON.stringify(baseReply(diagnosisRouter)), diagnosisRouter);
            assert.ok(valid.reply, valid.errors.join(';'));
            assert.match(structuredReplyToMarkdown(valid.reply), /## 依据/);

            const fence = String.fromCharCode(96).repeat(3);
            const fenced = parseStructuredReply(fence + 'json\\n' + JSON.stringify(baseReply(diagnosisRouter)) + '\\n' + fence, diagnosisRouter);
            assert.ok(fenced.reply, fenced.errors.join(';'));
            const bomPrefixed = parseStructuredReply('\uFEFF' + JSON.stringify(baseReply(diagnosisRouter)), diagnosisRouter);
            assert.ok(bomPrefixed.reply, bomPrefixed.errors.join(';'));
            const surrounded = parseStructuredReply('模型说明：' + JSON.stringify(baseReply(diagnosisRouter)) + '\\n以上是结构化结果。', diagnosisRouter);
            assert.ok(surrounded.reply, surrounded.errors.join(';'));
            const metadataThenReply = parseStructuredReply(
              JSON.stringify({ trace: 'metadata' }) + '\\n' + JSON.stringify(baseReply(diagnosisRouter)),
              diagnosisRouter,
            );
            assert.ok(metadataThenReply.reply, metadataThenReply.errors.join(';'));
            const trailingCommaReply = JSON.stringify(baseReply(diagnosisRouter)).replace(/}$/, ',}');
            const trailingComma = parseStructuredReply(trailingCommaReply, diagnosisRouter);
            assert.ok(trailingComma.reply, 'balanced JSON with a trailing comma should be repaired locally');
            const rawNewlineReply = JSON.stringify(baseReply(diagnosisRouter)).replace('## 回答\\\\n', '## 回答\\n');
            const rawNewline = parseStructuredReply(rawNewlineReply, diagnosisRouter);
            assert.ok(rawNewline.reply, 'balanced JSON with a raw newline in a string should be repaired locally');
            const repairedRouteMismatch = parseStructuredReply(
              JSON.stringify(baseReply(diagnosisRouter, { route: 'general_qa' })).replace(/}$/, ',}'),
              diagnosisRouter,
            );
            assert.ok(!repairedRouteMismatch.reply, 'syntax repair must not bypass route validation');
            assert.ok(repairedRouteMismatch.errors.some((error) => error.includes('route 必须匹配')));
            const oversizedMalformed = JSON.stringify(baseReply(diagnosisRouter, {
              answerMarkdown: '超限回答'.repeat(17_000),
            })).replace(/}$/, ',}');
            assert.ok(oversizedMalformed.length > 64_000);
            assert.ok(!parseStructuredReply(oversizedMalformed, diagnosisRouter).reply, 'oversized malformed JSON must not enter local repair');
            const truncated = parseStructuredReply('{"schemaVersion":"xiazhi.reply.v2",', diagnosisRouter);
            assert.ok(truncated.errors.some((error) => error.includes('JSON 不完整')));

            const originalFetch = globalThis.fetch;
            let repairRequestBody;
            globalThis.fetch = async (_url, options) => {
              repairRequestBody = JSON.parse(String(options?.body ?? '{}'));
              return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(baseReply(diagnosisRouter)) } }] }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              });
            };
            try {
              await requestStructuredReplyRepair({
                apiKey: 'test-key',
                model: 'test-model',
                messages: [{ role: 'user', content: 'repair' }],
                signal: new AbortController().signal,
              });
            } finally {
              globalThis.fetch = originalFetch;
            }
            assert.equal(repairRequestBody.max_tokens, 8_000, 'repair must not fall back to a smaller provider default');
            assert.equal(repairRequestBody.temperature, 0);
            assert.deepEqual(repairRequestBody.response_format, { type: 'json_object' });
            assert.equal('tools' in repairRequestBody, false, 'repair must never expose tools');

            const validCompletion = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(baseReply(diagnosisRouter)) } }] };
            for (const initial of [
              { choices: [{ finish_reason: 'stop', message: { content: '' } }] },
              { choices: [{ finish_reason: 'length', message: { content: '{"schemaVersion":"xiazhi.reply.v2",' } }] },
            ]) {
              let recoveryCalls = 0;
              globalThis.fetch = async () => {
                recoveryCalls += 1;
                return new Response(JSON.stringify(validCompletion), { status: 200, headers: { 'content-type': 'application/json' } });
              };
              try {
                const recovered = await recoverStructuredJsonCompletion({
                  initial,
                  apiKey: 'test-key',
                  model: 'test-model',
                  messages: [{ role: 'system', content: '只返回 JSON。' }],
                  signal: new AbortController().signal,
                });
                assert.equal(recovered.recovery.attempted, true);
                assert.equal(recoveryCalls, 1, 'JSON edge case must retry exactly once');
                assert.ok(parseStructuredReply(recovered.response.choices[0].message.content, diagnosisRouter).reply);
              } finally {
                globalThis.fetch = originalFetch;
              }
            }

            globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '' } }] }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
            try {
              await assert.rejects(
                recoverStructuredJsonCompletion({
                  initial: { choices: [{ finish_reason: 'stop', message: { content: '' } }] },
                  apiKey: 'test-key', model: 'test-model', messages: [{ role: 'system', content: 'JSON' }], signal: new AbortController().signal,
                }),
                /连续返回空 content/,
              );
            } finally {
              globalThis.fetch = originalFetch;
            }

            const longReply = JSON.stringify(baseReply(diagnosisRouter, {
              answerMarkdown: '长回答'.repeat(4_000),
            }));
            assert.ok(longReply.length > deepTutorEventDetailLimits.default);
            const boundedFinal = boundDeepTutorEventDetail('result', longReply);
            assert.equal(boundedFinal, longReply, 'final result must not be clipped at the trace detail limit');
            assert.ok(parseStructuredReply(boundedFinal, diagnosisRouter).reply, 'long valid JSON must remain parseable');
            const boundedTrace = boundDeepTutorEventDetail('progress', longReply);
            assert.ok(boundedTrace.endsWith('...[truncated]'));
            assert.ok(boundedTrace.length < longReply.length, 'non-final trace detail must stay bounded');

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
              longReplyChars: longReply.length,
              finalResultLimit: deepTutorEventDetailLimits.finalResult,
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
    const result = await runStructuredReplySmoke();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
