import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import sqlite3 from 'sqlite3';
import {openFixture} from './phase6-state-foundation-worker.mjs';
const {readWorkbenchSnapshot} = await import('../../src/main/xiaozhi-agent/workbench-read.ts');
const {createWorkbenchSummary} = await import('../../src/main/xiaozhi-agent/workbench-summary.ts');
const {createPiPersistentState} = await import('../../src/main/xiaozhi-agent/persistent-state.ts');
const {createPermissionStore} = await import('../../src/main/xiaozhi-agent/permissions/store.ts');
const {requestDigest} = await import('../../src/main/xiaozhi-agent/permissions/validation.ts');
const {createCapabilityRegistry} = await import('../../src/main/xiaozhi-agent/capabilities/registry.ts');
const {nativeStatDeclarations} = await import('../../src/main/xiaozhi-agent/capabilities/native-stat.ts');
const {createAcquisitionState} = await import('../../src/main/xiaozhi-agent/capabilities/acquisition/state.ts');
const {protocolHash} = await import('../../src/main/xiaozhi-agent/capabilities/validation.ts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase7-workbench-read-'));
const report = {success: false, root, paidCalls: 0, checks: [], opened: 0, closed: 0,
  boundary: 'Actual sqlite3 READONLY handle/query_only/BEGIN. Original Task coordinator/Journal, Permission request/transition, legacy state, Registry and Acquisition writers seed owned synthetic metadata. No Host, guest, network or UI acceptance.'};
const save = () => fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
const f = await openFixture(root); let closed = false;
const ro = action => readWorkbenchSnapshot(() => new Promise((resolve, reject) => {
  const database = new sqlite3.Database(f.file, sqlite3.OPEN_READONLY | sqlite3.OPEN_FULLMUTEX, error => {
    if (error) return reject(error); report.opened++;
    const original = database.close.bind(database);
    database.close = callback => original(error => {if (!error) report.closed++; callback(error);});
    resolve(database);
  });
}), action);
const summary = createWorkbenchSummary({read: ro});
const query = async input => {const value = await summary({schemaVersion: 1, ...input}); assert(value.ok, JSON.stringify(value)); return value.value;};
async function check(id, action) {try {const detail = await action(); report.checks.push({id, pass: true, detail});}
  catch (error) {report.checks.push({id, pass: false, error: String(error.stack || error)}); throw error;} finally {save();}}
