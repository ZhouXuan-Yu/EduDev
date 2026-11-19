import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createFileReferenceState,createFileReferenceProjection,FILE_REFERENCE_SCHEMA} from '../../src/main/xiaozhi-agent/file-references.ts';
import {fileVersion} from '../../src/main/xiaozhi-agent/workspace-files.ts';

const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-file-references-')),workspace=path.join(output,'workspace'),database=path.join(output,'state.db');
fs.mkdirSync(workspace);fs.writeFileSync(path.join(workspace,'私密甲.txt'),'teaching source');fs.writeFileSync(path.join(workspace,'私密乙.txt'),'second source');
fs.writeFileSync(path.join(workspace,'ordinary.txt'),'ordinary');fs.mkdirSync(path.join(workspace,'私密目录'));fs.writeFileSync(path.join(workspace,'私密目录','lesson.txt'),'nested');
let db=new DatabaseSync(database),sqlCalls=0,authorityCalls=0,sanitizerBatches=0,current=true,workspaceVersion='v1';
db.exec('PRAGMA foreign_keys=ON;CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);INSERT INTO ai_conversation_sessions VALUES(\'session\');CREATE TABLE old_fact(value TEXT);INSERT INTO old_fact VALUES(\'retained\')');
const sql={run:async(s,v=[])=>{sqlCalls++;return db.prepare(s).run(...v);},all:async(s,v=[])=>{sqlCalls++;return db.prepare(s).all(...v);}};
const state=createFileReferenceState(sql),clean=async text=>text.replace(/私密[甲乙]|私密目录/g,'学生资料');
const make=(taskId='task')=>createFileReferenceProjection({state,sessionId:'session',taskId,workspace:async()=>{authorityCalls++;return{path:workspace,label:'owned',version:workspaceVersion};},current:()=>current,sanitize:clean,sanitizer:async()=>{sanitizerBatches++;return clean;}});
let projection=make();const checks=[],report={success:false,output,checks,boundary:'Real SQLite and owned filesystem; domain tests complement actual production Host loopback regressions.'};
const result=(payload)=>({content:[{type:'text',text:JSON.stringify(payload)}],details:{private:'unchanged'}});
const payload=value=>JSON.parse(value.content[0].text);
const stat=name=>({success:true,tool:'office_file_stat',data:{source:name,version:fileVersion(fs.statSync(path.join(workspace,name)))}});
async function check(name,action){await action();checks.push({name,pass:true});console.log('PASS '+name);}
try{
 await check('Old SQLite migration is idempotent and retains original facts',async()=>{await state.migrate();await state.migrate();assert.equal(db.prepare('SELECT value FROM old_fact').get().value,'retained');});
 await check('256 ordinary list entries preserve bytes without per-entry SQL or authority',async()=>{
  const original=result({success:true,tool:'office_list_files',data:{source:'.',entries:Array.from({length:256},(_,i)=>({kind:'file',name:`lesson-${i}.txt`}))}});
  sqlCalls=authorityCalls=sanitizerBatches=0;const projected=await projection.project('office_list_files',original);
  assert.deepEqual(projected,original);assert.equal(sqlCalls,0);assert.equal(authorityCalls,0);assert.equal(sanitizerBatches,1);
 });
 let first,second;
 await check('Mixed private labels receive distinct usable selectors and canonical discovery is exact',async()=>{
  const original=result({success:true,tool:'office_list_files',data:{source:'.',entries:[{kind:'file',name:'ordinary.txt'},{kind:'file',name:'私密甲.txt'},{kind:'file',name:'私密乙.txt'}]}}),projected=await projection.project('office_list_files',original),value=payload(projected);
  assert.equal(value.fileReferenceSchema,FILE_REFERENCE_SCHEMA);assert.equal(value.data.entries[0].name,'ordinary.txt');[first,second]=value.data.entries.slice(1).map(entry=>entry.name);assert.notEqual(first,second);
  assert.equal(value.data.labels[first],value.data.labels[second]);assert.deepEqual(await projection.input('office_read_text',{path:first}),{path:'私密甲.txt'});
  assert.deepEqual(await projection.canonical('office_list_files',value),payload(original));assert.deepEqual(projected.details,original.details);
 });
 await check('Stat projection preserves raw source version and durable selectors survive database reopen',async()=>{
  const original=stat('私密甲.txt'),value=payload(await projection.project('office_file_stat',result(original)));assert.equal(value.data.version,original.data.version);assert.equal(value.data.source,first);
  db.close();db=new DatabaseSync(database);projection=make();assert.equal(await projection.resolve(first),'私密甲.txt');assert.equal((await state.get(first)).relative,'私密甲.txt');
 });
 await check('Sensitive parent permits independent child selector while canonical list remains raw',async()=>{
  const original={success:true,tool:'office_list_files',data:{source:'私密目录',entries:[{kind:'file',name:'lesson.txt'}]}},value=payload(await projection.project('office_list_files',result(original)));
  assert.match(value.data.source,/^xiaozhi-file:/);assert.match(value.data.entries[0].name,/^xiaozhi-file:/);assert.equal(await projection.resolve(value.data.entries[0].name),'私密目录/lesson.txt');assert.deepEqual(await projection.canonical('office_list_files',value),original);
 });
 await check('References never grant another task, changed workspace or revoked owner access',async()=>{
  await assert.rejects(make('other').resolve(first),/permission_denied/);workspaceVersion='v2';await assert.rejects(projection.resolve(first),/permission_denied/);workspaceVersion='v1';current=false;await assert.rejects(projection.resolve(first),/permission_denied/);current=true;
 });
 await check('File changes invalidate IO but recorded canonical evidence stays bound to original path',async()=>{
  fs.appendFileSync(path.join(workspace,'私密甲.txt'),' changed');await assert.rejects(projection.resolve(first),/source_changed/);
  assert.equal((await projection.canonical('office_file_stat',{fileReferenceSchema:FILE_REFERENCE_SCHEMA,data:{source:first}})).data.source,'私密甲.txt');
  const value=payload(await projection.project('office_edit_text',result({success:true,file:'私密甲.txt',outcome:'applied'}),{path:first}));assert.notEqual(value.file,first);assert.equal(await projection.resolve(value.file),'私密甲.txt');
 });
 await check('Legacy raw input and mixed copy selectors retain their canonical tool contract',async()=>{
  assert.deepEqual(await projection.input('office_read_text',{path:'ordinary.txt'}),{path:'ordinary.txt'});assert.deepEqual(await projection.input('office_copy_file',{source:second,target:'copy.txt'}),{source:'私密乙.txt',target:'copy.txt'});
  assert.deepEqual(await projection.input('office_create_document',{path:'new.docx',sources:[{path:second}]}),{path:'new.docx',sources:[{path:'私密乙.txt'}]});
 });
 await check('Unrelated large tool inputs, images and results retain object identity',async()=>{
  const input={image:Buffer.alloc(1048576),localOnly:()=>true},unrelated=result({value:'x'.repeat(1048576)});
  assert.equal(await projection.input('education_compute',input),input);assert.equal(await projection.project('education_compute',unrelated),unrelated);
  const messages=[{role:'assistant',content:[{type:'toolCall',name:'education_compute',arguments:input}]}];assert.equal(await projection.history(messages),messages);
 });
 await check('Old native history projects source, old body and arguments without changing local evidence',async()=>{
  const messages=[{role:'assistant',content:[{type:'toolCall',name:'office_read_text',arguments:{path:'私密乙.txt'}}]},
   {role:'toolResult',toolName:'office_read_text',content:[{type:'text',text:JSON.stringify({...stat('私密乙.txt'),tool:'office_read_text',data:{...stat('私密乙.txt').data,text:'私密乙 teaching'}})}],details:{sources:[{local:{path:'私密乙.txt'}}]}}];
  const original=JSON.stringify(messages),projected=await projection.history(messages),wire=JSON.stringify(projected.map(message=>{const value={...message};delete value.details;return value;}));assert.equal(JSON.stringify(messages),original);assert(!wire.includes('私密乙'));assert.equal(projected[1].details,messages[1].details);assert.match(projected[0].content[0].arguments.path,/^xiaozhi-file:/);
  assert.equal((await projection.canonical('office_read_text',JSON.parse(projected[1].content[0].text))).data.source,'私密乙.txt');
 });
 await check('Blocked links remain discovery evidence and never become readable references',async()=>{
  const link=path.join(workspace,'私密链接');fs.symlinkSync(path.join(workspace,'私密目录'),link,'junction');
  const original={success:true,tool:'office_list_files',data:{source:'.',entries:[{kind:'blocked_link',name:'私密链接'}]}};
  const special=createFileReferenceProjection({state,sessionId:'session',taskId:'task',workspace:async()=>({path:workspace,label:'owned',version:'v1'}),current:()=>true,sanitize:async text=>text.replace('私密链接','学生资料')});
  const value=payload(await special.project('office_list_files',result(original)));assert.deepEqual(await special.canonical('office_list_files',value),original);await assert.rejects(special.resolve(value.data.entries[0].name),/permission_denied/);
 });
 await check('Session deletion cascades derived references while old facts remain',async()=>{db.exec('PRAGMA foreign_keys=ON;DELETE FROM ai_conversation_sessions');assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_file_references').get().n,0);assert.equal(db.prepare('SELECT value FROM old_fact').get().value,'retained');});
 report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{db.close();fs.writeFileSync(path.join(output,'REPORT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
