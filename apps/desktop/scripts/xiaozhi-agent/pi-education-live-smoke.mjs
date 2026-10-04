import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const { createPiXiaozhiSession } = await import('../../src/main/xiaozhi-agent/pi-session.ts');

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = fs.readFileSync(path.join(appRoot, '.env.local'), 'utf8');
const pick = name => config.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`, 'm'))?.[1]?.replace(/^['"]|['"]$/g, '');
const apiKey = process.env.DEEPSEEK_API_KEY || pick('DEEPSEEK_API_KEY');
const model = process.env.DEEPSEEK_MODEL || pick('DEEPSEEK_MODEL') || 'deepseek-chat';
assert(apiKey, 'Missing ignored local DeepSeek configuration');
const clean = value => String(value).replaceAll(apiKey, '[REDACTED]').replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]');
fs.mkdirSync(path.join(appRoot, 'test-results/xiaozhi-agent'), { recursive: true });
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/xiaozhi-agent/pi-sdk-'));
const workspace = path.join(output, 'workspace'), stateRoot = path.join(output, 'state');
fs.mkdirSync(workspace); fs.mkdirSync(stateRoot);
const marker = `教研批次${randomUUID().slice(0, 8)}`;
fs.writeFileSync(path.join(workspace, 'lesson.md'), `# 五年级数学教研资料\n批次：${marker}\n本次备课时长：37分钟。主题：分数加法。先用同分母图示，再讨论通分。\n`);
fs.writeFileSync(path.join(workspace, '.env'), 'PRIVATE_SYNTHETIC_SECRET_DO_NOT_EXPOSE');
const events = [], checks = [];
const report = { suite: 'pi-education-real-deepseek', success: false, model, sdk: '0.80.3', checks,
  electron: process.versions.electron || null, node: process.versions.node,
  boundaries: ['Real DeepSeek official endpoint and isolated synthetic teacher material',
    'No production UI/IPC integration claim', 'Actual VPN-off environment not verified'] };
