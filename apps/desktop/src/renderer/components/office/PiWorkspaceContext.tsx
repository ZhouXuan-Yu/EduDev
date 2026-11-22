import { BookOpen, Folder, Link as LinkIcon } from 'lucide-react';
import { Button } from '@heroui/react';
import { ChatSources } from '../../heroui-pro/components/chat-source';
import type { XiaozhiWorkspaceSnapshot } from '../../../shared/xiaozhi-agent';
import { ChatTool } from '../../heroui-pro/components/chat-tool';
import { PiMemoryScope } from './PiMemoryScope';
import { PiBudgetCard } from './PiBudgetCard';
import {PiUsageReceipt} from './PiUsageReceipt';
import {useState,type ReactNode} from 'react';
import { workspaceStatus } from './workspace-status';
import {PiLearningHistory} from './PiLearningHistory';
import {OfficeSourceItem,replySources} from './OfficeReplySources';
import {OfficeMutationBoundary} from './OfficeSynchronization';
import { PiTaskPlan } from './PiTaskPlan';
import {teacherWorkspaceLabel} from './workspace-label';
import {PiTaskContextSummary} from './PiTaskContextSummary';
import {latestConversationTurn,workspaceTaskScope} from './workspace-task-context';

export function PiWorkspaceContext({sessionId,snapshot,compactBusy,compacting,onCompact,onRefresh,goalControl}: {
  sessionId:string;snapshot?:XiaozhiWorkspaceSnapshot;compactBusy:boolean;compacting:boolean;
  onCompact:()=>void;onRefresh:()=>Promise<void>;
  goalControl?:ReactNode;
}) {
  const [browserMessage,setBrowserMessage]=useState('');
  const current=snapshot?.projection.turns.at(-1);
  const scope=workspaceTaskScope(snapshot);
  const status=workspaceStatus(snapshot,compactBusy||compacting);
  const visibleTurns=scope?snapshot?.projection.turns.filter(turn=>scope.runIds.has(turn.id)).reverse()??[]:[latestConversationTurn(snapshot)];
  const sourceRows=new Map(visibleTurns.flatMap(replySources).map(source=>{
    const {citationId:_id,...reference}=source;
    const key=JSON.stringify(reference);
    return [key,<OfficeSourceItem key={key} source={source} sessionId={sessionId}/>] as const;
  }));
  const sources=[...sourceRows.values()];
  const plan=snapshot?.controls?.findLast(control=>control.kind==='plan'&&(scope?scope.runIds.has(control.runId):control.runId===current?.id));
  return <div className="wb-task-context" data-testid="xiaozhi-pi-inspector" data-scope={scope?'task':'reply'} aria-label="小智任务与来源">
    <div className="pi-context-header"><span>{snapshot?.workspace?.label||'教师工作区'}</span></div>
    <div className="pi-context-status" data-testid="xiaozhi-pi-status" data-state={status.state} role="status" aria-live="polite"><BookOpen size={17} aria-hidden="true"/><span>{status.label}</span></div>
    <div className="pi-context-location"><Folder size={17}/><span>{snapshot?.workspace?'教学工作目录':'教师知识库'}</span><span className="pi-context-local">本地</span></div>
    {snapshot&&scope&&<PiTaskContextSummary snapshot={snapshot} scope={scope} onRefresh={onRefresh}/>}
    {snapshot?.taskUnavailable&&<p role="status">任务记录暂未同步，可以刷新会话后重试。</p>}
    {plan && <section aria-label="小智计划报告"><PiTaskPlan plan={plan} sessionId={sessionId} compact /></section>}
    {goalControl&&<section data-heroui-native="" className="default" data-theme="light" data-testid="pi-goal-aside">{goalControl}</section>}
    {snapshot?.browser?.open&&<section data-testid="pi-browser-panel"><Button size="sm" variant="ghost" data-testid="pi-browser-show" onPress={async()=>{const result=await window.omniEdu?.showXiaozhiBrowser(sessionId);setBrowserMessage(result?.ok?'':'浏览器已关闭，请让小智重新打开页面。');await onRefresh();}}>打开浏览器</Button>{snapshot.browser.tabs?.filter(tab=>tab.active).map(tab=><p key={tab.tabId}>{tab.title||new URL(tab.url).hostname}</p>)}{browserMessage&&<p role="status">{browserMessage}</p>}</section>}
    <section key={scope?.task.id||'reply'} className="pi-context-sources" data-testid="pi-web-aside"><h4><LinkIcon size={16}/>{scope?'任务已读资料':'本轮已读资料'}</h4>
      {sources.length ? <><ul>{sources.slice(0,3)}</ul>{sources.length>3&&<ChatSources defaultExpanded={false}><ChatSources.Trigger>查看全部（{sources.length}）</ChatSources.Trigger><ChatSources.Content><ul>{sources.slice(3)}</ul></ChatSources.Content></ChatSources>}</> : <p>{scope?'当前任务暂无可显示的已读资料。':'本轮暂无已读资料。'}</p>}
      {scope&&snapshot?.projection.hasMoreHistory&&visibleTurns.length<scope.runIds.size&&<p>向上查看较早对话后，可在这里看到对应的资料记录。</p>}
    </section>
    {snapshot?.studentContext?.status==='active'&&<PiLearningHistory key={`${sessionId}:${snapshot.studentContext.id}`} sessionId={sessionId} revision={(snapshot.learningReviews||[]).map(item=>`${item.id}:${item.state}:${item.version}`).join('|')}/>}
    <ChatTool state="output-available" defaultExpanded={false} data-testid="pi-task-details" className="pi-task-details">
      <ChatTool.Trigger data-testid="pi-task-details-expand">任务详情</ChatTool.Trigger>
      <ChatTool.Content>
        <section data-testid="pi-model-capabilities"><h4>模型</h4><p>DeepSeek · {snapshot?.projection.model || '正在读取'}</p>
          {snapshot?.modelCapabilities ? <><p>{snapshot.modelCapabilities.name}</p><p>模型上下文：{snapshot.modelCapabilities.contextWindow.toLocaleString()} Token</p><p>模型输出上限：{snapshot.modelCapabilities.maxOutputTokens.toLocaleString()} Token</p><p>{snapshot.modelCapabilities.source==='official'?'官方信息':snapshot.modelCapabilities.stale?'上次官方信息，待刷新':'官方信息 · 本地缓存'}</p></> : <p>模型能力待核实；首次调用时读取官方信息。</p>}
          {snapshot?.contextPolicy && <p>当前回复上限：{snapshot.contextPolicy.maxOutputTokens.toLocaleString()} Token；{snapshot.contextPolicy.auto?'自动整理已开启':'自动整理未开启'}{snapshot.contextPolicy.testPolicy?'（隔离验收策略）':''}</p>}
        </section>
        <OfficeMutationBoundary><section><h4>上下文</h4><Button variant="ghost" size="sm" data-testid="pi-compact" isDisabled={!snapshot||snapshot.running||compactBusy} onPress={onCompact}>{compacting?'正在压缩…':'压缩上下文'}</Button><p>整理较早上下文，原对话与本地记录保留。</p></section></OfficeMutationBoundary>
        {snapshot?.limitsEnforced===false && <section data-testid="pi-run-observation"><h4>本轮用量</h4><p>按任务继续运行；{snapshot.contextPolicy?.auto?'上下文自动整理已开启':'上下文能力待核实'}。</p><PiUsageReceipt runId={current?.id} usage={snapshot.usage?.find(item=>item.runId===current?.id)}/></section>}
        <OfficeMutationBoundary>{snapshot?.limitsEnforced!==false && snapshot?.budgetSettings && <PiBudgetCard key={`budget:${sessionId}`} sessionId={sessionId} settings={snapshot.budgetSettings} running={snapshot.running}
          usage={snapshot.usage?.find(item=>item.runId===current?.id)} onSave={async(version,budget)=>{
            const result=await window.omniEdu?.setXiaozhiBudget({sessionId,version,budget});if(!result?.ok)throw new Error('预算未保存，请重试。');await onRefresh();
          }}/>}
        {snapshot?.memoryScope && <PiMemoryScope key={`memory:${sessionId}`} sessionId={sessionId} scope={snapshot.memoryScope} running={snapshot.running}
          onRefresh={onRefresh} onSave={async input=>{const result=await window.omniEdu?.setXiaozhiMemoryScope(input);await onRefresh();if(!result?.ok)throw new Error('memory_scope_failed');}}/>}</OfficeMutationBoundary>
        <section><h4>资料范围</h4><p>{snapshot?.workspace?`工作目录：${teacherWorkspaceLabel(snapshot.workspace.label)}。文件复制逐次确认。`:'教师知识库中的可用片段。用“+”选择教学工作目录。'}学生原图与个人信息正文保持本地。</p></section>
      </ChatTool.Content>
    </ChatTool>
  </div>;
}
