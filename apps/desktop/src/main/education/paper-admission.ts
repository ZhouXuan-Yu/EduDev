import {createHash} from 'node:crypto';
import {PAPER_TOOLS,validPaperBlueprint,validPaperSession} from '../../shared/paper-blueprint';
import type {Sql} from '../xiaozhi-agent/session-state';
import {TaskAdmissionError} from '../xiaozhi-agent/tasks/admission-error';
import {unwrapTaskArguments} from '../xiaozhi-agent/tasks/tool-envelope';
import {createTaskState} from '../xiaozhi-agent/tasks/task-state';
import {readTaskAction} from '../xiaozhi-agent/tasks/teacher-actions';
import {isThinkingContinuation} from '../xiaozhi-agent/answer-quality';

export type PaperProposalBinding=Readonly<{sessionId:string;runId:string;commandId:string;generation:number;callId:string;taskId:string;requirementsVersion:number}>;
const identity=(value:string)=>typeof value==='string'&&/^[A-Za-z0-9_:.-]{1,128}$/.test(value);

/** Conservative creation scope, not a general intent classifier. Only the leading
 * teacher instruction counts; quoted blueprints and model step text grant nothing. */
export function explicitlyRequestsPaper(text:string){
 if(/(?:不要|不必|无需|禁止|暂不|别)[^。！？；;\n]{0,32}(?:组卷|出卷|(?:生成|制作|创建|编制|编写|设计)[^，,。！？；;\n]{0,16}(?:试卷|卷子|整卷))|(?:仅|只)(?:需|要)?(?:解释|说明|介绍)(?:方案|组卷|出卷|流程|步骤)/u.test(text))return false;
 const head=text.trim().split(/[。！？；;\n]/u,1)[0].replace(/^(?:请你|请|麻烦你|麻烦|请帮我|帮我)\s*/u,'');
 if(/(?:仅|只)(?:需|要)?(?:解释|说明|介绍|阅读|读取|查看)|(?:不要|不必|无需|禁止|暂不|别)[^，,。！？；;\n]{0,24}(?:组卷|出卷|(?:生成|制作|创建|编制|编写|设计)[^，,。！？；;\n]{0,16}(?:试卷|卷子|整卷))/u.test(head))return false;
 const action=/(?:实际调用\s+education_propose_paper\b|组卷|出卷|(?:生成|制作|创建|编制|编写|设计|组)[^，,。！？；;\n]{0,24}(?:试卷|卷子|整卷))/u.exec(head);
 if(!action)return false;
 const suffix=head.slice(action.index+action[0].length).trim();
 if(/^(?:是什么|是啥|怎么|如何|怎样|(?:的)?(?:流程|用法|介绍|说明|含义|定义|用途|功能))/u.test(suffix))return false;
 const prefix=head.slice(0,action.index).trim();
 return prefix===''||/^(?:按|按照|根据|依据|基于|从|帮我|现在|重新|继续)/u.test(prefix)&&prefix.length<=120&&!/解释|说明|介绍|阅读|读取|查看|如何|怎样|步骤|流程|不要|禁止|暂不/u.test(prefix);
}

/** Read-only SDK/domain gate. It neither creates a paper nor approves a source.
 * The host additionally refreshes the current teacher task before journal admission;
 * the original paper transaction still selects sources and creates pending review.
 */
export async function admitPaperProposal(options:{sql:Sql;current:()=>boolean},binding:PaperProposalBinding,raw:unknown,signal?:AbortSignal){
 const check=()=>{if(signal?.aborted||!options.current())throw Error('cancelled');};
 check();
 if(!validPaperSession(binding.sessionId)||![binding.runId,binding.commandId,binding.callId,binding.taskId].every(identity)||!Number.isSafeInteger(binding.generation)||binding.generation<1||!Number.isSafeInteger(binding.requirementsVersion)||binding.requirementsVersion<1)throw new TaskAdmissionError('task_paper_owner_stale');
 let input:Record<string,unknown>;
 try{input=unwrapTaskArguments(raw).input;}catch{throw new TaskAdmissionError('task_paper_invalid');}
 if(!validPaperBlueprint(input))throw new TaskAdmissionError('task_paper_invalid');
 const tasks=createTaskState(options.sql,{sanitize:async()=>{throw Error('invalid_input');}}),task=await tasks.latest(binding.sessionId);
 if(!task||task.id!==binding.taskId||task.requirementsVersion!==binding.requirementsVersion)throw new TaskAdmissionError('task_paper_owner_stale');
 try{await tasks.validateCurrent({sessionId:binding.sessionId,runId:binding.runId,generation:binding.generation},task.id,task.revision);}catch(error){if(error instanceof Error&&/^task_(source_changed|owner_stale|revision_conflict)$/.test(error.message))throw new TaskAdmissionError(error.message);throw error;}
 check();
 const rows=await options.sql.all(`SELECT r.id,m.id message_id,m.content request FROM ai_agent_runs r
  JOIN ai_conversation_sessions s ON s.id=r.session_id
  JOIN xiaozhi_pi_commands c ON c.conversation_id=s.id AND c.run_id=r.id
  JOIN xiaozhi_event_runs e ON e.session_id=s.id AND e.run_id=r.id
  JOIN xiaozhi_tool_receipts t ON t.run_id=e.run_id AND t.generation=e.generation
  JOIN ai_conversation_messages m ON m.session_id=s.id AND m.role='user' AND json_extract(m.metadata_json,'$.agentRunId')=r.id AND json_extract(m.metadata_json,'$.piVersion')='xiaozhi.pi.education.v1'
  WHERE s.id=? AND s.archived_at IS NULL AND r.id=? AND r.status='running'
  AND COALESCE(r.student_id,'')=COALESCE(s.student_id,'')
  AND (COALESCE(s.student_id,'')='' OR EXISTS(SELECT 1 FROM students WHERE id=s.student_id AND status='active'))
  AND c.command_id=? AND c.status='running' AND e.generation=? AND e.status='running'
  AND t.call_id=? AND t.tool=? AND t.phase='planned' AND t.admitted=0`,
 [binding.sessionId,binding.runId,binding.commandId,binding.generation,binding.callId,PAPER_TOOLS[0]]);
 check();
 if(rows.length!==1)throw new TaskAdmissionError('task_paper_owner_stale');
 let request=String(rows[0].request);
 const prior=task.sources.filter(source=>source.actionId||source.messageId!==rows[0].message_id).at(-1);
 let corrected:string|undefined;
 if(prior?.actionId){const action=await readTaskAction(options.sql,prior.actionId);if(!action||action.body.kind!=='correct')throw new TaskAdmissionError('task_source_changed');corrected=action.body.criteria!.map(criterion=>criterion.text).join('；');}
 if(isThinkingContinuation(request)){
  if(corrected!==undefined)request=corrected;
  else if(prior?.messageId){const source=(await options.sql.all("SELECT content FROM ai_conversation_messages WHERE id=? AND session_id=? AND role='user' AND json_extract(metadata_json,'$.agentRunId')=?",[prior.messageId,binding.sessionId,prior.runId]))[0];request=source?String(source.content):'';}
  else request='';
 }
 check();
 if(!explicitlyRequestsPaper(request)||corrected!==undefined&&!explicitlyRequestsPaper(corrected))throw new TaskAdmissionError('task_paper_request_scope');
 // Stable host-side identity only. No generic saved_questions proof is minted.
 const resource=createHash('sha256').update(JSON.stringify(['paper_review',binding,input])).digest('hex');
 return{kind:'paper_review' as const,...binding,resource};
}
