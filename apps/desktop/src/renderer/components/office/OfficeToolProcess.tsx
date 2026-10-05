import { BookOpen, FileText, FolderOpen, Globe, Pencil, Workflow } from 'lucide-react';
import { useState } from 'react';
import type { OfficeProjectedItem } from '../../../shared/office-agent';
import { ChatTool, ChatToolGroup, type ToolPartState } from '../../heroui-pro/components/chat-tool';
import { ChatSource } from '../../heroui-pro/components/chat-source';
import { XIAOZHI_WEB_ERRORS, type XiaozhiPublicSource } from '../../../shared/xiaozhi-web';
import { formatProcessDuration, processNeedsAttention } from './office-process';
import {OfficeBrowserCapture} from './OfficeBrowserCapture';
import {MaterialSourceLink} from '../product/MaterialSourceNavigation';
import {QuestionSourceLink} from './PiQuestionSource';
import {StudentSourceLink} from '../students/StudentSourceNavigation';

function toolState(item: OfficeProjectedItem): ToolPartState {
  if (item.status === 'completed') return 'output-available';
  if (item.status === 'failed' || item.status === 'declined') return 'output-error';
  if (item.status === 'inProgress') return 'input-available';
  return 'requires-action';
}
function statusText(item: OfficeProjectedItem): string {
  return item.status === 'completed' ? '已完成' : item.status === 'failed' ? '未完成'
    : item.status === 'declined' ? '已拒绝' : item.status === 'inProgress' ? '正在执行'
    : item.status === 'waiting_approval' ? '等待确认' : item.status === 'waiting_input' ? '等待补充' : '等待状态同步';
}
export function WebSource({ source, sessionId }: { source: XiaozhiPublicSource; sessionId?: string }) {
  const [notice, setNotice] = useState('');
  return <li><ChatSource href={source.url} title={source.title} enablePreview={false}>
    <ChatSource.Trigger data-testid="pi-web-source-open" onClick={event => {
      event.preventDefault(); if (!sessionId || !source.url) return;
      void window.omniEdu?.openXiaozhiWebSource({ sessionId, url: source.url }).then(result => setNotice(result.ok ? '' : '来源未打开，请检查网络后重试。')).catch(() => setNotice('来源未打开，请重试。'));
    }}/></ChatSource>
    {source.observedAt && <span data-testid="pi-web-source-time">{source.kind === 'search' ? '搜索摘要' : '已读取网页'} · {new Date(source.observedAt).toLocaleString('zh-CN')} 读取</span>}
    {notice && <p role="alert">{notice}</p>}
  </li>;
}
function ToolStep({ item, sessionId }: { item: OfficeProjectedItem; sessionId?: string }) {
  const attention = processNeedsAttention(item), status = statusText(item);
  // Only the already-public action label determines the icon, never model prose.
  const label = item.label || '';
  const ActionIcon = /知识库/.test(label) ? BookOpen : /联网|网页|搜索/.test(label) ? Globe
    : /写入|编辑|创建|修改/.test(label) ? Pencil : /目录|文件夹/.test(label) ? FolderOpen
    : /读取|文件/.test(label) ? FileText : Workflow;
  return <ChatTool key={`${item.id}:${attention}`} className="office-tool" state={toolState(item)}
    defaultExpanded={attention} data-item-id={item.id} data-testid="office-tool-step">
    <ChatTool.Trigger><ActionIcon size={16} aria-hidden="true" /><span>{item.label || '授权工具'}{item.sources?.length ? ` · ${item.sources.map(source => source.title).join('、')}` : ''}</span>
      <span className="office-step-state">{status}</span>
      {item.durationMs !== undefined && <span className="office-step-duration">{formatProcessDuration(item.durationMs)}</span>}
    </ChatTool.Trigger>
    <ChatTool.Content className="office-tool-evidence" data-testid="office-tool-evidence">
      {item.status==='completed'&&item.browserCapture&&sessionId&&<OfficeBrowserCapture capture={item.browserCapture} sessionId={sessionId}/>}
      <p>{item.label || '授权工具'}：{status}。{item.durationMs !== undefined ? `实际用时 ${formatProcessDuration(item.durationMs)}。` : '未记录实际用时。'}</p>
      {item.imageDelivery&&<p data-testid="pi-image-delivery" data-image-state={item.imageDelivery.state}>{item.imageDelivery.title}：{
        item.imageDelivery.state==='prepared'?'已准备，尚未确认送达。':item.imageDelivery.state==='submitting'?'正在发送，尚未确认送达。'
        :item.imageDelivery.state==='received'?'供应商已接收并返回有效响应。':item.imageDelivery.state==='interrupted'?'已停止，未确认送达。':'未确认送达，请查看本轮结果。'}</p>}
      {!!item.sources?.length && <><p>引用资料</p><ul>{item.sources.map((source, index) => source.question ? <QuestionSourceLink key={index} source={source}/> : source.student ? <StudentSourceLink key={index} source={source}/> : source.material ? <MaterialSourceLink key={index} source={source}/> : source.url ? <WebSource key={index} source={source} sessionId={sessionId}/> : <li key={index}>{source.title}</li>)}</ul></>}
      {item.webEmpty && <p data-testid="pi-web-empty">本次搜索没有返回可用来源，请调整关键词。</p>}
      {item.status === 'failed' && <p data-testid="pi-web-error">{item.webError ? XIAOZHI_WEB_ERRORS[item.webError] : '该操作没有完成。请查看本轮提示；已完成的操作仍保留。'}</p>}
      {item.status === 'declined' && <p>教师已拒绝该操作。</p>}
    </ChatTool.Content>
  </ChatTool>;
}

