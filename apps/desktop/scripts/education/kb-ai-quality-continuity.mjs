import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {probe} from './kb-native-dispatch-boundaries.mjs';
const {validAiBatch} = await import('../../src/shared/material-ai.ts');
const {validAiNativeSelector} = await import('../../src/shared/material-ai-native-input.ts');
const {MATERIAL_HIGH_INFERENCE} = await import('../../src/shared/material-ai-inference.ts');
const {materialInferencePayload,materialInferenceLimits} = await import('../../src/main/assets/material-ai-reasoning.ts');
const {parseNativeAiReview,NATIVE_REVIEW_CHECKS,NATIVE_REVIEW_RESPONSE,NATIVE_FIELD_REVIEW_V3} = await import('../../src/shared/material-ai-native-review.ts');
const {recoverNativeResponse,AI_ANSWER_CONFLICT_RECOVERY,AI_UNCERTAIN_REVIEW_RECOVERY} = await import('../../src/shared/material-ai-response-recovery.ts');
const {MaterialAiResponses} = await import('../../src/main/assets/material-ai-responses.ts');
const {completeMaterialAi} = await import('../../src/main/assets/material-ai-provider.ts');
const results = [];
const hash = text => createHash('sha256').update(text).digest('hex');
async function check(name, action) {await action();results.push(name);console.log('PASS '+name);}
const id = 'resource_11111111-1111-4111-8111-111111111111';
const batch = {schemaVersion:'xiaozhi.material-ai.v1',resourceId:id,version:'a'.repeat(64),settingsRevision:1,start:1,count:1,maxCalls:3,images:true,cloudConsent:true,publicMaterial:true};
await check('Quality and standard are explicit grants while missing mode keeps legacy callers valid',()=>{
  for (const mode of ['quality','standard']) assert(validAiBatch({...batch,processingMode:mode}));
  assert(validAiBatch(batch));
  for (const mode of ['legacy','future',undefined,null,1]) assert(!validAiBatch({...batch,processingMode:mode}));
});
const selector = {schemaVersion:'xiaozhi.material-ai-native-input.v1',base:{schemaVersion:'xiaozhi.word-question-proof.v1',resourceId:id,version:'a'.repeat(64),documentSha:'b'.repeat(64),ordinal:1},sourceDigest:'c'.repeat(64)};
await check('Native high inference survives serialization and old selectors remain valid',()=>{
  assert(validAiNativeSelector(selector));
  assert(validAiNativeSelector(JSON.parse(JSON.stringify({...selector,inferencePolicy:MATERIAL_HIGH_INFERENCE}))));
  for (const value of ['future','',undefined,null,1]) assert(!validAiNativeSelector({...selector,inferencePolicy:value}));
  assert(!validAiNativeSelector({...selector,extra:true}));
});
await check('Native requests reuse the high-thinking adapter and bounded response budget',()=>{
  const old = {model:'deepseek-flash',temperature:0,reasoning_effort:'none',max_tokens:8192};
  assert.deepEqual(materialInferencePayload(old),old);
  const value = materialInferencePayload(old,undefined,MATERIAL_HIGH_INFERENCE);
  assert.equal(value.thinking.type,'enabled');assert.equal(value.reasoning_effort,'high');
  assert.equal(value.max_tokens,32768);assert(!Object.hasOwn(value,'temperature'));
  assert.deepEqual(materialInferenceLimits(undefined,MATERIAL_HIGH_INFERENCE),{timeoutMs:300000,responseBytes:1048576});
});
const priorHigh = process.env.OMNI_EDU_AI_REASONING_HIGH;
try {
  delete process.env.OMNI_EDU_AI_REASONING_HIGH;
  await check('Real native dispatch freezes quality for both passes even if the environment later changes',async()=>{
    const policies = [];
    const result = await probe('field_verified',{processingMode:'quality',provider:(_mode,input,response)=>{
      policies.push(input.inferencePolicy);
      if (!input.previous) {process.env.OMNI_EDU_AI_REASONING_HIGH='0';return JSON.stringify(response);}
      return JSON.stringify({schemaVersion:NATIVE_REVIEW_RESPONSE,firstSha256:input.nativeReviewSha256,number:input.previous.questions[0].number,
        decision:'verified',checks:Object.fromEntries(NATIVE_REVIEW_CHECKS.map(key=>[key,key in input.previous.questions[0].projection&&input.previous.questions[0].projection[key].state==='not_applicable'?'not_applicable':'verified'])),corrected:null,issues:[]});
    },afterDrain:async({db})=>{
      const unit=JSON.parse(db.prepare('SELECT input_json FROM material_ai_units').get().input_json);
      assert.equal(unit.native.inferencePolicy,MATERIAL_HIGH_INFERENCE);
      assert.equal(JSON.parse(db.prepare('SELECT config_json FROM material_ai_batches').get().config_json).processingMode,'quality');
    }});
    assert.deepEqual(policies,[MATERIAL_HIGH_INFERENCE,MATERIAL_HIGH_INFERENCE]);
    assert.equal(result.unitStatus,'complete');assert.equal(result.calls,2);
  });
} finally {if(priorHigh===undefined)delete process.env.OMNI_EDU_AI_REASONING_HIGH;else process.env.OMNI_EDU_AI_REASONING_HIGH=priorHigh;}

