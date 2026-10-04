import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {createAssistantMessageEventStream} from '@earendil-works/pi-ai';
const {createOfficeArtifactState}=await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const {createOfficeArtifactCoordinator}=await import('../../src/main/xiaozhi-agent/office-artifact-coordinator.ts');
const {registerOfficeArtifactIpc}=await import('../../src/main/xiaozhi-agent/office-artifact-api.ts');
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const {getPiProtectedContext}=await import('../../src/main/xiaozhi-agent/compaction-context.ts');
const {fileVersion}=await import('../../src/main/xiaozhi-agent/workspace-files.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-office-coordinator-'));
const workspace=path.join(output,'workspace'),dataRoot=path.join(output,'data'),stateRoot=path.join(output,'sdk');for(const root of[workspace,dataRoot,stateRoot])fs.mkdirSync(root);
const db=new DatabaseSync(path.join(dataRoot,'ledger.db')),sessionId=`aisession_${randomUUID()}`,other=`aisession_${randomUUID()}`,runId='owned-office-run';
db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);
CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
for(const id of[sessionId,other])db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(id);
const state=createOfficeArtifactState({all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)});await state.migrate();
let current=true,grant=workspace;const events=[];
const service=createOfficeArtifactService({state,dataRoot,workspace:async()=>grant,isCurrent:()=>current,onState:artifact=>events.push({kind:'office_artifact',artifact})});
const coordinator=createOfficeArtifactCoordinator({state,service,isCurrent:()=>current,emit:(_id,_run,event)=>events.push(event),sanitize:async text=>text.replaceAll('私有名字','[已脱敏]')});
const tool=coordinator.tools(sessionId,runId,action=>action())[0];
const draft=()=>({schemaVersion:'xiaozhi.office-draft.v1',title:'私有正文标题',sections:[{heading:'教学',paragraphs:['私有正文段落'],table:{columns:['阶段','分钟'],rows:[['复习',37],['=1+1',8]]}}]});
const proposal=(name,sources=[])=>({path:name+'.xlsx',format:'xlsx',sources,draft:draft()});
const address=row=>({schemaVersion:'xiaozhi.office-artifact.v1',sessionId,draftId:row.id});
const decide=(row,action,extra={})=>coordinator.decide({...address(row),revision:row.revision,action,...extra});
const until=async fn=>{const end=Date.now()+8000;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,5));}throw new Error('Office coordinator timeout');};
const pending=call=>until(async()=>(await state.list(sessionId)).find(row=>row.callId===call&&row.state==='pending'));
const report={success:false,checks:[],boundary:'Actual Pi registry/once/teacher wait, SQLite, FS and XLSX library; injected model protocol only. No live provider/UI/WPS claim.'};
const check=async(name,fn)=>{await fn();report.checks.push({name,pass:true});console.log('PASS '+name);};let agent;
globalThis.fetch=async()=>{throw new Error('No network in coordinator gate');};
try{
 await check('Actionable durable wait, local review and rejection contain no private content in events/model and no file effect',async()=>{
  const work=tool.execute('reject',proposal('私有名字'),new AbortController().signal),row=await pending('reject');
  const review=await coordinator.review(address(row));assert(review.ok&&review.value.draft.title==='私有正文标题');assert(!fs.existsSync(path.join(workspace,row.path)));
  assert((await decide(row,'reject')).ok);const result=await work;assert(result.isError);assert(!JSON.stringify(result).includes('私有名字'));assert(!JSON.stringify(result).includes('私有正文'));
  for(const event of events){assert.deepEqual(Object.keys(event.artifact).sort(),['schemaVersion','id','runId','callId','path','format','state','revision','artifactId','sourceCount'].sort());assert(!JSON.stringify(event).includes('私有正文'));}
  assert.equal(db.prepare('SELECT count(*) n FROM document_artifacts').get().n,0);
 });
 await check('Teacher revision invalidates old confirmation and saves only revised actual XLSX with real stage events',async()=>{
  const work=tool.execute('edit',proposal('备课'),new AbortController().signal),row=await pending('edit'),content=draft();content.title='教师修订';content.sections[0].paragraphs[0]='本地修改不得进入模型';content.sections[0].table.rows[0][1]=41;
  const revised=await coordinator.revise({...address(row),revision:row.revision,draft:content});assert(revised.ok&&revised.value.revision===1);
  assert.equal((await decide(row,'approve')).error,'conflict');assert((await decide(revised.value,'approve')).ok);const result=await work;assert(!result.isError);assert(!JSON.stringify(result).includes('本地修改'));
  const ExcelJS=(await import('exceljs')).default,book=new ExcelJS.Workbook();await book.xlsx.readFile(path.join(workspace,row.path));assert.equal(book.getWorksheet(1).getCell('A1').value,'教师修订');assert.equal(book.getWorksheet(1).getCell('A3').value,'本地修改不得进入模型');assert.equal(book.getWorksheet(1).getCell('B6').value,41);assert.equal(book.getWorksheet(1).getCell('A7').value,'=1+1');
  const states=events.filter(e=>e.artifact.id===row.id).map(e=>e.artifact.state);for(const state of['pending','approved','generating','prepared','committing','saved'])assert(states.includes(state));assert(states.indexOf('saved')>states.indexOf('committing'));
 });
 await check('Strict local inputs, cross-session access and concurrent decisions cannot produce a second file',async()=>{
  const work=tool.execute('concurrent',proposal('并发'),new AbortController().signal),row=await pending('concurrent');
  for(const extra of[{sessionId:other},{revision:9},{url:'https://example.invalid'},{action:'execute'}])assert(!(await decide(row,'approve',extra)).ok);
  assert(!(await coordinator.review({...address(row),sessionId:other})).ok);assert(!(await coordinator.review({...address(row),draft:'injected'})).ok);
  assert(!(await coordinator.revise({...address(row),revision:0,draft:{...draft(),extra:true}})).ok);assert(!(await coordinator.revise({...address(row),sessionId:other,revision:0,draft:draft()})).ok);
  const results=await Promise.all([decide(row,'approve'),decide(row,'reject')]);assert.equal(results.filter(r=>r.ok).length,1);assert(!(await work).isError);assert.equal(db.prepare('SELECT count(*) n FROM document_artifacts WHERE file_name=?').get(row.path).n,1);
 });
 await check('Source change during teacher revision resolves the waiter as conflict instead of waiting forever',async()=>{
  const source=path.join(workspace,'来源.txt');fs.writeFileSync(source,'来源第一版');const work=tool.execute('source',proposal('源冲突',[{path:'来源.txt',version:fileVersion(fs.lstatSync(source))}]),new AbortController().signal),row=await pending('source');
  fs.writeFileSync(source,'教师改后的来源');const result=await coordinator.revise({...address(row),revision:row.revision,draft:draft()});assert(result.ok&&result.value.state==='conflict');assert((await work).isError);assert(!fs.existsSync(path.join(workspace,row.path)));
 });
 await check('Stop, revoke and malicious tool paths release original waiter without raw error or write replay',async()=>{
  const controller=new AbortController(),work=tool.execute('stop',proposal('停止'),controller.signal),row=await pending('stop');current=false;controller.abort();await assert.rejects(work,/cancelled/);assert.equal((await state.get(row.id)).state,'interrupted');assert(!(await decide(row,'approve')).ok);current=true;
  const revoked=tool.execute('revoke',proposal('撤权'),new AbortController().signal),r=await pending('revoke');grant=null;assert(!(await decide(r,'approve')).ok);await coordinator.cancel(runId);await revoked;grant=workspace;
  for(const x of[{...proposal('bad'),path:'../越权.xlsx'},{...proposal('bad'),format:'html'},{...proposal('bad'),root:workspace}]){const result=await tool.execute(randomUUID(),x,new AbortController().signal);assert(result.isError&&!JSON.stringify(result).includes(workspace));}
  assert(!fs.existsSync(path.join(workspace,'停止.xlsx'))&&!fs.existsSync(path.join(workspace,'撤权.xlsx')));
 });
 await check('All three formal Office channels reject secondary frame before any host invocation',async()=>{
  const handlers=new Map();let calls=0;const fn=async()=>{calls++;return{ok:true};};registerOfficeArtifactIpc({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},allowed:e=>e.main===true,host:{reviewOfficeArtifact:fn,reviseOfficeArtifact:fn,decideOfficeArtifact:fn}});
  assert.equal(handlers.size,3);for(const fn of handlers.values()){assert.equal((await fn({main:false},{})).error,'permission_denied');assert.equal(calls,0);}
  assert((await handlers.get('xiaozhi:office-review')({main:true},{})).ok);assert.equal(calls,1);
 });
 await check('Compaction includes actual artifact identity/outcomes but no draft, output or source hash; exclusion removes old run',async()=>{
  const fake={xiaozhiState:{controls:async()=>[],approvals:async()=>[],officeArtifacts:state},getAiConversationSession:async()=>({messages:[]}),sanitizeProblemText:async text=>({sanitizedText:text})};
  const context=await getPiProtectedContext(fake,sessionId);assert(context.includes('办公产物')&&context.includes('artifact_'));assert(!context.includes('本地修改')&&!context.includes('私有正文')&&!context.includes('output')&&!context.includes('sha256'));assert.equal(await getPiProtectedContext(fake,sessionId,[runId]),'');
 });
 await check('Original native prefix and creation identity stay byte-identical with independent Office capability and Pi once',async()=>{
  const inject=queue=>{agent.session.agent.streamFn=model=>{const next=queue.shift();assert(next);const stream=createAssistantMessageEventStream(),message={role:'assistant',api:model.api,provider:model.provider,model:model.id,content:[],timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},...next};stream.push({type:'done',reason:message.stopReason,message});stream.end();return stream;};};
  const end={stopReason:'stop',content:[{type:'text',text:'实际回执。'}]};agent=await createPiXiaozhiSession({stateRoot,workspace,apiKey:'synthetic-no-provider',model:'deepseek-chat',approveCopy:async()=>false});inject([end]);assert((await agent.prompt('旧会话')).ok);
  const file=agent.sessionFile,before=fs.readFileSync(file),identity=agent.session.sessionManager.getBranch().find(e=>e.customType==='xiaozhi.education.snapshot.v1');await agent.dispose();
  agent=await createPiXiaozhiSession({stateRoot,workspace,sessionFile:file,apiKey:'synthetic-no-provider',model:'deepseek-chat',approveCopy:async()=>false,officeArtifactTools:wait=>coordinator.tools(sessionId,runId,wait)});
  assert(fs.readFileSync(file).subarray(0,before.length).equals(before));assert.deepEqual(agent.session.sessionManager.getBranch().find(e=>e.customType==='xiaozhi.education.snapshot.v1'),identity);
  const args=proposal('SDK实际');args.draft.sections[0].table.rows.push(['37','008']);
  const call={type:'toolCall',id:'once-office',name:'office_create_document',arguments:args};inject([{stopReason:'toolUse',content:[call,call]},end]);const work=agent.prompt('实际SDK等待');const row=await pending('once-office');
  const actual=(await coordinator.review(address(row))).value.draft.sections[0].table.rows;assert.deepEqual(actual,args.draft.sections[0].table.rows);assert.equal(typeof actual[0][1],'number');assert.equal(actual[2][1],'008');
  assert((await decide(row,'approve')).ok);assert((await work).ok);
  const ExcelJS=(await import('exceljs')).default,book=new ExcelJS.Workbook();await book.xlsx.readFile(path.join(workspace,row.path));assert.equal(book.getWorksheet(1).getCell('B6').value,37);assert.equal(book.getWorksheet(1).getCell('A7').value,'=1+1');assert.equal(book.getWorksheet(1).getCell('A8').value,'37');assert.equal(book.getWorksheet(1).getCell('B8').value,'008');
  assert.equal((await state.list(sessionId)).filter(r=>r.callId==='once-office').length,1);assert.equal(db.prepare('SELECT count(*) n FROM document_artifacts WHERE file_name=?').get(row.path).n,1);assert.equal(agent.diagnostics().executing,0);
  assert.equal(agent.session.sessionManager.getEntries().filter(e=>e.customType==='xiaozhi.education.office-artifact.v1').length,1);await agent.dispose();agent=undefined;
  await assert.rejects(createPiXiaozhiSession({stateRoot,workspace,sessionFile:file,apiKey:'synthetic-no-provider',model:'deepseek-chat',approveCopy:async()=>false}),/configuration/);
 });
 report.success=true;
}catch(error){report.error=String(error.stack).slice(0,3000);process.exitCode=1;}
finally{await agent?.dispose();db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,output}));}
