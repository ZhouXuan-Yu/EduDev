import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const {basketFixture}=await import('./paper-basket-fixture.mjs');
const {PAPER_BASKET_SCHEMA}=await import('../../src/shared/paper-basket.ts');
const {PAPER_EXPORT_INTENT_SCHEMA}=await import('../../src/shared/paper-export.ts');
const {readPaperExportIntent}=await import('../../src/main/education/paper-export-intent.ts');
const {assertPaperOffice,createPaperExportTool}=await import('../../src/main/education/paper-export.ts');
const {createOfficeArtifactState}=await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');

const output=fs.mkdtempSync(path.resolve('test-results/u4d1-exact-paper-races-'));
const report={success:false,checks:[],scope:'Actual repository, SQLite, bound tool and Office service/source lease. Existing synthetic unit question qualification adapter; no production fixture, model, Electron or teacher UI approval claim.'};
const check=async(name,fn)=>{await fn();report.checks.push({name,pass:true});console.log('PASS '+name);};
const opened=[];
async function fixture(){
 const f=await basketFixture(path.join(output,'owned-'+randomUUID()));opened.push(f);
 const {db,sid,baskets,papers}=f,item=f.question('独立受控原题');
 const workspace=path.join(f.root,'workspace'),dataRoot=path.join(f.root,'data');
 fs.mkdirSync(workspace);fs.mkdirSync(dataRoot);
 db.exec(`CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT,message_id TEXT,title TEXT,
 artifact_type TEXT,file_name TEXT,mime_type TEXT,description TEXT,content_md TEXT,file_path TEXT,
 file_size INTEGER,content_hash TEXT,status TEXT,error_message TEXT,created_at TEXT,updated_at TEXT);`);
 const sql={run:async(q,p=[])=>db.prepare(q).run(...p),all:async(q,p=[])=>db.prepare(q).all(...p),change:async(q,p=[])=>Number(db.prepare(q).run(...p).changes)};
 const state=createOfficeArtifactState(sql);await state.migrate();
 async function confirm(title){
  let basket=await baskets.create({schemaVersion:PAPER_BASKET_SCHEMA,sessionId:sid,requestId:randomUUID(),blueprint:{title,subject:'数学',grade:'初二',durationMinutes:40,totalPoints:10,mode:'source_only',sections:[{id:'a',label:'解答',questionType:'解答题',count:1,points:10}]}});
  const ref={schemaVersion:PAPER_BASKET_SCHEMA,sessionId:sid,basketId:basket.id};
  const candidate=await baskets.candidate({...ref,questionId:item.id});
  basket=await baskets.mutate({...ref,expectedRevision:basket.revision,requestId:randomUUID(),operation:{type:'add',questionId:item.id,sectionId:'a',expectedSourceVersion:candidate.contentVersion}});
  const pending=await baskets.createSnapshot({...ref,expectedRevision:basket.revision,requestId:randomUUID()});
  return papers.decide({schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:sid,id:pending.id,revision:1,action:'confirm'},()=>true);
 }
 const a=await confirm('确认卷 A'),intent={schemaVersion:PAPER_EXPORT_INTENT_SCHEMA,paperId:a.id,digest:a.digest,audience:'student',format:'docx',template:'paper'};
 let afterRead,beforeCommit,latest=0,installs=0,row;
 const exact={review:async(s,id)=>{assert.equal(id,a.id);const value=await papers.review(s,id);await afterRead?.();return value;},latest:async()=>{latest++;assert.fail('Bound export must never select latest B');}};
 const service=createOfficeArtifactService({state,dataRoot,workspace:async()=>workspace,isCurrent:()=>true,
  validatePaperDraft:async(s,draft)=>assertPaperOffice(await papers.review(s,draft.paperSource.paperId),draft),
  commitPaperDraft:async(s,draft,install)=>{await beforeCommit?.();await papers.withConfirmedSource(s,draft.paperSource.paperId,draft.paperSource.digest,paper=>{assertPaperOffice(paper,draft);installs++;install();});}});
 const tool=createPaperExportTool({papers:exact,paperExportIntent:intent,sessionId:sid,runId:'controlled-run',current:()=>true,wait:fn=>fn(),
  runOffice:async(s,run,_wait,call,raw)=>{row=await service.propose(s,run,call,raw);return {content:[],details:{success:true}};}})[0];
 const execute=()=>tool.execute(randomUUID(),{format:'docx',audience:'student',path:'exact-A.docx'});
 const approve=()=>service.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:sid,draftId:row.id,revision:row.revision,action:'approve'});
 const noDelivery=()=>{assert.equal(latest,0);assert.equal(installs,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM document_artifacts').get().n,0);assert.deepEqual(fs.readdirSync(workspace),[]);};
 return {...f,a,intent,exact,state,service,confirm,execute,approve,noDelivery,get row(){return row;},setAfterRead:fn=>{afterRead=fn;},setBeforeCommit:fn=>{beforeCommit=fn;}};
}
try{
 await check('B confirmed after click capture: exact admission rejects A even though A source remains valid',async()=>{
  const f=await fixture();await f.confirm('确认卷 B');const read=await f.papers.review(f.sid,f.a.id);
  assert(read.sourceCurrent);assert.equal(read.exportCurrent,false);
  await assert.rejects(readPaperExportIntent(f.exact,f.sid,f.intent),/^Error: paper_export_source_changed$/);assert.equal(f.row,undefined);f.noDelivery();
 });
 await check('B confirmed after send admission and before tool read: no proposal or fallback',async()=>{
  const f=await fixture();assert.equal((await readPaperExportIntent(f.exact,f.sid,f.intent)).id,f.a.id);
  await f.confirm('确认卷 B');assert((await f.execute()).isError);assert.equal(f.row,undefined);f.noDelivery();
 });
 await check('B confirmed after exact tool read: draft remains A and final source lease refuses installation',async()=>{
  const f=await fixture();f.setAfterRead(async()=>{await f.confirm('确认卷 B');});
  assert(!(await f.execute()).isError);const stored=await f.state.get(f.row.id);
  assert.equal(stored.draft.paperSource.paperId,f.a.id);assert.equal(stored.draft.paperSource.digest,f.a.digest);
  await f.approve();await assert.rejects(f.service.apply(f.sid,f.row.id),/conflict/);f.noDelivery();
 });
 await check('B confirmed after approval, immediately before synchronous install: no file or source fact',async()=>{
  const f=await fixture();assert(!(await f.execute()).isError);await f.approve();
  f.setBeforeCommit(async()=>{await f.confirm('确认卷 B');});
  await assert.rejects(f.service.apply(f.sid,f.row.id),/conflict/);assert.equal((await f.state.get(f.row.id)).draft.paperSource.paperId,f.a.id);f.noDelivery();
 });
 report.success=true;
}catch(error){report.error=error.stack||String(error);process.exitCode=1;}
finally{for(const f of opened)f.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.length,output,error:report.error}));}
