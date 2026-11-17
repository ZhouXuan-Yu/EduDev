import './phase6-state-foundation-worker.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {openFixture} from './phase6-state-foundation-worker.mjs';
const {captureRetiredPrivateHistory} = await import('../../src/main/xiaozhi-agent/skills/private-history.ts');
const {createSkillPrivateContext} = await import('../../src/main/xiaozhi-agent/skills/private-context.ts');
const {createSkillValidator} = await import('../../src/main/xiaozhi-agent/skills/validation.ts');
const {protocolHash} = await import('../../src/main/xiaozhi-agent/capabilities/validation.ts');
const {toolResultDigest} = await import('../../src/main/xiaozhi-agent/events/native-tail.ts');
const {createPiSkillCatalogState} = await import('../../src/main/xiaozhi-agent/skill-catalog-state.ts');
const {createManagedEducationSkills} = await import('../../src/main/xiaozhi-agent/managed-skills.ts');
const {createSkillGovernanceState} = await import('../../src/main/xiaozhi-agent/skills/state.ts');
const {createSkillGovernance} = await import('../../src/main/xiaozhi-agent/skills/service.ts');
const {createSkillCreatorTools} = await import('../../src/main/xiaozhi-agent/skills/tools.ts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-private-history-'));
const report = {success: false, root, checks: [], sources: ['skills/private-history.ts', 'skills/private-context.ts', 'skills/validation.ts', 'events/native-tail.ts']
  .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(path.join('src/main/xiaozhi-agent', file))).digest('hex')}))};