let agent, resumed, waiting, releaseApproval;
const base = { stateRoot, workspace, apiKey, model, onEvent: event => events.push(event) };
const approval = async request => request.source === 'lesson.md' && request.target === 'copy.md';
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); };
try {
  agent = await createPiXiaozhiSession({ ...base, approveCopy: approval });
  check('Education prompt and explicit tools; no default shell or coding tools', () => {
    assert.equal(agent.session.systemPrompt.includes('教师教育智能体'), true);
    assert.deepEqual(agent.diagnostics().activeTools.sort(), ['office_read_text', 'office_file_stat', 'office_list_files', 'office_copy_file'].sort());
  });
  const first = await agent.prompt('先调用 office_read_text 读取 lesson.md。按资料写一个简短备课建议，必须明确原文的批次、年级、科目和备课时长，并引用 lesson.md。不要猜资料。');
  check('Actual DeepSeek multi-delta reply after a real teacher-material read', () => {
    assert(first.ok, JSON.stringify(first)); assert(first.text.replace(/\s/g, '').includes(marker)); assert(first.text.includes('37'));
    assert(first.text.includes('lesson.md')); assert(events.filter(e => e.kind === 'text_delta').length > 1);
    assert(events.some(e => e.kind === 'tool_end' && e.tool === 'office_read_text' && e.success));
  });
  const copied = await agent.prompt('请调用 office_copy_file，把 lesson.md 复制到 copy.md。只需要这一项操作，完成后简短告知实际结果。');
  check('Real model tool request, host approval, and copied file readback', () => {
    assert(copied.ok, JSON.stringify(copied)); assert.deepEqual(fs.readFileSync(path.join(workspace, 'copy.md')), fs.readFileSync(path.join(workspace, 'lesson.md')));
  });
  const sessionId = agent.sessionId, sessionFile = agent.sessionFile;
  check('SDK private history exists and contains no credential', () => {
    assert(sessionFile && fs.existsSync(sessionFile)); assert(!fs.readFileSync(sessionFile, 'utf8').includes(apiKey));
  });
  await agent.dispose(); agent = undefined;
  fs.writeFileSync(path.join(workspace, 'lesson.md'), 'This file now has different facts.');
  resumed = await createPiXiaozhiSession({ ...base, sessionFile, approveCopy: approval });
  const restored = await resumed.prompt('仅根据本会话之前已读取的资料回答：刚才的教研批次和备课时长是什么？不要再次读取文件。');
  check('Private session restoration preserves facts and freezes model', () => {
    assert.equal(resumed.sessionId, sessionId); assert.equal(resumed.diagnostics().model, model);
    assert(restored.ok, JSON.stringify(restored)); assert(restored.text.replace(/\s/g, '').includes(marker)); assert(restored.text.includes('37'));
  });
  await assert.rejects(createPiXiaozhiSession({ ...base, sessionFile, model: 'different-model', approveCopy: approval }), /configuration/);
  checks.push({ name: 'Reject restoring history with a different model', pass: true });
  const failedTool = await resumed.prompt('请用 office_read_text 读取 missing-lesson.md。如果文件不存在，不要换工具或重试，简短说明实际错误。');
  check('Hana outcome adapter marks a rejected tool result as error', () => {
    assert(failedTool.ok, JSON.stringify(failedTool));
    assert(resumed.session.messages.some(m => m.role === 'toolResult' && m.isError && JSON.stringify(m).includes('not_found')));
    assert(!JSON.stringify(events).includes('PRIVATE_SYNTHETIC_SECRET_DO_NOT_EXPOSE'));
  });
  await resumed.dispose(); resumed = undefined;
  const waitingState = path.join(output, 'waiting-state'); fs.mkdirSync(waitingState);
  let approvalStarted;
  const started = new Promise(resolve => { approvalStarted = resolve; });
  waiting = await createPiXiaozhiSession({ ...base, stateRoot: waitingState, approveCopy: async () => {
    approvalStarted(); return new Promise(resolve => { releaseApproval = resolve; });
  } });
  const running = waiting.prompt('请用 office_copy_file 把 copy.md 复制到 stopped.md。操作后再回复。');
  let startedTimer;
  await Promise.race([started, new Promise((_, reject) => { startedTimer = setTimeout(() => reject(new Error('Approval was not requested within 45 seconds')), 45000); })]).finally(() => clearTimeout(startedTimer));
  const busy = await waiting.prompt('同时发送另一个请求');
  await waiting.abort(); releaseApproval?.(true);
  const stopped = await running;
  await new Promise(resolve => setTimeout(resolve, 50));
  check('Stop during real model copy approval, reject reentry, no late write', () => {
    assert.equal(busy.error, 'busy'); assert.equal(stopped.error, 'cancelled');
    assert.equal(waiting.diagnostics().executing, 0); assert(!fs.existsSync(path.join(workspace, 'stopped.md')));
  });
  check('Public projection has monotonic events and omits credentials/private reasoning', () => {
    assert(events.every(e => ['text_delta', 'tool_start', 'tool_end', 'status'].includes(e.kind)));
    const lastBySession = new Map();
    for (const e of events) { const key = `${e.sessionId}:${e.runId}`; assert(e.sequence > (lastBySession.get(key) || 0)); lastBySession.set(key, e.sequence); }
    assert(!JSON.stringify(events).includes(apiKey));
    assert(!events.some(e => 'reasoning' in e || 'thinking' in e));
  });
  report.success = true; report.eventCount = events.length;
} catch (error) { report.failure = clean(error.stack).slice(0, 4000); process.exitCode = 1; }
finally {
  releaseApproval?.(false); await Promise.allSettled([agent?.dispose(), resumed?.dispose(), waiting?.dispose()]);
  const reportPath = path.join(output, 'report.json'); report.reportPath = reportPath;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  globalThis.piEducationHostReport = report;
  console.log(JSON.stringify({ ...report, reportPath: path.relative(appRoot, reportPath) }));
}