const fileHash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
try {
  f.db.exec(`CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT);`);
  const runs = [];
  for (let index = 0; index < 57; index++) {const run = await f.fresh(); run.task = await f.taskState.pause(run.sessionId, run.task.id, run.task.revision); runs.push(run);}
  f.db.exec("ALTER TABLE ai_conversation_sessions ADD COLUMN title TEXT NOT NULL DEFAULT 'Synthetic session'");
  const origin = runs[0], permission = createPermissionStore(f.sql); await permission.migrate();
  const legacy = createPiPersistentState(f.sql);
  const copy = await legacy.createApproval(origin.sessionId, origin.runId,
    {callId: 'legacy-owned', source: 'source.txt', target: 'target.txt', sourceSha256: 'a'.repeat(64)}, 'b'.repeat(64));
  const request = {schemaVersion: 2, owner: {...origin.owner, taskId: origin.task.id}, requirementsVersion: 1, callId: 'permission-owned',
    action: 'owned.network', inputDigest: 'c'.repeat(64), purpose: 'Synthetic request, no dispatch', scopes: [{kind: 'network', origin: 'https://example.invalid', methods: ['GET'], purpose: 'Owned metadata'}],
    files: [], provider: null, classification: 'public', expiresAt: new Date(Date.now() + 3600000).toISOString()};
  const approval = await permission.request(request, {status: 'needs_approval', requestDigest: requestDigest(request), permissionSnapshotHash: 'd'.repeat(64), grantRefs: []});
  const declarations = nativeStatDeclarations(), registry = createCapabilityRegistry(f.sql, {officialProviderIds: declarations.map(item => item.provider.id)});
  await registry.migrate(); for (const item of declarations) await registry.register(item.definition, item.provider, item.binding);
  const acquisition = createAcquisitionState(f.sql); await acquisition.migrate();
  const candidate = {source: 'community', externalId: 'owned-candidate', name: 'Owned candidate', description: 'Synthetic', version: '1.0.0', repository: null,
    packageName: 'owned-package', transport: 'unknown', sourceHash: 'e'.repeat(64), fetchedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString()};
  candidate.id = 'xicandidate_' + protocolHash({source: candidate.source, externalId: candidate.externalId, version: candidate.version});
  await acquisition.cache([candidate]);
  await check('R01_readonly_real_connection_rejects_writes_and_closes', async () => {
    await ro(async sql => {assert.equal((await sql.all('PRAGMA query_only'))[0].query_only, 1); await assert.rejects(sql.run("INSERT INTO app_settings VALUES('forbidden','{}','')"), /readonly/iu);});
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM app_settings WHERE key='forbidden'").get().n, 0); assert.equal(report.opened, report.closed);
  });
  await check('R02_tasks_cross_session_keyset_counts', async () => {
    const ids = [], counts = []; let cursor;
    do {const page = await query({kind: 'tasks', filter: 'unfinished', limit: 20, ...(cursor ? {cursor} : {})});
      assert.equal(page.partial, false); assert.equal(page.total, 57); assert.equal(page.counts.paused, 57); counts.push(page.items.length); ids.push(...page.items.map(item => item.taskId)); cursor = page.nextCursor;
    } while (cursor);
    assert.equal(new Set(ids).size, 57); assert.deepEqual(counts, [20, 20, 17]); return {counts, distinct: ids.length};
  });
  await check('R03_session_filter_exact_and_invalid_cursor', async () => {
    const page = await query({kind: 'tasks', filter: 'all', sessionId: origin.sessionId}); assert.equal(page.items.length, 1); assert.equal(page.counts.paused, 1);
    const first = await query({kind: 'tasks', filter: 'all', limit: 1}); assert.deepEqual(await summary({schemaVersion: 1, kind: 'tasks', filter: 'ended', cursor: first.nextCursor}), {ok: false, error: 'changed'});
    assert.deepEqual(await summary({schemaVersion: 1, kind: 'tasks', filter: 'all', limit: 51}), {ok: false, error: 'invalid_input'});
    assert.deepEqual(await summary({schemaVersion: 1, kind: 'tasks', filter: 'all', sessionId: 'aisession_' + randomUUID()}), {ok: false, error: 'permission_denied'});
  });
  await check('R04_modern_revision_detail_cas_and_saved_state_counts', async () => {
    const page = await query({kind: 'approvals', state: 'all'}), row = page.items.find(item => item.kind === 'permission_v2');
    assert.equal(page.total, 2); assert.equal(page.counts.pending, 2); assert.equal(row.taskId, origin.task.id);
    const detail = await query({kind: 'approval_detail', ref: row.ref}); assert.equal(detail.detail.approval.requestDigest, approval.requestDigest);
    await permission.transition(origin.sessionId, approval.id, 1, ['pending'], 'rejected');
    assert.deepEqual(await summary({schemaVersion: 1, kind: 'approval_detail', ref: row.ref}), {ok: false, error: 'changed'});
    const after = await query({kind: 'approvals', state: 'pending'}); assert.equal(after.counts.rejected, 1); assert.equal(after.items.length, 1);
  });
  await check('R05_legacy_etag_unknown_and_approved_actions', async () => {
    const first = (await query({kind: 'approvals', state: 'all'})).items.find(item => item.kind === 'legacy_copy');
    const detail = await query({kind: 'approval_detail', ref: first.ref}); assert.equal('sourceSha256' in detail.detail.approval, false);
    await legacy.transition(copy.id, ['pending'], 'uncertain');
    assert.deepEqual(await summary({schemaVersion: 1, kind: 'approval_detail', ref: first.ref}), {ok: false, error: 'changed'});
    let row = (await query({kind: 'approvals', state: 'all'})).items.find(item => item.kind === 'legacy_copy'); assert(row.canDecide); assert.equal(row.state, 'uncertain');
    await legacy.transition(copy.id, ['uncertain'], 'approved'); row = (await query({kind: 'approvals', state: 'all'})).items.find(item => item.kind === 'legacy_copy'); assert(row.canDecide); assert.equal(row.state, 'approved');
  });
  await check('R06_capability_metadata_not_authorization_and_search', async () => {
    const page = await query({kind: 'capabilities'}); assert.equal(page.partial, false); assert.equal(page.context.state, 'none');
    assert(page.items.some(item => item.sourceKind === 'registry')); assert(page.items.some(item => item.verification === 'quarantined'));
    assert(page.items.every(item => item.authorization === 'task_check_required'));
    const selected = await query({kind: 'capabilities', sessionId: origin.sessionId, taskId: origin.task.id, requirementsVersion: 2}); assert.equal(selected.context.state, 'stale');
    const search = await query({kind: 'capabilities', query: 'Owned candidate'}); assert.equal(search.items.length, 1); assert.equal(search.items[0].installed, 'missing');
    const plan = {artifactId: 'xiartifact_' + 'f'.repeat(64), digest: 'f'.repeat(64), directory: path.join(root, 'owned-package'), lock: []};
    const operationId = 'xiacquisition_' + protocolHash([origin.task.id, candidate.id]);
    await acquisition.saveOperation({id: operationId, revision: 1, owner: request.owner, requirementsVersion: 1,
      candidateId: candidate.id, candidateHash: candidate.sourceHash, phase: 'needs_approval',
      error: 'permission_pending', artifactId: plan.artifactId, plan, updatedAt: new Date().toISOString()}, 0);
    const dependency = {...request, action: 'capability_prepare', callId: operationId, inputDigest: protocolHash(plan),
      scopes: [{kind: 'dependency', source: 'https://registry.npmjs.org', package: 'owned-package',
        version: '1.0.0', sha256: plan.digest, environment: plan.directory, installScripts: false}]};
    const pending = await permission.request(dependency, {status: 'needs_approval', requestDigest: requestDigest(dependency), permissionSnapshotHash: 'd'.repeat(64), grantRefs: []});
    const capabilityQuery = {kind: 'capabilities', query: 'Owned candidate', sessionId: origin.sessionId, taskId: origin.task.id, requirementsVersion: 1};
    assert.equal((await query(capabilityQuery)).items[0].authorization, 'required');
    assert.equal((await query({...capabilityQuery, requirementsVersion: 2})).items[0].authorization, 'task_check_required');
    const pendingPage = await query({kind: 'approvals', sessionId: origin.sessionId, state: 'pending'});
    assert.deepEqual(pendingPage.items.find(item => item.id === pending.id).resources, ['owned-package@1.0.0']);
    await permission.transition(origin.sessionId, pending.id, 1, ['pending'], 'approved');
    assert.equal((await query(capabilityQuery)).items[0].authorization, 'task_check_required');
    return {total: page.total, counts: page.counts, taskApprovalRequired: true};
  });
  await check('R07_corrupt_row_partial_keeps_verified_rows', async () => {
    const row = f.db.prepare('SELECT * FROM ai_confirmation_items WHERE id=?').get(copy.id);
    f.db.prepare('UPDATE ai_confirmation_items SET payload_json=? WHERE id=?').run('{broken', copy.id);
    const page = await query({kind: 'approvals', state: 'all'}); assert.equal(page.partial, true); assert.equal(page.total, null); assert.equal(page.counts, null); assert.equal(page.matched, null);
    assert.equal(page.items.length, 2); assert.equal(page.unavailableCount, 1); assert.equal(page.sourceFailures[0].source, 'approvals');
    f.db.prepare('UPDATE ai_confirmation_items SET payload_json=? WHERE id=?').run(row.payload_json, copy.id);
  });
  await check('R08_corrupt_registry_whole_source_not_salvaged', async () => {
    const row = f.db.prepare('SELECT * FROM xiaozhi_capability_registry_v1 WHERE id=1').get();
    f.db.prepare('UPDATE xiaozhi_capability_registry_v1 SET document_hash=? WHERE id=1').run('0'.repeat(64));
    const page = await query({kind: 'capabilities'}); assert.equal(page.partial, true); assert.equal(page.counts, null); assert(!page.items.some(item => item.sourceKind === 'registry')); assert(page.items.some(item => item.sourceKind === 'acquisition'));
    f.db.prepare('UPDATE xiaozhi_capability_registry_v1 SET document_hash=? WHERE id=1').run(row.document_hash);
  });
  await check('R09_corrupt_task_partial_and_revision_history_not_counted', async () => {
    const key = 'xiaozhi.task.v1:' + origin.task.id, row = f.db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(key);
    f.db.prepare('UPDATE app_settings SET value_json=? WHERE key=?').run('{broken', key);
    const page = await query({kind: 'tasks', filter: 'all', limit: 50}); assert.equal(page.partial, true); assert.equal(page.total, null);
    assert.equal(page.unavailableCount, 1); assert(!page.items.some(item => item.taskId === origin.task.id)); assert.equal(page.scanned, 57);
    f.db.prepare('UPDATE app_settings SET value_json=? WHERE key=?').run(row.value_json, key);
  });
  await check('R10_same_snapshot_counts_despite_concurrent_writer', async () => {
    f.db.exec('PRAGMA journal_mode=WAL');
    const sessionId = 'aisession_' + randomUUID();
    await ro(async sql => {
      const first = (await sql.all('SELECT count(*) AS n FROM ai_conversation_sessions'))[0].n;
      f.db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,NULL,?)').run(sessionId, 'Concurrent synthetic');
      const second = (await sql.all('SELECT count(*) AS n FROM ai_conversation_sessions'))[0].n; assert.equal(first, second);
    });
    assert.equal((await ro(sql => sql.all('SELECT id FROM ai_conversation_sessions WHERE id=?', [sessionId]))).length, 1);
    f.db.prepare('DELETE FROM ai_conversation_sessions WHERE id=?').run(sessionId);
    f.db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE');
  });
  await check('R11_cold_metadata_byte_identical_and_all_handles_closed', async () => {
    f.close(); closed = true; const before = fileHash(f.file);
    const first = await query({kind: 'tasks', filter: 'all'}), second = await query({kind: 'tasks', filter: 'all'});
    const {asOf: _a, ...a} = first, {asOf: _b, ...b} = second; assert.deepEqual(a, b); assert.equal(fileHash(f.file), before); assert.equal(report.opened, report.closed);
    report.databaseHash = before; return {sha256: before, opened: report.opened, closed: report.closed};
  });
  report.success = true;
} catch (error) {report.error = String(error.stack || error); process.exitCode = 1;}
finally {if (!closed) f.close(); save(); console.log(JSON.stringify({success: report.success, passed: report.checks.filter(item => item.pass).length, total: report.checks.length, report: path.join(root, 'report.json')}));}
