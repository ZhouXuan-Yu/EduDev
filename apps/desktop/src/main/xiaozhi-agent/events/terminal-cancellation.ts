import type {Sql} from '../session-state';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {legacyVerification,type TaskVerification} from '../../../shared/xiaozhi-verification';
import {createGoalState} from '../goal-state';
import {XIAOZHI_ERRORS} from '../../../shared/xiaozhi-projection';
import type {XiaozhiAgentError} from '../../../shared/xiaozhi-agent';

export type TerminalCancellation = {requested:()=>boolean;repair:(work:Sql,turn:OfficeProjectedTurn)=>Promise<void>};
/** Preserve observed operations/readbacks; stopping cannot certify the whole task. */
export function interruptedVerification(turn:OfficeProjectedTurn):TaskVerification {
  const value=turn.verification||legacyVerification(turn.id);
  return {...value,state:value.operations.succeeded?'partial':'blocked',reason:'execution_failed',checkedAt:new Date().toISOString()};
}
/** Called only inside the current journal owner's transaction, never from IPC. */
export async function repairCancelledRun(work:Sql,sessionId:string,runId:string,commandId:string,turn:OfficeProjectedTurn,outcome:{status:'interrupted'|'failed';error:XiaozhiAgentError}={status:'interrupted',error:'cancelled'}) {
  const stamp=new Date().toISOString(),error=XIAOZHI_ERRORS[outcome.error];
  await work.run('UPDATE ai_agent_runs SET status=?,error_message=?,completed_at=?,updated_at=? WHERE id=?',[outcome.status==='failed'?'failed':'blocked',error,stamp,stamp,runId]);
  await work.run(`UPDATE ai_conversation_messages SET metadata_json=json_set(metadata_json,'$.ok',json('false'),'$.status',?,'$.errorMessage',?,'$.verification',json(?))
    WHERE session_id=? AND role='assistant' AND json_extract(metadata_json,'$.agentRunId')=? AND json_extract(metadata_json,'$.piVersion')='xiaozhi.pi.education.v1'`,[outcome.status,error,JSON.stringify(turn.verification),sessionId,runId]);
  await work.run("UPDATE xiaozhi_pi_commands SET status='interrupted',updated_at=? WHERE command_id=? AND conversation_id=? AND run_id=?",[stamp,commandId,sessionId,runId]);
  await work.run("UPDATE xiaozhi_pi_usage SET payload_json=json_set(payload_json,'$.state',?),updated_at=? WHERE run_id=? AND conversation_id=?",[outcome.status,stamp,runId,sessionId]);
  await work.run("UPDATE ai_agent_events SET status='failed',label='小智未完成本轮',detail=?,output_summary_json=? WHERE run_id=? AND phase='finalize'",[error,JSON.stringify({executionStatus:outcome.status,verification:turn.verification}),runId]);
  await createGoalState(work).finish(sessionId,runId,'',true);
}
