import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {createEducationToolCatalog}=await import('../../src/main/xiaozhi-agent/education-tool-catalog.ts');
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const {createQuestionContextProvider}=await import('../../src/main/education/question-context-provider.ts');
const {readChatSourcePresence}=await import('../../src/main/xiaozhi-agent/chat-source-presence.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-kb-brain-discovery-'));
const report={success:false,checks:[],scope:'Real Pi wire and production question provider, synthetic local question and deterministic provider. Not natural-model behavior or recall measurement.'};
const q={id:'question_'+randomUUID(),subject:'物理',grade:'九年级',knowledgePoint:'电磁波',questionType:'填空',difficulty:'easy',stem:'智能手机通过哪种波远程控制扫地机器人？',answer:'电磁波',analysis:'手机通过电磁波传递控制信息。',sourceKind:'local_bank',sourceTitle:'合成教学题',tags:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
let active=true,searches=0,reads=0,agent;
const questions=createQuestionContextProvider({listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text}),searchQuestionBank:async()=>{searches++;return[q];},getQuestionNotebookEntry:async id=>id===q.id?q:undefined},()=>active,()=>reads++);
const others=Array.from({length:30},(_,i)=>({name:'mcp_'+'a'.repeat(24)+'_deferred'+i,label:'辅助能力',description:'非核心合成辅助能力',parameters:{type:'object',properties:{}},execute:async()=>({content:[{type:'text',text:'未用'}]})}));
const originalFetch=globalThis.fetch,originalQuality=process.env.XIAOZHI_ANSWER_QUALITY;
try{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE resource_chunks(id TEXT);CREATE TABLE teacher_resources(id TEXT);CREATE TABLE question_bank_items(id TEXT, eligible INTEGER);');
 const queries=[];const presence=()=>readChatSourcePresence(async query=>{queries.push(query);return db.prepare(query).all();});
 assert.deepEqual(await presence(),{knowledge:false,materials:false,questions:false});
 db.exec("INSERT INTO question_bank_items VALUES('old-usable',1),('newest-needs-review',0);INSERT INTO teacher_resources VALUES('original');INSERT INTO resource_chunks VALUES('text');");
 assert.deepEqual(await presence(),{knowledge:true,materials:true,questions:true});assert.equal(queries.length,2);assert(queries.every(s=>!/(ORDER BY|COUNT\(|JOIN|SELECT \*)/i.test(s)));
 await assert.rejects(readChatSourcePresence(async()=>[]),/unavailable/);
 report.checks.push('Actual SQLite existence probe survives review-only newest row and needs no retrieval, sorting or whole-bank counts');
 const catalog=createEducationToolCatalog('权限仍由宿主控制',[...others,...questions]);
 assert(catalog.deferred);
 for(const query of ['', '你好', '请帮我备课']){
  catalog.reset(query);
  for(const tool of questions)assert(catalog.exposed(tool.name),'Core local question read tool must not require model discovery: '+tool.name);
 }
 assert(!catalog.exposed(others[29].name));
 const unavailable=createEducationToolCatalog('权限仍由宿主控制',others);
 assert(!unavailable.exposed('education_search_questions'),'Pinning must not manufacture unauthorized definitions');
 report.checks.push('Core read schemas survive every task reset without manufacturing tools or exposing unrelated capabilities');
 let phase=0,found;
 // Pi appends its verified citation registry after the provider's JSON text line.
 const toolData=message=>JSON.parse((typeof message.content==='string'?message.content:message.content.map(c=>c.text||'').join('')).split('\n')[0]);
 globalThis.fetch=async(_url,init)=>{
  const body=JSON.parse(init.body);fs.writeFileSync(path.join(output,'wire-'+phase+'.json'),JSON.stringify(body,null,2));
  for(const tool of questions)assert(body.tools.some(t=>t.function.name===tool.name),'Actual first Pi wire must expose '+tool.name);
  assert(!body.tools.some(t=>t.function.name===others[29].name));
  let delta,finish='tool_calls';
  if(phase===0)delta={tool_calls:[{index:0,id:'kb-search',type:'function',function:{name:questions[0].name,arguments:JSON.stringify({query:'扫地机器人'})}}]};
  else if(phase===1){const data=toolData(body.messages.findLast(m=>m.role==='tool'));assert.equal(data.returned,1);found=data.questions[0];delta={tool_calls:[{index:0,id:'kb-read',type:'function',function:{name:questions[1].name,arguments:JSON.stringify({reference:found.reference,version:found.version})}}]};}
  else {const data=toolData(body.messages.findLast(m=>m.role==='tool'));assert(data.success);assert.equal(data.question.stem,q.stem);assert.equal(data.question.answer,q.answer);assert.equal(data.teacherConfirmationKnown,false);delta={content:'已读取本地题库的完整题目与答案。'};finish='stop';}
  phase++;
  return new Response([{role:'assistant',content:''},delta,{}].map((d,i)=>'data: '+JSON.stringify({id:'kb-brain',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta:d,finish_reason:i===2?finish:null}]})+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
 };
 const stateRoot=path.join(output,'state'),workspace=path.join(output,'workspace');fs.mkdirSync(stateRoot);fs.mkdirSync(workspace);delete process.env.XIAOZHI_ANSWER_QUALITY;
 const events=[];
 agent=await createPiXiaozhiSession({stateRoot,workspace,apiKey:'synthetic-key',model:'deepseek-flash',limitsEnforced:false,mcpTools:others,questionContextTools:questions,sourceAvailability:async()=>({...await presence(),attachments:false,workspace:true}),onEvent:e=>events.push(e)});
 const result=await agent.prompt('请从本地题库找到扫地机器人这道题，读取完整题目及答案。');assert(result.ok,JSON.stringify(result));assert.equal(phase,3);assert.equal(searches,1);assert.equal(reads,1);
 assert(events.some(e=>e.kind==='tool_end'&&e.tool==='education_read_question'&&e.success&&e.sources?.some(s=>s.question?.questionId===q.id)));
 assert(!events.some(e=>e.kind==='tool_end'&&e.tool==='find_education_tools'));
 report.checks.push('Actual Pi first request executes production search then versioned read with a source event, without catalog round trips');
 active=false;
 const denied=await questions[1].execute('revoked',{reference:found.reference,version:found.version},new AbortController().signal);assert(denied.isError);assert.equal(JSON.parse(denied.content[0].text).code,'permission_denied');
 report.checks.push('Pinned schemas do not bypass current-task revocation');db.close();report.success=true;
}catch(e){report.error=e.stack||String(e);process.exitCode=1;console.error(report.error);}
finally{await agent?.dispose();globalThis.fetch=originalFetch;if(originalQuality===undefined)delete process.env.XIAOZHI_ANSWER_QUALITY;else process.env.XIAOZHI_ANSWER_QUALITY=originalQuality;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,output}));}
