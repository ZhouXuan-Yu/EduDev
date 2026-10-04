import type { OfficeProjectedTurn } from './office-agent';
import type { XiaozhiAgentError, XiaozhiAgentEvent } from './xiaozhi-agent';
export const XIAOZHI_ERRORS: Record<XiaozhiAgentError, string> = {
  attachment_changed:'待发送附件已变化或未全部接收，请重新检查附件后发送。',
  invalid_input: '消息格式不正确，请重新输入。', busy: '本会话正在运行，请先停止或等待完成。',
  configuration: '当前模型或会话配置不可用，请检查 DeepSeek 设置或新建会话。',
  authentication: 'DeepSeek 凭证不可用，请检查 API Key。', rate_limited: 'DeepSeek 额度不足或请求过于频繁，请稍后重试。',
  timeout: '本轮等待超时，请重试。', transport: '无法连接 DeepSeek，请检查网络后重试。',
  cancelled: '已停止本轮。', model_error: '模型没有完成有效回复，请重试。',
  command_conflict: '这条发送记录与消息内容不一致，请重新发送。', permission_denied: '当前操作未获授权或确认已失效，请刷新后重试。',
  workspace_locked: '本会话的资料范围已经固定，请新建会话后选择工作目录。',
  budget_exhausted: '本轮已达到运行预算，后续调用已停止。可调整预算后发起新一轮；已完成的操作仍保留。',
  nothing_to_compact: '当前没有需要压缩的较早上下文。可以继续对话；本次没有请求模型。',
  context_limit: '本次资料超出当前上下文可容纳范围。原记录保留，请分批提供资料或新建会话继续。',
  compaction_failed: '本次上下文整理未完成，原记录保留。请重试压缩后继续任务。',
  memory_scope_changed: '本会话记忆选择或来源已变更，后续调用已停止。请刷新记忆选择，重新选择有效版本或关闭后继续。原对话和已完成操作保留。',
  skill_source_changed: '当前启用的技能文件已变更或不可用，后续调用已停止。请检查本地技能文件，或在技能管理中关闭该项后继续；原对话和已完成操作保留。',
  skill_scope_changed: '可用技能或授权版本已变更，后续调用已停止。请刷新技能设置后继续；原对话和已完成操作保留。',
};
const labels: Record<string, string> = { read: '读取教育技能', search_teacher_knowledge: '检索老师知识库', office_read_text: '读取授权资料',
  report_goal_progress:'记录目标进度',office_list_attachments:'查看已发送附件',office_read_attachment:'读取已发送附件',office_view_public_image:'确认公开图片分析',
  office_browser:'浏览网页',office_web_search:'联网搜索',office_web_fetch:'读取公开网页',office_file_stat: '检查资料信息', office_list_files: '查看授权文件目录', office_copy_file: '复制教学资料', office_create_text: '创建教学文档', office_edit_text: '修改教学文档', office_create_document:'生成办公文档', office_read_document:'读取办公文档',update_plan:'更新任务计划',ask_teacher:'请教师补充', read_education_memory:'读取本会话教育记忆', read_session_process:'查看本会话过程' };
