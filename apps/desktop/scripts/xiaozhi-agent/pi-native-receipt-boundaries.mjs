import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {SessionManager} from '@earendil-works/pi-coding-agent';
const {captureNativeTail,readNativeTail,readNativeToolEntries,toolResultDigest}=await import('../../src/main/xiaozhi-agent/events/native-tail.ts');
const {createPiTeachingEpoch,teachingAuthority}=await import('../../src/main/xiaozhi-agent/native-teaching-epoch.ts');
const evidenceRoot=path.resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||'test-results/xiaozhi-agent');
fs.mkdirSync(evidenceRoot,{recursive:true});
const root=fs.mkdtempSync(path.join(evidenceRoot,'pi-native-receipt-')),checks=[],report={success:false,checks,scope:'Actual Pi SessionManager persistence plus bounded native file negatives; not provider/UI or crash acceptance'};
async function check(name,fn){await fn();checks.push({name,pass:true});console.log('PASS '+name);}
const owner={sessionId:'aisession_'+randomUUID(),runId:'run_'+randomUUID(),generation:1},content=[{type:'text',text:'Independent synthetic tool result 37/8'}];
const manager=SessionManager.create(root,path.join(root,'sessions')),file=manager.getSessionFile(),tail=captureNativeTail(file,root),markerId=manager.appendCustomEntry('xiaozhi.event-owner.v1',{schemaVersion:1,...owner}),binding={...tail,...owner,markerId};
const assistant={role:'assistant',content:[{type:'toolCall',id:'call_owned',name:'office_read_attachment',arguments:{}}],api:'openai-completions',provider:'deepseek',model:'owned',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'toolUse',timestamp:Date.now()};
try{
 await check('Actual fresh SDK custom marker is not falsely claimed durable before the first user message',async()=>{assert.equal(fs.existsSync(file),false);await assert.rejects(readNativeToolEntries(binding,root));});
 manager.appendMessage({role:'user',content:[{type:'text',text:'Owned synthetic request'}],timestamp:Date.now()});manager.appendMessage(assistant);const entryId=manager.appendMessage({role:'toolResult',toolCallId:'call_owned',toolName:'office_read_attachment',content,isError:false,timestamp:Date.now()});
 await check('Actual SDK generated native entry ID and exact declared tool result digest are associated',async()=>{const entries=await readNativeToolEntries(binding,root);assert.equal(entries.length,1);assert.equal(entries[0].id,entryId);assert.equal(entries[0].digest,toolResultDigest('office_read_attachment',content,false));assert.equal(entries[0].failed,false);});
 await check('Other run or generation cannot reuse this native marker',async()=>{for(const patch of[{runId:'run_other'},{generation:2},{sessionId:'aisession_'+randomUUID()},{markerId:'missing'}])await assert.rejects(readNativeToolEntries({...binding,...patch},root),/evidence_missing/);});
 const original=fs.readFileSync(file),nativePath=path.relative(root,file);
 async function changed(bytes,fn){fs.writeFileSync(file,bytes);try{await fn();}finally{fs.writeFileSync(file,original);}}
 await check('Duplicate call, duplicate native entry ID and broken ancestry are rejected',async()=>{const rows=original.toString().trim().split('\n').map(JSON.parse),last=rows.at(-1);for(const change of[{...last,id:'other_id',parentId:last.id},{...last,parentId:last.id},{...last,id:'other_id',parentId:'wrong_parent'}])await changed(Buffer.from(rows.map(JSON.stringify).join('\n')+'\n'+JSON.stringify(change)+'\n'),async()=>assert.rejects(readNativeToolEntries(binding,root),/evidence_missing/));});
 await check('Undeclared or renamed native tool result cannot satisfy a current receipt',async()=>{const rows=original.toString().trim().split('\n').map(JSON.parse);rows.at(-1).message.toolName='office_web_fetch';await changed(Buffer.from(rows.map(JSON.stringify).join('\n')+'\n'),async()=>assert.rejects(readNativeToolEntries(binding,root),/evidence_missing/));});
 await check('Incomplete final line and malformed native JSON are rejected without modifying the file',async()=>{for(const bytes of[original.subarray(0,original.length-1),Buffer.concat([original,Buffer.from('{bad}\n')])])await changed(bytes,async()=>assert.rejects(readNativeToolEntries(binding,root)));assert(original.equals(fs.readFileSync(file)));});
 await check('A following run marker closes the current segment; another run result is excluded',async()=>{manager.appendCustomEntry('xiaozhi.event-owner.v1',{schemaVersion:1,...owner,runId:'run_next',generation:2});manager.appendMessage({...assistant,content:[{type:'toolCall',id:'call_next',name:'office_read_attachment',arguments:{}}]});manager.appendMessage({role:'toolResult',toolCallId:'call_next',toolName:'office_read_attachment',content,isError:false,timestamp:Date.now()});assert.equal((await readNativeToolEntries(binding,root)).length,1);fs.writeFileSync(file,original);});
 await check('Captured prior tail anchor rejects rewritten/truncated prefix',async()=>{const prior=captureNativeTail(file,root);await changed(Buffer.from('x'.repeat(original.length)+'\n'),async()=>assert.rejects(readNativeTail(prior,root),/evidence_missing/));});
 await check('Traversal, external native file, hardlink and excessive tail/line counts are refused',async()=>{await assert.rejects(readNativeTail({...binding,file:'../outside.jsonl'},root),/permission_denied/);const link=path.join(root,'hardlink.jsonl');fs.linkSync(file,link);try{await assert.rejects(readNativeTail({...binding,file:nativePath},root),/evidence_missing/);}finally{fs.unlinkSync(link);}await changed(Buffer.alloc(32*1048576+1),async()=>assert.rejects(readNativeTail(binding,root),/evidence_missing/));await changed(Buffer.from('{}\n'.repeat(4097)),async()=>assert.rejects(readNativeTail(binding,root),/evidence_missing/));});
 await check('Result digest is bounded and distinguishes failure/body/tool without retaining raw body',async()=>{assert.notEqual(toolResultDigest('office_read_attachment',content,false),toolResultDigest('office_read_attachment',content,true));assert.notEqual(toolResultDigest('office_read_attachment',content,false),toolResultDigest('office_web_fetch',content,false));assert.throws(()=>toolResultDigest('office_read_attachment',undefined,false),/invalid_input/);assert.throws(()=>toolResultDigest('office_read_attachment',[{type:'text',text:'a'.repeat(17*1048576)}],false),/evidence_missing/);});

 await check('A terminal Run retains all receipts across separately bound skill and teaching authority isolation',async()=>{
   const db=new DatabaseSync(':memory:');
   try{
     db.exec('CREATE TABLE xiaozhi_event_runs(run_id TEXT,session_id TEXT,generation INTEGER,status TEXT); CREATE TABLE xiaozhi_native_run_bindings(run_id TEXT,generation INTEGER,binding_json TEXT)');
     const sql={all:async(query,args)=>db.prepare(query).all(...args)};
     for(const [teaching,withInterveningMessage] of [[false,false],[false,true],[true,false],[true,true]]){
       const pi=SessionManager.create(root,root),sessionId='aisession_'+randomUUID();
       if(teaching){
         pi.appendCustomEntry('xiaozhi.education.snapshot.v1',{});
         createPiTeachingEpoch(pi,teachingAuthority('folder-old','2026-spring'));
       }
       const previous={sessionId,runId:'run_'+randomUUID(),generation:1};
       const bound={...previous,...captureNativeTail(pi.getSessionFile(),root),
         markerId:pi.appendCustomEntry('xiaozhi.event-owner.v1',{schemaVersion:1,...previous})};
       const safe=pi.appendCustomEntry('xiaozhi.answer-policy.v1',{});
       pi.appendCustomEntry('xiaozhi.memory.run.v1',{runId:previous.runId});
       if(!teaching)pi.appendCustomEntry('xiaozhi.skills.taint.v1',{authority:'a'.repeat(64),safeLeaf:safe,runId:previous.runId});
       pi.appendMessage({role:'user',content:'合成原任务',timestamp:Date.now()});
       pi.appendMessage(assistant);
       const resultId=pi.appendMessage({role:'toolResult',toolCallId:'call_owned',toolName:'office_read_attachment',content,isError:false,timestamp:Date.now()});
       if(teaching){
         assert(createPiTeachingEpoch(pi,teachingAuthority('folder-new','2026-spring')).isolated);
       }else{
         pi.branch(safe);
         pi.appendCustomEntry('xiaozhi.skills.isolation.v1',{authority:'b'.repeat(64),fromLeaf:resultId,blockedRunIds:[previous.runId]});
       }
       if(withInterveningMessage)pi.appendMessage({role:'user',content:'尚未绑定的新任务',timestamp:Date.now()});
       const next={sessionId,runId:'run_'+randomUUID(),generation:2};
       const following={...next,...captureNativeTail(pi.getSessionFile(),root),
         markerId:pi.appendCustomEntry('xiaozhi.event-owner.v1',{schemaVersion:1,...next})};
       db.prepare('INSERT INTO xiaozhi_event_runs VALUES(?,?,?,?)').run(previous.runId,sessionId,1,'running');
       db.prepare('INSERT INTO xiaozhi_event_runs VALUES(?,?,?,?)').run(next.runId,sessionId,2,'running');
       await assert.rejects(readNativeToolEntries(bound,root,sql),/evidence_missing/);
       db.prepare('INSERT INTO xiaozhi_native_run_bindings VALUES(?,?,?)').run(next.runId,2,JSON.stringify(following));
       await assert.rejects(readNativeToolEntries(bound,root,sql),/evidence_missing/);
       db.prepare("UPDATE xiaozhi_event_runs SET status='completed' WHERE run_id=?").run(previous.runId);
       if(withInterveningMessage)await assert.rejects(readNativeToolEntries(bound,root,sql),/evidence_missing/);
       else{
         const entries=await readNativeToolEntries(bound,root,sql);
         assert.deepEqual(entries.map(r=>[r.id,r.digest]),[[resultId,toolResultDigest('office_read_attachment',content,false)]]);
       }
     }
   }finally{db.close();}
 });
 report.success=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,output:root,error:report.error}));}