const fixture = await openFixture(path.join(root, 'state'));
try {
  const run = await fixture.fresh(), callId = 'private_' + randomUUID(), tool = 'office_read_text';
  const excerpt = 'Owned teacher private historical material with an unmistakable synthetic paragraph and provenance.';
  const content = [{type: 'text', text: excerpt}], resultDigest = toolResultDigest(tool, content, false);
  const file = path.join(root, 'old.jsonl'), markerId = '1a1a1a1a';
  const rows = [{type: 'session', version: 3, id: randomUUID(), cwd: root},
    {type: 'custom', id: markerId, customType: 'xiaozhi.event-owner.v1', data: {schemaVersion: 1, ...run.owner}},
    {type: 'message', id: '2b2b2b2b', parentId: markerId, message: {role: 'assistant', content: [{type: 'toolCall', id: callId, name: tool, arguments: {path: 'owned.txt'}}]}},
    {type: 'message', id: '3c3c3c3c', parentId: '2b2b2b2b', message: {role: 'toolResult', toolCallId: callId, toolName: tool, content, isError: false}}];
  const bytes = rows.map(row => JSON.stringify(row)).join('\n') + '\n'; fs.writeFileSync(file, bytes);
  const binding = {file: 'old.jsonl', offset: 0, anchor: createHash('sha256').update('').digest('hex'), markerId, ...run.owner};
  await run.publisher.persist(owner => fixture.journal.bindNative(owner, binding));
  run.publisher.enqueue({kind: 'tool_start', callId, tool, label: 'Owned private history'}); await run.publisher.flush();
  await run.publisher.persist(owner => fixture.journal.admitTool(owner, callId, tool));
  run.publisher.enqueue({kind: 'tool_end', callId, tool, success: true}, undefined, {callId, tool, digest: resultDigest, failed: false});
  await run.publisher.flush();
  const document = {schemaVersion: 1, owner: {...run.owner, taskId: run.task.id},
    previousBinding: {conversation_id: run.sessionId, session_file: 'old.jsonl'}};
  const archive = JSON.stringify({schemaVersion: 1, document, hash: protocolHash(document)});
  const key = 'xiaozhi.native-rebuild.v1:' + run.runId;
  await fixture.sql.run('INSERT INTO app_settings VALUES(?,?,?)', [key, archive, new Date().toISOString()]);
  const pending = createSkillPrivateContext(); pending.unavailableHistory();
  assert.equal(pending.historyComplete(), false);
  // Same-Run metadata admission replaces only the pending context after re-reading
  // the now-committed archive. Verified history can immediately authorize a generic draft.
  const complete = createSkillPrivateContext(); await captureRetiredPrivateHistory(fixture.sql, root, run.sessionId, complete);
  pending.clear();
  assert.equal(complete.historyComplete(), true); assert.equal(complete.contains(excerpt.slice(10, 70)), true);
  report.checks.push({id: 'verified_retired_marker_receipt_rebuilds_fingerprint', pass: true});
  await fixture.sql.run('CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT,role TEXT,status TEXT)');
  await fixture.sql.run("INSERT INTO users VALUES('user-private-history','Synthetic teacher','owner','active')");
  const catalog = createPiSkillCatalogState(fixture.sql); await catalog.migrateSkillCatalog();
  const managed = createManagedEducationSkills({root: path.join(root, 'skills'), state: catalog, assertIdle() {}});
  await managed.initialize();
  const governance = createSkillGovernanceState(fixture.sql); await governance.migrate();
  let currentPrivacy = complete;
  const service = createSkillGovernance({state: governance, managed, current: async () => true,
    sanitize: async text => text, dependency: async () => true, privateContext: async () => currentPrivacy});
  await service.initialize();
  const creator = createSkillCreatorTools(service, () => ({...run.owner, taskId: run.task.id}))[0];
  async function create(name, document) {
    const result = await creator.execute('call_' + name, {name, document, description: 'Synthetic teaching workflow', version: '1.0.0',
      dependencies: [], permissionRequirements: []}, new AbortController().signal, undefined, undefined);
    const skill = (await governance.list('skills')).find(value => value.name === name);
    const version = (await governance.list('versions')).find(value => value.skillId === skill?.id);
    return {result, version, bytes: version ? managed.verifyItem(version.package).document : ''};
  }
  const rejected = await create('retired-canary', '# Method\n' + excerpt.slice(10, 70));
  assert.equal(rejected.version?.state, 'draft'); assert(!rejected.bytes.includes(excerpt.slice(10, 70)));
  assert(!JSON.stringify(rejected.result).includes(excerpt.slice(10, 70)));
  const generic = await create('retired-generalized', '# Method\nCheck the requested learning objective, follow the necessary steps, and verify the actual result.');
  assert.equal(generic.version?.state, 'published');
  report.checks.push({id: 'actual_creator_canary_denied_generalized_method_published', pass: true});
  fs.unlinkSync(file);
  const missing = createSkillPrivateContext(); await captureRetiredPrivateHistory(fixture.sql, root, run.sessionId, missing);
  assert.equal(missing.historyComplete(), false);
  const validation = await createSkillValidator({sanitize: async text => text, dependency: async () => true, privateContext: async () => missing})(
    new Map([['SKILL.md', Buffer.from('---\nname: synthetic-safe-skill\ndescription: A synthetic safe skill\n---\nUse the teacher supplied lesson outline.')]]), [], []);
  assert.equal(validation.passed, false);
  assert(validation.checks.some(check => check.kind === 'privacy' && check.reasons.includes('private_history_unavailable')));
  currentPrivacy = missing;
  const unavailable = await create('retired-unavailable', '# Method\nCheck the teaching objective before planning the necessary steps.');
  assert.equal(unavailable.version?.state, 'draft');
  assert(unavailable.version.validation.checks.some(check => check.kind === 'privacy' && check.reasons.includes('private_history_unavailable')));
  report.checks.push({id: 'missing_retired_source_explicit_creator_rejection', pass: true});
  fs.writeFileSync(file, bytes);
  await fixture.sql.run('UPDATE xiaozhi_tool_receipts SET result_digest=? WHERE run_id=? AND call_id=?', ['0'.repeat(64), run.runId, callId]);
  const changed = createSkillPrivateContext(); await captureRetiredPrivateHistory(fixture.sql, root, run.sessionId, changed);
  assert.equal(changed.historyComplete(), false); assert.equal(changed.contains(excerpt), false);
  report.checks.push({id: 'receipt_digest_mismatch_cannot_supply_history', pass: true});
  await fixture.sql.run('UPDATE app_settings SET value_json=? WHERE key=?', [JSON.stringify({schemaVersion: 1, document, hash: '0'.repeat(64)}), key]);
  const corrupt = createSkillPrivateContext(); await captureRetiredPrivateHistory(fixture.sql, root, run.sessionId, corrupt);
  assert.equal(corrupt.historyComplete(), false);
  const foreign = createSkillPrivateContext(); await captureRetiredPrivateHistory(fixture.sql, root, 'aisession_' + randomUUID(), foreign);
  assert.equal(foreign.historyComplete(), true); assert.equal(foreign.contains(excerpt), false);
  report.checks.push({id: 'corrupt_archive_denied_foreign_session_isolated', pass: true});
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1;}
finally {fixture.close();}
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({success: report.success, checks: report.checks.length, root, error: report.error}));
