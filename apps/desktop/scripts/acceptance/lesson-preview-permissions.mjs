/** Owned lesson evidence only. No production imports, SQL writes or Electron launch. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {fingerprint,sha256} from './evidence.mjs';

export const LESSON_ROOT='C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-lesson-export-pi-QklMXy';
export const OWNER='aisession_b44f114f-ec7c-40c7-9395-cd52b84370bb';
export const IDS=['artifact_a6f691c2-58e3-43df-8e9d-bada0c25c985','artifact_c4d4bebc-6258-4966-a049-2e618212c456'];
export const TITLE='A18 教案只读权限空会话';
const quote=s=>'"'+s.replaceAll('"','""')+'"';
export function readDb(data,work){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{db.exec('PRAGMA query_only=ON;BEGIN');return work(db);}finally{db.close();}}
export function fileFact(file){
  const absolute=path.resolve(file),real=fs.realpathSync(absolute),stat=fs.lstatSync(absolute);
  assert.equal(real,absolute,'LESSON_REDIRECTED_FILE');assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,'LESSON_FILE_IDENTITY');
  return {file:absolute,sha256:sha256(fs.readFileSync(absolute)),bytes:stat.size,dev:stat.dev,ino:stat.ino,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs};
}
export const versionOf=f=>sha256([f.dev,f.ino,f.bytes,f.mtimeMs,f.ctimeMs].join(':'));
export function assertIdleOriginal(root){
  const encoded=Buffer.from(path.resolve(root)).toString('base64');
  const result=spawnSync('powershell.exe',['-NoProfile','-Command',`$lessonNeedle=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -and $_.CommandLine.Contains($lessonNeedle) }).Count`],{encoding:'utf8',windowsHide:true,timeout:8000});
  assert(result.status===0&&/^0\s*$/.test(result.stdout),'LESSON_ORIGINAL_PROCESS_ACTIVE_OR_UNKNOWN');
}
export function readFixture(desktop){
  const root=fs.realpathSync(LESSON_ROOT),data=path.join(root,'data'),profile=path.join(root,'profile');
  const provenance=JSON.parse(fs.readFileSync(path.resolve(desktop,'../../docs/research/FOUNDATION_B04_20261104.json'))).actualReports.lesson;
  const reportFile=path.join(root,'report.json');assert.equal(path.resolve(provenance.path),reportFile);
  assert.equal(sha256(fs.readFileSync(reportFile)),provenance.sha256,'LESSON_OLD_REPORT_CHANGED');
  const old=JSON.parse(fs.readFileSync(reportFile));assert.equal(old.ok,true);assert.equal(old.sessionId,OWNER);assert.equal(path.resolve(old.root),root);
  // Actual generator line 7 uses root/data and launch line 14 passes it verbatim.
  // Runtime getDataRoot and default-session storage are independently checked before UI work.
  for(const file of [path.join(profile,'xiaozhi-data-selection.v1.json'),path.join(data,'xiaozhi-recovery.v1.json')])assert(!fs.existsSync(file),'LESSON_RESTORE_REDIRECT_FORBIDDEN');
  assert(fs.statSync(profile).isDirectory());
  const scope=sha256(fs.realpathSync(data).toLowerCase()).slice(0,16),generated=path.join(root,'XiaozhiOutputs',scope),directory=path.join(generated,OWNER);
  const files=readDb(data,db=>{
    assert.equal(db.prepare("SELECT count(*) n FROM ai_agent_runs WHERE status IS NULL OR status NOT IN ('succeeded','failed','blocked','cancelled','interrupted')").get().n,0,'LESSON_OLD_ACTIVE_RUN');
    assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_pi_workspaces').get().n,0,'LESSON_EXPECTED_DEFAULT_AUTHORITY');
    assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_pi_paper_outputs').get().n,0,'LESSON_NO_PAPER_GRANT');
    return IDS.map(id=>{
      const a=db.prepare('SELECT id,session_id,artifact_type,file_name,file_path,file_size,content_hash,status FROM document_artifacts WHERE id=?').get(id);
      const rows=db.prepare("SELECT conversation_id,format,state,relative_path,result_path,output_hash,length(output_bytes) bytes,json_extract(draft_json,'$.schemaVersion') schema,json_extract(draft_json,'$.lessonSource') lessonSource FROM xiaozhi_pi_office_drafts WHERE artifact_id=?").all(id);
      assert(a&&rows.length===1,'LESSON_EXACT_SAVED_FACT');const d=rows[0];
      assert.equal(a.session_id,OWNER);assert.equal(d.conversation_id,OWNER);assert.equal(a.status,'exported');assert.equal(d.state,'saved');
      assert.equal(d.schema,'xiaozhi.teaching-lesson-office.v1');assert.equal(a.artifact_type,d.format);assert(['docx','pdf'].includes(d.format));
      assert.equal(a.file_name,d.relative_path);assert.equal(path.resolve(a.file_path),path.join(directory,a.file_name));assert.equal(d.result_path,a.file_path);
      const f=fileFact(a.file_path),prior=old.files.find(v=>path.resolve(v.file)===f.file);assert(prior,'LESSON_OLD_FILE_ABSENT');
      for(const expected of [a.content_hash,d.output_hash,prior.sha256])assert.equal(f.sha256,expected,'LESSON_SAVED_HASH');
      for(const expected of [a.file_size,d.bytes,prior.bytes])assert.equal(f.bytes,expected,'LESSON_SAVED_SIZE');
      const source=JSON.parse(d.lessonSource);assert.equal(source.revision,5);assert.equal(source.id,'classplan_abc20771-82f7-4d02-bdbc-9ea560f6f4eb');
      assert.equal(source.version,'b90f71ba73a244d88599f86433fc4b828eb10d734c5793cab90ec0a570ceaf69');
      return {...f,artifactId:id,format:d.format,name:a.file_name,source};
    });
  });
  assert.deepEqual(files.map(f=>f.format).sort(),['docx','pdf']);
  const sources=old.originals.map(s=>{const fact=fileFact(s.file);assert.equal(fact.sha256,s.sha256,'LESSON_SOURCE_HASH');return fact;});
  return {root,data,profile,generated,directory,files,sources,oldReportHash:provenance.sha256,title:old.plan.document.title};
}

const required=['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events','ai_confirmation_items','ai_conversation_messages',
  'xiaozhi_event_journal','xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts','xiaozhi_pi_session_bindings','xiaozhi_pi_workspaces',
  'xiaozhi_pi_paper_outputs','xiaozhi_pi_office_drafts','xiaozhi_pi_office_draft_sources','document_artifacts','document_artifact_sources',
  'document_artifact_paper_sources','teacher_resources','resource_chunks','question_bank_items'];
const encode=value=>typeof value==='bigint'?{integer:String(value)}:value instanceof Uint8Array?{blobHash:sha256(value),bytes:value.length}:value;
export function ledger(data){return readDb(data,db=>{
  const names=db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(r=>r.name);
  for(const t of required)assert(names.includes(t),'LESSON_REQUIRED_TABLE_'+t);
  const protectedNames=names.filter(n=>required.includes(n)||/receipt|approval|^xiaozhi_pi_(attachment|controls|goals|memory_scopes|text_changes)/.test(n)).sort();
  const tables=Object.fromEntries(protectedNames.map(t=>{
    const columns=db.prepare('PRAGMA table_info('+quote(t)+')').all().map(c=>c.name),stmt=db.prepare('SELECT '+columns.map(quote).join(',')+' FROM '+quote(t));
    stmt.setReturnArrays(true);stmt.setReadBigInts(true);const rows=stmt.all().map(r=>sha256(JSON.stringify(r.map(encode)))).sort();
    return [t,{columns,count:rows.length,sha256:sha256(JSON.stringify(rows))}];
  }));
  return {tables,sessions:db.prepare('SELECT * FROM ai_conversation_sessions ORDER BY id').all()};
});}
export function assertSessionDelta(before,after,id,{requireNew=false}={}){
  const prior=new Map(before.map(r=>[r.id,r]));
  for(const r of before)assert.deepEqual(after.find(a=>a.id===r.id),r,'LESSON_OLD_SESSION_CHANGED');
  const added=after.filter(r=>!prior.has(r.id));assert(added.length<=1,'LESSON_EXTRA_SESSION');
  if(requireNew)assert.equal(added.length,1,'LESSON_NEW_EMPTY_SESSION_MISSING');
  if(added.length){const r=added[0];assert(id&&r.id===id&&!prior.has(id),'LESSON_UNBOUND_NEW_SESSION');assert.equal(r.title,TITLE);assert.equal(r.message_count,0);assert.equal(r.last_prompt,'');assert.equal(r.last_response_preview,'');assert(!r.archived_at&&!r.student_id&&!r.folder_id,'LESSON_EMPTY_SESSION_SCOPE');}
  return added.map(r=>({id:r.id,title:r.title,messageCount:r.message_count}));
}
export function assertLedger(before,after,id,requireNew=false){
  assert.deepEqual(after.tables,before.tables,'LESSON_PROTECTED_LEDGER_CHANGED');
  return assertSessionDelta(before.sessions,after.sessions,id,{requireNew});
}
export function assertGuard(g){assert(g&&g.policyProbe==='FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED','LESSON_FRAME_GUARD');for(const k of ['networkAttempts','modelAttempts','rendererErrors'])assert.equal(g[k],0,'LESSON_'+k.toUpperCase());}
export function assertCatalogue(catalogue,files){for(const f of files){const matches=catalogue.filter(r=>r.id===f.artifactId);assert.equal(matches.length,1);const r=matches[0];assert.equal(r.sessionId,OWNER);assert.equal(r.status,'exported');assert.equal(r.type,f.format);assert.equal(r.fileName,f.name);assert.equal(r.contentHash,f.sha256);assert.equal(r.fileSize,f.bytes);assert.equal(r.savedArtifactKind,undefined,'LESSON_MISROUTED_PAPER');assert.equal(r.officeVersion,undefined,'LESSON_MISROUTED_ORDINARY');assert.equal(r.htmlVersion,undefined);}}
export function assertVersion(result,sessionId,id){assert.equal(result.ok,true,'LESSON_OWNER_VIEW');const v=result.value;assert.equal(v.sessionId,sessionId);assert.equal(v.selectedArtifactId,id);assert.equal(v.currentArtifactId,id);assert.equal(v.integrity,'same');assert.equal(v.canRestore,false);assert.equal(v.versions.length,1);assert.equal(v.versions[0].artifactId,id);return v;}
export function selfCheck(){
  const checks=[],test=(name,fn)=>{fn();checks.push(name);},old={id:OWNER,title:'original',message_count:2},fresh={id:'aisession_00000000-0000-0000-0000-000000000001',title:TITLE,message_count:0,last_prompt:'',last_response_preview:'',student_id:null,folder_id:null,archived_at:null};
  test('one-original-ui-empty-session',()=>assertSessionDelta([old],[old,fresh],fresh.id,{requireNew:true}));
  for(const [name,rows,id] of [['old-session-mutation',[{...old,message_count:3},fresh],fresh.id],['nonempty-new-session',[old,{...fresh,message_count:1}],fresh.id],['foreign-new-session',[old,fresh],OWNER],['extra-session',[old,fresh,{...fresh,id:'third'}],fresh.id]])test(name,()=>assert.throws(()=>assertSessionDelta([old],rows,id,{requireNew:true})));
  const guard={networkAttempts:0,modelAttempts:0,rendererErrors:0,policyProbe:'FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED'};
  test('zero-guard',()=>assertGuard(guard));for(const k of ['networkAttempts','modelAttempts','rendererErrors'])test(k+'-fails',()=>assert.throws(()=>assertGuard({...guard,[k]:1})));
  const f={artifactId:IDS[0],format:'docx',name:'lesson.docx',sha256:'a'.repeat(64),bytes:100},row={id:f.artifactId,sessionId:OWNER,status:'exported',type:f.format,fileName:f.name,contentHash:f.sha256,fileSize:f.bytes};
  test('lesson-original-route',()=>assertCatalogue([row],[f]));for(const patch of [{savedArtifactKind:'paper'},{officeVersion:{}},{contentHash:'b'.repeat(64)},{sessionId:fresh.id}])test('catalogue-mismatch-'+checks.length,()=>assert.throws(()=>assertCatalogue([{...row,...patch}],[f])));
  const v={ok:true,value:{sessionId:OWNER,selectedArtifactId:IDS[0],currentArtifactId:IDS[0],integrity:'same',canRestore:false,versions:[{artifactId:IDS[0]}]}};
  test('immutable-owner-view',()=>assertVersion(v,OWNER,IDS[0]));test('changed-file-rejected',()=>assert.throws(()=>assertVersion({...v,value:{...v.value,integrity:'changed'}},OWNER,IDS[0])));
  return {success:true,checks,electronLaunches:0,modelCalls:0,fixtureWrites:0};
}
