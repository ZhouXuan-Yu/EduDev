import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {createTextChangeState}=await import('../../src/main/xiaozhi-agent/text-change-state.ts');
const {createTextChangeService}=await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const {textVersionCatalog}=await import('../../src/main/xiaozhi-agent/text-version-catalog.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-html-catalog-')),dataRoot=path.join(root,'data'),workspace=path.join(root,'workspace');fs.mkdirSync(dataRoot);fs.mkdirSync(workspace);
const db=new DatabaseSync(path.join(dataRoot,'app.db'));db.exec('PRAGMA foreign_keys=ON; CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY)');
const sessionId='aisession_'+randomUUID(),other='aisession_'+randomUUID();for(const id of[sessionId,other])db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(id);
const state=createTextChangeState({all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)});await state.migrate();
let cut=false;const service=createTextChangeService({state,dataRoot,workspace:async()=>workspace,isCurrent:()=>true,afterStage:async stage=>{if(cut&&stage==='file')throw Error('owned-cut');}});
const report={ok:false,root,checks:[],boundary:'Real SQLite, original text service/Pi edit algorithm and local files; no model, UI or complete AT claims.'};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
async function propose(raw,id=sessionId){return service.propose(id,'fixture',randomUUID(),raw);}
async function approve(row){return service.decision({schemaVersion:'xiaozhi.change.v1',sessionId:row.sessionId||sessionId,changeId:row.id,revision:row.revision,action:'approve'});}
async function save(raw,id=sessionId){const row=await propose(raw,id);await approve({...row,sessionId:id});return service.apply(id,row.id);}
const html=value=>'<!doctype html><html><h1>载荷'+value+'N</h1></html>';
try {
 const before=new Date().toISOString();let first=await propose({operation:'create',path:'浮力.html',content:html(4)});
 db.prepare('UPDATE xiaozhi_pi_text_changes SET created_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z',first.id);await approve(first);first=await service.apply(sessionId,first.id);
 const original=(await state.versionRecords(sessionId))[0];assert(original.savedAt>=before&&original.savedAt<=new Date().toISOString());assert.equal(original.proposedAt,'2020-01-01T00:00:00.000Z');assert.equal(original.verifiedAt,null);
 const second=await save({operation:'edit',path:'浮力.html',edits:[{oldText:'载荷4N',newText:'载荷5N'}]});let catalog=await textVersionCatalog(state,sessionId);assert.equal(catalog.length,1);assert.equal(catalog[0].id,second.id);assert.equal(catalog[0].officeVersion.familyId,first.id);assert.equal(catalog[0].officeVersion.version,2);assert.equal(catalog[0].filePath,'');assert.equal(catalog[0].contentMd,'');check('Save receipt time differs from proposal time; HTML catalog returns one current family without file bytes or absolute path');
 const savedSecond=(await state.versionRecords(sessionId)).find(r=>r.id===second.id).savedAt;await service.decision({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:second.id,revision:second.revision,action:'undo'});assert.equal((await state.versionRecords(sessionId)).find(r=>r.id===second.id).savedAt,savedSecond);assert.equal((await textVersionCatalog(state,sessionId))[0].id,first.id);check('Undo preserves the original save time and catalog points to the remaining applied version');
 const bytes=(await state.get(first.id)).after;
 // This owned test copy now has the real prior table shape, with rows and without the new time columns.
 db.exec('ALTER TABLE xiaozhi_pi_text_changes DROP COLUMN saved_at');db.exec('ALTER TABLE xiaozhi_pi_text_changes DROP COLUMN verified_at');await state.migrate();await state.migrate();
 catalog=await textVersionCatalog(state,sessionId);assert.equal(catalog[0].htmlVersion.savedAt,null);assert.equal(catalog[0].htmlVersion.verifiedAt,null);assert.deepEqual((await state.get(first.id)).after,bytes);assert.equal((await state.get(second.id)).parentChangeId,first.id);check('Prior database shape migrates twice with legacy save time unknown and original bytes/lineage intact');
 const pending=await propose({operation:'create',path:'中断.html',content:html(7)});await approve(pending);cut=true;await assert.rejects(()=>service.apply(sessionId,pending.id),/owned-cut/);cut=false;let uncertain=await state.get(pending.id);assert.equal(uncertain.state,'uncertain');assert(!(await textVersionCatalog(state,sessionId)).some(r=>r.id===pending.id));const stamp=fs.statSync(path.join(workspace,pending.path)).mtimeMs;
 await state.recover();uncertain=await state.get(pending.id);await service.decision({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:pending.id,revision:uncertain.revision,action:'verify'});const recovered=(await textVersionCatalog(state,sessionId)).find(r=>r.id===pending.id);assert.equal(recovered.htmlVersion.savedAt,null);assert(recovered.htmlVersion.verifiedAt);assert.equal(fs.statSync(path.join(workspace,pending.path)).mtimeMs,stamp);check('Save-before-outcome recovery records verification time only, without inventing a save time or writing again');
 await propose({operation:'create',path:'未确认.html',content:html(8)});await save({operation:'create',path:'说明.txt',content:'普通文本'});await save({operation:'create',path:'另一会话.html',content:html(9)},other);
 assert.equal((await textVersionCatalog(state,sessionId)).length,2);assert.equal((await textVersionCatalog(state,other)).length,1);assert.equal((await textVersionCatalog(state)).length,3);assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='document_artifacts'").get().n,0);check('Pending/non-HTML changes are excluded, session filtering is exact, and no duplicate document artifact table is needed');
 for(let i=0;i<102;i++)await save({operation:'create',path:`容量-${i}.html`,content:html(i)},other);
 const seeds=await state.catalogSeeds(other);assert.equal(seeds.length,100);catalog=await textVersionCatalog(state,other);assert.equal(catalog.length,100);assert(catalog.every(row=>row.sessionId===other));assert(!catalog.some(row=>row.fileName==='另一会话.html'));assert.equal((await textVersionCatalog(state,sessionId)).length,2);check('Global/session metadata queries are bounded at 100 recent records; older sessions remain independently queryable');
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.error);}finally{db.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root}));}
