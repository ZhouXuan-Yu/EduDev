import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const {createTaskResultRecheck}=await import('../../src/main/xiaozhi-agent/tasks/result-recheck.ts');
const {createHanaOfficeTools}=await import('../../src/main/office-agent/hana-tool-adapter.ts');
const {fileVersion}=await import('../../src/main/xiaozhi-agent/workspace-files.ts');
const {captureNativeTail,toolResultDigest}=await import('../../src/main/xiaozhi-agent/events/native-tail.ts');
const {createRunResultReadback}=await import('../../src/main/xiaozhi-agent/verification/result-readback.ts');
const {legacyVerification,validTaskVerification}=await import('../../src/shared/xiaozhi-verification.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-task-recheck-')),workspace=path.join(output,'workspace'),nativeRoot=path.join(output,'native');fs.mkdirSync(workspace);fs.mkdirSync(nativeRoot);
const report={success:false,checks:[],boundary:'Production current-result recheck adapter, actual Hana file reads and native-tail parser over declared owned native/SQLite authority fixtures. No provider, real receipt provenance or UI acceptance claim.'};
const id='aisession_'+randomUUID(),runId='run_owned',callId='call_read',filename=path.join(workspace,'lesson.txt'),nativeFile=path.join(nativeRoot,'session.jsonl');fs.writeFileSync(filename,'公开合成课堂资料：先观察再解释。');
const raw=await createHanaOfficeTools({workspace,sessionId:id,runId,networkAllowed:false,fileVersion}).execute('office_read_text',callId,{path:'lesson.txt'},new AbortController().signal);assert(raw.success);
const content=[{type:'text',text:JSON.stringify(raw)}],message={role:'toolResult',toolCallId:callId,toolName:'office_read_text',content,isError:false};
const binding={...captureNativeTail(nativeFile,nativeRoot),markerId:'marker_owned',sessionId:id,runId,generation:1};
const records=[{id:'marker_owned',type:'custom',customType:'xiaozhi.event-owner.v1',data:{schemaVersion:1,sessionId:id,runId,generation:1}},{id:'assistant_owned',parentId:'marker_owned',type:'message',message:{role:'assistant',content:[{type:'toolCall',id:callId,name:'office_read_text',arguments:{path:'lesson.txt'}}]}},{id:'result_owned',parentId:'assistant_owned',type:'message',message}];const persist=()=>fs.writeFileSync(nativeFile,records.map(r=>JSON.stringify(r)).join('\n')+'\n');persist();
const base={...legacyVerification(runId),state:'needs_human',reason:'human_review',operations:{succeeded:1,failed:0}};
const initial=createRunResultReadback({runId,readLocal:async()=>content});initial.capture(callId,'office_read_text',{content},false);const original=await initial.finish(base,async()=>[message]);assert(original.checks.some(c=>c.id==='file:'+callId&&c.state==='passed'));
let current=true,archived=false,selected='',revoked=false,storedBinding={...binding},receipt={call_id:callId,tool:'office_read_text',phase:'settled',admitted:1,success:1,result_digest:toolResultDigest('office_read_text',content,false)},verification=original;
const store={listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text}),getAiConversationSession:async()=>({session:{id,studentId:selected,archivedAt:archived?'2026-10-21':null},messages:[{id:'answer_owned',role:'assistant',metadata:{agentRunId:runId,verification}}]}),xiaozhiState:{sql:{all:async q=>q.includes('SELECT student_id')?[{student_id:''}]:q.includes('SELECT binding_json')?[{binding_json:JSON.stringify(storedBinding)}]:q.includes('xiaozhi_tool_receipts')?[receipt]:q.includes('xiaozhi_event_journal')?[]:(()=>{throw Error('Unexpected query');})()}}};
const recheck=createTaskResultRecheck({store,dataRoot:output,nativeRoot,current:()=>current,workspace:async()=>{if(revoked)throw Error('permission_denied');return{path:workspace};}}),candidate={messageId:'answer_owned',runId,digest:'1'.repeat(64)},task={sessionId:id};
const passed=v=>v.checks.some(c=>c.id==='file:'+callId&&c.state==='passed');
const check=async(name,fn)=>{await fn();report.checks.push({name,pass:true});console.log('PASS '+name);};
try{
 await check('Unchanged current file plus matching native/receipt produces a fresh human-scoped file proof',async()=>{const v=await recheck(candidate,task);assert(validTaskVerification(v,runId));assert(passed(v));assert.equal(v.state,'needs_human');assert(Date.now()-Date.parse(v.checkedAt)<5000);});
 await check('Changed actual file cannot inherit its old passed proof',async()=>{fs.appendFileSync(filename,'\n内容已经变化');assert(!passed(await recheck(candidate,task)));});
 await check('Restoring bytes without the original file version still cannot revive old proof',async()=>{fs.writeFileSync(filename,'公开合成课堂资料：先观察再解释。');assert(!passed(await recheck(candidate,task)));});
 await check('Revoked actual workspace cannot pass from cached receipts',async()=>{
  const fresh=await createHanaOfficeTools({workspace,sessionId:id,runId,networkAllowed:false,fileVersion}).execute('office_read_text',callId,{path:'lesson.txt'},new AbortController().signal);assert(fresh.success);content[0].text=JSON.stringify(fresh);persist();receipt.result_digest=toolResultDigest('office_read_text',content,false);
  const currentResult=createRunResultReadback({runId,readLocal:async()=>content});currentResult.capture(callId,'office_read_text',{content},false);verification=await currentResult.finish(base,async()=>[message]);assert(passed(await recheck(candidate,task)),'Fresh receipt baseline must pass before revocation');
  revoked=true;assert(!passed(await recheck(candidate,task)));revoked=false;assert(passed(await recheck(candidate,task)));
 });
 await check('Mismatching or unadmitted receipts cannot furnish an originally passed machine check',async()=>{const originalReceipt={...receipt};assert(passed(await recheck(candidate,task)));for(const mutation of[{result_digest:'0'.repeat(64)},{admitted:0},{phase:'started'},{success:0}]){receipt={...originalReceipt,...mutation};assert(!passed(await recheck(candidate,task)));}receipt=originalReceipt;assert(passed(await recheck(candidate,task)));});
 await check('A changed selected student or archived session rejects review',async()=>{selected='other_student';await assert.rejects(recheck(candidate,task),/task_source_changed/);selected='';archived=true;await assert.rejects(recheck(candidate,task),/task_result_unverified/);archived=false;});
 await check('Foreign native run and paths outside native root cannot satisfy review',async()=>{storedBinding={...binding,runId:'foreign'};await assert.rejects(recheck(candidate,task),/task_result_unverified/);storedBinding={...binding,file:'../session.jsonl'};await assert.rejects(recheck(candidate,task),/permission_denied/);storedBinding={...binding};});
 await check('Broken native parent chain cannot be replaced by an otherwise matching receipt',async()=>{records[2].parentId='foreign_parent';persist();await assert.rejects(recheck(candidate,task),/evidence_missing/);records[2].parentId='assistant_owned';persist();});
 await check('Current-owner revocation rejects a late proof',async()=>{current=false;await assert.rejects(recheck(candidate,task),/cancelled/);current=true;});
 await check('Plain text without independent machine checks remains human-only',async()=>{verification=base;const v=await recheck(candidate,task);assert.equal(v.state,'needs_human');assert.deepEqual(v.evidence,[]);assert(!passed(v));});
 report.success=true;
}catch(e){report.error=String(e.stack||e);process.exitCode=1;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
