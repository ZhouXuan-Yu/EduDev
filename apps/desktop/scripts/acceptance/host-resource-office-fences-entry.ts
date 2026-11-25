import {app, BrowserWindow} from 'electron';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {statSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createOfficeArtifactState,officeSha} from '../../src/main/xiaozhi-agent/office-artifact-state';
import {createOfficeArtifactService} from '../../src/main/xiaozhi-agent/office-artifact-service';
import {generateOfficeDocument} from '../../src/main/xiaozhi-agent/office-generator';
import {fileVersion} from '../../src/main/xiaozhi-agent/workspace-files';
import {runWithPermission,type CurrentPermission} from '../../src/main/xiaozhi-agent/permissions/current';
import {hostResourceDiagnostics,reserveHostStage} from '../../src/main/host-resources/desktop';
import {OFFICE_ARTIFACT_SCHEMA} from '../../src/shared/xiaozhi-office-artifacts';
import {OFFICE_DRAFT_SCHEMA,type OfficeDraft} from '../../src/shared/xiaozhi-office-draft';

const root=process.env.OMNI_EDU_R1_OUTPUT!,dataRoot=path.join(root,'data'),workspace=path.join(root,'workspace');
const sessionId=`aisession_${randomUUID()}`,runId='r1-pdf-run',target='人工复核.pdf';
const checks:string[]=[],evidence:Record<string,unknown>={};
let windows=0;
app.on('window-all-closed',()=>{});
app.on('browser-window-created',()=>windows++);

