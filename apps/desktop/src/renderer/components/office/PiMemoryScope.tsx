import { useEffect, useRef, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Button } from '@heroui/react';
import { ChatTool } from '../../heroui-pro/components/chat-tool';
import type { XiaozhiMemoryCatalog, XiaozhiMemoryScope, XiaozhiMemoryScopeInput, XiaozhiMemorySelection, XiaozhiMemorySource, XiaozhiMemoryTrace } from '../../../shared/xiaozhi-memory';
import { XIAOZHI_MEMORY_LABELS, XIAOZHI_MEMORY_SLOTS, XIAOZHI_MEMORY_SURFACES, projectMemorySource } from '../../../shared/xiaozhi-memory';

const key = (item: XiaozhiMemorySelection) => `${item.layer}:${item.source}:${item.id}`;
const states = { ready: '版本有效', changed: '内容已变更，请重新选择', disabled: '已停用', missing: '已删除或不存在', unavailable: '暂时无法核验' };
const sources: XiaozhiMemorySource[] = [
  ...XIAOZHI_MEMORY_SURFACES.map(source => ({ layer: 'L2' as const, source })),
  ...XIAOZHI_MEMORY_SLOTS.map(source => ({ layer: 'L3' as const, source })),
];
export function PiMemoryScope({ sessionId, scope, running, onSave, onRefresh }: {
  sessionId: string; scope: XiaozhiMemoryScope; running: boolean;
  onSave: (input: XiaozhiMemoryScopeInput) => Promise<void>; onRefresh: () => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(scope.enabled);
  const [selected, setSelected] = useState<XiaozhiMemorySelection[]>(scope.selections.map(item => ({ ...projectMemorySource(item), id: item.id, version: item.version })));
  const [sourceIndex, setSourceIndex] = useState(0), [catalog, setCatalog] = useState<XiaozhiMemoryCatalog>();
  const [trace, setTrace] = useState<XiaozhiMemoryTrace | null>();
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const request = useRef(0), mutation = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++; }; }, []);
  useEffect(() => {
    setEnabled(scope.enabled);
    setSelected(scope.selections.map(item => ({ ...projectMemorySource(item), id: item.id, version: item.version })));
  }, [scope.version]);
  async function preview(index = sourceIndex, offset = 0) {
    const stamp = ++request.current; setLoading(true); setError('');
    try {
      const api = window.omniEdu; if (!api) throw new Error('configuration');
      const [result, ownTrace] = await Promise.all([
        api.getXiaozhiMemoryCatalog({ sessionId, ...sources[index], offset }),
        api.getXiaozhiMemoryTrace(sessionId),
      ]);
      if (!mounted.current || stamp !== request.current) return;
      if (!result.ok) throw new Error('preview_failed');
      setCatalog(result.catalog); setTrace(ownTrace);
    } catch { if (mounted.current && stamp === request.current) setError('无法读取本地记忆，请刷新重试。'); }
    finally { if (mounted.current && stamp === request.current) setLoading(false); }
  }
  async function save(clear = false) {
    if (running && !clear || mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await onSave({ sessionId, version: scope.version, enabled: clear ? false : enabled, selections: clear ? [] : selected });
      if (mounted.current) setNotice(clear ? '本会话选择已关闭并清空。' : scope.modelAccess === 'available' ? '选择已保存；小智可通过工具读取所选脱敏摘要。' : '选择已保存；模型读取尚未接入。');
    } catch { if (mounted.current) setError('保存未成功，可能已变更版本或正在运行。请刷新后重新选择。'); }
    finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }
  return <ChatTool state="output-available" className="pi-memory-scope" data-testid="pi-memory-scope" data-version={scope.version}>
    <ChatTool.Trigger><History size={15} aria-hidden="true" /><span>本会话记忆</span><span>{scope.enabled ? `${scope.selections.length} 项选择` : '未开启'}</span></ChatTool.Trigger>
    <ChatTool.Content>
      <p data-testid="pi-memory-model-access">{scope.modelAccess === 'available' ? '小智可通过工具读取本会话所选的脱敏摘要，并显示来源回执。' : '本地预览与选择；模型读取尚未接入。'}</p>
      <label className="pi-memory-switch"><input type="checkbox" checked={enabled} disabled={busy || running} onChange={event => setEnabled(event.target.checked)} data-testid="pi-memory-enabled" />允许本会话引用所选的必要脱敏摘要</label>
      <p>当前查看保留在本机。旧记忆不会自动分享给新会话。</p>
      {running && <p role="status">本轮结束或停止后可修改选择。“关闭并清空”会先停止本轮，再撤销记忆引用。</p>}
      <ul className="pi-memory-selected" data-testid="pi-memory-selected">{scope.selections.map(item => <li key={key(item)} data-memory-id={item.id} data-state={item.state}>
        <span>{item.label} · v{item.version} · {selected.some(entry => key(entry) === key(item)) ? states[item.state] : '已取消，待保存'}</span>
        <Button size="sm" variant="ghost" isDisabled={busy || running} data-testid={`pi-memory-remove-${item.id}`} onPress={() => setSelected(previous => previous.filter(entry => key(entry) !== key(item)))}>取消选择</Button>
      </li>)}</ul>
      {!scope.selections.length && <p data-testid="pi-memory-scope-empty">尚未选择长期记忆。</p>}
      <label>本地记忆来源<select value={sourceIndex} onChange={event => { const index = Number(event.target.value); setSourceIndex(index); setCatalog(undefined); void preview(index); }} data-testid="pi-memory-source">
        {sources.map((source, index) => <option key={`${source.layer}:${source.source}`} value={index}>{source.layer} · {XIAOZHI_MEMORY_LABELS[source.source]}</option>)}
      </select></label>
      <div className="pi-memory-actions">
        <Button size="sm" variant="outline" isDisabled={loading} onPress={() => { void preview(); }} data-testid="pi-memory-preview"><History size={14} />查看本地记忆</Button>
        <Button size="sm" variant="ghost" isDisabled={busy || loading} onPress={() => { void onRefresh().then(() => preview()).catch(() => setError('刷新失败，请重试。')); }} data-testid="pi-memory-refresh"><RefreshCw size={14} />刷新</Button>
      </div>
      {loading && <p role="status">正在读取本地记忆…</p>}
      {catalog && <div data-testid="pi-memory-catalog">
        <p>{catalog.total} 条 · 当前 {catalog.entries.length ? catalog.offset + 1 : 0}–{catalog.offset + catalog.entries.length}</p>
        {!catalog.entries.length && <p>该来源尚无记忆。</p>}
        {catalog.entries.map(item => {
          const checked = selected.some(entry => key(entry) === key(item) && entry.version === item.version);
          return <article key={key(item)} data-testid={`pi-memory-entry-${item.id}`} className="pi-memory-entry">
            <label><input type="checkbox" checked={checked} disabled={busy || running || !checked && (item.status !== 'active' || selected.length >= 12 && !selected.some(entry => key(entry) === key(item)))} data-testid={`pi-memory-select-${item.id}`}
              onChange={event => setSelected(previous => event.target.checked ? [...previous.filter(entry => key(entry) !== key(item)), { ...projectMemorySource(item), id: item.id, version: item.version }] : previous.filter(entry => key(entry) !== key(item)))} />{item.section} · v{item.version} · {item.status === 'active' ? '有效' : item.status === 'disabled' ? '已停用' : '已删除'}</label>
            <p data-testid="pi-memory-local-text">{item.text}</p>
            <details><summary>查看脱敏摘要</summary><p data-testid="pi-memory-sanitized-text">{item.sanitizedText}</p></details>
            <p data-testid="pi-memory-provenance">{item.provenance === 'surface_only' ? `仅有来源分类：${item.sourceDocuments.map(source => XIAOZHI_MEMORY_LABELS[source]).join('、')}；没有逐条证据。`
              : item.provenance === 'event_refs' ? `记录引用 ${item.referenceCount} 项；不表示结论已经核实。` : '没有记录来源引用。'}</p>
            {item.refs.length > 0 && <details><summary>来源记录</summary><ul>{item.refs.map(ref => <li key={`${ref.kind}:${ref.id}`}>{ref.label} · {ref.kind === 'run' ? '任务' : '事件'} · {ref.id}</li>)}</ul></details>}
          </article>;
        })}
        <div className="pi-memory-actions">
          <Button size="sm" variant="ghost" isDisabled={loading || catalog.offset === 0} onPress={() => { void preview(sourceIndex, Math.max(0, catalog.offset - 50)); }} data-testid="pi-memory-prev">上一页</Button>
          <Button size="sm" variant="ghost" isDisabled={loading || !catalog.hasMore} onPress={() => { void preview(sourceIndex, catalog.offset + 50); }} data-testid="pi-memory-next">下一页</Button>
        </div>
      </div>}
      {trace !== undefined && <details data-testid="pi-memory-own-trace"><summary>本会话最近过程记录</summary>{trace ? <ul>{trace.events.map(event => <li key={event.sequence}>{event.label} · {event.status}</li>)}</ul> : <p>本会话尚无过程记录。</p>}</details>}
      <p>当前选择 {selected.length}/12 项。记忆编辑、停用及删除仍在工作台“L2 记忆”中完成。</p>
      <div className="pi-memory-actions">
        <Button size="sm" variant="outline" isDisabled={busy || running} onPress={() => { void save(); }} data-testid="pi-memory-save">保存本会话选择</Button>
        <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => { void save(true); }} data-testid="pi-memory-clear">关闭并清空</Button>
      </div>
      {error && <p role="alert" data-testid="pi-memory-error">{error}</p>}{notice && <p role="status" data-testid="pi-memory-notice">{notice}</p>}
    </ChatTool.Content>
  </ChatTool>;
}
