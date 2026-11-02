import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const {resolveAnswerPolicy,resolveThinkingPolicy,resolveSubjectAnswerInstructions,applyThinkingPayload}=await import('../../src/main/xiaozhi-agent/answer-quality.ts');
const {isTeachingRestatement,teachingReference,teachingTaskText,teachingPresentationInstructions}=await import('../../src/main/xiaozhi-agent/teaching-presentation.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-teaching-policy-')),report={ok:false,checks:[],boundary:'Actual source routing and wire construction only; no model requests or natural teaching quality acceptance.'};
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);};
const cap={id:'deepseek-flash',name:'DeepSeek Flash',source:'official',observedAt:new Date().toISOString(),contextWindow:65536,maxOutputTokens:32768,effort:{supportedLevels:['low','high','max'],defaultLevel:'high'}};
const source='请给八年级简要讲解3(x−2)=2x+5，先核验再说明，全文不超过80字。';
try{
 check('Brief proofs, equations and quantities preserve deep automatic reasoning',()=>{
  for(const t of [source,'简要证明两条平行线内错角相等','只要答案：sqrt(x+2)=x','只要答案：y²−5y+6=0','100N作用0.02m²，请简要解释压强','1m/s换算为km/h，只要答案','简短核验定义域和增根']){assert.equal(resolveAnswerPolicy(t,cap).mode,'deep',t);assert.equal(resolveThinkingPolicy(t,cap).effective,'high',t);}
 });
 check('Greetings, short summaries and basic arithmetic retain light routing',()=>{
  for(const t of ['你好','简要说明下课安排','一句话打招呼','2+3，只要答案'])assert.equal(resolveThinkingPolicy(t,cap).effective,'off',t);
  assert.equal(resolveAnswerPolicy('解释光的折射',cap).mode,'standard');
 });
 check('Explicit effort always wins; supported limits and unknown metadata remain authoritative',()=>{
  for(const [choice,expected]of[['off','none'],['low','low'],['high','high'],['max','max']]){const p=resolveThinkingPolicy(source,cap,choice,'session');assert.equal(applyThinkingPayload({},p).reasoning_effort,expected);assert.equal(p.requested,choice);}
  for(const c of [{...cap,stale:true},{...cap,effort:undefined}]){const p=resolveThinkingPolicy(source,c,'high','session');assert.equal(p.reason,'capability_unknown');assert(!('reasoning_effort'in applyThinkingPayload({},p)));assert.equal(p.maxOutputTokens,c.stale?4096:16384);}
  assert.equal(resolveThinkingPolicy(source,{...cap,maxOutputTokens:4096,contextWindow:8192},'max').maxOutputTokens,4096);
 });
 check('Same-question style turns are recognized without swallowing changed conditions or new topics',()=>{
  for(const t of ['八年级简要讲解','教师深入说明','请把同一题改成教师深入说明','请用八年级学生能听懂的语言简要讲解同一题','再详细一点','只要答案','这道题用80字简要解释'])assert(isTeachingRestatement(t),t);
  for(const t of ['你好','换个话题：简要解释光合作用','给八年级讲光合作用','同一题把载荷由四牛改成五牛再简要讲解','这道题改g=9.8并简要讲解','这道题把密度改成八百再简要讲解','简要解释100N作用0.02m²','这道题用另一组数值简要讲解'])assert(!isTeachingRestatement(t),t);
 });
 check('Latest substantive teacher text anchors style chains; no assistant, cross-session or older-topic fallback',()=>{
  const messages=[{role:'user',content:source},{role:'assistant',content:'x=11'},{role:'user',content:'教师深入说明'},{role:'assistant',content:'说明'}],before=JSON.stringify(messages);
  assert.equal(teachingReference('八年级简要讲解',messages),source);assert.equal(JSON.stringify(messages),before);
  assert.equal(teachingReference('八年级简要讲解',[]),'');assert.equal(teachingReference('换个话题：简要讲解化学',messages),'');
  assert.equal(teachingReference('教师深入说明',[...messages,{role:'user',content:'你好'}]),'你好');
  assert.equal(teachingReference('教师深入说明',[{role:'user',content:'a'.repeat(9000)}]).length,8000);
 });
 check('Only style turns inherit classification; new tasks and actual changed quantities route from current text',()=>{
  assert.equal(resolveThinkingPolicy('八年级简要讲解',cap,'auto','global',source).effective,'high');
  assert.equal(teachingTaskText('简要讲光合作用',source),'简要讲光合作用');
  assert.equal(resolveThinkingPolicy('你好',cap,'auto','global',source).effective,'off');
  const physics='逐步推导正方体木块在水中浮力，g=10N/kg';assert(resolveSubjectAnswerInstructions('教师深入说明',physics));
  assert.equal(resolveSubjectAnswerInstructions('换个话题：简要解释光合作用',physics),'');
 });
 check('Current student/teacher presentation replaces historical style without fabricating a limit or hidden reasoning',()=>{
  const student=teachingPresentationInstructions('八年级简要讲解'),teacher=teachingPresentationInstructions('请把同一题改成教师深入说明');
  assert(student.includes('对象：八年级'));assert(student.includes('简短不等于少核对'));assert(teacher.includes('对象：教师'));assert(teacher.includes('保留当前同题'));assert(!teacher.includes('八年级'));
  assert(teacher.includes('若发现原结论有错'));assert(teacher.includes('不输出隐藏推理'));assert(!student.includes('80字'));assert.equal(teachingPresentationInstructions('你好'),'');
 });
 check('Inferred work is bounded, pure and does not grant a saved setting or mutate provider payload',()=>{
  const wire={thinking:{type:'disabled'},reasoning_effort:'none',max_tokens:1},before=JSON.stringify(wire);const p=resolveThinkingPolicy(source,cap),actual=applyThinkingPayload(wire,p);assert.equal(JSON.stringify(wire),before);assert.equal(actual.reasoning_effort,'high');assert.equal(actual.max_tokens,16384);
  const start=performance.now();for(let i=0;i<10000;i++)resolveThinkingPolicy('八年级简要讲解',cap,'auto','global',source);report.routingBenchmark={iterations:10000,milliseconds:Number((performance.now()-start).toFixed(3)),scope:'Routing only; not provider latency/P95 or teacher quality'};
 });report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,error:report.error}));}
