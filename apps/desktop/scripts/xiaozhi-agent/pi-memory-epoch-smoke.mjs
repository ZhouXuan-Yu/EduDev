import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SessionManager } from '@earendil-works/pi-coding-agent';
const { createPiMemoryEpoch } = await import('../../src/main/xiaozhi-agent/native-memory-epoch.ts');
const { createPiMemoryScope } = await import('../../src/main/xiaozhi-agent/memory-scope.ts');
const { getPiProtectedContext } = await import('../../src/main/xiaozhi-agent/compaction-context.ts');
const { createPiMemoryTools } = await import('../../src/main/xiaozhi-agent/memory-tools.ts');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(root, 'test-results/xiaozhi-agent/pi-memory-epoch-'));
const checks = [], report = { suite: 'pi-memory-epoch-native', success: false, checks,
  boundaries: ['Real pinned Pi SessionManager and append-only JSONL, deterministic message fixtures', 'Controlled existing-memory adapters, no model provider or formal UI integration claimed'] };
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64);
const uuid = () => `run_${randomUUID()}`;
const assistant = content => ({ role: 'assistant', content: typeof content === 'string' ? [{ type: 'text', text: content }] : content,
  api: 'openai-completions', provider: 'fixture', model: 'fixture', timestamp: Date.now(), stopReason: 'stop',
  usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });
