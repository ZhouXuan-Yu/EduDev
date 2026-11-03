import {plainStudentInput} from './student-context';
import {validPaperBlueprint,type PaperBlueprint,type PaperSelection} from './paper-blueprint';
export type PaperFulfillmentReport={addedEntryIds:string[];shortages:PaperSelection['shortages'];scanned:number;scanComplete:boolean;excluded:PaperSelection['excluded'];duplicateRecords:number};
export type PaperFulfillmentIssue={kind:'orphan'|'over_quota'|'member_unavailable'|'points_conflict'|'template_unresolved';sectionId?:string;entryId?:string};
export type PaperFulfillmentReceipt={requestId:string;planId:string;revision:number;report:PaperFulfillmentReport};
export type PaperFulfillmentPlan={
  planId:string;blueprint:PaperBlueprint;revision:number;digest:string;membersDigest:string;
  status:'draft'|'confirmed'|'fulfilled';issues:PaperFulfillmentIssue[];report?:PaperFulfillmentReport;
};
export type PaperFulfillmentOperation=
  |{type:'saveFulfillmentPlan';blueprint:PaperBlueprint}
  |{type:'confirmFulfillmentPlan';planId:string;digest:string}
  |{type:'fulfillPlan';planId:string;digest:string;confirmedRevision:number};
const digest=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const revision=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=1&&v<=1000000;
const planId=(v:unknown)=>typeof v==='string'&&/^xiplan_[a-f0-9-]{36}$/i.test(v);
export function validFulfillmentOperation(value:unknown):value is PaperFulfillmentOperation {
  if(!value||typeof value!=='object')return false;
  const v=value as Record<string,unknown>;
  if(v.type==='saveFulfillmentPlan')return plainStudentInput(v,['type','blueprint'])&&validPaperBlueprint(v.blueprint);
  if(v.type==='confirmFulfillmentPlan')return plainStudentInput(v,['type','planId','digest'])&&planId(v.planId)&&digest(v.digest);
  return v.type==='fulfillPlan'&&plainStudentInput(v,['type','planId','digest','confirmedRevision'])&&planId(v.planId)&&digest(v.digest)&&revision(v.confirmedRevision);
}
export function validFulfillmentPlan(value:unknown):value is PaperFulfillmentPlan {
  if(!plainStudentInput(value,['planId','blueprint','revision','digest','membersDigest','status','issues','report'])||!planId(value.planId)||!validPaperBlueprint(value.blueprint)||!revision(value.revision)||!digest(value.digest)||!digest(value.membersDigest)||!['draft','confirmed','fulfilled'].includes(String(value.status)))return false;
  if(!Array.isArray(value.issues)||value.issues.length>250||!value.issues.every(i=>plainStudentInput(i,['kind','sectionId','entryId'])&&['orphan','over_quota','member_unavailable','points_conflict','template_unresolved'].includes(String(i.kind))&&(i.entryId===undefined||typeof i.entryId==='string')&&(i.sectionId===undefined||typeof i.sectionId==='string')))return false;
  if(value.status!=='fulfilled')return value.report===undefined;
  return validFulfillmentReport(value.report);
}
export function validFulfillmentReport(r:unknown):r is PaperFulfillmentReport {
  if(!plainStudentInput(r,['addedEntryIds','shortages','scanned','scanComplete','excluded','duplicateRecords'])||!Array.isArray(r.addedEntryIds)||r.addedEntryIds.length>100||!r.addedEntryIds.every(id=>typeof id==='string'&&/^xibasketentry_[a-f0-9-]{36}$/i.test(id))||!Array.isArray(r.shortages)||r.shortages.length>40||typeof r.scanComplete!=='boolean')return false;
  const count=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
  if(!count(r.scanned)||!count(r.duplicateRecords)||!plainStudentInput(r.excluded,['unsupported','missing_answer','source_unavailable'])||!Object.values(r.excluded).every(count))return false;
  return r.shortages.every(s=>plainStudentInput(s,['sectionId','label','required','selected','missing','sourceKind'])&&typeof s.sectionId==='string'&&typeof s.label==='string'&&count(s.required)&&count(s.selected)&&count(s.missing)&&s.missing===Math.max(0,Number(s.required)-Number(s.selected))&&(s.sourceKind===undefined||s.sourceKind==='original'||s.sourceKind==='generated'));
}