/** Reuse native Pro disclosure; each call and its actual state remain inspectable. */
export function OfficeToolProcess({ items, sessionId }: { items: OfficeProjectedItem[]; sessionId?: string }) {
  if (items.length === 1) return <ToolStep item={items[0]} sessionId={sessionId}/>;
  const attention = items.some(processNeedsAttention), failed = items.some(item => ['failed', 'declined'].includes(item.status || ''));
  const active = items.some(item => item.status === 'inProgress'), completed = items.filter(item => item.status === 'completed').length;
  const unknown = items.some(item => !['completed', 'failed', 'declined', 'inProgress', 'waiting_approval', 'waiting_input'].includes(item.status || ''));
  const labels = [...new Set(items.map(item => item.label || '授权工具'))];
  const objects = [...new Set(items.flatMap(item => item.sources?.map(source => source.title) || []))];
  const state: ToolPartState = failed ? 'output-error' : attention || unknown ? 'requires-action' : active ? 'input-available' : 'output-available';
  return <ChatToolGroup key={`${items[0].id}:${attention}`} className="office-tool office-tool-group" active={active && !attention} data-state={state}
    defaultExpanded={attention} data-testid="office-tool-group" data-process-group-id={items[0].id} data-call-count={items.length}>
    <ChatToolGroup.Trigger><Workflow size={16} aria-hidden="true" /><span>{labels.slice(0, 3).join('、')}{labels.length > 3 ? '等操作' : ''}{objects.length ? ` · ${objects.slice(0, 3).join('、')}${objects.length > 3 ? '等资料' : ''}` : ''}</span>
      <span className="office-step-state">{completed}/{items.length} 已完成{failed ? ' · 有未完成操作' : attention ? ' · 等待教师' : active ? ' · 执行中' : unknown ? ' · 等待状态同步' : ''}</span>
    </ChatToolGroup.Trigger>
    <ChatToolGroup.Content className="office-tool-group-content">{items.map(item => <ToolStep key={item.id} item={item} sessionId={sessionId}/>)}</ChatToolGroup.Content>
  </ChatToolGroup>;
}
