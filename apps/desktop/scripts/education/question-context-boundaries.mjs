import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createQuestionContextProvider,questionVersion,readQuestionContextSource} from '../../src/main/education/question-context-provider.ts';
import {registerQuestionContextIpc} from '../../src/main/education/question-context-api.ts';
import {validQuestionContextQuery,validQuestionContextRead,validQuestionContextSource,QUESTION_CONTEXT_SCHEMA} from '../../src/shared/question-context.ts';
import {validateEducationSessionIdentity} from '../../src/main/xiaozhi-agent/education-session-identity.ts';
import {createPiXiaozhiSession} from '../../src/main/xiaozhi-agent/pi-session.ts';
export async function questionContextBoundaries(check,output,options,prime){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE questions(id TEXT PRIMARY KEY,body TEXT)');
 const original={id:'question_'+randomUUID(),subject:'数学',grade:'初二',knowledgePoint:'勾股定理',questionType:'计算',difficulty:'medium',stem:'直角边为3和4，请求斜边。合成学生甲 联系13800138000',answer:'5',analysis:'3²+4²=25。合成学校 D:/private/test',sourceTitle:'本地已保存题目',sourceKind:'local_bank',tags:['合成学生甲'],createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'};
 db.prepare('INSERT INTO questions VALUES (?,?)').run(original.id,JSON.stringify(original));
 let current=true,mutate=false,fail=false;
 const read=id=>{const row=db.prepare('SELECT body FROM questions WHERE id=?').get(id);return row?JSON.parse(row.body):undefined;};
 const store={listStudents:async()=>[{realName:'合成学生甲',school:'合成学校'}],sanitizeProblemText:async text=>{if(mutate){mutate=false;const q=read(original.id);q.answer='6';db.prepare('UPDATE questions SET body=? WHERE id=?').run(JSON.stringify(q),q.id);}return{sanitizedText:text.replaceAll('13800138000','[手机号]')};},
  getQuestionNotebookEntry:async id=>{if(fail)throw new Error('sensitive SQL credentials');const q=read(id);return q?{...q,bookmarked:false,version:7,categories:[],usageCount:0,lastUsedAt:''}:undefined;},
  searchQuestionBank:async filters=>filters.query==='空结果'?[]:[read(original.id)]};
 const tools=createQuestionContextProvider(store,()=>current),payload=result=>JSON.parse(result.content[0].text),call=(index,args,signal=new AbortController().signal)=>tools[index].execute(randomUUID(),args,signal);
 let result,reference,source;
 try{
  await check('Question context strict descriptors reject selectors, unknown fields, accessors and bad versions',async()=>{
   assert(validQuestionContextQuery({query:'勾股'}));assert(!validQuestionContextQuery({query:'勾股',studentId:'forged'}));let invoked=false;assert(!validQuestionContextQuery({get query(){invoked=true;return'bad';}}));assert(!invoked);assert(!validQuestionContextRead({reference:'题目0',version:'a'.repeat(64)}));assert(!validQuestionContextSource({schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:original.id,version:'bad'}));assert.equal(payload(await call(0,{query:'勾股',path:'D:/private'})).code,'invalid_input');
  });
  await check('Existing SQLite question facts yield sanitized search without answer, IDs, heuristic score or teacher approval claims',async()=>{
   result=await call(0,{query:'勾股'});assert(!result.isError);const p=payload(result);reference=p.questions[0];source=result.details.data.sources[0].question;assert.equal(p.returned,1);assert.equal(p.totalKnown,false);assert.equal(p.teacherConfirmationKnown,false);assert(!('answer' in reference));assert(!('id' in reference));assert(!('score' in reference));assert(!JSON.stringify(p).includes('合成学生甲'));assert(!JSON.stringify(p).includes('13800138000'));assert(validQuestionContextSource(source));
  });
  await check('Only discovered matching alias/version reads complete necessary answer and source, no writes',async()=>{
   const p=payload(await call(1,{reference:reference.reference,version:reference.version}));assert.equal(p.question.answer,'5');assert(!JSON.stringify(p).includes('合成学校'));assert(!JSON.stringify(p).includes('D:/private'));assert.equal(p.answerVerified,false);assert.equal(payload(await call(1,{reference:'题目999',version:reference.version})).code,'source_changed');assert.equal(read(original.id).answer,'5');
  });
  await check('Repeated search keeps aliases; bookmark version is not the content SHA; actual fact changes refuse old references',async()=>{
   assert.equal(payload(await call(0,{query:'勾股'})).questions[0].reference,reference.reference);const local=await readQuestionContextSource(store,source);assert.equal(local.question.answer,'5');assert.equal(questionVersion({...original,bookmarked:true,version:8}),source.version);const q=read(original.id);q.answer='6';db.prepare('UPDATE questions SET body=? WHERE id=?').run(JSON.stringify(q),q.id);assert.equal(payload(await call(1,{reference:reference.reference,version:reference.version})).code,'source_changed');await assert.rejects(readQuestionContextSource(store,source),/source_changed/);
  });
  await check('Source changes during sanitization fail without publishing new aliases or stale sources',async()=>{
   const q=read(original.id);q.answer='5';db.prepare('UPDATE questions SET body=? WHERE id=?').run(JSON.stringify(q),q.id);mutate=true;const res=await call(0,{query:'勾股'});assert(res.isError);assert.equal(payload(res).code,'source_changed');assert(!res.details.data);
  });
  await check('Empty, cancellation, stale run and read failures remain explicit and do not expose host errors',async()=>{
   assert.equal(payload(await call(0,{query:'空结果'})).returned,0);const abort=new AbortController();abort.abort();assert.equal(payload(await call(0,{query:'勾股'},abort.signal)).code,'cancelled');current=false;assert.equal(payload(await call(0,{query:'勾股'})).code,'permission_denied');current=true;fail=true;const p=payload(await call(0,{query:'勾股'}));assert.equal(p.code,'unavailable');assert(!JSON.stringify(p).includes('sensitive SQL'));fail=false;
  });
  await check('Question source typed IPC rejects non-main and unknown inputs before touching the store',async()=>{
   let handler;registerQuestionContextIpc({ipcMain:{handle:(_name,fn)=>handler=fn},allowed:event=>event.allowed,store});assert.deepEqual(await handler({allowed:false},source),{ok:false,error:'permission_denied'});assert.deepEqual(await handler({allowed:true},{...source,path:'bad'}),{ok:false,error:'invalid_input'});const fresh={...source,version:questionVersion(read(original.id))};assert.equal((await handler({allowed:true},fresh)).value.question.answer,'6');assert.equal((await handler({allowed:true},source)).error,'source_changed');
  });
  await check('Question capability identity supports old unmarked sessions and refuses removal, wrong tools or unknown branch marker before opening history',async()=>{
   const options={questionContextTools:tools},identity=validateEducationSessionIdentity(options,[]).question.data,entry={type:'custom',customType:'xiaozhi.education.question-context.v1',data:identity};assert(validateEducationSessionIdentity(options,[entry]).question.present);assert.throws(()=>validateEducationSessionIdentity({},[entry]),/configuration/);assert.throws(()=>validateEducationSessionIdentity({questionContextTools:[tools[1],tools[0]]},[]),/configuration/);assert.throws(()=>validateEducationSessionIdentity(options,[{...entry,customType:'xiaozhi.education.question-context.v2'}]),/configuration/);
  });
  await check('Oversized full answer is refused rather than silently truncated into a complete answer claim',async()=>{
   const q=read(original.id),large={...q,answer:'长'.repeat(12000)};db.prepare('UPDATE questions SET body=? WHERE id=?').run(JSON.stringify(large),q.id);
   try{const p=payload(await call(0,{query:'勾股'})).questions[0],res=await call(1,{reference:p.reference,version:p.version});assert.equal(payload(res).code,'too_large');assert(!res.details.data);}finally{db.prepare('UPDATE questions SET body=? WHERE id=?').run(JSON.stringify(q),q.id);}
  });
  await check('Actual Pi history gains a question marker once; removal and unknown-version restore refuse with JSONL bytes unchanged',async()=>{
   const root=path.join(output,'question-native');fs.mkdirSync(root);let agent;
   try{
    agent=await createPiXiaozhiSession({...options,stateRoot:root});await prime(agent);const file=agent.session.sessionManager.getSessionFile(),old=fs.readFileSync(file);await agent.dispose();
    agent=await createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,questionContextTools:tools});assert(fs.readFileSync(file).subarray(0,old.length).equals(old));assert(agent.session.getActiveToolNames().includes('education_read_question'));await agent.dispose();
    const saved=fs.readFileSync(file);await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file}),/configuration/);assert(fs.readFileSync(file).equals(saved));
    agent=await createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,questionContextTools:tools});assert.equal(agent.session.sessionManager.getEntries().filter(e=>e.customType==='xiaozhi.education.question-context.v1').length,1);agent.session.sessionManager.appendCustomEntry('xiaozhi.education.question-context.v2',{});await agent.dispose();const unknown=fs.readFileSync(file);await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,questionContextTools:tools}),/configuration/);assert(fs.readFileSync(file).equals(unknown));
   }finally{await agent?.dispose();}
  });
 }finally{db.close();}
}
