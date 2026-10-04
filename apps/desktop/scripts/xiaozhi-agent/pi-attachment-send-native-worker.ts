import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {OmniEduStore} from '../../src/main/db';
import {createAttachmentImportService} from '../../src/main/xiaozhi-agent/attachment-import-service';
import {attachmentStartHash} from '../../src/main/xiaozhi-agent/attachment-send-state';
import {validXiaozhiStart} from '../../src/shared/xiaozhi-start';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
const output=process.argv[2],mode=process.argv[3],stage=process.argv[4],data=path.join(output,'data');
const report:{success:boolean;checks:{name:string;pass:boolean}[];boundary:string;error?:string;terminations?:unknown[]}={success:false,checks:[],boundary:'Actual Electron/native sqlite3/OmniEduStore, selected synthetic files and OS terminations. Persistence foundation only, no renderer/Pi/model reading claims.'};
const check=(name:string)=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
globalThis.fetch=async()=>{throw new Error('Network forbidden in local send persistence acceptance');};
const store=new OmniEduStore(data);
const native=()=> (store as any).db;
const rows=(query:string,args:unknown[]=[])=>new Promise<any[]>((resolve,reject)=>native().all(query,args,(e:Error|null,r:any[])=>e?reject(e):resolve(r)));
const sql=(query:string)=>new Promise<void>((resolve,reject)=>native().run(query,(e:Error|null)=>e?reject(e):resolve()));
const close=()=>new Promise<void>((resolve,reject)=>native().close((e:Error|null)=>e?reject(e):resolve()));
const signal=()=>new AbortController().signal;
const selected=(row:{id:string;revision:number})=>({id:row.id,revision:row.revision});
const state=store.xiaozhiState;
const rejects=(work:Promise<unknown>,code:string)=>assert.rejects(work,e=>e instanceof Error&&e.message===code);
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
try{
 await store.init();
 if(mode==='recover'){
  const info=JSON.parse(fs.readFileSync(path.join(output,'cut-info.json'),'utf8'));
  const command=await state.command(info.commandId),attachments=await state.attachments.list(info.sessionId),messages=(await store.getAiConversationSession(info.sessionId)).messages;
  assert.equal(command?.status,'interrupted');assert.equal(messages.length,stage==='committed'?1:0);assert.equal(attachments.length,1);
  assert.equal(attachments[0].state,stage==='committed'?'submitted':'draft');
  assert.equal((await rows('SELECT * FROM xiaozhi_pi_attachment_sends')).length,stage==='committed'?1:0);
  if(stage==='committed')assert.equal((await store.getAiAgentRun(String(command!.run_id)))?.status,'blocked');
  const before=await rows('SELECT * FROM xiaozhi_pi_attachments');await state.init();await state.recover();assert.deepEqual(await rows('SELECT * FROM xiaozhi_pi_attachments'),before);
  assert.equal((await store.getAiConversationSession(info.sessionId)).messages.length,messages.length);
  console.log('RECOVER '+JSON.stringify({success:true,stage,noReplay:true}));
 }else{
  const sessionId=(await store.createAiConversationSession({title:'新对话',folderId:null})).session.id;
  const sources=path.join(output,'selected-files');fs.mkdirSync(sources,{recursive:true});
  const file=path.join(sources,'合成附件.txt');fs.writeFileSync(file,'真实本地合成文件，不上传正文。');
  const importer=createAttachmentImportService({dataRoot:data,state:state.attachments,imports:state.attachmentImports});
  const imported=await importer.importFile(sessionId,file,signal());
  const attachment=(await state.attachments.get(sessionId,imported.id))!;
  const input={sessionId,commandId:`xicmd_${randomUUID()}`,prompt:'请说明已收到附件',model:'deepseek-flash',attachments:[attachment],selections:[selected(attachment)],hash:''};
  input.hash=attachmentStartHash(sessionId,input.prompt,input.selections,input.attachments);
  await state.claimCommand(input.commandId,sessionId,input.hash);
  if(mode==='cut'){
   fs.writeFileSync(path.join(output,'cut-info.json'),JSON.stringify({sessionId,commandId:input.commandId}));
   if(stage==='committed')await state.attachmentSends.admit(input);
   fs.writeFileSync(path.join(output,'cut-stage.txt'),stage);process.kill(process.pid,'SIGKILL');await new Promise<void>(()=>{});
  }
  let called=0;
  const good={sessionId,commandId:input.commandId,prompt:'',attachments:input.selections};assert(validXiaozhiStart(good));
  for(const key of ['prompt','attachments']){const value={...good};Object.defineProperty(value,key,{get(){called++;return good[key as keyof typeof good];}});assert(!validXiaozhiStart(value));}
  const malformed:any[]=[{...good,[Symbol('extra')]:1},{...good,attachments:[]},{...good,attachments:[input.selections[0],input.selections[0]]},{...good,attachments:[{...input.selections[0],path:'C:/secret'}]},{...good,attachments:Array(1)},{...good,attachments:undefined}];
  malformed.forEach(v=>assert(!validXiaozhiStart(v)));const array=[input.selections[0]];Object.defineProperty(array,'0',{get(){called++;return input.selections[0];}});assert(!validXiaozhiStart({...good,attachments:array}));assert.equal(called,0);
  check('Strict start accepts attachment-only input and rejects accessors, symbols, sparse/empty/duplicate/extra selections without invoking getters');
  assert(validXiaozhiStart({sessionId,commandId:input.commandId,prompt:'文字'}));assert(!validXiaozhiStart({sessionId,commandId:input.commandId,prompt:''}));
  check('Original three-field text request remains valid; empty no-attachment request remains invalid');
  const business=async()=>digest(await rows('SELECT * FROM ai_conversation_sessions'))+digest(await rows('SELECT * FROM ai_conversation_messages'))+digest(await rows('SELECT * FROM ai_agent_runs'));
  const before=await business();await state.init();await state.init();assert.equal(await business(),before);
  check('Incremental migration runs twice without changing existing conversation/message/run facts');
  await sql("CREATE TRIGGER fail_attachment_publish BEFORE UPDATE ON xiaozhi_pi_attachments WHEN NEW.state='submitted' BEGIN SELECT RAISE(ABORT,'injected_native_failure'); END");
  await rejects(state.attachmentSends.admit(input),'configuration');assert.equal(await business(),before);assert.equal((await state.command(input.commandId))!.status,'starting');assert.equal((await state.attachments.get(sessionId,attachment.id))!.state,'draft');assert.equal(await state.attachmentSends.get(input.commandId),undefined);
  await sql('DROP TRIGGER fail_attachment_publish');check('Actual native SQLite failure after teacher/run insert rolls back every visible fact and retains only starting command/draft');
  const wrong={...input,selections:[{...input.selections[0],revision:9}]};wrong.hash=attachmentStartHash(sessionId,wrong.prompt,wrong.selections,wrong.attachments);wrong.commandId=`xicmd_${randomUUID()}`;await state.claimCommand(wrong.commandId,sessionId,wrong.hash);
  await rejects(state.attachmentSends.admit(wrong),'attachment_changed');assert.equal(await business(),before);check('Stale revision cannot partially create a message/run/send ledger');
  const first=await state.attachmentSends.admit(input);assert.equal(first.attachments.length,1);assert.equal(first.attachments[0].messageId,first.messageId);assert.equal(first.attachments[0].runId,first.runId);
  const detail=await store.getAiConversationSession(sessionId);assert.equal(detail.messages.length,1);assert.equal(detail.messages[0].id,first.messageId);assert.equal(detail.messages[0].metadata.agentRunId,first.runId);assert.equal(detail.session.messageCount,1);
  check('Single native statement binds real teacher message/run/command/submitted attachments and session summary');
  const frozen=await business();assert.deepEqual(await state.attachmentSends.admit(input),first);assert.equal(await business(),frozen);check('Same admitted command returns the same run/message and causes no duplicate effects');
  await rejects(state.attachmentSends.admit({...input,prompt:'变化',hash:attachmentStartHash(sessionId,'变化',input.selections,input.attachments)}),'command_conflict');check('Changed request cannot reuse the original admitted command');
  fs.unlinkSync(file);const preview=await importer.preview(sessionId,selected(first.attachments[0]),signal());assert(preview.text?.includes('真实本地合成文件'));check('Submitted attachment preview reads the captured copy after original deletion');
  const other=(await store.createAiConversationSession({title:'合成另一会话',folderId:null})).session.id;
  const foreign={...input,sessionId:other,commandId:`xicmd_${randomUUID()}`};foreign.hash=attachmentStartHash(other,foreign.prompt,foreign.selections,foreign.attachments);await state.claimCommand(foreign.commandId,other,foreign.hash);
  await rejects(state.attachmentSends.admit(foreign),'attachment_changed');assert.equal((await store.getAiConversationSession(other)).messages.length,0);check('Foreign conversation attachment selection cannot publish user facts');
  const file2=path.join(sources,'归档.txt');fs.writeFileSync(file2,'合成归档');const added=await importer.importFile(other,file2,signal());const row=(await state.attachments.get(other,added.id))!;
  const archived={...foreign,commandId:`xicmd_${randomUUID()}`,attachments:[row],selections:[selected(row)]};archived.hash=attachmentStartHash(other,archived.prompt,archived.selections,archived.attachments);await state.claimCommand(archived.commandId,other,archived.hash);
  await sql(`UPDATE ai_conversation_sessions SET archived_at='2026-10-04T00:00:00Z' WHERE id='${other}'`);await rejects(state.attachmentSends.admit(archived),'permission_denied');check('Archived conversation is refused by the same atomic publication statement');
  const hostId=(await store.createAiConversationSession({title:'合成宿主失败',folderId:null})).session.id;
  const hostFile=path.join(sources,'宿主附件.txt');fs.writeFileSync(hostFile,'合成宿主持久回执');const hostAttachment=await importer.importFile(hostId,hostFile,signal());
  const host=createXiaozhiProductionHost({store,dataRoot:data,emit:()=>{},afterAttachmentSendStage:async stage=>{if(stage==='committed')throw new Error('injected_post_commit_failure');}});
  const hostInput={sessionId:hostId,commandId:`xicmd_${randomUUID()}`,prompt:'合成持久回执',attachments:[selected(hostAttachment)]};
  const received=await host.start(hostInput);assert(received.ok);const hostDetail=await store.getAiConversationSession(hostId);assert.equal(hostDetail.messages.length,1);assert.equal((await store.getAiAgentRun(received.runId))?.status,'failed');
  assert.deepEqual(await host.start(hostInput),received);assert.equal((await store.getAiConversationSession(hostId)).messages.length,1);await host.close();
  check('Actual production host returns an admitted receipt after post-commit failure and confirms the same run without replay');
  report.terminations=[];
  for(const cut of ['claimed','committed']){
   const target=path.join(output,cut);fs.mkdirSync(target);const args=[process.argv[1],target,'cut',cut];
   const child=spawnSync(process.execPath,args,{cwd:process.cwd(),env:process.env,encoding:'utf8',windowsHide:true,timeout:25000});
   fs.writeFileSync(path.join(target,'cut.log'),String(child.stdout||'')+String(child.stderr||''));assert.notEqual(child.status,0);assert.equal(fs.readFileSync(path.join(target,'cut-stage.txt'),'utf8'),cut);
   report.terminations.push({stage:cut,exitCode:child.status,signal:child.signal});
   for(let index=0;index<2;index++){const reopened=spawnSync(process.execPath,[process.argv[1],target,'recover',cut],{cwd:process.cwd(),env:process.env,encoding:'utf8',windowsHide:true,timeout:25000});fs.writeFileSync(path.join(target,`recover-${index}.log`),String(reopened.stdout||'')+String(reopened.stderr||''));assert.equal(reopened.status,0);assert(reopened.stdout.includes('"noReplay":true'));}
   check(`Actual owned OS termination at ${cut}, then two separate native restarts preserve draft/submitted history and never replay`);
  }
  report.success=true;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
}catch(error){report.error=String(error instanceof Error?error.stack:error).slice(0,2200);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await close();}
