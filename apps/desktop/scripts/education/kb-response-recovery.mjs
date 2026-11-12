import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {probe} from './kb-native-dispatch-boundaries.mjs';
const {NATIVE_REVIEW_RESPONSE,NATIVE_REVIEW_CHECKS}=await import('../../src/shared/material-ai-native-review.ts');
const {validAiAction}=await import('../../src/shared/material-ai.ts');
const results=[];
const hash=value=>createHash('sha256').update(value).digest('hex');
function provider(kind,input,response){
  const question=response.questions[0];
  Object.assign(question,{answer:'',analysis:'',answerOrigin:'missing',analysisOrigin:'missing',requiresImage:true,
    issues:['requires_image','incomplete_question']});
  question.projection.figures={state:'missing',text:''};
  response.outcome='needs_review';
  if(kind==='outcome')response.outcome='no_questions';
  if(kind==='difficulty')question.difficulty='';
  if(!input.nativeReviewSha256)return JSON.stringify(response);
  if(kind==='network')throw Error('outcome_unknown');
  const review={schemaVersion:NATIVE_REVIEW_RESPONSE,firstSha256:input.nativeReviewSha256,number:question.number,
    decision:'needs_review',checks:Object.fromEntries(NATIVE_REVIEW_CHECKS.map(key=>[key,
      ['answer','analysis','figures'].includes(key)?'uncertain':key in question.projection&&question.projection[key].state==='not_applicable'?'not_applicable':'verified'])),
    corrected:null,issues:['requires_image','incomplete_question']};
  if(kind==='root-issues'){
    review.decision='corrected';review.corrected={issues:['requires_image','incomplete_question']};delete review.issues;
  }
  if(kind==='digest')review.firstSha256='f'.repeat(64);
  return JSON.stringify(review);
}
async function run(name,kind,{automatic=false,tamper=false,privateSource=false,network=false}={}){
  process.env.OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY=automatic?'1':'0';
  let evidence={};
  const result=await probe('field_recovery_fixture',{provider:(_mode,input,response)=>provider(kind,input,response),
    afterDrain:async({repo,db,batchId,sent})=>{
      const initial=db.prepare('SELECT status,error FROM material_ai_units').get();
      if(automatic){assert.equal(initial.status,'review');return;}
      const expected=network?'outcome_unknown':'failed';assert.equal(initial.status,expected);
      await repo.action({schemaVersion:'xiaozhi.material-ai.v1',batchId,action:'pause'});
      db.exec('CREATE TABLE material_folder_ai_units(ai_batch_id TEXT,state TEXT,error TEXT)');
      db.prepare('INSERT INTO material_folder_ai_units VALUES(?,?,?)').run(batchId,'review','outcome_unknown');
      const beforeCalls=sent.length;
      const receipts=()=>JSON.stringify(db.prepare('SELECT * FROM material_ai_response_receipts ORDER BY rowid').all());
      const originalReceiptSha=hash(receipts());
      if(tamper)db.prepare("UPDATE material_ai_response_receipts SET body_sha=? WHERE phase='final'").run('0'.repeat(64));
      if(privateSource)db.prepare('UPDATE resource_chunks SET contains_personal_data=1').run();
      const recover=()=>repo.action({schemaVersion:'xiaozhi.material-ai.v1',batchId,action:'recover_response'});
      if(tamper||privateSource){
        await assert.rejects(recover(),tamper?/source_changed/:/privacy_blocked/);
        assert.equal(db.prepare('SELECT COUNT(*) n FROM material_ai_members').get().n,0);
        assert.equal(db.prepare('SELECT COUNT(*) n FROM material_ai_response_recoveries').get().n,0);
      }else{
        await recover();
        const once=JSON.stringify(db.prepare('SELECT * FROM material_ai_units').get());
        await recover();
        assert.equal(JSON.stringify(db.prepare('SELECT * FROM material_ai_units').get()),once);
        assert.equal(hash(receipts()),originalReceiptSha);
        const folder=db.prepare('SELECT state,error FROM material_folder_ai_units').get();
        const current=db.prepare('SELECT status,error FROM material_ai_units').get();
        if(!network){assert.equal(folder.state,current.status);assert.equal(folder.error,current.error||'needs_review');}
      }
      assert.equal(sent.length,beforeCalls);
      evidence={beforeStatus:initial.status,providerCalls:sent.length,
        audits:db.prepare('SELECT policy,normalized_sha,error,changes_json FROM material_ai_response_recoveries').all()};
    }});
  if(['missing','root-issues'].includes(kind)&&!tamper&&!privateSource){
    assert.equal(result.unitStatus,'review');assert.equal(result.published.length,1);
    assert.equal(result.published[0].state,'ai_needs_review');assert.equal(result.published[0].eligible,false);
    assert.equal(result.calls,2);
  }
  if(['outcome','difficulty'].includes(kind)){
    assert.equal(result.unitStatus,'failed');assert.equal(result.error,'response_'+(kind==='outcome'?'outcome_conflict':'difficulty_missing'));
    assert.equal(result.calls,1);assert.equal(result.published.length,0);
  }
  if(network){assert.equal(result.unitStatus,'outcome_unknown');assert.equal(result.published.length,0);}
  if(kind==='digest'){assert.equal(result.unitStatus,'failed');assert.equal(result.published.length,0);}
  results.push({name,status:result.unitStatus,error:result.error,calls:result.calls,published:result.published.length,...evidence});
}
try{
  assert(validAiAction({schemaVersion:'xiaozhi.material-ai.v1',batchId:'aibatch_00000000-0000-4000-8000-000000000001',action:'recover_response'}));
  assert(!validAiAction({schemaVersion:'xiaozhi.material-ai.v1',batchId:'aibatch_00000000-0000-4000-8000-000000000001',action:'recover_response',acceptDuplicateCharge:true}));
  await run('Historical missing-role checks recover as review without dispatch','missing');
  await run('Historical root issues are copied only from explicit correction evidence','root-issues');
  await run('Current provider missing-role response is repaired automatically','missing',{automatic:true});
  await run('Current provider root-issues omission is repaired automatically','root-issues',{automatic:true});
  await run('Contradictory no-question output remains an explicit failure','outcome');
  await run('Empty difficulty is preserved as a specific failure','difficulty');
  await run('Tampered stored response cannot publish','missing',{tamper:true});
  await run('Current source privacy is checked again on recovery','missing',{privateSource:true});
  await run('A real unknown result keeps its identity and is never locally replayed','network',{network:true});
  await run('Wrong first-draft binding remains rejected','digest');
  console.log(JSON.stringify({passed:results.length+1,results,
    scope:'Actual SQLite repository/writer with controlled provider and native proof fixtures. Real stored corpus and visible UI remain separate.'}));
}finally{delete process.env.OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY;}
