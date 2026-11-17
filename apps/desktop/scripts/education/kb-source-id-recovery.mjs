import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID, createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'electron') return {url: 'data:text/javascript,export const utilityProcess={},BrowserWindow={},app={},session={},net={};', shortCircuit: true};
    return next(specifier, context);
  },
  load(url, context, next) {
    return next(url, url.endsWith('.json') ? {...context, importAttributes: {type: 'json'}} : context);
  },
});
const {MaterialRepository} = await import('../../src/main/assets/material-repository.ts');
const {materialBodyVersion, materialSource} = await import('../../src/main/assets/material-source.ts');
const {ensureMaterialReadingEntries} = await import('../../src/main/assets/material-reading-migration.ts');
const checks = [];

async function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,title TEXT,content_hash TEXT,parse_status TEXT);
    CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER,page_number INTEGER);
    CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,archive_json TEXT);
    CREATE TABLE material_question_members(resource_id TEXT,question_id TEXT);
    CREATE INDEX members_resource ON material_question_members(resource_id);
    CREATE TABLE material_ai_batches(id TEXT PRIMARY KEY,resource_id TEXT);
    CREATE TABLE material_ai_units(batch_id TEXT,ordinal INTEGER,input_json TEXT);
    CREATE TABLE material_ai_response_receipts(input_sha TEXT,batch_id TEXT,ordinal INTEGER,received_at TEXT);`);
  await ensureMaterialReadingEntries(async sql => db.exec(sql));
  const resourceId = 'resource_' + randomUUID();
  const current = {id: 'chunk_' + randomUUID(), resourceId, chunkIndex: 0, contentMd: '1．电流为0.3A，求通过导体的电荷量。', containsPersonalData: false, pageNumber: 12};
  db.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?)').run(resourceId, '合成物理资料', 'a'.repeat(64), 'ready');
  db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?)').run(current.id, resourceId, 0, current.contentMd, 0, 12);
  const unit = {resourceId, version: 'a'.repeat(64), title: '合成物理资料', offset: 0, chunk: current};
  const currentSource = materialSource(unit);
  const oldChunk = {...current, id: 'chunk_' + randomUUID()};
  const source = {...currentSource, chunkId: oldChunk.id, bodyVersion: materialBodyVersion(oldChunk)};
  const archive = {schemaVersion: 'xiaozhi.question-archive.v1', extractor: 'numbered-text.v1', state: 'rule_extracted', number: '1', sources: [source], issues: ['missing_answer'], sourceRisks: [], sourceChecked: false, answerOrigin: 'missing', analysisOrigin: 'missing'};
  const host = {
    root: 'unused-originals',
    all: async (sql, values = []) => db.prepare(sql).all(...values),
    change: async (sql, values = []) => Number(db.prepare(sql).run(...values).changes),
    mapResource: row => ({id: row.id, title: row.title, contentHash: row.content_hash, parseStatus: row.parse_status, chunkCount: row.chunk_count}),
    mapChunk: row => ({id: row.id, resourceId: row.resource_id, chunkIndex: row.chunk_index, contentMd: row.content_md, containsPersonalData: !!row.contains_personal_data, pageNumber: row.page_number}),
  };
  function saveQuestion(value = archive) {
    const id = 'question_' + randomUUID();
    db.prepare('INSERT INTO question_bank_items VALUES(?,?)').run(id, typeof value === 'string' ? value : JSON.stringify(value));
    db.prepare('INSERT INTO material_question_members VALUES(?,?)').run(resourceId, id);
  }
  return {db, host, repo: new MaterialRepository(host), source, currentSource, current, archive, saveQuestion, resourceId};
}
async function check(name, action) {
  const f = await fixture();
  try { await action(f); checks.push(name); console.log('PASS ' + name); } finally { f.db.close(); }
}
await check('Current source keeps its original strict read path without recovery metadata', async f => {
  const view = await f.repo.source(f.currentSource);
  assert.equal(view.recovery, undefined); assert.equal(view.body.chunks[0].id, f.current.id);
});
await check('Valid stored question restores only the displaced ID and leaves all durable facts intact', async f => {
  f.saveQuestion();
  const before = f.db.prepare('SELECT * FROM question_bank_items').all();
  const view = await f.repo.source(f.source);
  assert.deepEqual(view.source, f.source); assert.deepEqual(view.recovery, {schemaVersion: 'xiaozhi.material-source-recovery.v1', currentSource: f.currentSource});
  assert.equal(view.body.chunks[0].contentMd, f.current.contentMd);
  assert.deepEqual(f.db.prepare('SELECT * FROM question_bank_items').all(), before);
});
await check('Knowing the current content cannot mint an unstored historical ID', async f => {
  await assert.rejects(f.repo.source(f.source), /source_changed/);
  f.saveQuestion();
  const forged = {...f.source, chunkId: 'chunk_' + randomUUID()};
  forged.bodyVersion = materialBodyVersion({...f.current, id: forged.chunkId});
  await assert.rejects(f.repo.source(forged), /source_changed/);
});
await check('Malformed, primitive and invalid archive claims cannot authorize a source', async f => {
  for (const archive of ['bad json', {sources: ['not json', f.source]}, {...f.archive, issues: ['unknown_issue']}, {...f.archive, sources: [f.source, 'not json']}]) f.saveQuestion(archive);
  await assert.rejects(f.repo.source(f.source), /source_changed/);
});
await check('Text, privacy, page and chunk position changes each invalidate the original body digest', async f => {
  f.saveQuestion();
  for (const [field, changed, original] of [['content_md', '改动的正文', f.current.contentMd], ['contains_personal_data', 1, 0], ['page_number', 13, 12], ['chunk_index', 1, 0]]) {
    f.db.prepare('UPDATE resource_chunks SET ' + field + '=? WHERE id=?').run(changed, f.current.id);
    await assert.rejects(f.repo.source(f.source), /source_changed/);
    f.db.prepare('UPDATE resource_chunks SET ' + field + '=? WHERE id=?').run(original, f.current.id);
  }
});
await check('An existing old ID at another location prevents recovery', async f => {
  f.saveQuestion();
  f.db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?)').run(f.source.chunkId, 'resource_' + randomUUID(), 0, '另一位置', 0, 1);
  await assert.rejects(f.repo.source(f.source), /source_changed/);
});
await check('Frozen AI input requires a received response with the same complete input SHA', async f => {
  const batch = 'aibatch_' + randomUUID();
  const input = JSON.stringify({sources: [f.source], text: f.current.contentMd});
  f.db.prepare('INSERT INTO material_ai_batches VALUES(?,?)').run(batch, f.resourceId);
  f.db.prepare('INSERT INTO material_ai_units VALUES(?,1,?)').run(batch, input);
  const digest = createHash('sha256').update(input).digest('hex');
  f.db.prepare('INSERT INTO material_ai_response_receipts VALUES(?, ?,1,?)').run(digest, batch, '');
  await assert.rejects(f.repo.source(f.source), /source_changed/);
  f.db.prepare('UPDATE material_ai_response_receipts SET received_at=?').run('2026-11-12T00:00:00.000Z');
  assert.deepEqual((await f.repo.source(f.source)).recovery.currentSource, f.currentSource);
  f.db.prepare('UPDATE material_ai_units SET input_json=?').run(JSON.stringify({sources: [f.source], text: '篡改输入'}));
  await assert.rejects(f.repo.source(f.source), /source_changed/);
});
await check('Reading history restores the old location and saves new notes against current identity with revision CAS', async f => {
  const id = 'read_' + randomUUID();
  f.db.prepare('INSERT INTO material_reading_entries(id,resource_id,source_json,note,completed,updated_at) VALUES(?,?,?,?,0,?)').run(id, f.resourceId, JSON.stringify(f.source), '原笔记', '2026-11-12');
  assert.equal((await f.repo.study(f.resourceId)).stale, false);
  const input = {schemaVersion: 'xiaozhi.material-study.v1', source: f.source, expectedRevision: id, note: '新笔记', completed: true};
  const saved = await f.repo.saveStudy(input);
  assert.deepEqual(saved.entry.source, f.currentSource);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_reading_entries').get().n, 2);
  await assert.rejects(f.repo.saveStudy(input), /revision_conflict/);
});
await check('Fresh body validation catches a content change during durable-proof lookup', async f => {
  f.saveQuestion();
  const all = f.host.all;
  f.host.all = async (sql, values) => {
    const result = await all(sql, values);
    if (sql.includes('SELECT q.archive_json')) f.db.prepare('UPDATE resource_chunks SET content_md=?').run('并发改动');
    return result;
  };
  await assert.rejects(f.repo.source(f.source), /source_changed/);
});
await check('Different file version or offset cannot use a saved historical reference', async f => {
  f.saveQuestion();
  await assert.rejects(f.repo.source({...f.source, version: 'b'.repeat(64)}), /source_changed/);
  await assert.rejects(f.repo.source({...f.source, offset: 1}), /source_changed/);
});
await check('Oversized stored claims remain bounded and cannot authorize recovery', async f => {
  f.saveQuestion({...f.archive, padding: 'x'.repeat(2 * 1024 * 1024)});
  await assert.rejects(f.repo.source(f.source), /source_changed/);
});
await check('Disabling the new reader restores strict ID rejection while current sources still read', async f => {
  f.saveQuestion();
  const previous = process.env.OMNI_EDU_SOURCE_ID_RECOVERY;
  process.env.OMNI_EDU_SOURCE_ID_RECOVERY = '0';
  try { await assert.rejects(f.repo.source(f.source), /source_changed/); await f.repo.source(f.currentSource); }
  finally { if (previous === undefined) delete process.env.OMNI_EDU_SOURCE_ID_RECOVERY; else process.env.OMNI_EDU_SOURCE_ID_RECOVERY = previous; }
});
console.log(JSON.stringify({passed: checks.length, checks, scope: 'Actual SQLite and production source/reading repository, synthetic text, zero provider calls'}));
