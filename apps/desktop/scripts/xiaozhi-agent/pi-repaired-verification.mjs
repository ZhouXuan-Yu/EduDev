import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const {createRunResultReadback}=await import('../../src/main/xiaozhi-agent/verification/result-readback.ts');
const {createRunVerification}=await import('../../src/main/xiaozhi-agent/verification/run-observer.ts');
const {validTaskVerification,verificationOutstandingFailures,verificationLabel,verificationDescription}=await import('../../src/shared/xiaozhi-verification.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-repaired-verification-'));
const report={ok:false,output,checks:[],scope:'Bound result/native/observer contract fixtures; actual repository and formal Pi covered separately;0model/paid'};
const runId='run_repaired',tool='education_propose_questions',version='a'.repeat(64),text=p=>[{type:'text',text:JSON.stringify(p)}];
const predecessor=i=>({callId:'bad_'+i,reference:'修复_'+String(i+1).repeat(24),attempt:i});
const failure=i=>text({success:false,code:'quality_blocked',submittedForTeacherReview:true,repairReference:predecessor(i).reference,repairAttempt:i});
const success=text({success:true,state:'confirmed',count:2,generationKind:'ai_original'});
async function evaluate(options={}){
 const observer=createRunVerification(runId),failed=options.failures??1;
 for(let i=0;i<failed;i++){observer.observe({kind:'tool_start',callId:'bad_'+i,tool});observer.observe({kind:'tool_end',callId:'bad_'+i,tool,success:false});}
 observer.observe({kind:'tool_start',callId:'saved',tool});observer.observe({kind:'tool_end',callId:'saved',tool,success:true});
 if(options.invalid)observer.observe({kind:'tool_end',callId:'missing_start',tool,success:true});
 let base=options.base||observer.finish({failed:!!options.hostFailed,stopped:!!options.stopped});
 const binding={digest:version,version,repairFailures:options.links??[predecessor(0)],read:async()=>({digest:options.changed?'b'.repeat(64):version,version})};
 const reader=createRunResultReadback({runId,readLocal:async()=>{},verifyImage:async()=>false,canResolveFailures:()=>options.allow??observer.canResolveFailures(),bindEffect:async()=>binding});
 for(let i=0;i<failed;i++)reader.capture('bad_'+i,tool,{content:failure(i)},true);
 reader.capture('saved',tool,{content:success},false);
 const native=[...Array.from({length:failed},(_,i)=>({toolCallId:'bad_'+i,toolName:tool,isError:true,content:failure(i)})),{toolCallId:'saved',toolName:tool,content:success}];
 const result=await reader.finish(base,async()=>options.native?options.native(native):native);
 assert(validTaskVerification(result,runId));return result;
}
async function check(name,work){await work();report.checks.push(name);console.log('PASS '+name);}
try{
 let passed;
 await check('Native failed candidate plus linked independently read current save resolves only that failure, preserving raw counts and human check',async()=>{
  passed=await evaluate();assert.equal(passed.schema,'xiaozhi.verification.v2');assert.equal(passed.state,'needs_human');assert.equal(passed.operations.failed,1);assert.equal(verificationOutstandingFailures(passed),0);assert.equal(passed.repairedOperations[0].callId,'bad_0');assert.equal(passed.repairedOperations[0].repairedBy,'saved');assert.equal(passed.checks.find(c=>c.id==='answer:human').state,'needs_human');assert.equal(verificationLabel(passed),'结果已保存，内容待核对');assert(verificationDescription(passed).includes('原失败记录保留'));assert(passed.evidence.some(e=>e.id==='bad_0'));
 });
 await check('Unrelated failed operation remains partial beside a repaired candidate',async()=>{const v=await evaluate({failures:2});assert.equal(v.state,'partial');assert.equal(v.operations.failed,2);assert.equal(verificationOutstandingFailures(v),1);assert(verificationDescription(v).includes('1 项操作未完成'));});
 await check('All three immutable repair predecessors can resolve into one confirmed head without erasing their failures',async()=>{const v=await evaluate({failures:3,links:[0,1,2].map(predecessor)});assert.equal(v.repairedOperations.length,3);assert.equal(v.operations.failed,3);assert.equal(verificationOutstandingFailures(v),0);});
 for(const [name,native]of[
  ['missing failed native',n=>n.slice(1)],['duplicate failed native',n=>[n[0],...n]],['foreign call native',n=>[{...n[0],toolCallId:'other_run_call'},n[1]]],['wrong failure reference',n=>[{...n[0],content:text({success:false,code:'quality_blocked',submittedForTeacherReview:true,repairReference:'修复_'+'f'.repeat(24),repairAttempt:0})},n[1]]],['non-error native',n=>[{...n[0],isError:false},n[1]]],['different failure body',n=>[{...n[0],content:text({...JSON.parse(n[0].content[0].text),extra:'changed'})},n[1]]]
 ])await check(name+' cannot resolve failure',async()=>{const v=await evaluate({native});assert.equal(v.state,'partial');assert.equal(v.repairedOperations,undefined);});
 for(const [name,opts]of[['unrelated success',{links:[]}],['wrong lineage attempt',{links:[{...predecessor(0),attempt:1}]}],['current saved fact changed',{changed:true}],['host failed',{hostFailed:true}],['teacher stopped',{stopped:true}],['invalid observer event',{invalid:true}]])await check(name+' does not clear failed execution',async()=>{const v=await evaluate(opts);assert.equal(v.state,'partial');assert.equal(v.repairedOperations,undefined);});
 await check('Persisted v2 is freshly recomputed; changed saved facts cannot reuse old repair evidence',async()=>{const v=await evaluate({base:passed,changed:true,allow:true});assert.equal(v.state,'partial');assert.equal(v.schema,'xiaozhi.verification.v1');assert.equal(v.repairedOperations,undefined);});
 await check('Fresh unchanged readback can rebuild v2 evidence without reusing its previous derived failure receipt',async()=>{const v=await evaluate({base:passed,allow:true});assert.equal(v.schema,'xiaozhi.verification.v2');assert.equal(v.state,'needs_human');assert.equal(v.repairedOperations.length,1);});
 await check('v1 remains closed and every v2 repair must link distinct failed execution and a passed saved readback',async()=>{
  const old=await evaluate({links:[]});assert(validTaskVerification(old,runId));assert.equal(old.schema,'xiaozhi.verification.v1');assert(!validTaskVerification({...old,repairedOperations:passed.repairedOperations},runId));
  for(const mutate of[
   v=>{v.repairedOperations=[];},v=>{v.repairedOperations.push(v.repairedOperations[0]);},v=>{v.repairedOperations[0].repairedBy='bad_0';},v=>{v.repairedOperations[0].failureEvidenceId='missing';},v=>{v.repairedOperations[0].resultEvidenceId='bad_0';},v=>{v.checks[0].state='unknown';},v=>{v.repairedOperations[0].extra=true;},v=>{v.operations.failed=0;}
  ]){const v=structuredClone(passed);mutate(v);assert(!validTaskVerification(v,runId));}
 });
 report.result=passed;report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,output,checks:report.checks.length,error:report.error}));}
