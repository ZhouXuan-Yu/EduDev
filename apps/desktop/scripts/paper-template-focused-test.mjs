import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

async function load(entry) {
  const result = await build({entryPoints: [fileURLToPath(new URL('../' + entry, import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm'});
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const {migratePaperTemplates} = await load('src/main/education/paper-template-schema.ts');
const {planPaperTemplateMapping: plan} = await load('src/main/education/paper-template-mapping.ts');
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON; CREATE TABLE legacy (value TEXT); INSERT INTO legacy VALUES (\'preserved\')');
const sql = {run: async (query, params = []) => db.prepare(query).run(...params)};
await migratePaperTemplates(sql);
await migratePaperTemplates(sql);
assert.equal(db.prepare('SELECT value FROM legacy').get().value, 'preserved');
db.exec("INSERT INTO paper_template_heads VALUES ('t','',1); INSERT INTO paper_template_versions VALUES ('t',1,'d','v1','{}','now')");
assert.throws(() => db.exec("UPDATE paper_template_versions SET name='v2'"), /immutable_template_version/);
assert.throws(() => db.exec('DELETE FROM paper_template_versions'), /immutable_template_version/);
db.exec("INSERT INTO paper_template_receipts VALUES ('s','r','','hash','{\"version\":1}')");
assert.throws(() => db.exec("UPDATE paper_template_receipts SET result_json='{}'"), /immutable_template_receipt/);
assert.equal(JSON.parse(db.prepare('SELECT result_json FROM paper_template_receipts').get().result_json).version, 1);
const section = {id: 'old', label: '题', questionType: '选择题', count: 1, points: 5};
const previous = {title: '卷', subject: '数学', grade: '初二', durationMinutes: 30, totalPoints: 5, mode: 'source_only', sections: [section]};
const next = {...previous, totalPoints: 10, sections: [{...section, id: 'new', points: 10}]};
const entries = [{entryId: 'entry', sectionId: 'old', instance: {content: 'keep'}, source: 'keep'}];
const before = JSON.stringify(entries);
const mapped = plan(previous, next, entries, [{templateSectionId: 'new', target: {kind: 'existing', sectionId: 'old'}}]);
assert.equal(mapped.entryPoints.entry, 5);
assert.equal(mapped.conflicts.length, 1);
assert.equal(mapped.mappingComplete, false);
assert.equal(JSON.stringify(entries), before);
assert.equal(JSON.stringify(mapped.entries), before);
assert.deepEqual(mapped.entries[0].instance, entries[0].instance);
assert.throws(() => plan(previous, next, entries, []), /explicit_mapping_required/);
assert.throws(() => plan(previous, next, entries, [{templateSectionId: 'missing', target: {kind: 'new',sectionId:'new'}}]), /explicit_mapping_required/);
const retained = plan(previous, next, entries, [{templateSectionId: 'new', target: {kind: 'new',sectionId:'new'}}]);
assert.deepEqual(retained.retainedSections[0].section, section);
assert.equal(retained.mappingComplete, false);
const again = plan(retained.blueprint, next, retained.entries, [{templateSectionId:'new',target:{kind:'existing',sectionId:'new'}}],retained.entryPoints,retained.retainedSections);
assert.deepEqual(again.retainedSections.find(r=>r.section.id==='old').section,section);
assert.equal(JSON.stringify(again.entries),before);
const unknown=plan(previous,next,[{entryId:'orphan',sectionId:'unknown'}],[{templateSectionId:'new',target:{kind:'existing',sectionId:'old'}}]);
assert.equal(unknown.entryPoints.orphan,null);assert.equal(unknown.unknownRetainedSections[0].sectionId,'unknown');assert.equal(unknown.mappingComplete,false);
const two={...next,totalPoints:20,sections:[...next.sections,{...next.sections[0],id:'second'}]};
assert.throws(()=>plan(previous,two,entries,[{templateSectionId:'new',target:{kind:'existing',sectionId:'old'}}]),/explicit_mapping_required/);
assert.throws(()=>plan(previous,two,entries,[{templateSectionId:'new',target:{kind:'existing',sectionId:'old'}},{templateSectionId:'second',target:{kind:'existing',sectionId:'old'}}]),/explicit_mapping_required/);
const hybrid={...previous,mode:'hybrid',sections:[{...section,generatedCount:0}]};
assert.equal(plan(hybrid,next,entries,[{templateSectionId:'new',target:{kind:'existing',sectionId:'old'}}]).blueprint.sections[0].generatedCount,0);
assert.throws(()=>plan(hybrid,next,entries,[{templateSectionId:'new',target:{kind:'new',sectionId:'fresh'}}]),/quota_mapping_required/);
assert.equal(plan(hybrid,next,entries,[{templateSectionId:'new',generatedCount:1,target:{kind:'new',sectionId:'fresh'}}]).blueprint.sections[0].generatedCount,1);
const {PaperTemplateRepository} = await load('src/main/education/paper-template-repository.ts');
db.exec("CREATE TABLE ai_conversation_sessions(id TEXT, student_id TEXT, archived_at TEXT); CREATE TABLE students(id TEXT,status TEXT); INSERT INTO ai_conversation_sessions VALUES ('aisession_11111111-1111-4111-8111-111111111111','','' )");
db.exec("UPDATE ai_conversation_sessions SET archived_at=NULL");
const repoSql = {...sql, all: async (query, params = []) => db.prepare(query).all(...params)};
const repository = new PaperTemplateRepository({transaction: async work => {
  db.exec('BEGIN IMMEDIATE');
  try {const value = await work(repoSql); db.exec('COMMIT'); return value;}
  catch (error) {db.exec('ROLLBACK'); throw error;}
}});
const input = {sessionId: 'aisession_11111111-1111-4111-8111-111111111111', requestId: 'request_test_1', expectedHeadVersion: 0,
  intent: {kind: 'save',name:'第一版'}, content: {name: '第一版', kind: 'structure', candidate: {}, structure: previous}};
// Internal persistence test: extraction/patch validation belongs to the service, not this trusted DAO.
const receipt = await repository.save(input, async () => {}, () => true);
assert.deepEqual(await repository.save(input, async () => {}, () => true), receipt);
await assert.rejects(repository.save({...input,intent:{...input.intent,name:'different'}, content: {...input.content, name: 'different'}}, async () => {}, () => true), /idempotency_conflict/);
assert.deepEqual(await repository.save(input,async()=>{throw Error('source_changed');},()=>true),receipt);
await assert.rejects(repository.save({...input, requestId: 'request_test_2', templateId: receipt.template.templateId}, async () => {}, () => true), /conflict/);
await assert.rejects(repository.save({...input, requestId: 'request_test_3'}, async () => {throw Error('source_changed');}, () => true), /source_changed/);
await assert.rejects(repository.save({...input, requestId: 'request_test_4'}, async () => {}, () => false), /cancelled/);
await assert.rejects(repository.save({...input, requestId: 'request_test_5', sessionId: 'aisession_22222222-2222-4222-8222-222222222222'}, async () => {}, () => true), /permission_denied/);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM paper_template_heads WHERE template_id!='t'").get().n, 1);
db.close();
console.log('PASS: SQLite additive/idempotent migration, immutable version/receipt, legacy preservation, explicit mapping, score conflict, instance preservation, empty release');
