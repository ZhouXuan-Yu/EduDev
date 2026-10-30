import {createHash} from 'node:crypto';
import type {TaskDocument} from './task-state';
import type {TaskCriterion} from '../../../shared/xiaozhi-task';
import {validTaskVerification,type TaskVerification} from '../../../shared/xiaozhi-verification';

export const taskHash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const taskToolKinds:Partial<Record<TaskCriterion['kind'],string[]>>={file:['office_read_text'],attachment:['office_read_attachment','office_read_document','office_read_material'],web:['office_web_fetch','office_browser'],image:['office_view_public_image'],saved_text:['education_create_report','office_copy_file','office_create_text','office_edit_text','office_create_science_figure'],saved_bundle:['education_create_report','office_deliver_files'],saved_office:['education_create_report','office_create_document','education_export_paper','education_export_classroom'],saved_questions:['education_web_answer','education_propose_questions','education_propose_original_question','education_propose_original_questions','education_propose_practice']};

/** Only the host's current readback adapter can supply these checkpoints. This
 * function never fetches a model, dispatches a tool or replays a saved effect. */
export function applyTaskReadback(doc:TaskDocument,verification:TaskVerification){
 if(!validTaskVerification(verification,verification.runId)||Math.abs(Date.now()-Date.parse(verification.checkedAt))>60000)throw Error('task_verification_invalid');
 const lineage=doc.lineage.find(o=>o.runId===verification.runId);if(!lineage)throw Error('task_verification_invalid');
 for(const admission of doc.admissions.filter(a=>a.runId===lineage.runId&&a.generation===lineage.generation&&a.requirementsVersion===doc.view.requirementsVersion)){
  const criterionIds=admission.criterionIds||doc.view.steps.find(s=>s.id===admission.stepId)?.criterionIds;
  if(!criterionIds)continue; // Old records do not gain invented admission mapping.
  for(const cid of criterionIds){const criterion=doc.view.criteria.find(c=>c.id===cid);if(!criterion)continue;
   if(criterion.kind==='human'||criterion.resource!==admission.resource||!taskToolKinds[criterion.kind]?.includes(admission.tool))continue;
   const check=verification.checks.find(c=>c.id===`${criterion.kind}:${admission.callId}`);if(!check)continue;
   const refs=check.evidenceIds.map(id=>verification.evidence.find(e=>e.id===id)!);
   if(check.state==='passed'&&(!refs.length||refs.some(e=>e.runId!==lineage.runId||e.callId!==admission.callId||e.kind!=='readback')))throw Error('task_verification_invalid');
   doc.view.checks=doc.view.checks.filter(c=>c.criterionId!==cid);
   doc.view.checks.push({criterionId:cid,criterionVersion:criterion.version,state:check.state,runId:lineage.runId,generation:lineage.generation,callId:admission.callId,checkedAt:verification.checkedAt,digest:taskHash(refs.map(e=>[e.digest,e.kind])),authority:'readback'});
  }
 }
}
export function applyTaskRecheck(doc:TaskDocument,proofs:TaskVerification[]){
 if(!Array.isArray(proofs)||proofs.length>64||proofs.some(p=>!p||typeof p.runId!=='string')||new Set(proofs.map(p=>p.runId)).size!==proofs.length)throw Error('task_verification_invalid');
 doc.view.checks=doc.view.checks.filter(c=>c.authority==='teacher');
 for(const proof of proofs)applyTaskReadback(doc,proof);
}
