import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createInterface } from 'node:readline';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-console-harness-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-console-harness-data-'));

try {
  const outfile = join(bundleRoot, 'console-harness-smoke.mjs');
  await build({
    stdin: {
      contents: `
        import assert from 'node:assert/strict';
        import { OmniEduStore } from './src/main/db';
        import { buildAiSystemPrompt } from './src/main/deepseek';
        import { routeAiPrompt } from './src/main/ai-harness/router';
        import {
          isCapabilityAllowedForRoute,
          isConsoleRunPendingStatus,
          selectDeepTutorCapability,
          XIAZHI_AGENT_HARNESS_VERSION,
        } from './src/main/ai-harness/agent-harness-profile';
        import { executeHostToolRequest } from './src/main/ai-harness/host-tool-proxy';

        export async function runHarnessSmoke(dataRoot) {
          const routeCases = [
            ['你好', 'general_qa', 'chat'],
            ['怎么配置 DeepSeek API Key', 'workspace_help', 'chat'],
            ['查询老师知识库里的一次函数资料', 'knowledge_retrieval', 'chat'],
            ['查看小A最近数学学习进度', 'student_diagnosis', 'deep_solve'],
            ['分析小A最近的高频错因', 'error_analysis', 'deep_solve'],
            ['给小A生成三元题组', 'practice_design', 'deep_question'],
            ['研究一次函数课堂设计', 'knowledge_retrieval', 'deep_research'],
            ['设计一次函数课堂导入和板书', 'lesson_design', 'deep_research'],
            ['起草小A本月学习报告', 'report_draft', 'deep_research'],
            ['把一次函数知识关系做成流程图', 'lesson_design', 'visualize'],
          ];
          for (const [prompt, expectedRoute, expectedCapability] of routeCases) {
            const router = routeAiPrompt(prompt, { hasStudent: prompt.includes('小A') });
            assert.equal(router.route, expectedRoute, prompt);
            const capability = selectDeepTutorCapability(router);
            assert.equal(capability, expectedCapability, prompt);
            assert.equal(isCapabilityAllowedForRoute(capability, router.route), true, prompt);
            const systemPrompt = buildAiSystemPrompt(router, capability);
            assert.match(systemPrompt, /xiazhi\.agent-harness\.v1/);
            assert.match(systemPrompt, new RegExp('本轮 Capability：' + capability));
            assert.match(systemPrompt, /只有工具尝试后仍缺少必要标识或证据，才 ask_user/);
          }
          assert.equal(isConsoleRunPendingStatus('running'), true);
          assert.equal(isConsoleRunPendingStatus('waiting_input'), true);
          assert.equal(isConsoleRunPendingStatus('succeeded'), false);
          assert.equal(XIAZHI_AGENT_HARNESS_VERSION.startsWith('xiazhi.agent-harness.v'), true);

          const store = new OmniEduStore(dataRoot);
          await store.init();
          const student = (await store.createStudent({ displayName: '小A', grade: '八年级', subjects: ['数学'] }))[0];
          const prompt = '查看小A最近数学学习进度';
          const router = routeAiPrompt(prompt, { hasStudent: false });
          const capability = selectDeepTutorCapability(router);
          const resolved = await executeHostToolRequest({
            store,
            prompt,
            router,
            request: {
              schemaVersion: 'xiazhi.host_tool.request.v1', requestId: 'resolve-1', turnId: 'state-turn',
              capability, toolName: 'resolve_student_reference', arguments: { studentName: '小A' },
            },
          });
          assert.equal(resolved.result.status, 'used');
          assert.equal(resolved.state.resolvedStudentId, student.id);
          const profile = await executeHostToolRequest({
            store,
            prompt,
            router,
            state: resolved.state,
            request: {
              schemaVersion: 'xiazhi.host_tool.request.v1', requestId: 'profile-1', turnId: 'state-turn',
              capability, toolName: 'get_student_profile', arguments: {},
            },
          });
          assert.equal(profile.result.status, 'used');
          assert.equal(profile.result.modelResult.student.displayName, '小A');
          await store.close();
          return { routeCases: routeCases.length, stateHandoff: true };
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
  const { runHarnessSmoke } = await import(pathToFileURL(outfile).href);
  const harness = await runHarnessSmoke(dataRoot);
  assert.equal(harness.routeCases, 10);
  assert.equal(harness.stateHandoff, true);
} finally {
  rmSync(bundleRoot, { recursive: true, force: true });
  try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* SQLite can release late on failed assertions. */ }
}

const python = process.env.OMNI_EDU_PYTHON ?? (existsSync('C:\\Python314\\python.exe') ? 'C:\\Python314\\python.exe' : 'py');
const args = python.toLowerCase().endsWith('py.exe') ? ['-3', '-m', 'omni_edu_deeptutor_bridge'] : ['-m', 'omni_edu_deeptutor_bridge'];
const child = spawn(python, args, {
  cwd: repoRoot,
  env: { ...process.env, PYTHONPATH: join(repoRoot, 'python') },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
const lines = createInterface({ input: child.stdout });
const output = [];
const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`);
send({ type: 'request', id: 'start', method: 'start_turn', params: {
  turnId: 'host-proxy-smoke', capability: 'deep_solve', prompt: '查询一个学生的错题概况',
  context: { language: 'zh', hostToolRequest: { toolName: 'resolve_student_reference', arguments: { studentName: '不存在的学生' } } },
  budgets: { maxEvents: 32, maxWallMs: 120000 },
} });
for await (const line of lines) {
  const payload = JSON.parse(line);
  output.push(payload);
  if (payload.type === 'host_tool_request') {
    send({ type: 'host_tool_result', result: {
      schemaVersion: 'xiazhi.host_tool.result.v1', requestId: payload.request.requestId,
      turnId: payload.request.turnId, status: 'blocked',
      review: { ok: false, reason: 'smoke blocked by host policy', errors: ['student_not_found'] },
      modelResult: { ok: false, reason: 'student_not_found' },
    } });
  }
  if (payload.type === 'event' && payload.event?.phase === 'done') {
    send({ type: 'request', id: 'shutdown', method: 'shutdown', params: {} });
    child.stdin.end();
    break;
  }
}
await new Promise((resolveExit) => child.once('exit', resolveExit));
const events = output.filter((item) => item.type === 'event').map((item) => item.event);
if (!events.some((event) => event.phase === 'tool_request' && event.status === 'awaiting_host')) throw new Error('host tool request event missing');
if (!events.some((event) => event.phase === 'tool_result' && event.publicSummary?.status === 'blocked')) throw new Error('host tool result event missing');
console.log(JSON.stringify({ ok: true, routeCases: 10, stateHandoff: true, eventCount: events.length, hostToolRoundTrip: true }));
