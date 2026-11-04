/** Explicit parent/human edit decision. Never generates corrections or approves quality. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function paperAdaptationTeacherEditGate(output,{pins,verifyPins,onEvidence=()=>{},timeoutMs=600000}) {
  let used=false;
  return async input=>{
    assert(!used,'One optional teacher-edit decision; no model retry');used=true;verifyPins();
    assert.equal(input.draft.items.length,1,'This bounded edit journey covers one designated question');
    const requestPath=path.join(output,'paper-adaptation-edit.request.json');
    const receiptPath=path.join(output,'paper-adaptation-edit.receipt.json');
    assert(!fs.existsSync(requestPath)&&!fs.existsSync(receiptPath));
    const screenshot=fs.realpathSync(path.join(output,'paper-adaptation-before-edit.png'));
    const screenshotSha256=createHash('sha256').update(fs.readFileSync(screenshot)).digest('hex');
    const request={schemaVersion:'xiaozhi.qa.paper-adaptation-edit-request.v1',requestId:randomUUID(),createdAt:new Date().toISOString(),
      pins:{build:pins.build,source:pins.source},...input,screenshot,screenshotSha256,
      scope:'Keep the actual candidate, reject, or explicitly edit its single analysis through the original UI. No generated correction; final independent review still required.'};
    const digest=hash(request);
    fs.writeFileSync(requestPath,JSON.stringify({...request,digest},null,2),{flag:'wx'});
    onEvidence({status:'awaiting-teacher-edit',request:requestPath,receipt:receiptPath,digest});
    console.log(JSON.stringify({phase:'A27-explicit-teacher-edit-decision-required',request:requestPath,receipt:receiptPath,digest}));
    const deadline=Date.now()+timeoutMs;
    while(!fs.existsSync(receiptPath)) {
      assert(Date.now()<deadline,'Teacher edit decision timed out; no confirmation or resend');
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    assert(fs.realpathSync(receiptPath).startsWith(fs.realpathSync(output)+path.sep));
    assert(fs.statSync(receiptPath).size<=20000);
    const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
    assert.equal(receipt.schemaVersion,'xiaozhi.qa.paper-adaptation-edit-receipt.v1');
    assert.equal(receipt.requestId,request.requestId);assert.equal(receipt.digest,digest);
    assert(['keep','edit','reject'].includes(receipt.decision));
    assert(['parent_qa','human'].includes(receipt.reviewerType));
    assert(typeof receipt.reviewer==='string'&&receipt.reviewer.trim().length>0&&receipt.reviewer.length<=200);
    assert(typeof receipt.rationale==='string'&&receipt.rationale.trim().length>=8&&receipt.rationale.length<=4000);
    assert(Date.parse(receipt.reviewedAt)>=Date.parse(request.createdAt)&&Date.parse(receipt.reviewedAt)<=Date.now()+5000);
    const persisted=JSON.parse(fs.readFileSync(requestPath,'utf8'));delete persisted.digest;
    assert.equal(hash(persisted),digest,'Actual edit request changed');verifyPins();
    assert.equal(createHash('sha256').update(fs.readFileSync(screenshot)).digest('hex'),screenshotSha256,'Original candidate screenshot changed');
    onEvidence({status:'teacher-'+receipt.decision,request:requestPath,receipt:receiptPath,digest});
    assert.notEqual(receipt.decision,'reject','Teacher rejected actual candidate; no UI edit or model retry');
    const draft=structuredClone(input.draft);
    if(receipt.decision==='edit') {
      assert.deepEqual(Object.keys(receipt.edits||{}).sort(),['analysis','itemIndex']);
      assert.equal(receipt.edits.itemIndex,0);
      assert(typeof receipt.edits.analysis==='string'&&receipt.edits.analysis.trim().length>0&&receipt.edits.analysis.length<=12000);
      assert.notEqual(receipt.edits.analysis,draft.items[0].analysis,'Explicit edit must actually change analysis');
      draft.items[0].analysis=receipt.edits.analysis;
    } else assert.equal(receipt.edits,undefined,'Keep cannot silently carry edits');
    return draft;
  };
}
