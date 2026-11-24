import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash, randomUUID} from 'node:crypto';
const {MaterialQuestionArchive} = await import('../../src/main/assets/material-question-archive.ts');
const {extractMaterialQuestionWindow} = await import('../../src/main/assets/material-question-extract.ts');
const {prepareRuleDuplicate, applyRuleDuplicate, ruleDuplicateHidden, materialQuestionExtractionKey} = await import('../../src/main/assets/material-rule-duplicates.ts');
const {structureDuplicateHidden} = await import('../../src/main/assets/material-structure-duplicates.ts');
const checks = [];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function fixture(body = '学科：物理\n年级：初三\n知识点：电流\n题型：计算题\n难度：基础\n1．计算通过导体的电荷量。\n【答案】3C\n【解析】电流乘以时间。') {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,title TEXT,original_file_name TEXT,content_hash TEXT,parse_status TEXT,parse_engine TEXT);
    CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER,page_number INTEGER);
    CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,subject TEXT,grade TEXT,knowledge_point TEXT,question_type TEXT,difficulty TEXT,stem TEXT,answer TEXT,analysis TEXT,source_title TEXT,source_kind TEXT,tags TEXT,created_at TEXT,updated_at TEXT,archive_json TEXT DEFAULT '',document_json TEXT DEFAULT '');
    CREATE TABLE material_question_members(extraction_key TEXT PRIMARY KEY,resource_id TEXT,question_id TEXT UNIQUE,needs_attention INTEGER);
    CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
    CREATE TABLE question_notebook_bookmarks(question_id TEXT PRIMARY KEY,bookmarked INTEGER);
    CREATE TABLE question_notebook_category_links(question_id TEXT,category_id TEXT);
    CREATE TABLE question_bank_usage(question_id TEXT,usage_type TEXT);
    INSERT INTO app_settings VALUES('xiaozhi.question-origins.cursor.v1','{"schema":2,"cursor":999}', 'before');`);
  const resourceId = 'resource_' + randomUUID(), currentId = 'chunk_' + randomUUID();
  db.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?,?,?)').run(resourceId, '合成物理资料', '合成物理资料.docx', 'a'.repeat(64), 'ready', 'word-ooxml.v2');
  db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,0,12)').run(currentId, resourceId, 0, body);
  const sql = {all: async (query, values = []) => db.prepare(query).all(...values), run: async (query, values = []) => {db.prepare(query).run(...values);}};
  const materials = {
    resource: async id => {const r = db.prepare('SELECT * FROM teacher_resources WHERE id=?').get(id); return {id, contentHash: r.content_hash, parseEngine: r.parse_engine};},
    originalStamp: async () => 'controlled-original', verify: async () => {},
    readingWindow: async (id, offset, limit = 16) => {
      const resource = await materials.resource(id);
      const rows = db.prepare('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index,id LIMIT ? OFFSET ?').all(id, limit + 1, offset);
      const units = rows.slice(0, limit).map((r, i) => ({resourceId: id, version: resource.contentHash, title: '合成物理资料.docx', offset: offset + i,
        chunk: {id: r.id, resourceId: id, chunkIndex: r.chunk_index, contentMd: r.content_md, containsPersonalData: !!r.contains_personal_data, pageNumber: r.page_number}}));
      return {units, hasMore: rows.length > limit, fingerprint: digest(units)};
    },
  };
  function read(id) {
    const row = db.prepare('SELECT * FROM question_bank_items WHERE id=?').get(id); if (!row) return;
    return {id, subject: row.subject, grade: row.grade, knowledgePoint: row.knowledge_point, questionType: row.question_type, difficulty: row.difficulty,
      stem: row.stem, answer: row.answer, analysis: row.analysis, sourceTitle: row.source_title, sourceKind: row.source_kind, tags: JSON.parse(row.tags),
      createdAt: row.created_at, updatedAt: row.updated_at, ...(row.archive_json ? {archive: JSON.parse(row.archive_json)} : {})};
  }
  let creates = 0, archive;
  async function create(fields) {
    creates++; const id = 'question_' + randomUUID(), time = new Date(Date.now() + creates).toISOString();
    db.prepare('INSERT INTO question_bank_items(id,subject,grade,knowledge_point,question_type,difficulty,stem,answer,analysis,source_title,source_kind,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, fields.subject, fields.grade, fields.knowledgePoint, fields.questionType, fields.difficulty, fields.stem, fields.answer, fields.analysis, fields.sourceTitle, fields.sourceKind, JSON.stringify(fields.tags), time, time);
    return read(id);
  }
  const host = {...sql, materials: () => materials, read: async id => read(id), create, withWriter: async action => {
    db.exec('BEGIN IMMEDIATE'); try {const value = await action(archive); db.exec('COMMIT'); return value;} catch (error) {db.exec('ROLLBACK'); throw error;}
  }};
  archive = new MaterialQuestionArchive(host); await archive.migrate(); await archive.migrateMembers();
  async function seed(position = 0, legacy = true) {
    const window = await materials.readingWindow(resourceId, 0);
    const units = legacy ? window.units.map(unit => ({...unit, chunk: {...unit.chunk, id: 'chunk_' + randomUUID()}})) : window.units;
    const candidate = extractMaterialQuestionWindow(units, 'word-ooxml.v2', false, 0)[position]; assert(candidate);
    const saved = await create(candidate.fields);
    db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?').run(JSON.stringify(candidate.archive), saved.id);
    const key = materialQuestionExtractionKey(resourceId, 'a'.repeat(64), candidate.archive.sources, candidate.key);
    db.prepare('INSERT INTO material_question_members(extraction_key,resource_id,question_id,needs_attention) VALUES(?,?,?,1)').run(key, resourceId, saved.id);
    return read(saved.id);
  }
  async function fold(q) {const plan = await prepareRuleDuplicate(host, read(q.id)); assert(plan); await host.withWriter(() => applyRuleDuplicate(host, plan)); return plan;}
  const visible = () => db.prepare(`SELECT q.id FROM question_bank_items q WHERE NOT ${ruleDuplicateHidden} ORDER BY q.rowid`).all().map(row => row.id);
  return {db, host, materials, archive, resourceId, seed, read, fold, visible, creates: () => creates};
}
async function check(name, action, body) {
  const f = await fixture(body); try {await action(f); checks.push(name); console.log('PASS ' + name);} finally {await f.archive.close(); f.db.close();}
}
await check('Migration backfills once and remains idempotent without changing bank facts', async f => {
  const q = await f.seed(); const before = JSON.stringify(f.db.prepare('SELECT * FROM question_bank_items').all());
  f.db.prepare("UPDATE app_settings SET value_json=? WHERE key='xiaozhi.question-origins.cursor.v1'").run('{"schema":2,"cursor":123}');
  await f.archive.migrateMembers();
  assert.equal(JSON.parse(f.db.prepare('SELECT value_json FROM app_settings').get().value_json).cursor, 123);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM question_bank_items').all()), before); assert(q);
});
await check('Historical SQLite UTC creation times have a portable ordering value', async f => {
  const q = await f.seed();
  f.db.prepare('UPDATE question_bank_items SET created_at=?,updated_at=? WHERE id=?').run('2026-11-12 13:04:05', '2026-11-12 13:04:05', q.id);
  await f.fold(q);
  assert.equal(f.db.prepare('SELECT duplicate_order FROM material_question_members').get().duplicate_order, '2026-11-12T13:04:05.000Z');
});
await check('Source-ID aliases fold to the earliest record while every original row remains', async f => {
  const first = await f.seed(), second = await f.seed(0, false); const before = digest(f.db.prepare('SELECT * FROM question_bank_items ORDER BY id').all());
  await f.fold(second); await f.fold(first);
  assert.deepEqual(f.visible(), [first.id]); assert.equal(f.db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n, 2);
  const status = await f.archive.status(); assert.equal(status.foldedDuplicates, 1); assert.equal(status.needsAttention, 1);
  assert.equal(digest(f.db.prepare('SELECT * FROM question_bank_items ORDER BY id').all()), before);
});
await check('Repeated identical text and numbering at different original positions remain separate', async f => {
  const a = await f.seed(0), b = await f.seed(1), c = await f.seed(0), d = await f.seed(1);
  for (const q of [a, b, c, d]) await f.fold(q);
  assert.deepEqual(f.visible(), [a.id, b.id]);
}, '1．计算通过导体的电荷量？\n1．计算通过导体的电荷量？');
for (const field of ['answer', 'analysis', 'subject', 'grade', 'knowledge_point', 'question_type', 'difficulty']) await check('Different ' + field + ' cannot share a duplicate proof', async f => {
  const q = await f.seed(); f.db.prepare('UPDATE question_bank_items SET ' + field + '=? WHERE id=?').run(field === 'difficulty' ? 'hard' : '不同内容', q.id);
  assert.equal(await prepareRuleDuplicate(f.host, f.read(q.id)), undefined);
});
for (const [table, insert] of [
  ['bookmark', (db, id) => db.prepare('INSERT INTO question_notebook_bookmarks VALUES(?,1)').run(id)],
  ['category', (db, id) => db.prepare('INSERT INTO question_notebook_category_links VALUES(?,?)').run(id, 'category')],
  ['usage', (db, id) => db.prepare('INSERT INTO question_bank_usage VALUES(?,?)').run(id, 'paper')],
]) await check('Teacher ' + table + ' immediately restores both records and prevents refolding the owned row', async f => {
  const first = await f.seed(), second = await f.seed(); await f.fold(first); await f.fold(second);
  insert(f.db, second.id); assert.deepEqual(f.visible(), [first.id, second.id]);
  assert.equal(await prepareRuleDuplicate(f.host, f.read(second.id)), undefined);
});
await check('Teacher edits to the keeper invalidate the group before another writer can apply stale proof', async f => {
  const a = await f.seed(), b = await f.seed(); await f.fold(a); const plan = await f.fold(b);
  const changed = {...a.archive, state: 'teacher_edited'};
  f.db.prepare('UPDATE question_bank_items SET archive_json=?,updated_at=? WHERE id=?').run(JSON.stringify(changed), 'later', a.id);
  assert.deepEqual(f.visible(), [a.id, b.id]); await applyRuleDuplicate(f.host, plan); assert.deepEqual(f.visible(), [a.id, b.id]);
});
for (const [field, value] of [['content_md', '变化正文'], ['contains_personal_data', 1], ['page_number', 13], ['chunk_index', 1]]) await check('Source ' + field + ' change immediately invalidates grouping and old plans', async f => {
  const a = await f.seed(), b = await f.seed(); await f.fold(a); const plan = await f.fold(b);
  f.db.prepare('UPDATE resource_chunks SET ' + field + '=?').run(value);
  assert.deepEqual(f.visible(), [a.id, b.id]); await applyRuleDuplicate(f.host, plan); assert.deepEqual(f.visible(), [a.id, b.id]);
});
await check('Source version changes and inserted body locations restore visibility', async f => {
  const a = await f.seed(), b = await f.seed(); await f.fold(a); await f.fold(b);
  f.db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,0,11)').run('chunk_' + randomUUID(), f.resourceId, -1, '前置内容');
  assert.deepEqual(f.visible(), [a.id, b.id]);
  f.db.prepare('UPDATE teacher_resources SET content_hash=?').run('b'.repeat(64));
  assert.equal(await prepareRuleDuplicate(f.host, f.read(a.id)), undefined);
});
await check('Deleting the keeper never hides its surviving original', async f => {
  const a = await f.seed(), b = await f.seed(); await f.fold(a); await f.fold(b);
  f.db.prepare('DELETE FROM question_bank_items WHERE id=?').run(a.id); assert.deepEqual(f.visible(), [b.id]);
});
await check('A changed extraction position receipt cannot authorize grouping', async f => {
  const q = await f.seed(); const plan = await prepareRuleDuplicate(f.host, q); assert(plan);
  f.db.prepare('UPDATE material_question_members SET extraction_key=? WHERE question_id=?').run('invalid', q.id);
  await applyRuleDuplicate(f.host, plan); assert.equal(f.db.prepare('SELECT duplicate_key FROM material_question_members').get().duplicate_key, '');
});
await check('Different archive warnings and imported documents retain their own records', async f => {
  const q = await f.seed();
  const archive = {...q.archive, issues: [...q.archive.issues, 'cross_chunk'], sourceRisks: [...q.archive.sourceRisks, 'cross_chunk']};
  f.db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?').run(JSON.stringify(archive), q.id);
  assert.equal(await prepareRuleDuplicate(f.host, f.read(q.id)), undefined);
  assert.equal(await prepareRuleDuplicate(f.host, {...q, document: {schemaVersion: 'controlled-document'}}), undefined);
});
await check('A bookmark on the keeper releases every original and survives background reconciliation', async f => {
  const a = await f.seed(), b = await f.seed(); await f.fold(a); await f.fold(b);
  f.db.prepare('INSERT INTO question_notebook_bookmarks VALUES(?,1)').run(a.id);
  assert.deepEqual(f.visible(), [a.id, b.id]);
  await f.archive.reconcileOrigins(); assert.deepEqual(f.visible(), [a.id, b.id]);
  assert.equal(await prepareRuleDuplicate(f.host, f.read(a.id)), undefined);
});
await check('Removing a teacher category queues the record for normal duplicate regrouping', async f => {
  const a = await f.seed(), b = await f.seed(); await f.fold(a); await f.fold(b);
  f.db.prepare('INSERT INTO question_notebook_category_links VALUES(?,?)').run(b.id, 'category');
  await f.archive.reconcileOrigins(); assert.deepEqual(f.visible(), [a.id, b.id]);
  f.db.prepare('DELETE FROM question_notebook_category_links WHERE question_id=?').run(b.id);
  assert(f.db.prepare('SELECT 1 FROM material_question_origin_dirty_v1 WHERE question_id=?').get(b.id));
  await f.archive.reconcileOrigins(); assert.deepEqual(f.visible(), [a.id]);
});
await check('A teacher change after proof preparation cannot be lost by the background dirty cursor', async f => {
  const a = await f.seed(), b = await f.seed(); await f.fold(a); await f.fold(b);
  f.db.prepare('UPDATE material_question_members SET duplicate_key=duplicate_key WHERE question_id=?').run(b.id);
  let injected = false; const writer = f.host.withWriter;
  f.host.withWriter = async action => {
    if (!injected) {injected = true; f.db.prepare('INSERT INTO question_notebook_bookmarks VALUES(?,1)').run(b.id);}
    return writer(action);
  };
  await f.archive.reconcileOrigins(); await f.archive.reconcileOrigins();
  assert.deepEqual(f.visible(), [a.id, b.id]); assert.equal(await prepareRuleDuplicate(f.host, f.read(b.id)), undefined);
});
await check('A changed window boundary queues a fresh proof even when the unit fingerprint is identical', async f => {
  const q = await f.seed(); const read = f.materials.readingWindow; let hasMore = false;
  f.materials.readingWindow = async (...args) => ({...await read(...args), hasMore});
  const writer = f.host.withWriter;
  f.host.withWriter = async action => {hasMore = true; return writer(action);};
  await f.archive.reconcileOrigins();
  assert(f.db.prepare('SELECT 1 FROM material_question_origin_dirty_v1 WHERE question_id=?').get(q.id));
  assert.equal(f.db.prepare('SELECT duplicate_key FROM material_question_members').get().duplicate_key, '');
});
await check('A changed parser mode invalidates prepared duplicate proof', async f => {
  const q = await f.seed(); const plan = await prepareRuleDuplicate(f.host, q); assert(plan);
  f.db.prepare('UPDATE teacher_resources SET parse_engine=?').run('local-text-v1');
  assert.equal(await applyRuleDuplicate(f.host, plan), false);
});
await check('Normal new extraction reuses the proved record after source ID rebuilding', async f => {
  const q = await f.seed(); await f.fold(q);
  f.db.prepare('UPDATE resource_chunks SET id=?').run('chunk_' + randomUUID()); await f.fold(q);
  const before = f.creates(); await f.archive.enqueue(f.resourceId, 'a'.repeat(64), 'changed-parser');
  await f.archive.drain(); assert.equal(f.creates(), before); assert.equal(f.db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n, 1);
});
await check('New extraction fails atomically if its window boundary changes before the writer', async f => {
  const reader = f.materials.readingWindow; let reads = 0;
  f.materials.readingWindow = async (...args) => ({...await reader(...args), hasMore: ++reads > 1});
  await f.archive.enqueue(f.resourceId, 'a'.repeat(64), 'new-window'); await f.archive.drain();
  assert.equal(f.creates(), 0); assert.equal(f.db.prepare('SELECT status FROM material_question_jobs').get().status, 'failed');
});
await check('A linked PDF is the keeper, independent links survive, and stale or retired keepers cannot suppress copies', async f => {
  const original = await f.seed(), copy = await f.seed();
  const version = 'a'.repeat(64);
  const newSource = id => f.db.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?,?,?)')
    .run(id, '', id+'.pdf', version, 'ready', 'controlled-pdf');
  const copyId = 'resource_' + randomUUID(), answerId = 'resource_' + randomUUID(), otherAnswerId = 'resource_' + randomUUID();
  for (const id of [copyId,answerId,otherAnswerId]) newSource(id);
  const group = 'pdf-structure:' + version + ':' + digest('same-layout');
  f.db.prepare('UPDATE material_question_members SET resource_id=?,duplicate_key=?,duplicate_order=? WHERE question_id=?')
    .run(copyId, group, '1', copy.id);
  f.db.prepare('UPDATE material_question_members SET duplicate_key=?,duplicate_order=? WHERE question_id=?')
    .run(group, '2', original.id);
  const visible = () => f.db.prepare(`SELECT q.id FROM question_bank_items q WHERE NOT ${structureDuplicateHidden} ORDER BY q.rowid`)
    .all().map(row => row.id);
  const link = (paper, answer) => f.db.prepare('INSERT INTO material_book_pairs VALUES(?,?,?,?,1,1)')
    .run(paper, version, answer, version);
  assert.deepEqual(visible(), [copy.id]);
  link(f.resourceId, answerId);
  assert.deepEqual(visible(), [original.id]);
  link(copyId, otherAnswerId);
  assert.deepEqual(visible(), [original.id,copy.id]);
  f.db.prepare('DELETE FROM material_book_pairs WHERE question_id=?').run(copyId);
  f.db.prepare("INSERT INTO material_structure_hidden_questions VALUES(?,?,?,'superseded')").run(original.id, f.resourceId, 'old-layout');
  assert(visible().includes(copy.id));
  f.db.prepare('DELETE FROM material_structure_hidden_questions WHERE question_id=?').run(original.id);
  f.db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('b'.repeat(64), f.resourceId);
  assert(visible().includes(copy.id));
});
console.log(JSON.stringify({passed: checks.length, checks, scope: 'Actual SQLite, production parser, migrations, grouping, protection, writer and archive drain. Controlled original verification, zero providers.'}));
