import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const {createEducationToolCatalog}=await import('../../src/main/xiaozhi-agent/education-tool-catalog.ts');
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const {createQuestionContextProvider}=await import('../../src/main/education/question-context-provider.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-kb-brain-discovery-'));
const report={success:false,checks:[],scope:'Real Pi wire and production question provider, synthetic local question and deterministic provider. Not natural-model behavior or recall measurement.'};
const q={id:'question_'+randomUUID(),subject:'物理',grade:'九年级',knowledgePoint:'电磁波',questionType:'填空',difficulty:'easy',stem:'智能手机通过哪种波远程控制扫地机器人？',answer:'电磁波',analysis:'手机通过电磁波传递控制信息。',sourceKind:'teacher_created',sourceTitle:'合成教学题',tags:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
let active=true,searches=0,reads=0,agent;
const questions=createQuestionContextProvider({listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text}),searchQuestionBank:async()=>{searches++;return[q];},getQuestionNotebookEntry:async id=>id===q.id?q:undefined},()=>active,()=>reads++);
const others=Array.from({length:30},(_,i)=>({name:'synthetic_deferred_'+i,label:'辅助能力',description:'非核心合成辅助能力',parameters:{type:'object',properties:{}},execute:async()=>({content:[{type:'text',text:'未用'}]})}));
const originalFetch=globalThis.fetch,originalQuality=process.env.XIAOZHI_ANSWER_QUALITY;
try{
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
 globalThis.fetch=async(_url,init)=>{
  const body=JSON.parse(init.body);
  for(const tool of questions)assert(body.tools.some(t=>t.function.name===tool.name),'Actual first Pi wire must expose '+tool.name);
  assert(!body.tools.some(t=>t.function.name===others[29].name));
  let delta,finish='tool_calls';
  if(phase===0)delta={tool_calls:[{index:0,id:'kb-search',type:'function',function:{name:questions[0].name,arguments:JSON.stringify({query:'扫地机器人'})}}]};
  else if(phase===1){const message=body.messages.findLast(m=>m.role==='tool');const data=JSON.parse(typeof message.content==='string'?message.content:message.content.map(c=>c.text||'').join(''));assert.equal(data.returned,1);found=data.questions[0];delta={tool_calls:[{index:0,id:'kb-read',type:'function',function:{name:questions[1].name,arguments:JSON.stringify({reference:found.reference,version:found.version})}}]};}
  else {const message=body.messages.findLast(m=>m.role==='tool'),data=JSON.parse(typeof message.content==='string'?message.content:message.content.map(c=>c.text||'').join(''));assert(data.success);assert.equal(data.question.stem,q.stem);assert.equal(data.question.answer,q.answer);assert.equal(data.teacherConfirmationKnown,false);delta={content:'已读取本地题库的完整题目与答案。'};finish='stop';}
  phase++;
  return new Response([{role:'assistant',content:''},delta,{}].map((d,i)=>'data: '+JSON.stringify({id:'kb-brain',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta:d,finish_reason:i===2?finish:null}]})+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
 };
 const stateRoot=path.join(output,'state'),workspace=path.join(output,'workspace');fs.mkdirSync(stateRoot);fs.mkdirSync(workspace);delete process.env.XIAOZHI_ANSWER_QUALITY;
 const events=[];
 agent=await createPiXiaozhiSession({stateRoot,workspace,apiKey:'synthetic-key',model:'deepseek-flash',limitsEnforced:false,mcpTools:others,questionContextTools:questions,onEvent:e=>events.push(e)});
 const result=await agent.prompt('请从本地题库找到扫地机器人这道题，读取完整题目及答案。');assert(result.ok,JSON.stringify(result));assert.equal(phase,3);assert.equal(searches,1);assert.equal(reads,1);
 assert(events.some(e=>e.kind==='tool_end'&&e.tool==='education_read_question'&&e.success&&e.sources?.some(s=>s.question?.questionId===q.id)));
 assert(!events.some(e=>e.kind==='tool_end'&&e.tool==='find_education_tools'));
 report.checks.push('Actual Pi first request executes production search then versioned read with a source event, without catalog round trips');
 active=false;
 const denied=await questions[1].execute('revoked',{reference:found.reference,version:found.version},new AbortController().signal);assert(denied.isError);assert.equal(JSON.parse(denied.content[0].text).code,'permission_denied');
 report.checks.push('Pinned schemas do not bypass current-task revocation');report.success=true;
}catch(e){report.error=e.stack||String(e);process.exitCode=1;console.error(report.error);}
finally{await agent?.dispose();globalThis.fetch=originalFetch;if(originalQuality===undefined)delete process.env.XIAOZHI_ANSWER_QUALITY;else process.env.XIAOZHI_ANSWER_QUALITY=originalQuality;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,output}));}
