import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {fork} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {Document,Packer,Paragraph} from 'docx';

// Real Node child runs the unchanged production document-worker/parser. Only
// Electron's utility transport is adapted; no Electron window/model is launched.
const children=new Set();let forks=0;
globalThis.savedPreviewUtility={fork(entry,_args,options){
  assert(entry.endsWith('document-worker.js'));forks++;
  const child=fork(path.resolve('src/main/xiaozhi-agent/document-worker.ts'),[],{env:options.env,serialization:'advanced',
    execArgv:['--experimental-transform-types','--import',pathToFileURL(path.resolve('scripts/office-agent/register-source.mjs')).href],stdio:['ignore','pipe','pipe','ipc']});
  children.add(child);child.once('exit',()=>children.delete(child));child.postMessage=value=>child.send(value);return child;
}};
registerHooks({resolve(specifier,context,next){if(specifier==='electron')return {url:'data:text/javascript,export const utilityProcess=globalThis.savedPreviewUtility;export const shell={};export const session={};export const app={isPackaged:false};export class BrowserWindow{constructor(){throw Error("ELECTRON_FORBIDDEN");}}',shortCircuit:true};return next(specifier,context);},
  load(url,context,next){if(url.endsWith('/ocr-runtime-manifest.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};return next(url,context);}});
const {createSavedArtifactPreview}=await import('../../src/main/xiaozhi-agent/saved-artifact-preview.ts');
const {extractLocalDocument}=await import('../../src/main/xiaozhi-agent/document-host.ts');
const {createOfficeArtifactState}=await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');
const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
const {createXiaozhiProductionHost}=await import('../../src/main/xiaozhi-agent/production-host.ts');
const {registerOfficeArtifactIpc}=await import('../../src/main/xiaozhi-agent/office-artifact-api.ts');
const {PAPER_C2_OFFICE_SCHEMA}=await import('../../src/shared/paper-export.ts');
const {PAPER_PRINT_LAYOUT}=await import('../../src/shared/paper-print-layout.ts');
const {PAPER_SNAPSHOT_C2_SCHEMA}=await import('../../src/shared/paper-basket-c2.ts');
const {validSavedArtifactPreviewInput}=await import('../../src/shared/saved-artifact-preview.ts');
const sha=value=>createHash('sha256').update(value).digest('hex');
globalThis.fetch=async()=>{throw Error('NO_NETWORK');};
const output=fs.mkdtempSync(path.resolve('test-results/saved-artifact-preview-')),dataRoot=path.join(output,'data'),workspace=path.join(output,'paper-output');
fs.mkdirSync(dataRoot);fs.mkdirSync(workspace);
const db=new DatabaseSync(path.join(dataRoot,'owned.db'));
db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);
 CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,status TEXT);
 CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
const sql={all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)};
const state=createOfficeArtifactState(sql);await state.migrate();
const sessionId=`aisession_${randomUUID()}`,otherId=`aisession_${randomUUID()}`;for(const id of [sessionId,otherId])db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(id);
const bytes=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('实际本地解析核对：17 + 8 = 25')]}]}));
const draft={schemaVersion:PAPER_C2_OFFICE_SCHEMA,title:'本地试卷',sections:[{heading:'第一题',paragraphs:['17 + 8 = ?']}],paperSource:{paperId:`xipaper_${randomUUID()}`,digest:'a'.repeat(64),audience:'student',template:'paper',printLayout:PAPER_PRINT_LAYOUT,snapshotSchema:PAPER_SNAPSHOT_C2_SCHEMA}};
let row=await state.create({sessionId,runId:'owned-run',callId:'owned-call',workspaceHash:sha(workspace),inputHash:sha('owned'),path:'saved.docx',format:'docx',draft,sources:[],parentArtifactId:null});
for(const next of ['approved','generating','prepared','committing','saved'])row=await state.transition(row,[row.state],next,next==='prepared'?{output:bytes,resultPath:path.join(workspace,'saved.docx')}:{});
const artifactId=row.artifactId,file=path.join(workspace,row.path);fs.writeFileSync(file,bytes);
const address=()=>({sessionId,artifactId,requestId:`xifile_${randomUUID()}`});
const artifact=async id=>{const r=db.prepare('SELECT * FROM document_artifacts WHERE id=?').get(id);return r?{id:r.id,sessionId:r.session_id,status:r.status,type:r.artifact_type,fileName:r.file_name,filePath:r.file_path,fileSize:r.file_size,contentHash:r.content_hash,updatedAt:r.updated_at}:null;};
let granted=true,archived=false,active=true,extract=extractLocalDocument;
const options={dataRoot,authorize:async id=>{if(archived||id!==sessionId)throw Error('permission_denied');},current:()=>active,
  byArtifact:(id,key)=>state.byArtifact(id,key),artifact,resolve:async(_id,hash)=>granted&&hash===sha(workspace)?workspace:null,
  extract:(request,signal)=>extract(request,signal)};
