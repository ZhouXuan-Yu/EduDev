// Focused source/SQLite tests. Synthetic files are test inputs, never production receipts or actual UI evidence.
import '../office-agent/register-source.mjs';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier, context, next) {
  if (specifier === 'electron') return {url: 'data:text/javascript,export const utilityProcess={fork(){throw Error("No utility process allowed in reference tests")}}', shortCircuit: true};
  return next(specifier, context);
}});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {Document, Packer, Paragraph} from 'docx';
import {wordFixture, mutateWord} from './word-fixtures.mjs';
const {basketFixture} = await import('./paper-basket-fixture.mjs');
const {MaterialRepository} = await import('../../src/main/assets/material-repository.ts');
const {PaperBasketV2Repository} = await import('../../src/main/education/paper-basket-v2-repository.ts');
const {createPaperReferenceService} = await import('../../src/main/education/paper-reference-service.ts');
const {registerPaperReferenceIpc} = await import('../../src/main/education/paper-reference-ipc.ts');
const {PAPER_REFERENCE_SCHEMA, validReferenceExtract, validReferenceList} = await import('../../src/shared/paper-reference.ts');
const {defaultPaperBlueprint} = await import('../../src/shared/paper-blueprint.ts');
const output = fs.mkdtempSync(path.resolve('test-results/paper-reference-source-'));
const f = await basketFixture(path.join(output, 'owned'));
const {db, sid} = f;
let passed = 0;
const check = async (name, work) => {await work(); passed++; console.log('PASS ' + name);};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const signal = () => new AbortController().signal;
try {
  db.exec(`CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,title TEXT,resource_type TEXT,original_file_name TEXT,local_path TEXT,file_size INTEGER,content_hash TEXT,parse_status TEXT,parse_engine TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,heading TEXT,content_md TEXT,page_number INTEGER,contains_personal_data INTEGER);`);
  const root = path.join(output, 'originals'); fs.mkdirSync(root);
  let originalReads = 0, windowReads = 0;
  const materials = new MaterialRepository({root, all: async (sql, params = []) => db.prepare(sql).all(...params),
    mapResource: r => ({id: r.id, title: r.title, originalFileName: r.original_file_name, contentHash: r.content_hash,
      localPath: r.local_path, parseStatus: r.parse_status, parseEngine: r.parse_engine, chunkCount: r.chunk_count, fileSize: r.file_size}),
    mapChunk: r => ({id: r.id, resourceId: r.resource_id, chunkIndex: r.chunk_index, heading: r.heading, contentMd: r.content_md,
      containsPersonalData: !!r.contains_personal_data, pageNumber: r.page_number}),
    change: async () => {throw Error('Unexpected write');}, commit: async () => {throw Error('Unexpected ingest');},
    reuse: async () => {throw Error('Unexpected ingest');}, failure: async () => {throw Error('Unexpected ingest');}});
  const original = materials.original.bind(materials), windowRead = materials.readingWindow.bind(materials);
  materials.original = (...args) => {originalReads++; return original(...args);};
  materials.readingWindow = (...args) => {windowReads++; return windowRead(...args);};
  function add(bytes, name, text, status = 'ready', privateBody = false) {
    const id = 'resource_' + randomUUID(), file = path.join(root, id), version = sha(bytes);
    fs.writeFileSync(file, bytes);
    db.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id, name, 'reference', name, file, bytes.length, version, status, 'unit-committed-v1', 'now', 'now');
    if (text) db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?,?)').run('chunk_' + randomUUID(), id, 0, '', text, 1, privateBody ? 1 : 0);
    return {resourceId: id, version};
  }
  const textA = '试卷名称：受控数学卷\n学科：数学\n年级：初二\n考试时间：45分钟\n满分：12分\n一、选择题（共2小题，每小题3分）\n二、填空题（共2题，每题3分）';
  const a = add(Buffer.from(textA), 'filename-must-not-supply-grade-A4.txt', textA);
  const b = add(Buffer.from('独立未知正文'), '数学初三A4双栏.txt', '独立未知正文');
  const basket = await f.baskets.create({schemaVersion: 'xiaozhi.paper-basket.v1', sessionId: sid, requestId: randomUUID(), blueprint: defaultPaperBlueprint()});
  const baskets = new PaperBasketV2Repository(f.host, f.papers);
  const host = {materials, baskets, privateResourceIds: ids => materials.privateResourceIds(ids)};
  const service = createPaperReferenceService(host);
  const target = {schemaVersion: PAPER_REFERENCE_SCHEMA, sessionId: sid, basketId: basket.id, basketRevision: basket.revision};
  const request = (source, patch = {}) => ({...target, requestId: 'reference_' + randomUUID(), ...source, ...patch});
  const before = db.prepare('SELECT data_json FROM paper_baskets WHERE id=?').get(basket.id).data_json;
  let candidate;
  await check('actual committed text produces version-bound fields, evidence, unknown difficulty and unchanged basket', async () => {
    candidate = await service.extract(request(a), signal());
    assert.equal(candidate.durationMinutes.value, '45'); assert.equal(candidate.sections[0].count.value, '2');
    assert.equal(candidate.sections[0].points.value, '3'); assert.equal(candidate.sections[0].difficulty.status, 'unknown');
    assert(candidate.evidence[0].source.bodyVersion); assert.equal(candidate.source.complete, true);
    assert.equal(candidate.layout.paper.value, null); assert.equal(db.prepare('SELECT data_json FROM paper_baskets WHERE id=?').get(basket.id).data_json, before);
  });
  await check('unknown text never inherits file-name grade, subject or A4; different bytes produce a different proposal', async () => {
    const unknown = await service.extract(request(b), signal());
    assert.equal(unknown.grade.value, null); assert.equal(unknown.subject.value, null); assert.equal(unknown.layout.paper.value, null);
    assert.equal(unknown.sections.length, 0); assert.notEqual(unknown.digest, candidate.digest);
  });
  await check('decimal scores, optional questions and conflicting metadata remain unresolved', async () => {
    const text = '总分：10.5分\n年级：初二\n年级：初三\n一、选择题（共3题，每题3.5分，任选2题）';
    const result = await service.extract(request(add(Buffer.from(text), 'irregular.txt', text)), signal());
    assert.equal(result.totalPoints.status, 'unsupported'); assert.equal(result.grade.status, 'ambiguous');
    assert.equal(result.sections[0].points.status, 'unsupported'); assert.equal(result.sections[0].count.status, 'unsupported');
  });
  await check('actual DOCX ZIP/XML page settings with explicit twip evidence are read from managed original', async () => {
    const bytes = await Packer.toBuffer(new Document({sections: [{properties: {page: {size: {width: 11906, height: 16838},
      margin: {top: 900, bottom: 1000, left: 1100, right: 1200}}, column: {count: 2, space: 500}}, children: [new Paragraph(textA)]}]}));
    const result = await service.extract(request(add(bytes, 'actual.docx', textA)), signal());
    assert.equal(result.layout.paper.value, 'A4'); assert.equal(result.layout.top.value, '900');
    assert.equal(result.layout.columns.value, '2'); assert.equal(result.layout.columnGap.value, '500');
    assert(result.source.structureDigest); assert(result.evidence.some(e => e.part === 'word/document.xml' && e.path && e.text.includes('pgMar')));
  });
  await check('mixed sections are ambiguous and absent properties never become Word defaults', async () => {
    let bytes = await wordFixture();
    bytes = await mutateWord(bytes, async zip => {let xml = await zip.file('word/document.xml').async('string');
      xml = xml.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, '<w:p><w:pPr><w:sectPr><w:pgMar w:top="800"/></w:sectPr></w:pPr></w:p><w:sectPr><w:pgMar w:top="900"/></w:sectPr>'); zip.file('word/document.xml', xml);});
    const result = await service.extract(request(add(bytes, 'mixed.docx', textA)), signal());
    assert.equal(result.layout.top.status, 'ambiguous'); assert.equal(result.layout.paper.value, null); assert.equal(result.layout.columns.value, null);
  });
  await check('unsafe DOCX relationships, XML declarations, duplicate settings and oversized attributes reject without mutation', async () => {
    const bytes = await wordFixture();
    for (const mutation of [
      async zip => {let xml = await zip.file('_rels/.rels').async('string'); xml = xml.replace(/Target="word\/document.xml"/, 'Target="https://outside.invalid/doc.xml" TargetMode="External"'); zip.file('_rels/.rels', xml);},
      async zip => {let xml = await zip.file('word/document.xml').async('string'); zip.file('word/document.xml', xml.replace(/<w:document/, '<!DOCTYPE unsafe><w:document'));},
      async zip => {let xml = await zip.file('word/document.xml').async('string'); zip.file('word/document.xml', xml.replace(/<w:sectPr[^>]*>/, '<w:sectPr><w:pgSz w:w="11906"/><w:pgSz w:w="16838"/>'));},
      async zip => {let xml = await zip.file('word/document.xml').async('string'); zip.file('word/document.xml', xml.replace(/<w:sectPr[^>]*>/, '<w:sectPr><w:cols w:num="' + '9'.repeat(200) + '"/>'));},
    ]) {
      const changed = await mutateWord(bytes, mutation);
      await assert.rejects(service.extract(request(add(changed, 'unsafe.docx', textA)), signal()), /parse_failed|too_large/);
    }
  });
  await check('pre-cancelled extraction never reads body or original', async () => {
    const controller = new AbortController(); controller.abort(); const start = [windowReads, originalReads];
    await assert.rejects(service.extract(request(b), controller.signal), {name: 'AbortError'});
    assert.deepEqual([windowReads, originalReads], start);
  });
  await check('partial committed body and capped chunks explicitly report incomplete coverage', async () => {
    const p = add(Buffer.from(textA), 'partial.pdf', textA, 'partial');
    assert.equal((await service.extract(request(p), signal())).source.complete, false);
    const many = add(Buffer.from('many chunks'), 'many.txt', 'first');
    for (let i = 1; i < 140; i++) db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?,?)').run('chunk_' + randomUUID(), many.resourceId, i, '', 'body ' + i, null, 0);
    const result = await service.extract(request(many), signal());
    assert.equal(result.source.readChunks, 128); assert.equal(result.source.totalChunks, 140); assert.equal(result.source.complete, false);
  });
  await check('private resources are excluded from list and denied before any body/original read', async () => {
    const p = add(Buffer.from('private'), 'private.docx', 'private', 'ready', true), start = [windowReads, originalReads];
    assert(!(await service.list({...target, query: '', offset: 0})).items.some(i => i.resourceId === p.resourceId));
    await assert.rejects(service.extract(request(p), signal()), /permission_denied/); assert.deepEqual([windowReads, originalReads], start);
  });
  await check('wrong owner, inactive student and changed basket revision deny before reading source', async () => {
    const start = windowReads;
    await assert.rejects(service.extract(request(a, {sessionId: f.other}), signal()), /permission_denied/);
    await assert.rejects(service.extract(request(a, {basketRevision: 999}), signal()), /conflict/);
    db.prepare("UPDATE students SET status='archived'").run();
    await assert.rejects(service.extract(request(a), signal()), /permission_denied/); db.prepare("UPDATE students SET status='active'").run();
    assert.equal(windowReads, start);
  });
  await check('changed source bytes, committed chunks and post-read owner changes are rejected', async () => {
    const c = add(Buffer.from(textA), 'changed.txt', textA); fs.appendFileSync(path.join(root, c.resourceId), 'changed');
    await assert.rejects(service.extract(request(c), signal()), /source_changed/);
    const previous = materials.verify.bind(materials);
    materials.verify = async (...args) => {await previous(...args); db.prepare('UPDATE resource_chunks SET content_md=? WHERE resource_id=?').run('changed content', a.resourceId);};
    await assert.rejects(service.extract(request(a), signal()), /source_changed/); materials.verify = previous;
    const source = add(Buffer.from(textA), 'owner-change.txt', textA);
    materials.verify = async (...args) => {await previous(...args); db.prepare("UPDATE ai_conversation_sessions SET archived_at='now' WHERE id=?").run(sid);};
    await assert.rejects(service.extract(request(source), signal()), /permission_denied/);
    db.prepare('UPDATE ai_conversation_sessions SET archived_at=NULL WHERE id=?').run(sid); materials.verify = previous;
  });
  await check('strict inputs reject arbitrary paths, accessor values, extra fields and nonfinite offsets', async () => {
    assert(validReferenceExtract(request(a)));
    assert(!validReferenceExtract(request(a, {path: 'C:/private'}))); assert(!validReferenceList({...target, query: '', offset: Infinity}));
    const x = request(a); let reads = 0; Object.defineProperty(x, 'version', {get() {reads++; return a.version;}});
    assert(!validReferenceExtract(x)); assert.equal(reads, 0);
  });
  await check('real IPC wrapper denies foreign frames and request-specific cancellation never publishes late result', async () => {
    const handlers = new Map(), sender = new EventEmitter(); sender.id = 7;
    const event = {sender, senderFrame: 'main'}, foreign = {sender, senderFrame: 'foreign'};
    let release, entered; const enteredPromise = new Promise(r => {entered = r;});
    const slowMaterials = Object.create(materials); slowMaterials.verify = async (...args) => {entered(); await new Promise(r => {release = r;}); await materials.verify(...args);};
    registerPaperReferenceIpc({handle: (key, fn) => handlers.set(key, fn)}, e => e.senderFrame === 'main', {...host, materials: slowMaterials});
    const invoke = (name, e, input) => handlers.get('education:paper-reference-' + name)(e, input);
    assert.equal((await invoke('extract', foreign, request(b))).error, 'permission_denied');
    const input = request(b), task = invoke('extract', event, input); await enteredPromise;
    assert.equal((await invoke('extract', event, request(b))).error, 'busy');
    assert.equal((await invoke('cancel', event, {...target, requestId: 'wrong_request'})).value, false);
    assert.equal((await invoke('cancel', event, {...target, requestId: input.requestId})).value, true);
    release(); assert.equal((await task).error, 'cancelled');
    assert.equal(db.prepare('SELECT data_json FROM paper_baskets WHERE id=?').get(basket.id).data_json, before);
  });
  console.log(`paper-reference source/SQLite/IPC: ${passed} passed; no Electron/model/ingest`);
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({passed, scope: 'source/SQLite/IPC only; controlled synthetic originals', output}, null, 2));
} finally {f.close();}
