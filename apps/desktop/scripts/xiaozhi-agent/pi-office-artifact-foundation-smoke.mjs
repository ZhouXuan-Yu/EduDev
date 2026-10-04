import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {spawnSync} from 'node:child_process';
const {createOfficeArtifactState,officeSha,officeSummary}=await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const {fileVersion}=await import('../../src/main/xiaozhi-agent/workspace-files.ts');
const {generateOfficeDocument}=await import('../../src/main/xiaozhi-agent/office-generator.ts');
const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
const session=`aisession_${randomUUID()}`,other=`aisession_${randomUUID()}`;
globalThis.fetch=async()=>{throw new Error('Network forbidden in local artifact foundation');};
const testRoot=fs.realpathSync(path.resolve('test-results/xiaozhi-agent'));
const sqlAdapter=db=>({run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes),all:async(s,v=[])=>db.prepare(s).all(...v)});
function engine(directory,extra={}){
 const db=new DatabaseSync(path.join(directory,'ledger.db'));db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS ai_conversation_sessions(id TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
 for(const id of [session,other])db.prepare('INSERT OR IGNORE INTO ai_conversation_sessions VALUES(?)').run(id);
 const state=createOfficeArtifactState(sqlAdapter(db)),dataRoot=path.join(directory,'data'),workspace=path.join(directory,'workspace');
 fs.mkdirSync(dataRoot,{recursive:true});fs.mkdirSync(workspace,{recursive:true});let grant=workspace,active=true;
 const service=createOfficeArtifactService({state,dataRoot,workspace:async()=>grant,isCurrent:()=>active,...extra});
 return {db,state,service,dataRoot,workspace,setGrant:v=>grant=v,setActive:v=>active=v};
}
if(process.argv[2]==='--child'){
 const directory=fs.realpathSync(process.argv[3]),relative=path.relative(testRoot,directory);
 assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
 const data=JSON.parse(fs.readFileSync(path.join(directory,'child.json')));
 const e=engine(directory,{afterStage:async stage=>{if(stage===data.cut)process.exit(73);}});
 await e.state.migrate();await e.service.apply(data.sessionId,data.id);throw new Error('Real exit cut not reached');
}
const output=fs.mkdtempSync(path.join(testRoot,'pi-office-artifact-foundation-'));
const report={success:false,checks:[],boundary:'Actual SQLite, local FS, original Pi queue, actual DOCX/XLSX/PPTX libraries and real process.exit73. PDF foundation separately Electron; no formal Pi tool, typed UI or teacher/WPS path claim.'};
const opened=[];
async function fixture(extra){const e=engine(fs.mkdtempSync(path.join(output,'owned-')),extra);opened.push(e);await e.state.migrate();await e.state.migrate();return e;}
const draft=(text='教师拟备课内容')=>({schemaVersion:'xiaozhi.office-draft.v1',title:'教学计划',sections:[{heading:'课时',paragraphs:[text],table:{columns:['课题','分钟'],rows:[['复习',37],['=1+1',8]]}}]});
const input=(e,sources=[],format='xlsx',name='备课')=>({path:name+'.'+format,format,draft:draft(),sources});
const propose=(e,x=input(e),call=randomUUID())=>e.service.propose(session,'owned-run',call,x);
const decide=(e,row,action)=>e.service.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:session,draftId:row.id,revision:row.revision,action});
const apply=async(e,row)=>{const approved=await decide(e,row,'approve');return e.service.apply(session,approved.id);};
const count=e=>Number(e.db.prepare('SELECT count(*) n FROM document_artifacts').get().n);
const check=async(name,action)=>{await action();report.checks.push({name,pass:true});console.log('PASS '+name);};
try{
 await check('Proposal persists strict reviewed content and captured sources atomically with zero file/artifact effects',async()=>{
  const e=await fixture();fs.writeFileSync(path.join(e.workspace,'资料.txt'),'原资料哨兵');
  const version=fileVersion(fs.lstatSync(path.join(e.workspace,'资料.txt'))),row=await propose(e,input(e,[{path:'资料.txt',version}]));
  assert.equal(row.state,'pending');assert.equal(row.sourceCount,1);assert.equal(count(e),0);assert(!fs.existsSync(path.join(e.workspace,'备课.xlsx')));
  const review=await e.service.review(session,row.id);assert.equal(review.sources[0].sha256,officeSha('原资料哨兵'));assert.equal(review.draft.title,'教学计划');
  assert.equal(e.db.prepare('SELECT count(*) n FROM xiaozhi_pi_office_draft_sources').get().n,1);
  assert.deepEqual(Object.keys(row).sort(),['schemaVersion','id','runId','callId','path','format','state','revision','artifactId','sourceCount'].sort());
  await assert.rejects(e.service.apply(session,row.id),/conflict/);
 });
 await check('Teacher revision replaces pending draft and invalidates stale confirmation before actual XLSX save',async()=>{
  const e=await fixture(),row=await propose(e);const revised=await e.service.revise(session,row.id,row.revision,draft('教师修改后的课程内容'));
  assert.equal(revised.revision,1);await assert.rejects(decide(e,row,'approve'),/conflict/);
  const saved=await apply(e,revised);assert.equal(saved.state,'saved');
  const ExcelJS=(await import('exceljs')).default,w=new ExcelJS.Workbook();await w.xlsx.readFile(path.join(e.workspace,'备课.xlsx'));
  assert.equal(w.getWorksheet(1).getCell('A3').value,'教师修改后的课程内容');assert.equal(w.getWorksheet(1).getCell('B6').value,37);assert.equal(w.getWorksheet(1).getCell('A7').value,'=1+1');
  assert.equal(fs.lstatSync(path.join(e.workspace,'备课.xlsx')).nlink,1);assert.equal(count(e),1);
  const artifact=e.db.prepare('SELECT * FROM document_artifacts').get();assert.equal(artifact.artifact_type,'xlsx');assert.equal(artifact.content_hash,officeSha(fs.readFileSync(artifact.file_path)));
  assert.equal(e.db.prepare('SELECT source_type FROM document_artifact_sources').get().source_type,'ai_generated');
 });
 await check('Actual DOCX and PPTX generators commit bounded real library files into existing artifact facts',async()=>{
  const e=await fixture();for(const format of ['docx','pptx']){const row=await apply(e,await propose(e,input(e,[],format)));assert.equal(row.state,'saved');
   const saved=e.db.prepare('SELECT * FROM document_artifacts WHERE id=?').get(row.artifactId);assert.equal(saved.artifact_type,format);assert(saved.file_size>1000);assert.equal(saved.content_hash,officeSha(fs.readFileSync(saved.file_path)));}
  assert.equal(count(e),2);
 });
 await check('Rejection leaves no file, source relationship or official artifact and cannot generate',async()=>{
  const e=await fixture(),row=await propose(e),rejected=await decide(e,row,'reject');assert.equal(rejected.state,'rejected');
  await assert.rejects(e.service.apply(session,row.id),/conflict/);assert.equal(count(e),0);assert(!fs.existsSync(path.join(e.workspace,'备课.xlsx')));
 });
 await check('Same call is idempotent after teacher revision and actual save, different payload conflicts',async()=>{
  const e=await fixture(),x=input(e),row=await propose(e,x,'same-call');await e.service.revise(session,row.id,0,draft('教师版本'));
  assert.equal((await propose(e,x,'same-call')).id,row.id);const latest=officeSummary(await e.state.get(row.id));await apply(e,latest);
  const again=await propose(e,x,'same-call');assert.equal(again.state,'saved');assert.equal(count(e),1);
  await assert.rejects(propose(e,{...x,draft:draft('另一个输入')},'same-call'),/conflict/);
 });
 await check('Source version changes before approval or after approval refuse output and retain manual bytes',async()=>{
  for(const timing of ['before','after']){const e=await fixture(),file=path.join(e.workspace,'资料.txt');fs.writeFileSync(file,'原资料');
   let row=await propose(e,input(e,[{path:'资料.txt',version:fileVersion(fs.lstatSync(file))}]));if(timing==='after')row=await decide(e,row,'approve');
   fs.writeFileSync(file,'教师手工新资料');const result=timing==='before'?await decide(e,row,'approve'):await e.service.apply(session,row.id);
   assert.equal(result.state,'conflict');assert.equal(fs.readFileSync(file).toString(),'教师手工新资料');assert.equal(count(e),0);assert(!fs.existsSync(path.join(e.workspace,'备课.xlsx')));
  }
 });
 await check('New binary revision preserves original file and stores explicit parent artifact plus file provenance',async()=>{
  const e=await fixture();fs.writeFileSync(path.join(e.workspace,'资料.txt'),'源正文');
  const first=await apply(e,await propose(e,input(e,[{path:'资料.txt',version:fileVersion(fs.lstatSync(path.join(e.workspace,'资料.txt')))}])));
  const original=fs.readFileSync(path.join(e.workspace,'备课.xlsx'));
  const parentVersion=fileVersion(fs.lstatSync(path.join(e.workspace,'备课.xlsx')));
  await assert.rejects(propose(e,{...input(e,[{path:'备课.xlsx',version:'0'.repeat(64)}],'xlsx','坏来源版本'),parentArtifactId:first.artifactId}),/conflict/);
  const next=await apply(e,await propose(e,{...input(e,[{path:'备课.xlsx',version:parentVersion}],'xlsx','备课第二版'),parentArtifactId:first.artifactId,draft:draft('第二版')}));
  assert.equal(next.sourceCount,1);const parentRow=e.db.prepare('SELECT * FROM document_artifact_sources WHERE artifact_id=?').get(next.artifactId);assert.equal(parentRow.source_type,'parent_artifact');assert.equal(parentRow.file_version,parentVersion);
  assert.notEqual(first.artifactId,next.artifactId);assert(fs.readFileSync(path.join(e.workspace,'备课.xlsx')).equals(original));
  const links=e.db.prepare('SELECT * FROM document_artifact_sources ORDER BY artifact_id,ordinal').all();assert(links.some(x=>x.source_type==='workspace_file'&&x.relative_path==='资料.txt'));assert(links.some(x=>x.source_type==='parent_artifact'&&x.source_id===first.artifactId));
  fs.writeFileSync(path.join(e.workspace,'备课.xlsx'),'手改旧文件');await assert.rejects(propose(e,{...input(e,[],'xlsx','第三版'),parentArtifactId:first.artifactId}),/conflict/);
 });
 await check('Cross-session review/revise/decide/apply cannot access private draft',async()=>{
  const e=await fixture(),row=await propose(e);await assert.rejects(e.service.review(other,row.id),/permission_denied/);await assert.rejects(e.service.revise(other,row.id,0,draft()),/permission_denied/);
  await assert.rejects(e.service.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:other,draftId:row.id,revision:0,action:'approve'}),/permission_denied/);await assert.rejects(e.service.apply(other,row.id),/permission_denied/);
 });
 await check('Concurrent revision decisions and commits install one file and one official artifact',async()=>{
  const e=await fixture(),row=await propose(e);const decisions=await Promise.allSettled([decide(e,row,'approve'),decide(e,row,'reject')]);assert.equal(decisions.filter(v=>v.status==='fulfilled').length,1);
  assert.equal(decisions.find(v=>v.status==='fulfilled').value.state,'approved');const results=await Promise.allSettled([e.service.apply(session,row.id),e.service.apply(session,row.id)]);assert.equal(results.filter(v=>v.status==='fulfilled').length,1);assert.equal(count(e),1);
 });
 await check('Existing target and a competing creator never get overwritten',async()=>{
  const e=await fixture(),row=await propose(e);fs.writeFileSync(path.join(e.workspace,'备课.xlsx'),'教师文件');assert.equal((await decide(e,row,'approve')).state,'conflict');assert.equal(fs.readFileSync(path.join(e.workspace,'备课.xlsx')).toString(),'教师文件');
  await assert.rejects(propose(e),/conflict/);assert.equal(count(e),0);
 });
 await check('Traversal, Windows aliases, credentials, hardlinks and unsupported model paths are rejected',async()=>{
  const e=await fixture();fs.writeFileSync(path.join(e.workspace,'源.txt'),'原文');fs.linkSync(path.join(e.workspace,'源.txt'),path.join(e.workspace,'硬.txt'));
  for(const p of ['../外部.xlsx','.env.xlsx','.pi/a.xlsx','CON.xlsx','dir./a.xlsx','备课.xlsx:流','/a.xlsx','a.docx'])await assert.rejects(propose(e,{...input(e),path:p}));
  await assert.rejects(propose(e,{...input(e),sources:[{path:'硬.txt',version:fileVersion(fs.lstatSync(path.join(e.workspace,'硬.txt')))}]}),/permission_denied/);
  await assert.rejects(propose(e,{...input(e),draft:{...draft(),url:'https://example.com'}}),/invalid_input/);
  assert.equal((await e.state.list(session)).length,0);
 });
 await check('Stop, revoke and abort after actual generation discard output without installing',async()=>{
  for(const mode of ['stop','revoke','abort']){const controller=new AbortController();let e; e=await fixture({generate:async(...args)=>{const bytes=await generateOfficeDocument(...args);if(mode==='stop')e.setActive(false);if(mode==='revoke')e.setGrant(null);if(mode==='abort')controller.abort();return bytes;}});
   const approved=await decide(e,await propose(e),'approve');await assert.rejects(e.service.apply(session,approved.id,controller.signal),/permission_denied|cancelled/);assert(!fs.existsSync(path.join(e.workspace,'备课.xlsx')));assert.equal(count(e),0);
  }
 });
 await check('Malformed/corrupt content and source rows fail closed before confirmation or file effects',async()=>{
  const e=await fixture(),row=await propose(e);e.db.prepare('UPDATE xiaozhi_pi_office_drafts SET draft_json=? WHERE id=?').run(JSON.stringify(draft('被篡改')),row.id);await assert.rejects(e.service.review(session,row.id),/configuration/);assert.equal(count(e),0);
  const e2=await fixture();fs.writeFileSync(path.join(e2.workspace,'源.txt'),'来源');const row2=await propose(e2,input(e2,[{path:'源.txt',version:fileVersion(fs.lstatSync(path.join(e2.workspace,'源.txt')))}]));e2.db.prepare('UPDATE xiaozhi_pi_office_draft_sources SET sha256=?').run('0'.repeat(64));await assert.rejects(decide(e2,row2,'approve'),/configuration/);assert.equal(count(e2),0);
 });
 await check('Official id conflict atomically rolls back saved state and lineage while preserving old fact',async()=>{
  let e;e=await fixture({afterStage:async stage=>{if(stage==='file'){const x=(await e.state.list(session))[0];e.db.prepare(`INSERT INTO document_artifacts VALUES(?,?,'','旧事实','markdown','旧.md','text/markdown','','旧正文','',0,'','exported','','旧时间','旧时间')`).run(x.artifactId,session);}}});
  const row=await decide(e,await propose(e),'approve');await assert.rejects(e.service.apply(session,row.id));assert.equal((await e.state.get(row.id)).state,'uncertain');assert.equal(e.db.prepare('SELECT title FROM document_artifacts').get().title,'旧事实');assert.equal(e.db.prepare('SELECT count(*) n FROM document_artifact_sources').get().n,0);assert(fs.existsSync(path.join(e.workspace,'备课.xlsx')));
 });
 await check('Real child exits at prepared, intent, file and fact recover without regeneration or file replay',async()=>{
  for(const cut of ['prepared','intent','file','fact']){const e=await fixture();const approved=await decide(e,await propose(e),'approve'),directory=path.dirname(e.db.location());
   fs.writeFileSync(path.join(directory,'child.json'),JSON.stringify({cut,sessionId:session,id:approved.id}));e.db.close();opened.splice(opened.indexOf(e),1);
   const child=spawnSync(process.execPath,[path.resolve('scripts/xiaozhi-agent/pi-office-artifact-foundation-smoke.mjs'),'--child',directory],{cwd:process.cwd(),encoding:'utf8',timeout:60000});assert.equal(child.status,73,child.stderr);
   const recovered=engine(directory);opened.push(recovered);await recovered.state.migrate();const source=path.join(recovered.workspace,'备课.xlsx');const before=fs.existsSync(source)?{bytes:fs.readFileSync(source),mtime:fs.statSync(source).mtimeMs}:null;
   await recovered.state.recover();await recovered.state.recover();let row=await recovered.state.get(approved.id);
   assert.equal(row.state,cut==='prepared'?'interrupted':cut==='fact'?'saved':'uncertain');
   if(row.state==='uncertain')row=await decide(recovered,row,'verify');assert.equal(row.state,cut==='file'||cut==='fact'?'saved':'interrupted');assert.equal(count(recovered),cut==='file'||cut==='fact'?1:0);
   if(before){assert(fs.readFileSync(source).equals(before.bytes));assert.equal(fs.statSync(source).mtimeMs,before.mtime);}else assert(!fs.existsSync(source));
  }
 });
 await check('Read-only uncertain verification preserves competing manual version and refuses publishing it',async()=>{
  const e=await fixture({afterStage:async stage=>{if(stage==='file')throw new Error('controlled-after-file');}}),row=await decide(e,await propose(e),'approve');await assert.rejects(e.service.apply(session,row.id));await e.state.recover();const uncertain=await e.state.get(row.id);fs.writeFileSync(path.join(e.workspace,'备课.xlsx'),'教师新内容');const before=fs.statSync(path.join(e.workspace,'备课.xlsx')).mtimeMs;
  assert.equal((await decide(e,uncertain,'verify')).state,'conflict');assert.equal(count(e),0);assert.equal(fs.readFileSync(path.join(e.workspace,'备课.xlsx')).toString(),'教师新内容');assert.equal(fs.statSync(path.join(e.workspace,'备课.xlsx')).mtimeMs,before);
 });
 await check('Old isolated production database copy and fresh state migrate twice without changing any old table rows',async()=>{
  const source=path.resolve('test-results/xiaozhi-agent/pi-shell-reading-NOm6wY/data/app.db');assert(!path.relative(testRoot,source).startsWith('..'));
  const originalHash=officeSha(fs.readFileSync(source)),copy=path.join(output,'legacy-copy.db');fs.copyFileSync(source,copy);const db=new DatabaseSync(copy);
  try{
   const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x=>x.name);
   const facts=()=>Object.fromEntries(names.map(name=>[name,db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`).all().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]));
   const before=facts(),state=createXiaozhiSessionState(sqlAdapter(db));await state.init();await state.init();assert.deepEqual(facts(),before);
   assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_pi_office_drafts').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM document_artifact_sources').get().n,0);
  }finally{db.close();}assert.equal(officeSha(fs.readFileSync(source)),originalHash);
 });
 report.success=true;
}catch(error){report.error=String(error?.stack||error);console.error(report.error);process.exitCode=1;}
finally{for(const e of opened)e.db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:report.checks.length,output}));}