let service=createSavedArtifactPreview(options),host;
const report={success:false,checks:[],boundary:'Owned real SQLite v7 saved lineage and FS; original document-host/worker/Anydoc via Node child transport. No Electron, model, business IPC mutation, or build.'};
async function check(name,run){await run();report.checks.push({name,pass:true});console.log('PASS '+name);}
const denied=async(input,error)=>{const value=await service.preview(input);assert.equal(value.ok,false);assert.equal(value.error,error);};
const barrier=()=>{let release,enter;const waiting=new Promise(r=>release=r),entered=new Promise(r=>enter=r);return {release,entered,extract:async(request,signal)=>{enter();await waiting;return extractLocalDocument(request,signal);}};};
try{
  await check('Strict identity request rejects paths and unknown keys',async()=>{assert(validSavedArtifactPreviewInput(address()));assert(!validSavedArtifactPreviewInput({...address(),path:file}));await denied({...address(),path:file},'invalid_input');});
  await check('Actual v7 saved lineage + exact bytes reach original parser; zero DB/file effects',async()=>{
    const before=db.prepare('SELECT total_changes() n').get().n,dbHash=sha(fs.readFileSync(path.join(dataRoot,'owned.db'))),fileHash=sha(fs.readFileSync(file));
    const value=await service.preview(address());assert(value.ok,JSON.stringify(value));assert(value.value.markdown.includes('17 + 8 = 25'));assert.equal(value.value.sha256,sha(bytes));assert.equal(forks,1);
    assert.equal(db.prepare('SELECT total_changes() n').get().n,before);assert.equal(sha(fs.readFileSync(path.join(dataRoot,'owned.db'))),dbHash);assert.equal(sha(fs.readFileSync(file)),fileHash);
  });
  await check('Wrong session/artifact, archived session, and absent exact grant refuse before parser',async()=>{const before=forks;await denied({...address(),sessionId:otherId},'permission_denied');await denied({...address(),artifactId:`artifact_${randomUUID()}`},'permission_denied');archived=true;await denied(address(),'permission_denied');archived=false;granted=false;await denied(address(),'permission_denied');granted=true;assert.equal(forks,before);});
  await check('Missing or mismatched paper lineage is not a generic raw artifact read',async()=>{db.prepare('UPDATE document_artifact_paper_sources SET paper_digest=? WHERE artifact_id=?').run('b'.repeat(64),artifactId);await denied(address(),'read_failed');db.prepare('UPDATE document_artifact_paper_sources SET paper_digest=? WHERE artifact_id=?').run('a'.repeat(64),artifactId);});
  await check('Exported state, format, relative path, saved hash and file size bind independently',async()=>{for(const [column,bad,expected]of [['status','draft','permission_denied'],['artifact_type','pdf','changed'],['file_name','other.docx','changed'],['content_hash','b'.repeat(64),'changed'],['file_size',1,'changed']]){const original=db.prepare('SELECT '+column+' value FROM document_artifacts WHERE id=?').get(artifactId).value;db.prepare('UPDATE document_artifacts SET '+column+'=? WHERE id=?').run(bad,artifactId);await denied(address(),expected);db.prepare('UPDATE document_artifacts SET '+column+'=? WHERE id=?').run(original,artifactId);}});
  await check('Same-size changed file hash denied before parser; no output_bytes fallback',async()=>{const before=forks,bad=Buffer.from(bytes);bad[bad.length-1]^=1;fs.writeFileSync(file,bad);await denied(address(),'changed');assert.equal(forks,before);fs.writeFileSync(file,bytes);});
  await check('Hardlinked file and symbolic workspace ancestor refuse',async()=>{const link=path.join(workspace,'hard.docx');fs.linkSync(file,link);await denied(address(),'permission_denied');fs.unlinkSync(link);
    const original=workspace+'.original';fs.renameSync(workspace,original);let linked=false;
    try{fs.symlinkSync(original,workspace,process.platform==='win32'?'junction':'dir');linked=true;await denied(address(),'permission_denied');}
    finally{if(linked)fs.unlinkSync(workspace);fs.renameSync(original,workspace);}});
  await check('Cancellation address is exact and late parser work cannot release its slot early',async()=>{const gates=[];for(let i=0;i<4;i++){const gate=barrier();gates.push(gate);extract=gate.extract;const input=address(),pending=service.preview(input);await gate.entered;assert.equal(service.cancel({...input,artifactId:`artifact_${randomUUID()}`}).ok,false);assert(service.cancel(input).ok);assert.equal((await pending).error,'cancelled');}await denied(address(),'busy');for(const gate of gates)gate.release();await service.close();service=createSavedArtifactPreview(options);extract=extractLocalDocument;});
  await check('Parser-time grant, lifecycle, file and saved-fact changes never disclose text',async()=>{
    for(const mode of ['grant','lifecycle','file','facts','directory']){
      extract=async(request,signal)=>{
        const parsed=await extractLocalDocument(request,signal);
        if(mode==='grant')granted=false;if(mode==='lifecycle')active=false;
        if(mode==='file')fs.appendFileSync(file,'changed');
        if(mode==='facts')db.prepare('UPDATE xiaozhi_pi_office_drafts SET revision=revision+1 WHERE id=?').run(row.id);
        if(mode==='directory'){
          try{fs.renameSync(workspace,workspace+'.old');}
          catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;report.notRun=[{case:'Same-path directory inode replacement during open file read',reason:'OS_RENAME_DENIED',code:error.code}];throw error;}
          fs.mkdirSync(workspace);fs.copyFileSync(path.join(workspace+'.old',row.path),file);
        }
        return parsed;
      };
      const value=await service.preview(address());assert.equal(value.ok,false);assert(!JSON.stringify(value).includes('17 + 8'));
      granted=true;active=true;if(mode==='file')fs.writeFileSync(file,bytes);
      if(mode==='directory'&&fs.existsSync(workspace+'.old')){fs.unlinkSync(file);fs.rmdirSync(workspace);fs.renameSync(workspace+'.old',workspace);}
    }
    extract=extractLocalDocument;
  });
  await check('Timeout response at original bound; ignored parser retains slot and cannot return late text',async()=>{const gate=barrier();extract=gate.extract;const pending=service.preview(address());await gate.entered;const value=await pending;assert.equal(value.error,'timeout');gate.release();await service.close();service=createSavedArtifactPreview(options);extract=extractLocalDocument;});
  await check('Main-window IPC guard rejects foreign read/cancel before host access',async()=>{const handlers=new Map();registerOfficeArtifactIpc({ipcMain:{handle:(key,fn)=>handlers.set(key,fn)},allowed:event=>event.main===true,host:{previewSavedArtifact:input=>service.preview(input),cancelSavedArtifactPreview:input=>service.cancel(input)}});assert.equal((await handlers.get('xiaozhi:saved-artifact-preview')({main:false},address())).error,'permission_denied');assert.equal(handlers.get('xiaozhi:saved-artifact-preview-cancel')({main:false},address()).ok,false);});
  await check('Actual production host requires matching paper-output grant without ordinary workspace fallback',async()=>{
    const fullState=createXiaozhiSessionState(sql);await fullState.init();await fullState.setPaperOutput(sessionId,workspace,'owned paper',sha(workspace));
    const store={xiaozhiState:fullState,questionReviews:{collections:{}},getDocumentArtifact:artifact,getAiConversationSession:async()=>({session:{archivedAt:archived?'owned':'',studentId:'student_owned'}}),listStudents:async()=>[{id:'student_owned',status:active?'active':'archived'}],sanitizeProblemText:async text=>({sanitizedText:text})};
    host=createXiaozhiProductionHost({store,dataRoot,emit:()=>assert.fail('No provider event')});await host.skillCatalog();
    const good=await host.previewSavedArtifact(address());assert(good.ok,JSON.stringify(good));
    db.prepare('DELETE FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?').run(sessionId);await fullState.setWorkspace(sessionId,workspace,'ordinary same directory');
    assert.equal((await host.previewSavedArtifact(address())).error,'permission_denied');
    await fullState.setPaperOutput(sessionId,workspace,'owned paper',sha(workspace));active=false;assert.equal((await host.previewSavedArtifact(address())).error,'permission_denied');active=true;
    archived=true;assert.equal((await host.previewSavedArtifact(address())).error,'permission_denied');archived=false;await host.close();assert.equal((await host.previewSavedArtifact(address())).error,'permission_denied');host=undefined;
  });
  report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;console.error(report.error);}
finally{await service.close();if(host)await host.close();for(const child of children)child.kill();db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({...report,parserForks:forks,electronLaunches:0,modelCalls:0},null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.length,output}));}