/** Public process only. Preserve text segments around tools; no SDK reasoning. */
export function applyXiaozhiEvent(turn: OfficeProjectedTurn, event: XiaozhiAgentEvent): OfficeProjectedTurn {
  const next = { ...turn, items: turn.items.map(item => ({ ...item })) };
  if(event.kind === 'assistant_start') {
    next.items.push({id:`${turn.id}:segment:${event.segment}`,kind:'message',role:'assistant',phase:'commentary',text:''});
  } else if(event.kind === 'assistant_end') {
    const item=next.items.find(item=>item.id === `${turn.id}:segment:${event.segment}` && item.kind === 'message');
    if(item && !item.text?.trim())next.items=next.items.filter(value=>value !== item);
    else if(item && event.final)item.phase='final_answer';
  } else if (event.kind === 'text_delta') {
    let item = next.items.at(-1);
    if (item?.kind !== 'message' || item.role !== 'assistant') {
      item = { id: `${turn.id}:text:${next.items.length}`, kind: 'message', role: 'assistant', phase: 'commentary', text: '' };
      next.items.push(item);
    }
    item.text = (item.text || '') + event.delta;
  } else if (event.kind === 'tool_start') {
    if (!next.items.some(item => item.id === event.callId)) next.items.push({ id: event.callId, kind: 'tool', label: labels[event.tool] || '执行授权工具', status: 'inProgress' });
  } else if (event.kind === 'tool_end') {
    const item = next.items.find(item => item.id === event.callId && item.kind === 'tool');
    if (item) { item.status = event.success ? 'completed' : item.status === 'declined' ? 'declined' : 'failed'; if (event.sources) item.sources = event.sources; if(event.webError)item.webError=event.webError; if(event.webEmpty !== undefined)item.webEmpty=event.webEmpty;
      if(event.success&&event.browserCapture)item.browserCapture=event.browserCapture;
      if (typeof event.durationMs === 'number' && Number.isFinite(event.durationMs) && event.durationMs >= 0) item.durationMs = event.durationMs;
    }
  } else if(event.kind==='image_delivery'){
    const image=event.image,id=`${image.callId}:image`;
    let item=next.items.find(v=>v.kind==='tool'&&v.id===id);
    if(!item){item={id,kind:'tool'};next.items.push(item);}
    item.imageDelivery={...image};
    item.label=image.state==='prepared'?'准备公开图片':image.state==='submitting'?'发送公开图片'
      :image.state==='received'?'公开图片已接收':image.state==='interrupted'?'图片交付已停止':'图片交付未完成';
    item.status=image.state==='received'?'completed':['prepared','submitting'].includes(image.state)?'inProgress':'failed';
    item.text=image.title;
    if(image.state==='received')item.sources=[{title:image.title}];
  } else if (event.kind === 'usage') {
    const { activeMs, waitingMs } = event.usage;
    if (Number.isFinite(activeMs) && activeMs >= 0 && Number.isFinite(waitingMs) && waitingMs >= 0 && Number.isFinite(activeMs + waitingMs)) next.elapsedMs = activeMs + waitingMs;
  } else if (event.kind === 'approval') {
    const item = next.items.find(item => item.kind === 'tool' && item.id === event.approval.callId);
    if (item) item.status = event.approval.state === 'pending' ? 'waiting_approval' : event.approval.state === 'rejected' ? 'declined'
      : ['executed', 'verified'].includes(event.approval.state) ? 'completed' : ['interrupted', 'uncertain', 'failed'].includes(event.approval.state) ? 'failed' : 'inProgress';
    if (event.approval.state === 'pending') next.status = 'waiting_approval';
    else if (next.status === 'waiting_approval') next.status = 'running';
  } else if (event.kind === 'change') {
    const item = next.items.find(item => item.kind === 'tool' && item.id === event.change.callId);
    if (item) item.status = event.change.state === 'pending' ? 'waiting_approval' : event.change.state === 'rejected' ? 'declined'
      : ['applied', 'reverted'].includes(event.change.state) ? 'completed' : ['approved', 'executing', 'reverting'].includes(event.change.state) ? 'inProgress' : 'failed';
    if (event.change.state === 'pending') next.status = 'waiting_approval';
    else if (next.status === 'waiting_approval') next.status = 'running';
  } else if (event.kind === 'office_artifact') {
    const item = next.items.find(item => item.kind === 'tool' && item.id === event.artifact.callId);
    if (item) item.status = event.artifact.state === 'pending' ? 'waiting_approval' : event.artifact.state === 'rejected' ? 'declined'
      : event.artifact.state === 'saved' ? 'completed' : ['approved','generating','prepared','committing'].includes(event.artifact.state) ? 'inProgress' : 'failed';
    if (event.artifact.state === 'pending') next.status = 'waiting_approval';
    else if (next.status === 'waiting_approval') next.status = 'running';
  } else if (event.kind === 'control') {
    const control = event.control;
    if (control.kind === 'plan') {
      let item = next.items.find(item => item.id === control.id);
      if (!item) { item = {id:control.id,kind:'plan'}; next.items.push(item); }
      item.text = control.steps?.map(step => `${step.status === 'completed' ? '✓' : step.status === 'in_progress' ? '→' : '○'} ${step.text}`).join('\n\n');
    }
    if (control.kind === 'question') {
      const tool=next.items.find(item=>item.kind === 'tool' && item.id === control.callId);
      if(tool)tool.status=control.state === 'pending'?'waiting_input':control.state === 'answered'?'inProgress':'failed';
      if (control.state === 'pending') next.status = 'waiting_input';
      else if (next.status === 'waiting_input') next.status = 'running';
    }
  } else if (event.kind === 'skill_isolation') {
    const id = `${turn.id}:skill-isolation`;
    if (!next.items.some(item => item.id === id)) next.items.push({ id, kind: 'skill_isolation', label: '旧技能上下文已隔离', status: 'completed',
      text: `旧技能说明及其后续模型上下文已隔离（${event.excludedRuns} 轮）。原对话仍可查看；必要时请重述未完成事项，新写入仍需确认。` });
  } else if (event.kind === 'memory_isolation') {
    const id = `${turn.id}:memory-isolation`;
    if (!next.items.some(item => item.id === id)) next.items.push({ id, kind: 'memory_isolation', label: event.reason === 'interrupted_tool' ? '中断的工具上下文已隔离' : '旧记忆上下文已隔离', status: 'completed',
      text: `${event.reason === 'interrupted_tool' ? '未收到工具结果的旧运行' : '旧记忆引用之后的模型上下文'}已隔离（${event.excludedRuns} 轮）。原对话仍可查看；请在必要时重述未完成事项。新写入仍需确认。` });
  } else if (event.kind === 'compaction') {
    const id = `${turn.id}:compaction${event.id === undefined ? '' : `:${event.id}`}`;
    let item = next.items.find(value => value.id === id);
    if (!item) { item = { id, kind: 'compaction', label: event.automatic ? '上下文已自动整理' : '压缩上下文' }; next.items.push(item); }
    if (event.automatic) item.label = event.state === 'running' ? '正在自动整理上下文' : event.state === 'failed' ? '上下文整理未完成' : '上下文已自动整理';
    item.status = event.state === 'completed' ? 'completed' : event.state === 'failed' ? 'failed' : 'inProgress';
    item.text = event.state === 'completed' ? `上下文估计 Token：${event.tokensBefore ?? '未知'} → ${event.estimatedTokensAfter ?? '未知'}。原对话记录保留；来源、计划与审批仍以本地记录为准。` : event.state === 'failed' ? XIAOZHI_ERRORS[event.error || 'compaction_failed'] : '正在整理较早上下文，原对话记录保留。';
  } else if(event.kind === 'status') {
    next.status = event.status;
    if (event.error) next.error = XIAOZHI_ERRORS[event.error];
    if (event.status !== 'running') {
      const lastText = [...next.items].reverse().find(item => item.kind === 'message' && item.role === 'assistant');
      if (lastText) lastText.phase = 'final_answer';
      for (const item of next.items) if (item.kind === 'tool' && ['inProgress','waiting_input'].includes(item.status || '')) item.status = 'failed';
      for (const item of next.items) if (item.kind === 'compaction' && item.status === 'inProgress') { item.status = 'failed'; item.text = event.error ? XIAOZHI_ERRORS[event.error] : '压缩没有完成，原对话记录保留。'; }
    }
  }
  return next;
}
