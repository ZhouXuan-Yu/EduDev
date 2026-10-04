import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
const { createPiXiaozhiSession } = await import('../../src/main/xiaozhi-agent/pi-session.ts');
const { createEducationSkillRuntime } = await import('../../src/main/xiaozhi-agent/skill-runtime.ts');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(root, 'test-results/xiaozhi-agent/pi-skills-boundary-'));
const stateRoot = path.join(output, 'state'), workspace = path.join(output, 'workspace');
fs.mkdirSync(stateRoot); fs.mkdirSync(workspace);
const checks = [], report = { success: false, checks, suite: 'pi-education-skills-boundary', boundaries: ['Synthetic stream for SDK command and permission checks; not provider/UI proof'] };
let agent;
const base = { stateRoot, workspace, apiKey: 'isolated-synthetic-key', model: 'deepseek-chat' };
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); };
function inject(target, capture) {
  target.session.agent.streamFn = (_model, context) => {
    capture.push(JSON.parse(JSON.stringify(context)));
    const stream = createAssistantMessageEventStream();
    const message = { role: 'assistant', content: [{ type: 'text', text: '已根据技能说明完成正文草稿。' }], stopReason: 'stop', provider: 'xiaozhi_deepseek', api: 'openai-completions', model: 'deepseek-chat', timestamp: Date.now(),
      usage: { input: 1, output: 1, totalTokens: 2, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 } } };
    stream.push({ type: 'done', reason: 'stop', message }); stream.end(); return stream;
  };
}
try {
  // First create a genuine legacy SDK history, then upgrade without rewriting it.
  agent = await createPiXiaozhiSession(base); const calls = []; inject(agent, calls); const legacy = await agent.prompt('旧历史测试'); assert(legacy.ok, JSON.stringify(legacy));
  const sessionFile = agent.sessionFile, original = fs.readFileSync(sessionFile); await agent.dispose();
  agent = await createPiXiaozhiSession({ ...base, sessionFile, educationSkills: true }); inject(agent, calls);
  check('Legacy native prefix preserved and Skills snapshot appended independently', () => { assert(fs.readFileSync(sessionFile).subarray(0, original.length).equals(original)); assert(agent.session.systemPrompt.includes('<available_skills>')); assert(agent.session.systemPrompt.includes('lesson-preparation')); assert(!agent.diagnostics().activeTools.includes('bash')); });
  const resources = agent.session.resourceLoader.getSkills();
  check('Pi native discovery resolves four real Hana session pointers', () => { assert.equal(resources.skills.length, 4); assert.equal(resources.diagnostics.length, 0); assert(resources.skills.every(s => s.runtimeIdentity.kind === 'skill_pointer')); });
  const native = await agent.prompt('/skill:lesson-preparation 制定教案');
  check('Native skill command expands full instructions into the real SDK user message', () => { assert(native.ok); const user = calls.at(-1).messages.filter(m => m.role === 'user').at(-1); const text = user.content.map(item => item.text || '').join(''); assert(text.includes('<skill name="lesson-preparation"')); assert(text.includes('备课流程')); assert(text.includes('制定教案')); });
  const library = await createEducationSkillRuntime(path.join(stateRoot, 'agent'), sessionFile), skillPath = resources.skills[0].filePath;
  const read = await library.tool.execute('read-registered', { path: skillPath });
  check('Restricted custom read returns actual registered instruction source', () => { assert(read.content[0].text.includes('执行规则')); assert(read.details.success); assert(!JSON.stringify(read.details).includes(stateRoot)); });
  await assert.rejects(library.tool.execute('arbitrary-path', { path: path.join(workspace, 'secret.md') }), /permission_denied/);
  await assert.rejects(library.tool.execute('extra-key', { path: skillPath, command: 'execute' }), /invalid_input/);
  await assert.rejects(library.tool.execute('relative', { path: '../secret.md' }), /invalid_input/);
  check('Arbitrary, relative and extra-field reads reject without acquiring file authority', () => {});
  const count = calls.length; const unknown = await agent.prompt('/skill:unregistered 测试');
  check('Unknown explicit command rejects before model entry', () => { assert.equal(unknown.error, 'invalid_input'); assert.equal(calls.length, count); });
  await agent.dispose(); agent = undefined;
  await assert.rejects(createPiXiaozhiSession({ ...base, sessionFile }), /configuration/);
  check('An adapter without Skills refuses Skills-bearing native history', () => {});
  let queued = false; const applied = [];
  agent = await createPiXiaozhiSession({ ...base, sessionFile, educationSkills: true,
    onInstructionApplied: async id => { applied.push(id); },
    onEvent: event => { if (event.kind === 'status' && event.status === 'running' && !queued) { queued = true; void agent.queue('skill-queued-id', '/skill:teaching-office 起草一行纪要', 'followUp'); } },
  }); inject(agent, calls);
  const followup = await agent.prompt('先完成当前任务，再接着处理补充');
  check('Native queued skill expansion consumes the correct instruction once', () => { assert(followup.ok, JSON.stringify(followup)); assert.deepEqual(applied, ['skill-queued-id']); assert(calls.at(-1).messages.filter(m => m.role === 'user').at(-1).content[0].text.includes('<skill name="teaching-office"')); });
  const document = fs.readFileSync(skillPath); fs.appendFileSync(skillPath, '\nmodified instructions');
  const modified = await agent.prompt('不要用已变化技能继续');
  check('Changed source refuses the next request and preserves original private history', () => { assert.equal(modified.error, 'skill_source_changed'); assert(fs.readFileSync(sessionFile).subarray(0, original.length).equals(original)); });
  await assert.rejects(library.tool.execute('changed-read', { path: skillPath }), /skill_source_changed/);
  await agent.dispose(); agent = undefined;
  await assert.rejects(createPiXiaozhiSession({ ...base, sessionFile, educationSkills: true }), /skill_source_changed/);
  check('Changed source also rejects read and restart; never silently overwrites source', () => assert(fs.readFileSync(skillPath).toString().endsWith('modified instructions')));
  fs.writeFileSync(skillPath, document); fs.unlinkSync(skillPath);
  assert.throws(() => library.check(), /skill_source_changed/);
  check('Deleted pointer fails explicitly during an active catalog', () => {});
  // Exact reviewed bytes can be recreated on startup; an existing mismatch cannot.
  agent = await createPiXiaozhiSession({ ...base, sessionFile, educationSkills: true });
  check('Restart recreates missing immutable reviewed resource with identical content', () => assert.equal(createHash('sha256').update(fs.readFileSync(skillPath)).digest('hex'), createHash('sha256').update(document).digest('hex')));
  let starts = 0, forceEnd, mutation;
  agent.session.agent.streamFn = (model, _context, options) => {
    starts++; const stream = createAssistantMessageEventStream();
    const finish = () => { const message = { role: 'assistant', content: [], stopReason: 'aborted', provider: model.provider, api: model.api, model: model.id, timestamp: Date.now(),
      usage: { input: 0, output: 0, totalTokens: 0, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 } } }; stream.push({ type: 'done', reason: 'aborted', message }); stream.end(); };
    forceEnd = finish; options.signal.addEventListener('abort', finish, { once: true });
    mutation = setTimeout(() => fs.appendFileSync(skillPath, '\nactive source changed'), 20); return stream;
  };
  let timer; const live = await Promise.race([agent.prompt('观察运行中的技能失效'), new Promise((_, reject) => { timer = setTimeout(() => { forceEnd?.(); reject(new Error('Skill watcher did not stop active stream')); }, 4000); })]).finally(() => { clearTimeout(timer); clearTimeout(mutation); });
  check('Source observer aborts an active SDK stream and returns the source error', () => { assert.equal(live.error, 'skill_source_changed'); assert.equal(starts, 1); });
  fs.writeFileSync(skillPath, document); const later = await agent.prompt('同一失效运行对象不可继续');
  check('A failed runtime remains fenced even if original bytes are restored', () => { assert.equal(later.error, 'skill_source_changed'); assert.equal(starts, 1); });
  report.success = true;
} catch (error) { report.error = String(error?.stack || error); process.exitCode = 1; }
finally { await agent?.dispose().catch(() => {}); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: checks.length, error: report.error, report: path.relative(root, path.join(output, 'report.json')) })); }
