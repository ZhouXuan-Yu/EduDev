import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
const {basketFixture}=await import('./paper-basket-fixture.mjs');
const {PaperBasketV2Repository}=await import('../../src/main/education/paper-basket-v2-repository.ts');
const {createPaperBasketAdaptationService}=await import('../../src/main/education/paper-basket-adaptation-service.ts');
const {migratePaperBasketAdaptations,adaptationHash}=await import('../../src/main/education/paper-basket-adaptation-ledger.ts');
const {preparePaperAdaptationContext}=await import('../../src/main/education/paper-basket-adaptation-context.ts');
const {createQuestionContextProvider,questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {createQuestionReviewCoordinator}=await import('../../src/main/education/question-review-coordinator.ts');
const {prepareQuestionAliases}=await import('../../src/main/education/question-aliases.ts');
const {PAPER_ADAPTATION_SCHEMA}=await import('../../src/shared/paper-basket-adaptation.ts');

const output=fs.mkdtempSync(path.join(tmpdir(),'paper-adaptation-context-'));
const report={success:false,output,checks:[],boundary:'Owned SQLite/source files; actual discovery/provider/review; zero model, Electron or build'};
const f=await basketFixture(path.join(output,'db'));
const {db,host,sid,student}=f;
db.exec("ALTER TABLE ai_agent_runs ADD COLUMN prompt TEXT; ALTER TABLE ai_agent_runs ADD COLUMN status TEXT; ALTER TABLE ai_agent_runs ADD COLUMN route TEXT; ALTER TABLE ai_agent_runs ADD COLUMN sub_intent TEXT;");
await migratePaperBasketAdaptations(host);
const reviews=f.useActualReviews(),v2=new PaperBasketV2Repository(host,f.papers);
const service=createPaperBasketAdaptationService({...host,mutateInTransaction:(...args)=>v2.mutateInTransaction(...args)},reviews);
const schema={schemaVersion:'xiaozhi.paper-basket.v2',sessionId:sid};
const signal=()=>new AbortController().signal;
const check=async(name,run)=>{await run();report.checks.push({name,pass:true});console.log('PASS '+name);};
const count=()=>db.prepare('SELECT COUNT(*) n FROM ai_confirmation_items').get().n;
const draft={title:'父题变式',reason:'修改条件并保持知识点，等待教师核对。',subject:'数学',grade:'初二',knowledgePoint:'合成合同',items:[{questionType:'written',difficulty:'medium',stem:'将椭圆改为x²/9+y²/4=1，联立含参数直线，讨论相交、相切、退化与弦中点范围。',answer:'分条件讨论的教学草稿，需人工核对。',analysis:'列出定义域、方程与判别式，按参数分类；每步与题干条件对应，完整结论交教师审核。',options:null}]};
async function setup(bind=true){
  const parent=f.question(randomUUID());
  let b=await v2.create({...schema,requestId:randomUUID(),blueprint:{title:'改编发现合同',subject:'数学',grade:'初二',durationMinutes:40,totalPoints:15,mode:'hybrid',sections:[{id:'a',label:'混合',questionType:'解答题',count:3,points:5,generatedCount:2}]}});
  b=await v2.mutate({...schema,basketId:b.id,requestId:randomUUID(),expectedRevision:b.revision,operation:{type:'add',sectionId:'a',questionId:parent.id,expectedSourceVersion:questionVersion(parent)}});
  const e=b.entries[0],input={schemaVersion:PAPER_ADAPTATION_SCHEMA,sessionId:sid,studentId:student,basketId:b.id,requestId:'intent_'+randomUUID(),expectedBasketRevision:b.revision,entryId:e.entryId,instanceRevision:e.instance.instanceRevision,parentQuestionId:parent.id,parentSourceVersion:questionVersion(parent),requirements:'保持考点，更换条件',intent:'replace'};
  const view=await service.prepare(input),runId='run_'+randomUUID(),run={sessionId:sid,studentId:student,runId,prompt:view.prompt};
  db.prepare('INSERT INTO ai_agent_runs(id,session_id,student_id,prompt,status,route,sub_intent) VALUES(?,?,?,?,?,?,?)').run(runId,sid,student,view.prompt,'running','knowledge_retrieval','pi_education');
  if(bind)await service.bindRun(run);
  return {parent,b,e,input,view,run,ref:{schemaVersion:PAPER_ADAPTATION_SCHEMA,sessionId:sid,studentId:student,basketId:b.id,intentId:view.intentId}};
}
async function context(x,aliases=new Map(),lease=()=>true,abort=signal()){
  return preparePaperAdaptationContext(service,x.run,aliases,abort,lease);
}
async function denied(x,pattern=/permission_denied|conflict|source_changed|invalid_input|cancelled/,lease=()=>true,abort=signal()){
  const aliases=new Map();
  await assert.rejects(context(x,aliases,lease,abort),pattern);
  assert.equal(aliases.size,0);
}
function changeRecord(x,change){
  const row=db.prepare('SELECT adaptation_json FROM paper_basket_operations WHERE session_id=? AND request_id=?').get(sid,x.view.intentId);
  const record=JSON.parse(row.adaptation_json);change(record);
  db.prepare('UPDATE paper_basket_operations SET adaptation_json=?,input_hash=? WHERE session_id=? AND request_id=?').run(JSON.stringify(record),adaptationHash(record.input),sid,x.view.intentId);
}
function provider(x,aliases,observed=new Map(),current=()=>true){
  let reads=0;
  const store={questionReviews:reviews,listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text}),searchQuestionBank:async()=>[],getQuestionNotebookEntry:async id=>{reads++;return host.read(id);}};
  return {store,observed,reads:()=>reads,tools:createQuestionContextProvider(store,current,(ref,source)=>observed.set(ref,source),aliases)};
}
const execute=(tool,args,abort=signal())=>tool.execute(randomUUID(),args,abort);
const code=result=>result.details?.error?.code;
try{
  await check('Empty search still discovers the bound frozen parent; only real read grants propose authority',async()=>{
    const x=await setup(),aliases=new Map(),p=provider(x,aliases);
    const search=await execute(p.tools[0],{query:'不存在的短描述'});
    assert.equal(search.isError,undefined);assert.equal(aliases.size,0);
    const text=await context(x,aliases),[reference]=aliases.keys();
    assert(text.includes(reference)&&text.includes(x.input.parentSourceVersion));
    assert.equal(aliases.get(reference).id,x.parent.id);assert.equal(aliases.get(reference).purpose,undefined);
    assert.equal(p.observed.size,0);assert.equal(p.reads(),0);
    assert.equal(await context(x,aliases),text);assert.equal(aliases.size,1);
    let pending;
    const emitted=new Promise(resolve=>{pending=resolve;});
    const coordinator=createQuestionReviewCoordinator({store:p.store,isCurrent:()=>true,canDecide:()=>true,emit:(_s,_r,v)=>{if(v.state==='pending')pending(v);}});
    const propose=coordinator.tools(sid,x.run.runId,p.observed)[0],raw={...draft,sourceReferences:[reference]},before=count();
    assert((await execute(propose,raw)).isError);assert.equal(count(),before);
    assert.equal(code(await execute(p.tools[1],{reference,version:x.input.parentSourceVersion,purpose:'answer_enrichment'})),'permission_denied');
    assert.equal(p.observed.size,0);assert.equal(p.reads(),0);
    assert.equal(code(await execute(p.tools[1],{reference:x.parent.id,version:x.input.parentSourceVersion})),'invalid_input');
    assert.equal(code(await execute(p.tools[1],{reference,version:'f'.repeat(64)})),'source_changed');
    const read=await execute(p.tools[1],{reference,version:x.input.parentSourceVersion});
    assert.equal(read.isError,undefined);assert(p.reads()>=2);
    assert.equal(p.observed.get(reference).questionId,x.parent.id);
    assert.equal(p.observed.get(reference).version,x.input.parentSourceVersion);
    const abort=new AbortController(),result=execute(propose,raw,abort.signal);
    let timer;
    try{
      const item=await Promise.race([emitted,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('real proposal did not reach pending')),5000);})]);
      assert.equal(item.runId,x.run.runId);assert.equal(count(),before+1);
    }finally{clearTimeout(timer);abort.abort();coordinator.cancel(x.run.runId);await result.catch(error=>assert.match(String(error),/cancelled/));}
    const fresh=provider(x,new Map());
    assert.equal(code(await execute(fresh.tools[1],{reference,version:x.input.parentSourceVersion})),'source_changed');
    assert.equal(fresh.observed.size,0);
  });
  await check('Purpose-specific alias cannot substitute for ordinary adaptation discovery',async()=>{
    const x=await setup(),aliases=new Map(),source=await service.boundParent(x.run,signal(),()=>true);
    prepareQuestionAliases(aliases,[source],'answer_enrichment').commit();
    const text=await context(x,aliases);assert.equal(aliases.size,2);assert(text.includes('题目2'));
    const p=provider(x,aliases);
    assert.equal(code(await execute(p.tools[1],{reference:'题目1',version:source.version})),'permission_denied');
    assert.equal(p.observed.size,0);
    assert.equal((await execute(p.tools[1],{reference:'题目2',version:source.version})).isError,undefined);
    assert.equal(p.observed.size,1);
  });
  await check('Unbound, wrong owner/student/run/prompt/intent never produce discovery',async()=>{
    const x=await setup(false);await denied(x,/permission_denied/);await service.bindRun(x.run);
    for(const patch of [{sessionId:f.other},{studentId:''},{runId:'run_'+randomUUID()},{runId:'wrong'},{prompt:x.run.prompt+'其它要求'},{prompt:x.run.prompt.replace(x.view.intentId,'intent_'+randomUUID())}])await denied({...x,run:{...x.run,...patch}});
    assert.equal(await context({...x,run:{...x.run,prompt:'普通教学消息'}}),'');
    db.prepare('UPDATE ai_agent_runs SET student_id=? WHERE id=?').run('',x.run.runId);await denied(x,/permission_denied/);
  });
  await check('Actual succeeded is binder-idempotent, never a live context lease; terminal/wrong-purpose runs denied',async()=>{
    const x=await setup();
    db.prepare("UPDATE ai_agent_runs SET status='succeeded' WHERE id=?").run(x.run.runId);
    assert.equal(await service.bindRun(x.run),true);await denied(x,/permission_denied/);
    for(const status of ['completed','failed','blocked','cancelled','interrupted']){
      db.prepare('UPDATE ai_agent_runs SET status=? WHERE id=?').run(status,x.run.runId);
      await denied(x,/permission_denied/);await assert.rejects(service.bindRun(x.run),/permission_denied/);
    }
    db.prepare("UPDATE ai_agent_runs SET status='running',route='other' WHERE id=?").run(x.run.runId);await denied(x,/permission_denied/);
    db.prepare("UPDATE ai_agent_runs SET route='knowledge_retrieval',sub_intent='other' WHERE id=?").run(x.run.runId);await denied(x,/permission_denied/);
    db.prepare("UPDATE ai_agent_runs SET sub_intent='pi_education',prompt=? WHERE id=?").run('forged',x.run.runId);await denied(x,/permission_denied/);
    const y=await setup(false);db.prepare("UPDATE ai_agent_runs SET status='succeeded' WHERE id=?").run(y.run.runId);await assert.rejects(service.bindRun(y.run),/conflict/);await denied(y,/permission_denied/);
  });
  await check('Cancellation, archived owner, wrong basket/entry/instance/frozen version rejected',async()=>{
    const x=await setup();await service.cancel({...x.ref,requestId:'cancel_'+randomUUID()});await denied(x,/conflict/);
    for(const [mutate,error] of [[r=>{r.input.basketId='xibasket_'+randomUUID();},/permission_denied/],[r=>{r.input.entryId='xibasketentry_'+randomUUID();},/conflict/],[r=>{r.input.instanceRevision++;},/conflict/],[r=>{r.input.parentSourceVersion='e'.repeat(64);},/conflict/],[r=>{r.input.parentQuestionId='question_'+randomUUID();},/conflict/]]){
      const y=await setup();changeRecord(y,mutate);await denied(y,error);
    }
    const z=await setup();db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run('2026-11-04',sid);
    try{await denied(z,/permission_denied/);}finally{db.prepare('UPDATE ai_conversation_sessions SET archived_at=NULL WHERE id=?').run(sid);}
  });
  await check('Real basket instance edit, canonical drift and source-file drift reject without latest fallback',async()=>{
    const x=await setup();await v2.mutate({...schema,basketId:x.b.id,requestId:randomUUID(),expectedRevision:x.b.revision,operation:{type:'editEntry',entryId:x.e.entryId,expectedInstanceRevision:x.e.instance.instanceRevision,content:{question:{mode:'edited',blocks:[{type:'text',text:'教师已修改条件'}]},answer:{mode:'source'},analysis:{mode:'source'}}}});await denied(x,/conflict/);
    const y=await setup();f.put({...y.parent,answer:'来源换版'});await denied(y,/source_changed/);
    const z=await setup();fs.writeFileSync(f.sources.get(z.parent.id).file,'源文件变化');await denied(z,/source_changed/);
  });
  await check('Aborted/stale lease before and during source validation leaves aliases untouched',async()=>{
    const x=await setup(),abort=new AbortController();abort.abort();await denied(x,/AbortError/,()=>true,abort.signal);await denied(x,/cancelled/,()=>false);
    let current=true;f.validationHook(()=>{current=false;});
    try{await denied(x,/cancelled/,()=>current);}finally{f.validationHook(undefined);}
    const during=new AbortController();f.validationHook(()=>during.abort());
    try{await denied(x,/AbortError/,()=>true,during.signal);}finally{f.validationHook(undefined);}
  });
  await check('Discovery followed by source drift cannot become observed or proposal authority',async()=>{
    const x=await setup(),aliases=new Map();await context(x,aliases);
    const p=provider(x,aliases);f.put({...x.parent,answer:'发现之后换版'});
    assert.equal(code(await execute(p.tools[1],{reference:'题目1',version:x.input.parentSourceVersion})),'source_changed');assert.equal(p.observed.size,0);
    const coordinator=createQuestionReviewCoordinator({store:p.store,isCurrent:()=>true,canDecide:()=>true,emit:()=>{throw Error('must not emit');}}),before=count();
    assert((await execute(coordinator.tools(sid,x.run.runId,p.observed)[0],{...draft,sourceReferences:['题目1']})).isError);assert.equal(count(),before);
  });
  report.success=true;
}catch(error){report.error=String(error.stack||error);console.error(error);process.exitCode=1;}
finally{f.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('REPORT '+path.join(output,'report.json'));}
