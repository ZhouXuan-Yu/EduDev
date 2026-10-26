import { Check, CircleHelp, Globe, LoaderCircle, Pause, Search, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { OfficeProjectedItem } from '../../../shared/office-agent';
import { validToolAttempt } from '../../../shared/xiaozhi-tool-attempt';
import { WebSearch, getWebSearchRowCount, type WebSearchSource, type WebSearchStep } from '../../vendor/boardui-web-search';
import { formatProcessDuration } from './office-process';
import './office-web-search.css';

type State = NonNullable<WebSearchStep['status']>;
export function isWebSearchItem(item: OfficeProjectedItem): boolean {
  if (item.toolAttempt && !validToolAttempt(item.toolAttempt)) return false;
  const name = item.toolAttempt?.tool;
  return name ? name === 'office_web_search' || name === 'office_web_fetch'
    : item.label === '联网搜索' || item.label === '读取公开网页';
}
function stateOf(item: OfficeProjectedItem): State {
  if (item.status === 'inProgress' && validToolAttempt(item.toolAttempt) && item.toolAttempt.state === 'queued') return 'waiting';
  if (item.status === 'inProgress') return 'running';
  if (item.toolAttempt?.code === 'cancelled') return 'stopped';
  if (item.status === 'completed') return 'completed';
  if (item.status === 'failed' || item.status === 'declined') return 'failed';
  if (item.status === 'waiting_approval' || item.status === 'waiting_input') return 'waiting';
  return 'unknown';
}
const labels: Record<State, string> = { running: '正在执行', completed: '已完成', failed: '未完成', waiting: '等待操作', stopped: '已停止', unknown: '等待状态同步' };
const icons = { running: LoaderCircle, completed: Check, failed: X, waiting: Pause, stopped: Pause, unknown: CircleHelp };
function sourceUrl(raw?: string): URL | undefined {
  try { const url = new URL(raw || ''); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : undefined; }
  catch { return undefined; }
}

/** A read-only view of host receipts. Animation never completes a tool or a run. */
export function OfficeWebSearchProcess({ items, sessionId, renderDetails }: {
  items: OfficeProjectedItem[]; sessionId?: string; renderDetails: (item: OfficeProjectedItem) => ReactNode;
}) {
  const [notice, setNotice] = useState('');
  const states = items.map(stateOf);
  const state: State = states.includes('running') ? 'running' : states.includes('failed') ? 'failed'
    : states.includes('waiting') ? 'waiting' : states.includes('stopped') ? 'stopped' : states.includes('unknown') ? 'unknown' : 'completed';
  const completed = states.filter(value => value === 'completed').length;
  const steps = useMemo<WebSearchStep[]>(() => [
    { id: 'summary', label: '联网检索', icon: Search, heading: true,
      meta: `${completed}/${items.length} 已完成 · ${labels[state]}` },
    ...items.map(item => {
      const status = stateOf(item);
      const statusLabel = item.status === 'inProgress' && item.toolAttempt?.state === 'queued' ? '等待读取' : labels[status];
      const sources: WebSearchSource[] = (item.sources || []).flatMap(source => {
        const url = sourceUrl(source.url);
        if (!url) return [];
        const stamp = source.observedAt && Number.isFinite(Date.parse(source.observedAt)) ? ` · ${new Date(source.observedAt).toLocaleString('zh-CN')}` : '';
        return [{ title: source.title, domain: `${url.hostname} · ${source.kind === 'read' ? '已读正文' : '搜索摘要'}${stamp}`, href: url.href, icon: <Globe size={15} aria-hidden="true" /> }];
      });
      return { id: item.id, label: item.label || '联网检索', status, icon: icons[status], sources,
        meta: `${statusLabel}${item.webEmpty ? ' · 无可用结果' : sources.length ? ` · ${sources.length} 个来源` : ''}${item.durationMs !== undefined ? ` · ${formatProcessDuration(item.durationMs)}` : ''}`,
        details: <details className="office-web-search-details" open={status === 'failed' || status === 'stopped' || status === 'waiting' || status === 'unknown' ? true : undefined}>
          <summary>查看操作详情</summary>{renderDetails(item)}
        </details> };
    }),
  ], [items, completed, state]);

  const openSource = (source: WebSearchSource) => {
    if (!sessionId || !sourceUrl(source.href) || !window.omniEdu) { setNotice('来源暂不可打开，请刷新对话后重试。'); return; }
    setNotice('');
    void window.omniEdu.openXiaozhiWebSource({ sessionId, url: source.href! })
      .then(result => setNotice(result.ok ? '' : '来源未打开，请检查网络后重试。'))
      .catch(() => setNotice('来源未打开，请重试。'));
  };
  return <div className="office-web-search-process" data-testid="pi-web-search-process" data-process-group-id={items[0]?.id} data-call-count={items.length} data-state={state}>
    <WebSearch steps={steps} state={state} revealed={getWebSearchRowCount(steps)} working="正在检索" sourcesLabel="引用来源" ariaLabel="联网检索过程" onSourceOpen={openSource} />
    {notice && <p role="alert">{notice}</p>}
  </div>;
}
