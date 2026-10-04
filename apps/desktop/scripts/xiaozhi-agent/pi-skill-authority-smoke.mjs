import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
const { createPiMemoryEpoch } = await import('../../src/main/xiaozhi-agent/native-memory-epoch.ts');
const { createPiSkillEpoch, legacySkillIdentity, skillAuthority } = await import('../../src/main/xiaozhi-agent/native-skill-epoch.ts');
const { createManagedEducationSkills } = await import('../../src/main/xiaozhi-agent/managed-skills.ts');
const { createPiSkillCatalogState } = await import('../../src/main/xiaozhi-agent/skill-catalog-state.ts');
const { createManagedSkillRuntime } = await import('../../src/main/xiaozhi-agent/managed-skill-runtime.ts');
const { createPiXiaozhiSession } = await import('../../src/main/xiaozhi-agent/pi-session.ts');
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), output = fs.mkdtempSync(path.join(desktop, 'test-results/xiaozhi-agent/pi-skill-authority-'));
const checks = [], report = { suite: 'pi-skill-authority-native', success: false, checks, boundaries: [
  'Real Pi native manager/SDK and local managed packages with deterministic model streams',
  'No production managed Skills host/UI/binding v4 or provider acceptance claimed',
] };
const A = 'a'.repeat(64), B = 'b'.repeat(64), originalIdentity = legacySkillIdentity(), otherIdentity = originalIdentity.slice(1);
const check = async (name, fn) => { await fn(); checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const newManager = () => { const manager = SessionManager.create(output, output); manager.appendCustomEntry('xiaozhi.education.snapshot.v1', { fixture: true }); return manager; };
const reopen = manager => SessionManager.open(manager.getSessionFile(), output, output);
const context = manager => JSON.stringify(manager.buildSessionContext().messages);
const runId = () => `run_${randomUUID()}`;
const message = (text, content) => ({ role: 'assistant', content: content || [{ type: 'text', text }], stopReason: 'stop', provider: 'fixture', api: 'openai-completions', model: 'deepseek-chat', timestamp: Date.now(),
  usage: { input: 1, output: 1, totalTokens: 2, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 } } });