const newManager = () => { const manager = SessionManager.create(output, output); manager.appendCustomEntry('xiaozhi.education.snapshot.v1', { fixture: true }); return manager; };
const context = manager => JSON.stringify(manager.buildSessionContext().messages);
const reopen = manager => SessionManager.open(manager.getSessionFile(), output, output);
try {
  let manager = newManager(), epoch = createPiMemoryEpoch(manager, A);
  const safeRun = uuid(); epoch.beginRun(safeRun); manager.appendMessage({ role: 'user', content: '安全教师任务', timestamp: Date.now() }); manager.appendMessage(assistant('保留这条无记忆的回复'));
  const safeLeaf = manager.getLeafId(), safeContext = context(manager), taintedRun = uuid(), laterRun = uuid();
  epoch = createPiMemoryEpoch(manager, A); epoch.beginRun(taintedRun);
  const userEntry = manager.appendMessage({ role: 'user', content: '请引用所选教学偏好', timestamp: Date.now() });
  manager.appendMessage(assistant([{ type: 'toolCall', id: 'memory-call', name: 'read_education_memory', arguments: {} }]));
  epoch.beforeDelivery(); epoch.beforeDelivery();
  manager.appendMessage({ role: 'toolResult', toolCallId: 'memory-call', toolName: 'read_education_memory', content: [{ type: 'text', text: '撤销测试原始记忆标记Z9' }], details: {}, isError: false, timestamp: Date.now() });
  manager.appendMessage(assistant('基于撤销测试原始记忆标记Z9产生的派生结论'));
  epoch = createPiMemoryEpoch(manager, A); epoch.beginRun(laterRun); manager.appendMessage({ role: 'user', content: '承接之前的方案', timestamp: Date.now() }); manager.appendMessage(assistant('继续派生结论Z9'));
  manager.appendCompaction('已引用撤销测试原始记忆标记Z9与派生结论Z9的压缩摘要', userEntry, 5000);
  const originalFile = fs.readFileSync(manager.getSessionFile()), originalEntries = JSON.parse(JSON.stringify(manager.getEntries()));
  check('Native taint is recorded once and remains ancestor of actual tool results and compaction', () => {
    assert(context(manager).includes('撤销测试原始记忆标记Z9')); assert.equal(manager.getBranch().filter(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.memory.taint.v1').length, 1);
  });
  manager = reopen(manager); epoch = createPiMemoryEpoch(manager, B);
  check('Authority change branches before first memory read and excludes original, derived and compacted text', () => {
    assert.equal(epoch.isolated, true); assert.equal(context(manager), safeContext); assert.deepEqual(new Set(epoch.blockedRunIds()), new Set([taintedRun, laterRun])); assert(!epoch.blockedRunIds().includes(safeRun));
    assert.equal(manager.getBranch().at(-1).parentId, safeLeaf);
  });
  check('Append-only isolation preserves every existing entry and byte prefix without summary replay', () => {
    assert.deepEqual(manager.getEntries().slice(0, originalEntries.length), originalEntries);
    assert(fs.readFileSync(manager.getSessionFile()).subarray(0, originalFile.length).equals(originalFile));
    assert(!manager.getBranch().some(entry => entry.type === 'branch_summary'));
  });
  manager = reopen(manager); epoch = createPiMemoryEpoch(manager, B);
  check('Restart retains isolated branch and blocked host run IDs without repeating isolation', () => {
    assert.equal(epoch.isolated, false); assert.equal(context(manager), safeContext); assert.equal(epoch.blockedRunIds().length, 2);
  });
  const secondRun = uuid(); epoch.beginRun(secondRun); manager.appendMessage({ role: 'user', content: '新授权任务', timestamp: Date.now() });
  manager.appendMessage(assistant([{ type: 'toolCall', id: 'second-call', name: 'read_education_memory', arguments: {} }])); epoch.beforeDelivery();
  // Crash seam: marker exists, tool result has not yet been appended.
  manager = reopen(manager); epoch = createPiMemoryEpoch(manager, C);
  check('Crash before tool result and second revocation isolate without replay and retain prior blocked identities', () => {
    assert(epoch.isolated); assert.equal(context(manager), safeContext); assert.deepEqual(new Set(epoch.blockedRunIds()), new Set([taintedRun, laterRun, secondRun]));
  });
  check('Every request can reject changed or malformed authority before delivery', () => {
    epoch.check(C); assert.throws(() => epoch.check(B), /memory_scope_changed/); assert.throws(() => epoch.check('invalid'), /configuration/);
  });
  const clean = newManager(); createPiMemoryEpoch(clean, A).beginRun(uuid()); clean.appendMessage({ role: 'user', content: '没有读取记忆', timestamp: Date.now() }); clean.appendMessage(assistant('普通回复'));
  const cleanBefore = context(clean); const changedClean = createPiMemoryEpoch(reopen(clean), B);
  check('Changing selections without actual memory delivery preserves all normal conversation context', () => { assert(!changedClean.isolated); assert.equal(context(clean), cleanBefore); });
  const foreign = newManager(), rootLeaf = foreign.getLeafId(); foreign.appendMessage({ role: 'user', content: '另一分支', timestamp: Date.now() }); const foreignLeaf = foreign.getLeafId();
  foreign.branch(rootLeaf); foreign.appendCustomEntry('xiaozhi.memory.run.v1', { runId: uuid() }); foreign.appendCustomEntry('xiaozhi.memory.taint.v1', { authority: A, safeLeaf: foreignLeaf, runId: uuid() });
  const malformed = newManager(); malformed.appendCustomEntry('xiaozhi.memory.taint.v2', { authority: A });
  const broken = newManager(); broken.appendCustomEntry('xiaozhi.memory.taint.v1', { authority: A, safeLeaf: 'missing', runId: uuid() });
  check('Foreign/nonancestor safe leaf, missing anchor and future metadata reject closed', () => {
    assert.throws(() => createPiMemoryEpoch(foreign, B), /configuration/); assert.throws(() => createPiMemoryEpoch(malformed, B), /configuration/); assert.throws(() => createPiMemoryEpoch(broken, A), /configuration/);
  });
  const dangling = newManager(); dangling.appendMessage(assistant([{ type: 'toolCall', id: 'dangling', name: 'office_copy_file', arguments: {} }]));
  check('New run cannot choose a safe boundary inside unmatched tool call/result context', () => assert.throws(() => createPiMemoryEpoch(dangling, A).beginRun(uuid()), /configuration/));
  const crashed = newManager(), crashSafe = context(crashed), crashRun = uuid(); createPiMemoryEpoch(crashed, A).beginRun(crashRun);
  crashed.appendMessage({ role: 'user', content: '等待中的教师任务', timestamp: Date.now() });
  crashed.appendMessage(assistant([{ type: 'toolCall', id: 'question-crash', name: 'ask_teacher', arguments: {} }]));
  const crashBytes = fs.readFileSync(crashed.getSessionFile()); const recovered = reopen(crashed), recovery = createPiMemoryEpoch(recovered, A);
  check('Same-authority crash recovers only a host-owned run boundary, preserving original bytes and forbidding replay', () => {
    assert(recovery.isolated); assert.equal(recovery.isolationReason, 'interrupted_tool'); assert.equal(context(recovered), crashSafe); assert.deepEqual(recovery.blockedRunIds(), [crashRun]);
    assert(fs.readFileSync(crashed.getSessionFile()).subarray(0, crashBytes.length).equals(crashBytes)); recovery.beginRun(uuid());
  });
  let memoryReads = 0, processReads = 0;
  const tools = createPiMemoryTools({ runId: uuid(), readSelected: async () => { memoryReads++; return []; }, trace: async () => { processReads++; return null; } }, A, () => assert.fail('Empty memory must not taint history'));
  for (const tool of tools) for (const args of [{ sessionId: 'another' }, { runId: 'another' }, { ids: ['unselected'] }, null, []]) await assert.rejects(tool.execute('bad', args), /invalid_input/);
  await tools[0].execute('empty', {}); await tools[1].execute('own', {});
  check('Fixed model tools reject extra session, run and selection inputs before calling the main authority', () => { assert.equal(memoryReads, 1); assert.equal(processReads, 1); });

  const sessionId = `aisession_${randomUUID()}`, id = `memory_entry_${randomUUID()}`;
  let fact = { id, documentId: 'teacher-original', text: '教学随机偏好R7，假手机号13800138000', version: 1, status: 'active', section: '备课', refs: [{ kind: 'event', id: 'own-event', label: '假手机号13800138000来源' }] };
  const fingerprint = value => createHash('sha256').update(JSON.stringify({ id: value.id, version: value.version, text: value.text, status: value.status, refs: value.refs, surfaces: [], documentId: value.documentId })).digest('hex');
  let saved = { version: 1, enabled: true, selections: [{ layer: 'L2', source: 'chat', id, version: 1, fingerprint: fingerprint(fact) }] }, mutateDuringSanitize = false;
  const sourceStore = { xiaozhiState: { memoryScope: async () => structuredClone(saved) }, getAiConversationSession: async value => { assert.equal(value, sessionId); return { session: { archivedAt: '' } }; },
    getAiMemoryDocument: async source => ({ entries: source === 'chat' ? [structuredClone(fact)] : [] }), getAiMemoryL3Document: async () => ({ entries: [] }),
    sanitizeProblemText: async text => { if (mutateDuringSanitize) { mutateDuringSanitize = false; fact = { ...fact, text: '读取期间来源修改' }; } return { sanitizedText: text.replaceAll('13800138000', '[手机号]') }; } };
  const source = createPiMemoryScope(sourceStore); let authority = await source.authority(sessionId);
  const payload = await source.readSelected(sessionId, authority.fingerprint);
  check('Main model payload uses only explicit selected current facts and redacts text and reference labels', () => {
    assert.equal(payload.length, 1); assert(payload[0].text.includes('[手机号]')); assert.equal(payload[0].refs[0].label, '假手机号[手机号]来源');
    assert(!JSON.stringify(payload).includes('fingerprint')); assert(!JSON.stringify(payload).includes('teacher-original')); assert(!JSON.stringify(payload).includes(id));
  });
  mutateDuringSanitize = true; await assert.rejects(source.readSelected(sessionId, authority.fingerprint), /memory_scope_changed/);
  check('Concurrent source mutation during sanitation rejects before any selected payload returns', () => assert.equal((fact.text), '读取期间来源修改'));
  fact = { ...fact, status: 'disabled' }; const disabled = await source.authority(sessionId); await assert.rejects(source.readSelected(sessionId, disabled.fingerprint), /memory_scope_changed/);
  saved = { ...saved, version: 2, enabled: false, selections: [] }; authority = await source.authority(sessionId); assert.deepEqual(await source.readSelected(sessionId, authority.fingerprint), []);
  const stop = new AbortController(); stop.abort(); await assert.rejects(source.readSelected(sessionId, authority.fingerprint, stop.signal));
  check('Disabled facts cannot be read, explicit closed scope returns no text and cancellation prevents delivery', () => {});
  fact = { ...fact, status: 'active' };
  saved = { version: 3, enabled: true, selections: [] }; authority = await source.authority(sessionId);
  assert.deepEqual(await source.readSelected(sessionId, authority.fingerprint), []);
  check('Enabled scope with no explicit selected facts cannot read the available global source', () => assert.equal(saved.selections.length, 0));
  const l3Fact = { id: `memory_l3_entry_${randomUUID()}`, documentId: 'local-l3', text: '采用纸条教学，13800138000', version: 1, status: 'active', sourceDocuments: ['chat'] };
  sourceStore.getAiMemoryL3Document = async slot => ({ entries: slot === 'profile' ? [l3Fact] : [] });
  saved = { version: 4, enabled: true, selections: [{ layer: 'L3', source: 'profile', id: l3Fact.id, version: 1,
    fingerprint: createHash('sha256').update(JSON.stringify({ id: l3Fact.id, version: l3Fact.version, text: l3Fact.text, status: l3Fact.status, refs: [], surfaces: l3Fact.sourceDocuments, documentId: l3Fact.documentId })).digest('hex') }] };
  authority = await source.authority(sessionId); const l3Payload = await source.readSelected(sessionId, authority.fingerprint);
  check('L3 model payload preserves actual surface-only provenance and never invents event references', () => {
    assert.equal(l3Payload[0].provenance, 'surface_only'); assert.deepEqual(l3Payload[0].sourceDocuments, ['对话摘要']); assert.deepEqual(l3Payload[0].refs, []); assert(!l3Payload[0].text.includes('13800138000'));
  });

  const taintedId = 'host-tainted', safeId = 'host-safe';
  const plans = [{ kind: 'plan', runId: safeId, steps: [{ text: '保留安全计划', status: 'pending' }] }, { kind: 'plan', runId: taintedId, steps: [{ text: '撤销派生计划秘密Q2', status: 'pending' }] }];
  const approvals = [{ runId: safeId, source: '安全源.txt', target: '安全目标.txt', state: 'executed', sourceSha256: A }, { runId: taintedId, source: '撤销派生审批秘密Q2.txt', target: '旧目标.txt', state: 'executed', sourceSha256: B }];
  const messages = [safeId, taintedId].map(runId => ({ metadata: { agentRunId: runId, piVersion: 'xiaozhi.pi.education.v1', publicItems: [{ kind: 'tool', sources: [{ title: runId === safeId ? '保留安全资料' : '撤销派生来源秘密Q2' }] }] } }));
  const projectionStore = { xiaozhiState: { controls: async () => plans, approvals: async () => approvals }, getAiConversationSession: async () => ({ messages }), sanitizeProblemText: async text => ({ sanitizedText: text }) };
  const beforeFacts = JSON.stringify({ plans, approvals, messages }); const protectedText = await getPiProtectedContext(projectionStore, sessionId, [taintedId]);
  check('Protected SQLite projections cannot reintroduce tainted plans, titles or approval text; original facts persist', () => {
    assert(protectedText.includes('保留安全计划')); assert(protectedText.includes('保留安全资料')); assert(protectedText.includes('安全目标.txt')); assert(!protectedText.includes('秘密Q2'));
    assert.equal(JSON.stringify({ plans, approvals, messages }), beforeFacts);
  });
  report.success = true;
} catch (error) { report.failure = String(error.stack).slice(0, 2200); process.exitCode = 1; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, report: path.relative(root, path.join(output, 'report.json')) })); }
