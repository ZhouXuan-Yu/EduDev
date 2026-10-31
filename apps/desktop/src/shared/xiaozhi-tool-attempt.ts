export const TOOL_EXECUTION_CODES=['invalid_input','invalid_output','permission_denied','authentication','cancelled','timeout','network','rate_limited','service_error','conflict','not_found','resource_busy','task_blocked','unknown'] as const;
export type ToolExecutionCode=typeof TOOL_EXECUTION_CODES[number];
export type XiaozhiToolAttempt={schemaVersion:1;callId:string;tool:string;attempt:number;maxAttempts:number;state:'queued'|'started'|'retrying'|'succeeded'|'failed';code?:ToolExecutionCode;effect:'none'|'unknown';queueWaitMs?:number;executionMs?:number};
export function validToolAttempt(value:unknown):value is XiaozhiToolAttempt{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).every(k=>['schemaVersion','callId','tool','attempt','maxAttempts','state','code','effect','queueWaitMs','executionMs'].includes(k))&&v.schemaVersion===1
  &&typeof v.callId==='string'&&/^[A-Za-z0-9_:.-]{1,128}$/.test(v.callId)&&typeof v.tool==='string'&&(/^[a-z_]{1,128}$/.test(v.tool)||/^mcp_[a-f0-9]{24}_[A-Za-z0-9_-]{1,35}$/.test(v.tool))
  &&Number.isSafeInteger(v.attempt)&&Number.isSafeInteger(v.maxAttempts)&&Number(v.attempt)>=1&&Number(v.attempt)<=Number(v.maxAttempts)&&Number(v.maxAttempts)<=2
  &&['queued','started','retrying','succeeded','failed'].includes(String(v.state))&&['none','unknown'].includes(String(v.effect))
  &&(v.code===undefined||TOOL_EXECUTION_CODES.includes(v.code as ToolExecutionCode))
  &&(v.queueWaitMs===undefined||Number.isFinite(v.queueWaitMs)&&Number(v.queueWaitMs)>=0&&Number(v.queueWaitMs)<=86_400_000)
  &&(v.executionMs===undefined||Number.isFinite(v.executionMs)&&Number(v.executionMs)>=0&&Number(v.executionMs)<=86_400_000)
  &&(v.state!=='queued'||v.code===undefined&&v.effect==='none'&&v.executionMs===undefined)
  &&(v.state!=='retrying'||Number(v.attempt)<Number(v.maxAttempts)&&v.effect==='none')
  &&(v.state!=='succeeded'||v.code===undefined&&v.effect==='none');
}
export const TOOL_EXECUTION_MESSAGES:Record<ToolExecutionCode,string>={invalid_input:'操作参数无效，尚未执行。',invalid_output:'操作返回的结果格式无效，未确认完成。',permission_denied:'操作未获授权或授权已失效。',authentication:'服务凭证未通过验证，未自动重试。',cancelled:'已停止等待本次操作。',timeout:'操作等待超时。',network:'连接中断，未取得有效结果。',rate_limited:'服务请求过于频繁。',service_error:'来源服务暂时不可用。',conflict:'来源或操作记录已变化，未自动重试。',not_found:'授权范围内未找到目标文件，可能已移动或更名。请先列出当前目录核对名称，再读取实际文件和版本。',resource_busy:'文件或相关操作暂时被占用。请稍后重新核对当前文件；不会自动重复写入。',task_blocked:'任务步骤尚未满足执行条件，本操作尚未派发。请核对当前任务计划、要求版本和前置核验，不要把模型报告完成当作通过。',unknown:'操作未取得可确认的结果。'};