async function queued(){
  for(let i=0;i<250;i++){
    const current=hostResourceDiagnostics();
    if(current.queued===1&&current.used.pdfWindows===1)return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('The office job never entered the shared PDF queue');
}

async function underBarrier<T>(work:()=>Promise<T>,afterQueued:()=>Promise<void>):Promise<T>{
  const barrier=await reserveHostStage('fixture-print-barrier','print','foreground',{pdfWindows:1},30000);
  assert(barrier.start());
  const operation=work();
  void operation.catch(()=>undefined);
  try{await queued();await afterQueued();}
  finally{barrier.settle();}
  return operation;
}

void app.whenReady().then(async()=>{
  await fs.mkdir(dataRoot);await fs.mkdir(workspace);
  const db=new DatabaseSync(path.join(dataRoot,'ledger.db'));
  let success=false,error:string|undefined;
  try{
    db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);
      CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE fixture_authority(active INTEGER NOT NULL); INSERT INTO fixture_authority VALUES(1);`);
    db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(sessionId);
    const state=createOfficeArtifactState({all:async(sql,params=[])=>db.prepare(sql).all(...params),
      run:async(sql,params=[])=>{db.prepare(sql).run(...params);},change:async(sql,params=[])=>Number(db.prepare(sql).run(...params).changes)});
    await state.migrate();
    let phaseHook:(stage:string)=>Promise<void>=async()=>{};
    const service=createOfficeArtifactService({state,dataRoot,workspace:async()=>workspace,isCurrent:()=>true,afterStage:stage=>phaseHook(stage)});
    const html=await fs.readFile(path.join(process.env.OMNI_EDU_R1_FIXTURES!,'export-source.html'),'utf8');
    const draft:OfficeDraft={schemaVersion:OFFICE_DRAFT_SCHEMA,title:html.match(/<h1>([^<]+)<\/h1>/u)![1],sections:
      [...html.matchAll(/<section><h2>([^<]+)<\/h2><p>([^<]+)<\/p><\/section>/gu)].map((match,index)=>({heading:match[1],paragraphs:[`R1-SECTION-${index+1}`,match[2]]}))};
    assert.equal(draft.sections.length,4);
    const draftFor=(name:string,sources:{path:string;version:string}[]=[])=>service.propose(sessionId,runId,name,{draft,format:'pdf',path:name,sources});
    const approve=async(row:Awaited<ReturnType<typeof draftFor>>)=>service.decide({schemaVersion:OFFICE_ARTIFACT_SCHEMA,
      sessionId,draftId:row.id,revision:row.revision,action:'approve'});

    const permissionSignal=new AbortController().signal;
    let permissionChecks=0;
    // Real service entry receives the same persisted permission assertion interface as Pi.
    // Changing this fixture authority leaves the signal live, as with a stale requirements revision.
    const permission={signal:permissionSignal,assert:async()=>{
      permissionChecks++;
      if(db.prepare('SELECT active FROM fixture_authority').get()?.active!==1)throw Error('permission_denied');
    }} as CurrentPermission;
    const revoked=await approve(await draftFor('revoked.pdf'));
    const beforeRevoke=windows;
    await assert.rejects(underBarrier(()=>runWithPermission(permission,()=>service.apply(sessionId,revoked.id,permissionSignal)),async()=>{
      db.exec('UPDATE fixture_authority SET active=0');
    }),/permission_denied/u);
    evidence.revoked={windowsOpened:windows-beforeRevoke,permissionChecks,signalAborted:permissionSignal.aborted,state:(await state.get(revoked.id))?.state};
    assert.equal(windows,beforeRevoke,'revoked request reached the native renderer after queueing');
    assert.equal(permissionSignal.aborted,false);
    await assert.rejects(fs.stat(path.join(workspace,revoked.path)),{code:'ENOENT'});
    checks.push('Persisted permission is rechecked before the admitted PDF can open a renderer');

    const preview=await draftFor('preview.pdf'),beforeRevision=windows;
    let revised!:Awaited<ReturnType<typeof service.revise>>;
    await assert.rejects(underBarrier(()=>service.candidate(sessionId,preview.id),async()=>{
      revised=await service.revise(sessionId,preview.id,preview.revision,{...draft,title:'教师已改的新稿'});
    }),/conflict/u);
    const after=await state.get(preview.id);
    evidence.revision={oldRevision:preview.revision,newRevision:after?.revision,state:after?.state,windowsOpened:windows-beforeRevision};
    assert.equal(windows,beforeRevision,'stale draft reached Chromium before the final candidate CAS');
    assert.equal(after?.revision,revised.revision);
    assert.equal(after?.output,null);
    checks.push('A teacher revision invalidates the queued preview before Chromium or candidate caching');

    const original='原始资料.txt',source=path.join(workspace,original);
    await fs.writeFile(source,'最初确认的教师资料');
    const stale=await approve(await draftFor('source-changed.pdf',[{path:original,version:fileVersion(statSync(source))}]));
    const beforeSource=windows;
    const conflict=await underBarrier(()=>service.apply(sessionId,stale.id),async()=>{
      await fs.writeFile(source,'人工更新后的教师资料，旧确认已失效');
    });
    evidence.source={state:conflict.state,windowsOpened:windows-beforeSource,bytes:await fs.readFile(source,'utf8')};
    assert.equal(conflict.state,'conflict');
    assert.equal(windows,beforeSource,'changed source was only checked after rendering');
    checks.push('A changed source rejects the approved old version before rendering');

    const edited=await approve(await draftFor(target));
    const manual=Buffer.from('Teacher kept this manual file.');
    phaseHook=async stage=>{
      if(stage!=='intent')return;
      const resources=hostResourceDiagnostics();
      evidence.commit={held:resources.used.pdfWindows,queued:resources.queued};
      await fs.writeFile(path.join(workspace,target),manual,{flag:'wx'});
    };
    await assert.rejects(service.apply(sessionId,edited.id),/conflict/u);
    assert.equal((evidence.commit as {held:number}).held,1,'the prepared output lost its lease before actual commit');
    assert.deepEqual(await fs.readFile(path.join(workspace,target)),manual);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM document_artifacts').get()?.n,0);
    assert(!(await fs.readdir(workspace)).some(name=>name.startsWith('.xiaozhi-stage-')));
    checks.push('The commit keeps the prepared PDF charged and preserves the file installed manually during the final fence');

    phaseHook=async()=>{};
    const good=await approve(await draftFor('approved.pdf'));
    const saved=await service.apply(sessionId,good.id);
    const bytes=await fs.readFile(path.join(workspace,saved.path));
    const fact=db.prepare('SELECT content_hash,file_size FROM document_artifacts WHERE id=?').get(saved.artifactId);
    assert.equal(saved.state,'saved');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
    assert.deepEqual({...fact},{content_hash:officeSha(bytes),file_size:bytes.length});
    evidence.saved={fact,path:workspace,sections:draft.sections.length};
    checks.push('Real four-section PDF and atomic artifact fact are readable after the commit fences');

    const barrier=await reserveHostStage('queue-timeout','print','foreground',{pdfWindows:1},30000);
    assert(barrier.start());const beforeTimeout=windows;
    try{await assert.rejects(generateOfficeDocument('pdf',draft,{dataRoot,deadlineMs:30}),/timeout/u);}
    finally{barrier.settle();}
    assert.equal(windows,beforeTimeout);
    assert.equal(hostResourceDiagnostics().used.pdfWindows,0);
    assert.equal(BrowserWindow.getAllWindows().length,0);
    assert(!(await fs.readdir(dataRoot)).some(name=>name.startsWith('office-render-')));
    checks.push('A queued timeout creates no renderer or staging directory and clears its wait');
    success=true;
  }catch(cause){error=String(cause instanceof Error?cause.stack:cause);}
  finally{
    db.close();
    await fs.writeFile(path.join(root,'report.json'),JSON.stringify({success,error,checks,evidence,resources:hostResourceDiagnostics()},null,2),{flag:'wx'});
    app.exit(success?0:1);
  }
});
