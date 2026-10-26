import { createHash } from 'node:crypto';
import type { XiaozhiAgentEventPayload } from '../../../shared/xiaozhi-agent';
import { VERIFICATION_SCHEMA, type TaskVerification, type VerificationEvidence } from '../../../shared/xiaozhi-verification';
/** Execution receipts describe operations, not answer correctness. Model text,
 * plans and readyForReview do not register acceptance criteria. */
export function createRunVerification(runId: string) {
  const started = new Map<string,string>(), settled = new Map<string, boolean>(), evidence = new Map<string,VerificationEvidence>();
  let invalid = false, imageReceived = false;const notDelivered=new Set<string>(),dispatched=new Set<string>();
  function observe(event: XiaozhiAgentEventPayload) {
    if (event.kind === 'tool_start') {
      if (started.has(event.callId) || started.size >= 256) { invalid = true; return; }
      started.set(event.callId,event.tool);
    } else if(event.kind==='tool_attempt'){
      if(started.get(event.attempt.callId)!==event.attempt.tool){invalid=true;return;}
      if(event.attempt.state==='started'){if(notDelivered.has(event.attempt.callId))invalid=true;dispatched.add(event.attempt.callId);}
      if(event.attempt.state==='failed'&&event.attempt.code==='task_blocked'&&event.attempt.effect==='none'){
        if(dispatched.has(event.attempt.callId))invalid=true;else notDelivered.add(event.attempt.callId);
      }
    } else if (event.kind === 'tool_end') {
      if (started.get(event.callId) !== event.tool || settled.has(event.callId)) { invalid = true; return; }
      if(notDelivered.has(event.callId)&&event.success)invalid=true;settled.set(event.callId,event.success);
      evidence.set(event.callId,{id:event.callId,runId,callId:event.callId,kind:'execution',
        digest:createHash('sha256').update(JSON.stringify(event)).digest('hex'),observedAt:new Date().toISOString()});
    } else if (event.kind === 'image_delivery' && event.image.state === 'received') {
      // Receipt remains delivery evidence; never a visual answer verification.
      if (!started.has(event.image.callId) || !event.image.attachment) { invalid=true; return; }
      imageReceived=true;
      const id=`${event.image.callId}:image`;
      evidence.set(id,{id,runId,callId:event.image.callId,kind:'image_delivery',digest:createHash('sha256').update(JSON.stringify(event.image)).digest('hex'),observedAt:new Date().toISOString()});
    }
  }
  function finish(input: {failed:boolean; stopped:boolean; teacherCriteria?:string[]}): TaskVerification {
    const succeeded=[...settled.values()].filter(Boolean).length;
    // Count actual started operations only. A provider/host failure or malformed
    // receipt blocks the result but must not fabricate another failed tool.
    const failed=[...started.keys()].filter(id=>settled.get(id)!==true&&!(notDelivered.has(id)&&settled.get(id)===false)).length;
    const executionFailed=failed>0 || invalid || input.failed || input.stopped;
    const criteria=(input.teacherCriteria||[]).slice(0,64);
    const state = executionFailed ? succeeded ? 'partial' : 'blocked' : criteria.length || imageReceived ? 'needs_human' : 'unknown';
    return {schema:VERIFICATION_SCHEMA,runId,state,scope:'declared_criteria',checkedAt:new Date().toISOString(),
      reason:executionFailed?'execution_failed':criteria.length||imageReceived?'human_review':'no_criteria',
      checks:criteria.map((_text,index)=>({id:`teacher:${index}`,state:'needs_human',evidenceIds:[]})),
      evidence:[...evidence.values()],operations:{succeeded,failed}};
  }
  return {observe,finish};
}