const stem='以下物理量中属于国际单位制基本单位的是哪一项？';
const first={schemaVersion:'xiaozhi.material-ai-native-response.v1',outcome:'questions',questions:[{number:'1',stem,answer:'B',analysis:'首稿推导。',subject:'物理',grade:'高中',knowledgePoint:'单位制',questionType:'选择题',difficulty:'easy',answerOrigin:'ai_generated',analysisOrigin:'ai_generated',requiresImage:false,issues:[],
  projection:Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(name=>[name,{state:name==='statement'?'provided':'not_applicable',text:name==='statement'?stem:''}]))}]};
const firstRaw=JSON.stringify(first),digest=hash(firstRaw);
await check('Production native provider emits supported high-thinking HTTP options and rejects an unknown policy before transport',async()=>{
  const originalFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async(_url,options)=>{
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({choices:[{message:{content:firstRaw},finish_reason:'stop'}]}),{status:200});
  };
  try{
    const input={model:'deepseek-flash',apiKey:'controlled-never-sent',text:'{}',native:true,nativeReviewPolicy:'native-field-review.v2',inferencePolicy:MATERIAL_HIGH_INFERENCE,
      images:[{role:'question',index:0,mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='}]};
    await completeMaterialAi(input,new AbortController().signal);
    assert.equal(requests.length,1);assert.equal(requests[0].thinking.type,'enabled');
    assert.equal(requests[0].reasoning_effort,'high');assert.equal(requests[0].max_tokens,32768);
    assert(!Object.hasOwn(requests[0],'temperature'));
    await assert.rejects(()=>completeMaterialAi({...input,inferencePolicy:'future'},new AbortController().signal),/invalid_input/);
    assert.equal(requests.length,1);
  }finally{globalThis.fetch=originalFetch;}
});
const review={schemaVersion:NATIVE_REVIEW_RESPONSE,firstSha256:digest,number:'1',decision:'corrected',checks:Object.fromEntries(NATIVE_REVIEW_CHECKS.map(name=>[name,['answer','analysis'].includes(name)?'uncertain':name==='statement'?'verified':'not_applicable'])),corrected:{answer:'C',analysis:'复核中仍有冲突。',issues:[]},issues:[]};
await check('Bound uncertain answer disagreement recovers only to a versioned explicit review',()=>{
  const raw=JSON.stringify(review);
  assert.throws(()=>parseNativeAiReview(raw,first,digest),/invalid_response/);
  const result=recoverNativeResponse(raw,firstRaw,digest,'native-field-review.v2');
  assert.equal(result.policy,AI_ANSWER_CONFLICT_RECOVERY);
  const parsed=parseNativeAiReview(result.raw,first,digest);
  assert.equal(parsed.response.outcome,'needs_review');assert.deepEqual(parsed.response.questions[0].issues,['answer_conflict']);
  assert.equal(first.questions[0].answer,'B');assert.equal(JSON.stringify(review),raw);
});
for (const [name,modify] of [
  ['Wrong first draft',v=>{v.firstSha256='f'.repeat(64);}],
  ['Wrong question',v=>{v.number='2';}],
  ['Unknown field',v=>{v.extra=true;}],
  ['Invalid correction',v=>{v.corrected.projection={statement:{state:'provided',text:'changed'}};}],
]) await check(name+' cannot authorize conflict recovery',()=>{
  const value=structuredClone(review);modify(value);
  assert.throws(()=>recoverNativeResponse(JSON.stringify(value),firstRaw,digest,'native-field-review.v2'),/invalid_response/);
});
await check('Agreement with uncertain analysis becomes v3 review without inventing OCR or answer conflict',()=>{
  const value=structuredClone(review);value.corrected={analysis:'仍需核对推导。'};value.checks.answer='verified';
  const result=recoverNativeResponse(JSON.stringify(value),firstRaw,digest,'native-field-review.v2');
  assert.equal(result.policy,AI_UNCERTAIN_REVIEW_RECOVERY);
  const parsed=parseNativeAiReview(result.raw,first,digest,NATIVE_FIELD_REVIEW_V3);
  assert.equal(parsed.response.outcome,'needs_review');assert.equal(parsed.response.questions[0].answer,'B');
  assert.deepEqual(parsed.response.questions[0].issues,[]);assert.equal(parsed.review.checks.analysis,'uncertain');
  assert.throws(()=>parseNativeAiReview(JSON.stringify(value),first,digest,'native-field-review.v2'),/invalid_response/);
  value.decision='verified';value.corrected=null;
  assert.throws(()=>recoverNativeResponse(JSON.stringify(value),firstRaw,digest,'native-field-review.v2'),/invalid_response/);
});
function conflictingProvider(_mode,input,response){
  if(!input.previous){Object.assign(response.questions[0],{answer:'B',analysis:'第一遍推导。',answerOrigin:'ai_generated',analysisOrigin:'ai_generated'});return JSON.stringify(response);}
  const question=input.previous.questions[0];
  return JSON.stringify({schemaVersion:NATIVE_REVIEW_RESPONSE,firstSha256:input.nativeReviewSha256,number:question.number,decision:'corrected',
    checks:Object.fromEntries(NATIVE_REVIEW_CHECKS.map(name=>[name,['answer','analysis'].includes(name)?'uncertain':name in question.projection&&question.projection[name].state==='not_applicable'?'not_applicable':'verified'])),
    corrected:{answer:'C',analysis:'第二遍仍有冲突。',issues:[]},issues:[]});
}
const priorRecovery=process.env.OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY;
try{
  await check('Current uncertain response automatically publishes one explicit review with its v2 audit',async()=>{
    process.env.OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY='1';
    const result=await probe('field_conflicting_response',{provider:conflictingProvider,afterDrain:async({db})=>{
      const audits=db.prepare('SELECT policy FROM material_ai_response_recoveries').all();
      assert.deepEqual(audits.map(row=>row.policy),[AI_ANSWER_CONFLICT_RECOVERY]);
    }});
    assert.equal(result.unitStatus,'review');assert.equal(result.calls,2);assert.equal(result.published.length,1);
    assert(result.published[0].issues.includes('answer_conflict'));assert.equal(result.published[0].eligible,false);
  });
  await check('Historical failed v1 audit and original receipt survive an idempotent v2 local restore',async()=>{
    process.env.OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY='0';
    const result=await probe('field_conflicting_response',{provider:conflictingProvider,afterDrain:async({repo,db,batchId,sent})=>{
      assert.equal(db.prepare('SELECT status FROM material_ai_units').get().status,'failed');
      const responses=new MaterialAiResponses({all:async(sql,p=[])=>db.prepare(sql).all(...p),run:async(sql,p=[])=>db.prepare(sql).run(...p)});
      const receipt=await responses.latest(batchId,1);
      await responses.recordRecovery(receipt,'native-response-recovery.v1','','invalid_response',[]);
      const old=JSON.stringify(db.prepare("SELECT * FROM material_ai_response_recoveries WHERE policy='native-response-recovery.v1'").all());
      const receipts=JSON.stringify(db.prepare('SELECT * FROM material_ai_response_receipts ORDER BY rowid').all());
      await repo.action({schemaVersion:'xiaozhi.material-ai.v1',batchId,action:'pause'});
      await repo.action({schemaVersion:'xiaozhi.material-ai.v1',batchId,action:'recover_response'});
      await repo.action({schemaVersion:'xiaozhi.material-ai.v1',batchId,action:'recover_response'});
      assert.equal(JSON.stringify(db.prepare("SELECT * FROM material_ai_response_recoveries WHERE policy='native-response-recovery.v1'").all()),old);
      assert.equal(JSON.stringify(db.prepare('SELECT * FROM material_ai_response_receipts ORDER BY rowid').all()),receipts);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM material_ai_response_recoveries').get().n,2);
      assert.equal(sent.length,2);
    }});
    assert.equal(result.unitStatus,'review');assert.equal(result.published.length,1);
  });
  await check('Automatic v3 review retains source authority during cold reading and rejects a changed derivation audit',async()=>{
    process.env.OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY='1';
    const result=await probe('field_uncertain_analysis',{provider:(mode,input,response)=>{
      const value=JSON.parse(conflictingProvider(mode,input,response));
      if(input.previous){value.corrected={analysis:'该步推导仍需核对。'};value.checks.answer='verified';}
      return JSON.stringify(value);
    },afterDrain:async({repo,db,saved,source})=>{
      assert.equal(saved.length,1);assert.equal(saved[0].archive.ai.policy,'native-reviewed.v3');
      assert(!saved[0].archive.issues.includes('answer_conflict'));
      await repo.nativeTranscription(saved[0],source,new AbortController().signal);
      db.prepare('UPDATE material_ai_response_recoveries SET normalized_sha=? WHERE policy=?').run('0'.repeat(64),AI_UNCERTAIN_REVIEW_RECOVERY);
      await assert.rejects(()=>repo.nativeTranscription(saved[0],source,new AbortController().signal),/source_changed/);
    }});
    assert.equal(result.unitStatus,'review');assert.equal(result.published[0].eligible,false);
  });
}finally{if(priorRecovery===undefined)delete process.env.OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY;else process.env.OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY=priorRecovery;}

await check('Versioned audit migration retains prior rows, permits a new policy and rolls back failed DDL',async()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE material_ai_response_receipts(id TEXT PRIMARY KEY);
      INSERT INTO material_ai_response_receipts VALUES('receipt');
      CREATE TABLE material_ai_response_recoveries(response_id TEXT PRIMARY KEY REFERENCES material_ai_response_receipts(id),input_sha TEXT NOT NULL,body_sha TEXT NOT NULL,policy TEXT NOT NULL,normalized_sha TEXT NOT NULL,error TEXT NOT NULL,changes_json TEXT NOT NULL,created_at TEXT NOT NULL);
      INSERT INTO material_ai_response_recoveries VALUES('receipt','input','body','native-response-recovery.v1','','invalid_response','[]','old-time')`);
    const before=JSON.stringify(db.prepare('SELECT * FROM material_ai_response_recoveries').all());
    let fail=true;
    const responses=new MaterialAiResponses({all:async(sql,p=[])=>db.prepare(sql).all(...p),run:async(sql,p=[])=>{if(fail&&sql.startsWith('ALTER TABLE material_ai_response_recoveries_next'))throw Error('injected');db.prepare(sql).run(...p);}});
    async function migrate(){db.exec('BEGIN IMMEDIATE');try{await responses.migrate();db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
    await assert.rejects(migrate(),/injected/);
    assert.equal(JSON.stringify(db.prepare('SELECT * FROM material_ai_response_recoveries').all()),before);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='material_ai_response_recoveries_next_v2'").get().n,0);
    fail=false;await migrate();await migrate();
    const receipt={id:'receipt',inputSha:'input',bodySha:'body'};
    await responses.recordRecovery(receipt,AI_ANSWER_CONFLICT_RECOVERY,'derived','',['uncertain-changed-answer-conflict']);
    await responses.recordRecovery(receipt,AI_ANSWER_CONFLICT_RECOVERY,'derived','',['uncertain-changed-answer-conflict']);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM material_ai_response_recoveries').get().n,2);
    assert.equal(JSON.stringify(db.prepare("SELECT * FROM material_ai_response_recoveries WHERE policy='native-response-recovery.v1'").all()),before);
    await assert.rejects(()=>responses.recordRecovery(receipt,AI_ANSWER_CONFLICT_RECOVERY,'tampered','',[]),/conflict/);
  } finally {db.close();}
});
if(process.argv[2]) await check('The original saved DeepSeek B/C receipt becomes review while the strict reader still rejects the raw format',()=>{
  const root=process.argv[2];const content=name=>JSON.parse(fs.readFileSync(root+'/'+name)).choices[0].message.content;
  const rawFirst=content('word-drawing-response-first.json'),rawFinal=content('word-drawing-response-final.json');
  const result=recoverNativeResponse(rawFinal,rawFirst,hash(rawFirst),'native-field-review.v2');
  assert.equal(result.policy,AI_ANSWER_CONFLICT_RECOVERY);
  const final=parseNativeAiReview(result.raw,JSON.parse(rawFirst),hash(rawFirst));
  assert.equal(final.response.outcome,'needs_review');assert(final.response.questions[0].issues.includes('answer_conflict'));
});
if(process.argv[2]) await check('The real high-thinking result preserves answer agreement and explicit analysis uncertainty',()=>{
  const root=process.argv[2],content=phase=>JSON.parse(fs.readFileSync(root+'/ai-quality-native-'+phase+'-envelope.json')).choices[0].message.content;
  const rawFirst=content('first'),rawFinal=content('final');
  const result=recoverNativeResponse(rawFinal,rawFirst,hash(rawFirst),'native-field-review.v2');
  assert.equal(result.policy,AI_UNCERTAIN_REVIEW_RECOVERY);
  const parsed=parseNativeAiReview(result.raw,JSON.parse(rawFirst),hash(rawFirst),NATIVE_FIELD_REVIEW_V3);
  assert.equal(parsed.response.outcome,'needs_review');assert.deepEqual(parsed.response.questions[0].issues,[]);
  assert.equal(parsed.review.checks.analysis,'uncertain');
});
console.log(JSON.stringify({passed:results.length,results,scope:'Actual SQLite migrations and native dispatcher plus strict source-bound response recovery. Controlled providers, zero network calls.'}));
