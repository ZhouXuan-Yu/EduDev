import {randomUUID} from 'node:crypto';
import type {AiConsoleRunInput,AiConsoleRunResult,AiConversationDetail} from '../../shared/contracts';
import type {XiaozhiStartInput,XiaozhiStartResult,XiaozhiWorkspaceSnapshot} from '../../shared/xiaozhi-agent';
import {XIAOZHI_ERRORS} from '../../shared/xiaozhi-projection';

type Store={createAiConversationSession:(input:{title?:string})=>Promise<AiConversationDetail>;
  getAiConversationSession:(id:string)=>Promise<AiConversationDetail>};
type Host={start:(input:XiaozhiStartInput)=>Promise<XiaozhiStartResult>;
  waitForRun:(id:string,runId:string)=>Promise<XiaozhiWorkspaceSnapshot>};
const sessionId=(id:unknown):id is string=>typeof id==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(id);

/** Old optional education selectors require a separate scoped migration, never silently drop them. */
export function validateConsoleRequest(raw:unknown):'invalid_input'|'legacy_scope'|undefined {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return 'invalid_input';
  const entries=Object.getOwnPropertyDescriptors(raw);
  if(Reflect.ownKeys(raw).some(key=>typeof key!=='string'||!['prompt','sessionId','commandId','studentId','intent','timeRange','knowledgeScope'].includes(key))
    ||Object.values(entries).some(d=>!('value'in d)))return 'invalid_input';
  const prompt=entries.prompt?.value;
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>32768||prompt.includes('\0'))return 'invalid_input';
  if(entries.sessionId?.value&&!sessionId(entries.sessionId.value))return 'invalid_input';
  if(entries.sessionId&&entries.sessionId.value!==undefined&&typeof entries.sessionId.value!=='string')return 'invalid_input';
  if(entries.studentId&&entries.studentId.value!==undefined&&typeof entries.studentId.value!=='string')return 'invalid_input';
  if(entries.commandId?.value!==undefined&&(!sessionId(entries.sessionId?.value)||typeof entries.commandId.value!=='string'||!/^xicmd_[a-f0-9-]{36}$/i.test(entries.commandId.value)))return 'invalid_input';
  if(entries.studentId?.value||entries.intent?.value
    ||(entries.timeRange?.value!==undefined&&entries.timeRange.value!=='last30')
    ||(entries.knowledgeScope?.value!==undefined&&entries.knowledgeScope.value!=='teacher'))return 'legacy_scope';
  return undefined;
}

/** Native prompt lifecycle + committed public projection; no polling/budget/model orchestration. */
export function createPiConsoleFacade(options:{store:Store;host:Host}) {
  const failed=(message:string):AiConsoleRunResult=>({ok:false,executionMode:'direct',provider:'deepseek',model:'',content:'',toolRuns:[],sources:[],errorMessage:message});
  return {async run(raw:unknown):Promise<AiConsoleRunResult> {
    const invalid=validateConsoleRequest(raw);
    if(invalid)return failed(invalid==='legacy_scope'?'旧版学生或范围请求尚未迁移，请在小智工作区发起任务。':XIAOZHI_ERRORS.invalid_input);
    const input=raw as AiConsoleRunInput;
    let receipt:AiConsoleRunResult['runtimeReceipt'];
    try {
      const detail=input.sessionId?await options.store.getAiConversationSession(input.sessionId)
        :await options.store.createAiConversationSession({});
      if(detail.session.archivedAt)return failed(XIAOZHI_ERRORS.permission_denied);
      if(detail.session.studentId)return failed('旧版学生会话尚未迁移，请在小智工作区发起任务。');
      const id=detail.session.id,commandId=input.commandId||`xicmd_${randomUUID()}`;
      const started=await options.host.start({sessionId:id,commandId,prompt:input.prompt});
      if(!started.ok)return failed(XIAOZHI_ERRORS[started.error]);
      receipt={schemaVersion:'xiaozhi.pi.console.v1',sessionId:id,commandId,runId:started.runId};
      const state=await options.host.waitForRun(id,started.runId);
      const turn=state.projection.turns.find(row=>row.id===started.runId);
      const ok=turn?.status==='completed';
      const text=turn?.items.filter(item=>item.kind==='message'&&item.role==='assistant').at(-1)?.text||'';
      const metrics=state.usage?.find(item=>item.runId===started.runId)?.tokens;
      return {ok,executionMode:'direct',provider:'deepseek',model:state.projection.model,content:text,
        runtimeReceipt:receipt,
        toolRuns:(turn?.items||[]).filter(item=>item.kind==='tool').map(item=>({name:item.label||'授权工具',label:item.label||'授权工具',
          status:item.status==='completed'?'used':item.status==='declined'?'blocked':'failed',detail:item.status==='completed'?'工具实际执行完成。':'工具没有完成。'})),
        sources:(turn?.items||[]).flatMap(item=>(item.sources||[]).map(source=>({title:source.title,type:'Pi 授权工具来源',detail:'来自本轮已保存的公开工具结果。',count:1}))),
        ...(metrics?{usage:{promptTokens:metrics.input+metrics.cacheRead+metrics.cacheWrite,completionTokens:metrics.output,totalTokens:metrics.total}}:{}),
        ...(!ok?{errorMessage:turn?.error||XIAOZHI_ERRORS[turn?.status==='interrupted'?'cancelled':'configuration']}:{})};
    } catch {return {...failed(XIAOZHI_ERRORS.configuration),...(receipt?{runtimeReceipt:receipt}:{})};}
  }};
}