let db, agent;
try {
  let manager = newManager(), memory = createPiMemoryEpoch(manager, A), skills = createPiSkillEpoch(manager, originalIdentity);
  const first = runId(); memory.beginRun(first); skills.beginRun(first, true); skills.beforeDelivery(); skills.beforeDelivery();
  manager.appendMessage({ role: 'user', content: '引用技能说明', timestamp: Date.now() }); manager.appendMessage(message('技能派生标记S1'));
  await check('Separate skill delivery reuses one main RUN and does not mark education memory read', async () => {
    assert.equal(manager.getBranch().filter(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.memory.run.v1').length, 1);
    assert(!memory.hasDelivery()); assert(skills.hasDelivery());
  });
  memory = createPiMemoryEpoch(manager, A); skills = createPiSkillEpoch(manager, originalIdentity);
  const second = runId(); memory.beginRun(second); skills.beginRun(second, true); skills.beforeDelivery(); memory.beforeDelivery();
  const user = manager.appendMessage({ role: 'user', content: '根据记忆与技能继续', timestamp: Date.now() }); manager.appendMessage(message('记忆与技能派生M2S2'));
  manager.appendCompaction('技能标记S1与记忆派生M2S2的旧摘要', user, 5000);
  const bytes = fs.readFileSync(manager.getSessionFile());
  manager = reopen(manager); memory = createPiMemoryEpoch(manager, B);
  await check('Memory-only revocation isolates its suffix while retaining earlier valid Skill context', async () => {
    assert(memory.isolated); assert.deepEqual(memory.blockedRunIds(), [second]); assert(context(manager).includes('S1')); assert(!context(manager).includes('M2S2'));
  });
  skills = createPiSkillEpoch(manager, otherIdentity);
  await check('Later skill revocation removes all Skill-derived/compacted text and retains memory blocked IDs after pruning its marker', async () => {
    assert(skills.isolated); assert.equal(skills.isolationReason, 'skill_authority'); assert(!context(manager).includes('S1')); assert(!context(manager).includes('M2S2'));
    assert.deepEqual(new Set(skills.blockedRunIds()), new Set([first, second]));
    assert(fs.readFileSync(manager.getSessionFile()).subarray(0, bytes.length).equals(bytes)); assert(!manager.getBranch().some(entry => entry.type === 'branch_summary'));
  });
  manager = reopen(manager); memory = createPiMemoryEpoch(manager, B); skills = createPiSkillEpoch(manager, otherIdentity);
  await check('Both authority namespaces recover the union of prior revoked run identities after restart', async () => {
    assert.deepEqual(new Set(memory.blockedRunIds()), new Set([first, second])); assert.deepEqual(new Set(skills.blockedRunIds()), new Set([first, second]));
    assert(!skills.isolated); assert(!memory.hasDelivery());
  });
  const third = runId(); memory.beginRun(third); skills.beginRun(third, true); skills.beforeDelivery(); memory.beforeDelivery();
  manager.appendMessage(message('第二轮授权产生S3')); manager = reopen(manager); skills = createPiSkillEpoch(manager, []); memory = createPiMemoryEpoch(manager, A);
  await check('Reverse-order skill then memory revocation preserves all exclusions without reviving previous text', async () => {
    assert(!context(manager).includes('S3')); assert.deepEqual(new Set(memory.blockedRunIds()), new Set([first, second, third]));
    assert.deepEqual(new Set(createPiSkillEpoch(reopen(manager), []).blockedRunIds()), new Set([first, second, third]));
  });
  await check('Skill authority mismatch and malformed identities fail with stable errors', async () => {
    skills.check(skillAuthority([])); assert.throws(() => skills.check(skillAuthority(originalIdentity)), /skill_scope_changed/);
    assert.throws(() => createPiSkillEpoch(newManager(), [{ name: 'bad_name', sha256: A }]), /configuration/);
    assert.throws(() => createPiSkillEpoch(newManager(), [...originalIdentity, originalIdentity[0]]), /configuration/);
  });
  const old = newManager(); old.appendMessage(message('安全的更早对话'));
  old.appendCustomEntry('xiaozhi.education.skills.v1', { version: 1, identity: originalIdentity });
  const oldSafe = context(old), oldRun = runId(); createPiMemoryEpoch(old, A).beginRun(oldRun); old.appendMessage(message('旧A技能派生L1'));
  const oldBytes = fs.readFileSync(old.getSessionFile()); let oldCopy = reopen(old); let upgraded = createPiSkillEpoch(oldCopy, originalIdentity);
  await check('Reviewed v1 history upgrades conservatively at the actual first main RUN while unchanged identity preserves context', async () => {
    assert(!upgraded.isolated); assert(context(oldCopy).includes('L1')); assert(oldCopy.getBranch().some(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.skills.taint.v1'));
    assert(fs.readFileSync(old.getSessionFile()).subarray(0, oldBytes.length).equals(oldBytes));
  });
  oldCopy = reopen(oldCopy); upgraded = createPiSkillEpoch(oldCopy, otherIdentity);
  await check('Subsequent v1-upgrade revocation restores original safe native prefix', async () => { assert(upgraded.isolated); assert.equal(context(oldCopy), oldSafe); assert.deepEqual(upgraded.blockedRunIds(), [oldRun]); });
  const unmapped = newManager(); unmapped.appendCustomEntry('xiaozhi.education.skills.v1', { version: 1, identity: originalIdentity }); unmapped.appendMessage(message('没有main RUN的旧技能文本'));
  const unmappedBytes = fs.readFileSync(unmapped.getSessionFile());
  await check('Legacy history with no proven RUN rejects without appending guessed migration markers', async () => {
    assert.throws(() => createPiSkillEpoch(unmapped, originalIdentity), /configuration/); assert(fs.readFileSync(unmapped.getSessionFile()).equals(unmappedBytes));
  });
  const emptyOld = newManager(); emptyOld.appendCustomEntry('xiaozhi.education.skills.v1', { version: 1, identity: originalIdentity });
  await check('Empty v1 history upgrades without fabricating a delivery or run', async () => { const item = createPiSkillEpoch(emptyOld, otherIdentity); assert(!item.hasDelivery()); assert(!item.isolated); });
  const future = newManager(), leaf = future.getLeafId(); future.appendCustomEntry('xiaozhi.skills.taint.v9', { authority: A }); future.branch(leaf); future.appendMessage(message('安全分支'));
  await check('Off-branch future markers and altered reviewed v1 identities reject before mutation', async () => {
    const before = fs.readFileSync(future.getSessionFile()); assert.throws(() => createPiSkillEpoch(future, originalIdentity), /configuration/); assert(fs.readFileSync(future.getSessionFile()).equals(before));
    const altered = newManager(); altered.appendCustomEntry('xiaozhi.education.skills.v1', { version: 1, identity: otherIdentity }); assert.throws(() => createPiSkillEpoch(altered, otherIdentity), /configuration/);
  });
  const pending = newManager(), pendingEpoch = createPiSkillEpoch(pending, originalIdentity), crashedId = runId(); pendingEpoch.beginRun(crashedId); pendingEpoch.beforeDelivery();
  pending.appendMessage(message('', [{ type: 'toolCall', id: 'unpaired-skill', name: 'read', arguments: {} }]));
  const recovered = createPiSkillEpoch(reopen(pending), originalIdentity);
  await check('Skill-only SDK crash recovers the proven shared run without replaying an unmatched tool', async () => { assert(recovered.isolated); assert.equal(recovered.isolationReason, 'interrupted_tool'); assert.deepEqual(recovered.blockedRunIds(), [crashedId]); });
  db = new DatabaseSync(path.join(output, 'skills.db'));
  const state = createPiSkillCatalogState({ run: async (query, values = []) => db.prepare(query).run(...values), change: async (query, values = []) => Number(db.prepare(query).run(...values).changes), all: async (query, values = []) => db.prepare(query).all(...values) });
  const managed = createManagedEducationSkills({ root: path.join(output, 'packages'), state, assertIdle: () => {} }); let catalog = await managed.initialize();
  const sourceDir = path.join(output, 'source'); fs.mkdirSync(path.join(sourceDir, 'references'), { recursive: true });
  const customDoc = '---\nname: teacher-meeting\ndescription: 教学会议纪要格式\n---\n\n# 教研纪要\n\nREVOKED_CUSTOM_SKILL_INSTRUCTIONS_SENTINEL\n记录教学事项，假手机号13800138000只保留脱敏文本。\n参阅 references/guide.md。\n';
  fs.writeFileSync(path.join(sourceDir, 'SKILL.md'), customDoc); fs.writeFileSync(path.join(sourceDir, 'references/guide.md'), '引用规则，假手机号13800138000。');
  fs.writeFileSync(path.join(sourceDir, 'helper.py'), 'raise RuntimeError("must not execute")'); fs.writeFileSync(path.join(sourceDir, 'photo.bin'), Buffer.from([1, 2, 3]));
  catalog = await managed.importDirectory(sourceDir, catalog.revision); catalog = await managed.setEnabled('teacher-meeting', catalog.revision, true);
  const source = { resources: () => managed.enabledResources(), sanitize: async text => text.replaceAll('13800138000', '[手机号]') };
  const stateRoot = path.join(output, 'state'), workspace = path.join(output, 'workspace'), sessionDir = path.join(stateRoot, 'sessions'); fs.mkdirSync(sessionDir, { recursive: true }); fs.mkdirSync(workspace);
  const native = SessionManager.create(workspace, sessionDir), agentDir = path.join(stateRoot, 'agent');
  const runtime = await createManagedSkillRuntime(agentDir, native.getSessionFile(), source), descriptor = runtime.result.skills.find(item => item.name === 'teacher-meeting');
  await check('Managed native resources contain only necessary sanitized text, preserve original package, and reuse Hana pointers', async () => {
    assert.equal(runtime.result.skills.length, 5); assert(runtime.result.skills.every(item => item.runtimeIdentity.kind === 'skill_pointer'));
    assert(!fs.readFileSync(descriptor.filePath, 'utf8').includes('13800138000')); assert(fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8').includes('13800138000'));
    assert(!fs.existsSync(path.join(descriptor.baseDir, 'helper.py'))); assert(!fs.existsSync(path.join(descriptor.baseDir, 'photo.bin')));
  });
  await check('Registered reference read is sanitized while scripts/original paths/arbitrary references reject', async () => {
    const result = await runtime.tool.execute('guide', { path: path.join(descriptor.baseDir, 'references/guide.md') }); assert(result.content[0].text.includes('[手机号]')); assert(!result.content[0].text.includes('13800138000'));
    for (const file of [path.join(descriptor.baseDir, 'helper.py'), path.join(sourceDir, 'SKILL.md'), path.join(workspace, 'secret.md')]) await assert.rejects(runtime.tool.execute('bad', { path: file }), /permission_denied/);
    await assert.rejects(runtime.tool.execute('extra', { path: descriptor.filePath, command: 'run' }), /invalid_input/);
  });
  const captures = [], events = [], base = { stateRoot, workspace, apiKey: 'synthetic-test-only', model: 'deepseek-chat', educationSkills: true, managedSkills: source, onEvent: event => events.push(event) };
  agent = await createPiXiaozhiSession(base);
  const inject = target => { target.session.agent.streamFn = (_model, ctx) => { captures.push(JSON.parse(JSON.stringify(ctx))); const stream = createAssistantMessageEventStream(); stream.push({ type: 'done', reason: 'stop', message: message('技能任务已起草。') }); stream.end(); return stream; }; };
  inject(agent); let result = await agent.prompt('/skill:teacher-meeting 写一段纪要'); assert(result.ok, JSON.stringify(result)); const sessionFile = agent.sessionFile;
  await check('Actual Pi explicit command expands the sanitized custom document and persists one native run', async () => {
    const user = captures.at(-1).messages.filter(item => item.role === 'user').at(-1); assert(JSON.stringify(user).includes('<skill name=\\"teacher-meeting\\"')); assert(!JSON.stringify(user).includes('13800138000'));
    const manager = SessionManager.open(sessionFile, sessionDir, workspace); assert.equal(manager.getBranch().filter(item => item.type === 'custom' && item.customType === 'xiaozhi.memory.run.v1').length, 1);
  });
  await agent.dispose(); agent = undefined; catalog = await managed.setEnabled('teacher-meeting', catalog.revision, false);
  await assert.rejects(runtime.check(), /skill_scope_changed/);
  agent = await createPiXiaozhiSession({ ...base, sessionFile }); inject(agent); result = await agent.prompt('继续当前普通办公任务'); assert(result.ok, JSON.stringify(result));
  await check('Reopening after disabling custom Skill isolates old expanded text and emits accurate public receipt', async () => {
    // Pi1 persists all system declarations in messages; a generic catalogue term
    // can also describe other still-enabled Skills. Fence the unique delivered body.
    assert(!JSON.stringify(captures.at(-1).messages).includes('REVOKED_CUSTOM_SKILL_INSTRUCTIONS_SENTINEL')); assert(events.some(event => event.kind === 'skill_isolation' && event.reason === 'skill_authority'));
    assert(!(agent.session.resourceLoader.getSkills()).skills.some(item => item.name === 'teacher-meeting'));
  });
  await agent.dispose(); agent = undefined;
  await assert.rejects(createPiXiaozhiSession({ ...base, managedSkills: undefined, sessionFile }), /configuration/);
  await check('Old fixed-Skills adapter cannot reopen v2 history without managed authority handling', async () => {});
  catalog = await managed.setEnabled('teacher-meeting', catalog.revision, true); agent = await createPiXiaozhiSession({ ...base, sessionFile });
  let forceEnd, starts = 0, change;
  agent.session.agent.streamFn = (_model, _ctx, options) => {
    starts++; const stream = createAssistantMessageEventStream(); const finish = () => { stream.push({ type: 'done', reason: 'aborted', message: { ...message(''), content: [], stopReason: 'aborted' } }); stream.end(); };
    forceEnd = finish; options.signal.addEventListener('abort', finish, { once: true }); change = setTimeout(() => { void managed.setEnabled('teacher-meeting', catalog.revision, false).then(next => { catalog = next; }); }, 30); return stream;
  };
  let timeout; result = await Promise.race([agent.prompt('等待期间观察技能授权变化'), new Promise((_, reject) => { timeout = setTimeout(() => { forceEnd?.(); reject(new Error('Skill authority watch failed')); }, 6000); })]).finally(() => { clearTimeout(timeout); clearTimeout(change); });
  await check('500ms authority observer aborts active SDK stream and fences the failed runtime', async () => {
    assert.equal(result.error, 'skill_scope_changed'); catalog = await managed.setEnabled('teacher-meeting', catalog.revision, true);
    assert.equal((await agent.prompt('恢复后不能复活旧对象')).error, 'skill_scope_changed'); assert.equal(starts, 1);
  });
  await agent.dispose(); agent = undefined;
  const versioned = await createManagedSkillRuntime(agentDir, native.getSessionFile(), source), authority = versioned.authority;
  catalog = await managed.edit('teacher-meeting', catalog.revision, customDoc); catalog = await managed.setEnabled('teacher-meeting', catalog.revision, true);
  const edited = await createManagedSkillRuntime(agentDir, native.getSessionFile(), source);
  await check('Even identical re-enabled instructions at a new teacher version change authority and fence old descriptor', async () => { assert.notEqual(edited.authority, authority); await assert.rejects(versioned.check(), /skill_scope_changed/); });
  let changedDuringSanitize = false;
  await assert.rejects(createManagedSkillRuntime(agentDir, native.getSessionFile(), { ...source, sanitize: async text => { if (!changedDuringSanitize) { changedDuringSanitize = true; catalog = await managed.setEnabled('teacher-meeting', catalog.revision, false); } return text; } }), /skill_scope_changed/);
  await check('Authority mutation during sanitation is rejected before native resource delivery', async () => assert(changedDuringSanitize));
  const fixed = await createManagedSkillRuntime(agentDir, native.getSessionFile(), source), fixedDescriptor = fixed.result.skills[0];
  fs.appendFileSync(fixedDescriptor.filePath, '\nchanged cache');
  await check('Tampered sanitized model cache refuses read instead of overwriting it', async () => { await assert.rejects(fixed.tool.execute('tampered', { path: fixedDescriptor.filePath }), /skill_source_changed/); assert(fs.readFileSync(fixedDescriptor.filePath, 'utf8').endsWith('changed cache')); });
  await check('Restart refuses a changed cache before native parsing and extra files cannot enter model resources', async () => {
    await assert.rejects(createManagedSkillRuntime(agentDir, native.getSessionFile(), source), /skill_source_changed/);
    // Restore only this synthetic derived test cache, then introduce an unregistered parser input.
    const expectedRaw = (await managed.enabledResources()).resources.find(item => item.item.name === fixedDescriptor.name).bytes.get('SKILL.md');
    fs.writeFileSync(fixedDescriptor.filePath, expectedRaw.toString('utf8').replaceAll('13800138000', '[手机号]'));
    fs.writeFileSync(path.join(fixedDescriptor.baseDir, '.gitignore'), 'SKILL.md\n');
    await assert.rejects(createManagedSkillRuntime(agentDir, native.getSessionFile(), source), /skill_source_changed/);
  });
  report.success = true;
} catch (error) { report.error = String(error?.stack || error).slice(0, 1500); process.exitCode = 1; }
finally { await agent?.dispose().catch(() => {}); db?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: checks.length, error: report.error, output })); }
