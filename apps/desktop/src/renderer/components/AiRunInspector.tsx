import { Activity, CheckCircle2, Database, FileText, ShieldCheck } from 'lucide-react';
import type { AiConfirmationItem, AiConsoleRunResult, AiConversationMessage } from '../../shared/contracts';
import { normalizeAiConsoleError } from '../ai-console-error';

type Props = {
  result: AiConsoleRunResult | null;
  latestAssistant?: AiConversationMessage;
  running: boolean;
  confirmations: AiConfirmationItem[];
  onConfirm: (item: AiConfirmationItem) => Promise<void>;
  onReject: (item: AiConfirmationItem) => Promise<void>;
};

export function AiRunInspector({ result, latestAssistant, running, confirmations, onConfirm, onReject }: Props) {
  const visibleConfirmations = confirmations.slice(0, 3);
  const historicTools = Array.isArray(latestAssistant?.metadata.toolRuns) ? latestAssistant.metadata.toolRuns : [];
  const usedTools = result?.toolRuns.filter((tool) => tool.status !== 'ready').map((tool) => ({ name: tool.label || tool.name, status: tool.status, detail: tool.detail }))
    ?? historicTools.filter((tool): tool is Record<string, unknown> => Boolean(tool && typeof tool === 'object')).map((tool) => ({ name: String(tool.toolName ?? ''), status: String(tool.state ?? ''), detail: String(tool.argsText ?? '') }));
  const historicSources = Array.isArray(latestAssistant?.metadata.contextSources) ? latestAssistant.metadata.contextSources : [];
  const sources = result?.sources.map((source) => ({ title: source.title, detail: source.detail || source.type }))
    ?? historicSources.filter((source): source is Record<string, unknown> => Boolean(source && typeof source === 'object')).map((source) => ({ title: String(source.title ?? ''), detail: String(source.detail ?? '') }));
  const historicSteps = Array.isArray(latestAssistant?.metadata.thoughtSteps) ? latestAssistant.metadata.thoughtSteps : [];
  const steps = result?.harness?.trace.map((step) => ({ label: step.label, detail: step.detail, status: step.status }))
    ?? historicSteps.filter((step): step is Record<string, unknown> => Boolean(step && typeof step === 'object')).map((step) => ({ label: String(step.label ?? ''), detail: String(step.detail ?? ''), status: 'succeeded' }));
  const hasResponse = Boolean(result || latestAssistant);
  const responseOk = result?.ok ?? latestAssistant?.metadata.ok === true;
  const errorMessage = result?.errorMessage || String(latestAssistant?.metadata.errorMessage ?? '');
  return (
    <aside className="ai-run-inspector" aria-label="小智运行与来源" data-testid="ai-run-inspector">
      <div className="ai-inspector-heading"><strong>本轮任务</strong><span>{running ? '运行中' : hasResponse ? responseOk ? '已完成' : '失败' : '等待提问'}</span></div>
      <div className="ai-inspector-scroll">
        <section className="ai-inspector-section">
          <h3><Activity size={15} />运行状态</h3>
          {result?.harness?.agentRunId || latestAssistant?.metadata.agentRunId ? <p className="ai-inspector-run-id">{String(result?.harness?.agentRunId || latestAssistant?.metadata.agentRunId)}</p> : null}
          <p>{running ? '小智正在处理这轮请求。' : responseOk ? '模型已返回结果。需要写入的内容仍待教师确认。' : errorMessage ? normalizeAiConsoleError(errorMessage, latestAssistant?.metadata.provider === 'glm' ? 'glm' : 'deepseek') : '发送问题后显示真实执行状态。'}</p>
          {steps.length ? <ol className="ai-inspector-steps">{steps.slice(-6).map((step, index) => <li key={`${step.label}-${index}`}><span data-status={step.status} /><div><strong>{step.label}</strong><small>{step.detail}</small></div></li>)}</ol> : null}
        </section>
        <section className="ai-inspector-section">
          <h3><Database size={15} />来源</h3>
          {sources.length ? <ul className="ai-inspector-list">{sources.slice(0, 8).map((source, index) => <li key={`${source.title}-${index}`}><strong>{source.title}</strong><small>{source.detail}</small></li>)}</ul> : <p>本轮尚无可展示的来源。</p>}
        </section>
        <section className="ai-inspector-section">
          <h3><ShieldCheck size={15} />工具活动</h3>
          {usedTools.length ? <ul className="ai-inspector-list">{usedTools.slice(0, 8).map((tool, index) => <li key={`${tool.name}-${index}`}><strong>{tool.name} · {tool.status}</strong><small>{tool.detail}</small></li>)}</ul> : <p>本轮尚未调用工具。</p>}
        </section>
        <section className="ai-inspector-section ai-inspector-confirmations" data-testid="ai-confirmation-queue">
          <h3><FileText size={15} />待教师确认 <span>{confirmations.length}</span></h3>
          {visibleConfirmations.length ? visibleConfirmations.map((item) => <article key={item.id} className="ai-inspector-confirmation" data-testid={`ai-confirmation-${item.id}`}>
            <strong>{item.title}</strong>
            <p>{item.description || '确认后写入本地数据。'}</p>
            <div className="ai-inspector-confirmation-actions">
              <button className="primary-action compact-button" onClick={() => void onConfirm(item)} data-testid={`ai-confirm-${item.id}`}><CheckCircle2 size={14} />确认保存</button>
              <button className="secondary-action compact-button" onClick={() => void onReject(item)} data-testid={`ai-reject-${item.id}`}>拒绝</button>
            </div>
          </article>) : <p>暂无待确认写入。</p>}
          {confirmations.length > visibleConfirmations.length ? <p>还有 {confirmations.length - visibleConfirmations.length} 项待处理。</p> : null}
        </section>
      </div>
    </aside>
  );
}
