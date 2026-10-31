import {createHash} from 'node:crypto';
import type {TaskView} from '../../../shared/xiaozhi-task';
import type {DeliveryRequirements,DeliveryCheckInput,DeliveryCheckReport,RequirementCoverage,CheckFinding} from '../../../shared/xiaozhi-delivery-checks';

/** Snapshot existing task authority, excluding transient plan/execution revisions. No new task source. */
export function deliveryRequirements(task:TaskView|null):DeliveryRequirements|null{
 if(!task)return null;
 const value={taskId:task.id,version:task.requirementsVersion,criteria:task.criteria.map(c=>({id:c.id,version:c.version,text:c.text,sourceId:c.sourceId,sourceVersion:c.sourceVersion}))};
 return{...value,digest:createHash('sha256').update(JSON.stringify(value)).digest('hex')};
}
export function validateRequirementBindings(input:DeliveryCheckInput,context:DeliveryRequirements|null){
 for(const file of input.files)for(const binding of file.rules?.bindings||[]){
  if(binding.taskId!==context?.taskId||!context?.criteria.some(c=>c.id===binding.criterionId&&c.version===binding.criterionVersion))throw Error('changed');
 }
}
export function requirementCoverage(report:DeliveryCheckReport,input:DeliveryCheckInput):RequirementCoverage[]{
 return(report.requirements?.criteria||[]).map(criterion=>{
  const evidence:RequirementCoverage['evidence']=[];
  for(const declared of input.files){
   const file=report.files.find(f=>f.path===declared.path),binding=declared.rules?.bindings?.find(b=>b.criterionId===criterion.id&&b.criterionVersion===criterion.version);
   for(const checkId of binding?.checks||[]){
    const findings=(file?.checks||[]).filter(c=>findingCheckId(c)===checkId);
    const state=findings.some(c=>c.state==='failed')?'failed':findings.length&&findings.every(c=>c.state==='passed')?'passed':'unchecked';
    evidence.push({path:declared.path,checkId,state,messages:findings.slice(0,4).map(c=>c.message)});
   }
  }
  return{criterionId:criterion.id,criterionVersion:criterion.version,state:!evidence.length?'unmapped':evidence.some(e=>e.state==='failed')?'checks_failed':evidence.every(e=>e.state==='passed')?'checks_passed':'unchecked',semantics:'unchecked',evidence};
 });
}
function findingCheckId(check:CheckFinding){
 if(check.checkId)return check.checkId;
 if(check.ruleId){
  if(check.kind==='interaction')return'interactions:'+check.ruleId;
  if(check.code==='cross_file_fact')return'facts:'+check.ruleId;
  if(check.code==='cross_file_value')return'numbers:'+check.ruleId;
 }
 return undefined;
}
