/** External human/parent-QA review gate. This module NEVER creates a receipt,
 * selects approve, changes a product control, or starts an app/provider.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const adaptationReviewReceiptSchema='xiaozhi.qa.paper-adaptation-review-receipt.v1';
export const adaptationReviewGateFiles=Object.freeze({request:'paper-adaptation-review.request.json',receipt:'paper-adaptation-review.receipt.json'});
export const adaptationReviewRequiredChecks=Object.freeze(['parentLineage','requirements','stemAndOptions','uniqueAnswer','analysis']);

export function paperAdaptationParentReviewGate(output,{pins,timeoutMs=600000,verifyPins=()=>{},onEvidence=()=>{}}={}){
 const root=fs.realpathSync(output);
 const requestPath=path.join(root,adaptationReviewGateFiles.request),receiptPath=path.join(root,adaptationReviewGateFiles.receipt);
 let used=false;
 return async input=>{
  assert(!used,'One review gate per run; no retry or receipt reuse');used=true;
  verifyPins();
  assert(input?.draft&&input.quality&&input.original&&input.requirements&&input.runId&&input.candidateId);
  assert(!fs.existsSync(requestPath)&&!fs.existsSync(receiptPath),'Cannot reuse an old request or receipt');
  const screenshot=fs.realpathSync(path.join(root,'paper-adaptation-real-comparison.png'));
  assert(screenshot.startsWith(root+path.sep),'Screenshot must belong to this live run');
  const createdAt=new Date().toISOString();
  const request={schemaVersion:'xiaozhi.qa.paper-adaptation-review-request.v1',requestId:randomUUID(),createdAt,
   runId:input.runId,candidateId:input.candidateId,parentQuestionId:input.original.id,
   pins:{build:pins.build,source:pins.source},screenshot,screenshotSha256:digest(fs.readFileSync(screenshot)),
   requirements:input.requirements,requirementsSha256:digest(input.requirements),
   draft:input.draft,draftSha256:digest(input.draft),quality:input.quality,qualitySha256:digest(input.quality),
   original:input.original,originalSha256:digest(input.original),requiredChecks:adaptationReviewRequiredChecks};
  const requestDigest=digest(request);
  fs.writeFileSync(requestPath,JSON.stringify({...request,digest:requestDigest},null,2),{flag:'wx'});
  onEvidence({status:'awaiting-external-review',request:requestPath,receipt:receiptPath,digest:requestDigest});
  console.log(JSON.stringify({phase:'A27-human-or-parent-QA-review-required',request:requestPath,receipt:receiptPath,
   requestId:request.requestId,digest:requestDigest,instruction:'Inspect original/candidate/requirements/quality and screenshot. An external reviewer must write a matching decision receipt. No receipt is generated automatically.'}));
  const deadline=Date.now()+timeoutMs;
  while(!fs.existsSync(receiptPath)){
   assert(Date.now()<deadline,'External candidate review timed out; no UI confirmation performed');
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert(fs.realpathSync(receiptPath).startsWith(root+path.sep),'Receipt must belong to this run');
  assert(fs.statSync(receiptPath).size<=16384,'Oversize review receipt');
  const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  assert.equal(receipt.schemaVersion,adaptationReviewReceiptSchema);
  assert.equal(receipt.requestId,request.requestId);assert.equal(receipt.digest,requestDigest);
  assert(['approve','reject'].includes(receipt.decision),'External reviewer must explicitly decide');
  assert(['human','parent_qa'].includes(receipt.reviewerType),'Identify actual human or parent QA reviewer');
  assert(typeof receipt.reviewer==='string'&&receipt.reviewer.trim().length>0&&receipt.reviewer.length<=200);
  assert(typeof receipt.rationale==='string'&&receipt.rationale.trim().length>=8&&receipt.rationale.length<=4000,'Record actual review rationale');
  const reviewedAt=Date.parse(receipt.reviewedAt);
  assert(Number.isFinite(reviewedAt)&&reviewedAt>=Date.parse(createdAt)&&reviewedAt<=Date.now()+5000,'Receipt must be a fresh review of this request');
  const persisted=JSON.parse(fs.readFileSync(requestPath,'utf8'));delete persisted.digest;
  assert.equal(digest(persisted),requestDigest,'Review request changed while awaiting external decision');
  assert.equal(digest(fs.readFileSync(screenshot)),request.screenshotSha256,'Comparison screenshot changed during review');
  verifyPins();
  const evidence={request:requestPath,receipt:receiptPath,digest:requestDigest,
   receiptSha256:digest(fs.readFileSync(receiptPath)),reviewerType:receipt.reviewerType,
   reviewer:receipt.reviewer,reviewedAt:receipt.reviewedAt};
  if(receipt.decision==='reject'){
   onEvidence({...evidence,status:'external-rejected'});
   throw Error('External reviewer rejected the actual candidate; no UI confirmation or model retry');
  }
  assert.equal(receipt.reviewed,true);
  for(const check of adaptationReviewRequiredChecks)assert.equal(receipt.checks?.[check],true,'External review must explicitly cover '+check);
  onEvidence({...evidence,status:'external-approved'});
  return true; // Only a fresh external matching approve receipt reaches this line.
 };
}
