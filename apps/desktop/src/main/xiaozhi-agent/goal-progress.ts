import {createHash} from 'node:crypto';
import {validTaskVerification,type TaskVerification} from '../../shared/xiaozhi-verification';
import type {GoalProgress} from '../../shared/xiaozhi-goal';

const resultKinds=new Set(['file','attachment','web','image','saved_text','saved_office','saved_questions','directory','file_metadata']);
/** Integrity of current host-owned readback, never a teaching/step acceptance.
 * Stable source/effect digests intentionally exclude call ID, prose and time. */
export function goalEvidenceProgress(input:{runId:string;seen:string[];idle:number;verification?:TaskVerification;teacherAnswerDigests?:string[];now?:number}){
 const now=input.now??Date.now(),checkedAt=new Date(now).toISOString(),v=input.verification;
 const valid=!!v&&validTaskVerification(v,input.runId)&&Date.parse(v.checkedAt)<=now&&now-Date.parse(v.checkedAt)<=30000;
 const keys=new Set<string>();
 if(valid)for(const check of v!.checks)if(check.state==='passed'&&resultKinds.has(check.id.split(':')[0]))for(const id of check.evidenceIds){
  const evidence=v!.evidence.find(e=>e.id===id&&e.kind==='readback');
  if(evidence){const kind=check.id.split(':')[0],group=kind==='directory'||kind==='file_metadata'?'source_discovery':kind;keys.add(createHash('sha256').update(JSON.stringify([group,evidence.digest])).digest('hex'));}
 }
 const inputs=new Set<string>();
 if(input.teacherAnswerDigests!==undefined){
  if(!Array.isArray(input.teacherAnswerDigests)||input.teacherAnswerDigests.length>32||input.teacherAnswerDigests.some(k=>typeof k!=='string'||!/^[a-f0-9]{64}$/.test(k)))throw Error('invalid_teacher_input');
  for(const digest of input.teacherAnswerDigests)inputs.add(createHash('sha256').update(JSON.stringify(['teacher_input',digest])).digest('hex'));
 }
 const seen=new Set(input.seen),evidenceKeys=[...keys].filter(k=>!seen.has(k)),inputKeys=[...inputs].filter(k=>!seen.has(k)),newKeys=[...evidenceKeys,...inputKeys],overflow=seen.size+newKeys.length>128;
 const idle=newKeys.length&&!overflow?0:Math.min(3,input.idle+1),stop=overflow||idle>=3;
 if(!overflow)for(const key of newKeys)seen.add(key);
 const state:GoalProgress['state']=overflow?'coverage_limit':newKeys.length?'advanced':!valid?'unavailable':stop?'stalled':'no_new_evidence';
 const fields={checkedAt,newEvidence:overflow?0:evidenceKeys.length,idleBoundaries:idle,state};
 const progress:GoalProgress=input.teacherAnswerDigests===undefined?{schemaVersion:1,scope:'result_integrity',...fields}:{schemaVersion:2,scope:'evidence_and_teacher_input',...fields,newTeacherInputs:overflow?0:inputKeys.length};
 return{seen:[...seen].sort(),progress,stop};
}
