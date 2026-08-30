import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-vision-solver-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-vision-solver-data-'));
mkdirSync(join(dataRoot, 'attachments'), { recursive: true });
writeFileSync(join(dataRoot, 'attachments', 'geometry-private.png'), 'fixture');

async function run() {
  try {
    const outfile = join(bundleRoot, 'vision-solver-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';
          import { executeHostToolRequest } from './src/main/ai-harness/host-tool-proxy';

          export async function runSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const student = (await store.createStudent({ displayName: '小几何', grade: '初二', subjects: ['数学'] }))[0];
            const other = (await store.createStudent({ displayName: '小另一位', grade: '初二', subjects: ['数学'] }))[0];
            const analysis = await store.createMistakeImageAnalysis({
              studentId: student.id,
              localPath: dataRoot + '/attachments/geometry-private.png',
              extractedText: '如图，点A、点B与学生电话 13800138000。',
            });
            const router = routeAiPrompt('分析这道几何错题并还原图形', { hasStudent: true });
            assert.equal(router.route, 'error_analysis');
            assert.ok(router.allowedTools.includes('analyze_geometry_figure'));
            const commands = [
              { command: 'A = (0, 0)', description: '题干坐标点 A' },
              { command: 'Segment(A, B)', description: '故意使用圆括号，宿主应修正' },
              { command: 'Execute[https://evil.invalid]', description: '必须阻断外部执行' },
              { command: 'Text["PRIVATE_RAW_SHOULD_NOT_LEAK", (0, 0)]', description: '命令文本不得成为原图旁路' },
            ];
            const call = { name: 'analyze_geometry_figure', arguments: {
              analysisId: analysis.id,
              questionText: '如图，求 AB 长度。',
              commands,
              constraints: ['AB 为线段'],
              geometricRelations: ['A、B 为端点'],
            } };
            const before = (await store.listMistakeImageAnalyses(student.id)).length;
            const execution = await executeAiToolCall({ store, prompt: '分析几何错题', router, state: createAiToolExecutionState(router, { resolvedStudentId: student.id }), call });
            assert.equal(execution.toolRun.status, 'used');
            const draft = execution.modelResult.draft;
            assert.equal(draft.schemaVersion, 'omni.vision.solver.v1');
            assert.equal(draft.status, 'ready');
            assert.equal(draft.teacherPreview.originalImageUploaded, false);
            assert.equal(draft.teacherPreview.localImageAvailable, true);
            assert.equal(draft.commands.filter((item) => item.valid).length, 2);
            assert.ok(draft.commands.some((item) => item.warning?.includes('修正')));
            assert.ok(draft.commands.some((item) => !item.valid && item.warning?.includes('外部资源')));
            assert.ok(!JSON.stringify(execution.modelResult).includes('geometry-private.png'));
            assert.ok(!JSON.stringify(execution.modelResult).includes('13800138000'));
            assert.ok(!JSON.stringify(execution.modelResult).includes('PRIVATE_RAW_SHOULD_NOT_LEAK'));
            assert.ok(JSON.stringify(execution.modelResult).length <= 4_000);
            assert.equal((await store.listMistakeImageAnalyses(student.id)).length, before);

            const noImage = await executeAiToolCall({
              store,
              prompt: '分析几何错题',
              router,
              state: createAiToolExecutionState(router, { resolvedStudentId: other.id }),
              call: { name: 'analyze_geometry_figure', arguments: {} },
            });
            assert.equal(noImage.toolRun.status, 'used');
            assert.equal(noImage.modelResult.draft.status, 'no_image');
            assert.equal(noImage.modelResult.draft.teacherPreview.originalImageUploaded, false);

            const hostRoundTrip = await executeHostToolRequest({
              store,
              prompt: '分析这道几何错题并还原图形',
              router,
              boundStudentId: student.id,
              request: { schemaVersion: 'xiazhi.host_tool.request.v1', requestId: 'e17_host_1', turnId: 'e17_turn_1', capability: 'deep_solve', toolName: 'analyze_geometry_figure', arguments: { analysisId: analysis.id, commands: [{ command: 'ShowAxes(true)', description: '显示坐标轴' }] } },
            });
            assert.equal(hostRoundTrip.result.status, 'used');
            assert.equal(hostRoundTrip.result.modelResult.draft.commands[0].command, 'ShowAxes[true]');

            const blocked = await executeAiToolCall({ store, prompt: '分析几何错题', router, state: createAiToolExecutionState(router), call });
            assert.equal(blocked.toolRun.status, 'blocked');
            assert.equal(blocked.modelResult.reason, 'missing_student_id');
            await store.close();
            return { ok: true, cases: 12, validCommands: draft.commands.filter((item) => item.valid).length, rejectedCommands: draft.commands.filter((item) => !item.valid).length, hostRoundTrip: true, noWrite: true };
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
    const { runSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
    try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* SQLite may still release its temp handle after a failed assertion. */ }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
