import { Database, History, RefreshCw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AiMemoryDocument,
  AiMemoryDocumentDetail,
  AiMemoryEntry,
  AiMemoryEvidenceGraph,
  AiMemoryGovernanceReport,
  AiMemoryL3Document,
  AiMemoryL3DocumentDetail,
  AiMemoryL3Entry,
  AiMemoryL3Slot,
  AiMemoryRevision,
  AiMemorySurface,
} from '../../shared/contracts';

type Props = { setStatus: (message: string) => void };
type L2Draft = { section: string; text: string; refs: string[] };
type L3Draft = { text: string; sourceDocuments: AiMemorySurface[] };

const surfaces: AiMemorySurface[] = ['chat', 'notebook', 'quiz', 'kb', 'book', 'partner', 'cowriter'];
const slots: AiMemoryL3Slot[] = ['recent', 'profile', 'scope', 'preferences'];

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未知时间';
}

function revisionSummary(revision: AiMemoryRevision) {
  const after = revision.after;
  return typeof after?.text === 'string' ? after.text : revision.action;
}

export function MemoryGovernanceWorkspace({ setStatus }: Props) {
  const [surface, setSurface] = useState<AiMemorySurface>('chat');
  const [documents, setDocuments] = useState<AiMemoryDocument[]>([]);
  const [detail, setDetail] = useState<AiMemoryDocumentDetail | null>(null);
  const [l2Drafts, setL2Drafts] = useState<L2Draft[]>([]);
  const [l2Edits, setL2Edits] = useState<Record<string, string>>({});
  const [revisions, setRevisions] = useState<Record<string, AiMemoryRevision[]>>({});
  const [slot, setSlot] = useState<AiMemoryL3Slot>('profile');
  const [l3Documents, setL3Documents] = useState<AiMemoryL3Document[]>([]);
  const [l3Detail, setL3Detail] = useState<AiMemoryL3DocumentDetail | null>(null);
  const [l3Drafts, setL3Drafts] = useState<L3Draft[]>([]);
  const [l3Edits, setL3Edits] = useState<Record<string, string>>({});
  const [graph, setGraph] = useState<AiMemoryEvidenceGraph | null>(null);
  const [governance, setGovernance] = useState<AiMemoryGovernanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  function showNotice(message: string) {
    setNotice(message); setErrorMessage(''); setStatus(message);
  }

  function showError(error: unknown, fallback: string) {
    const rawMessage = error instanceof Error ? error.message : fallback;
    const message = /version conflict/i.test(rawMessage) ? `版本冲突：${rawMessage}` : rawMessage;
    setErrorMessage(message); setNotice(''); setStatus(message);
  }

  async function loadL2(nextSurface = surface) {
    const [nextDocuments, nextDetail] = await Promise.all([
      window.omniEdu?.listAiMemoryDocuments(),
      window.omniEdu?.getAiMemoryDocument(nextSurface),
    ]);
    setDocuments(nextDocuments ?? []);
    setDetail(nextDetail ?? null);
    if (nextDetail) setL2Edits((current) => ({ ...current, ...Object.fromEntries(nextDetail.entries.map((entry) => [entry.id, entry.text])) }));
  }

  async function loadL3(nextSlot = slot) {
    const [nextDocuments, nextDetail] = await Promise.all([
      window.omniEdu?.listAiMemoryL3Documents(),
      window.omniEdu?.getAiMemoryL3Document(nextSlot),
    ]);
    setL3Documents(nextDocuments ?? []);
    setL3Detail(nextDetail ?? null);
    if (nextDetail) setL3Edits((current) => ({ ...current, ...Object.fromEntries(nextDetail.entries.map((entry) => [entry.id, entry.text])) }));
  }

  async function loadGovernance() {
    const [nextGraph, nextGovernance] = await Promise.all([
      window.omniEdu?.getAiMemoryEvidenceGraph(200),
      window.omniEdu?.getAiMemoryGovernanceReport(),
    ]);
    setGraph(nextGraph ?? null); setGovernance(nextGovernance ?? null);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([loadL2(), loadL3(), loadGovernance()]);
    } catch (error) { showError(error, '读取记忆治理数据失败，请稍后重试。'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refreshAll(); }, []);
  useEffect(() => { void loadL2(surface).catch((error) => showError(error, '读取 L2 记忆失败。')); }, [surface]);
  useEffect(() => { void loadL3(slot).catch((error) => showError(error, '读取 L3 综合失败。')); }, [slot]);

  async function runAction(action: () => Promise<void>, success: string, fallback: string) {
    setSaving(true);
    try { await action(); await Promise.all([loadL2(), loadL3(), loadGovernance()]); showNotice(success); }
    catch (error) {
      try { await Promise.all([loadL2(), loadL3(), loadGovernance()]); } catch { /* preserve the last successful readback */ }
      showError(error, fallback);
    } finally { setSaving(false); }
  }

  async function draftL2() {
    setSaving(true);
    try {
      const draft = await window.omniEdu?.draftAiMemorySummary(surface, undefined, 8);
      setL2Drafts((draft?.entries ?? []).map((entry) => ({ section: entry.section, text: entry.text, refs: entry.refs.map((ref) => ref.ref) })));
      showNotice(draft?.entries.length ? '已生成有界 L2 候选；教师采纳前不会写入正式记忆。' : '当前没有可用于生成 L2 候选的本地运行证据。');
    } catch (error) { showError(error, '生成 L2 候选失败。'); }
    finally { setSaving(false); }
  }

  async function adoptL2(draft: L2Draft) {
    await runAction(async () => {
      await window.omniEdu?.createAiMemoryEntry({ surface, section: draft.section, text: draft.text, refs: draft.refs, origin: 'teacher' });
      setL2Drafts((current) => current.filter((item) => item !== draft));
    }, '教师已采纳 L2 候选，SQLite 与证据引用已回读。', '采纳 L2 候选失败。');
  }

  async function updateL2(entry: AiMemoryEntry, update: { text?: string; status?: 'active' | 'disabled' }) {
    const text = update.text?.trim();
    if (update.text != null && !text) { showError(null, 'L2 记忆内容不能为空。'); return; }
    await runAction(async () => { await window.omniEdu?.updateAiMemoryEntry(entry.id, { version: entry.version, ...update, ...(text ? { text } : {}) }); }, 'L2 记忆已按版本锁更新并保留修订记录。', '更新 L2 记忆失败，可能存在版本冲突。');
  }

  async function deleteL2(entry: AiMemoryEntry) {
    await runAction(async () => { await window.omniEdu?.deleteAiMemoryEntry(entry.id, entry.version); }, 'L2 记忆已软删除并保留审计记录。', '删除 L2 记忆失败，可能存在版本冲突。');
  }

  async function loadRevisions(entry: AiMemoryEntry) {
    try {
      const next = await window.omniEdu?.listAiMemoryRevisions(entry.id, 50) ?? [];
      setRevisions((current) => ({ ...current, [entry.id]: next }));
    }
    catch (error) { showError(error, '读取修订历史失败。'); }
  }

  async function draftL3() {
    setSaving(true);
    try {
      const draft = await window.omniEdu?.draftAiMemoryL3(slot, 8);
      setL3Drafts(draft?.entries ?? []);
      showNotice(draft?.entries.length ? '已生成 L3 综合候选；教师采纳前不会写入正式记忆。' : '当前没有足够的已确认 L2 条目。');
    } catch (error) { showError(error, '生成 L3 候选失败。'); }
    finally { setSaving(false); }
  }

  async function adoptL3(draft: L3Draft) {
    await runAction(async () => {
      await window.omniEdu?.createAiMemoryL3Entry({ slot, text: draft.text, sourceDocuments: draft.sourceDocuments });
      setL3Drafts((current) => current.filter((item) => item !== draft));
    }, '教师已采纳 L3 综合，来源 surface 已回读。', '采纳 L3 综合失败。');
  }

  async function updateL3(entry: AiMemoryL3Entry, update: { text?: string; status?: 'active' | 'disabled' }) {
    const text = update.text?.trim();
    if (update.text != null && !text) { showError(null, 'L3 综合内容不能为空。'); return; }
    await runAction(async () => { await window.omniEdu?.updateAiMemoryL3Entry(entry.id, { version: entry.version, ...update, ...(text ? { text } : {}) }); }, 'L3 综合已按版本锁更新。', '更新 L3 综合失败，可能存在版本冲突。');
  }

  const entries = detail?.entries ?? [];
  const l3Entries = l3Detail?.entries ?? [];

  return (
    <div className="page-grid memory-governance-view" data-testid="memory-governance-workspace">
      <section className="work-panel span-2">
        <div className="workspace-label"><span>01</span><div><h2>L2 可检查记忆</h2><p>候选来自本地运行事件；只有教师采纳后才写入，可修订、停用、恢复或软删除。</p></div></div>
        <div className="toolbar-row"><label>工作表面<select value={surface} onChange={(event) => { setL2Drafts([]); setSurface(event.target.value as AiMemorySurface); }} data-testid="memory-surface-select">{surfaces.map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary-action" onClick={() => void draftL2()} disabled={saving} data-testid="memory-draft-l2"><Sparkles size={16} />生成 L2 候选</button><button className="secondary-action" onClick={() => void refreshAll()} disabled={loading} data-testid="memory-refresh"><RefreshCw size={16} />刷新</button></div>
        {loading ? <p data-testid="memory-loading">正在读取本地记忆治理数据…</p> : null}
        {errorMessage ? <div className="warning-box" role="alert" data-testid="memory-error">{errorMessage}</div> : null}
        {notice ? <div className="success-box" role="status" data-testid="memory-success">{notice}</div> : null}
        {l2Drafts.length ? <div className="stack compact-stack" data-testid="memory-l2-drafts">{l2Drafts.map((draft, index) => <article className="evidence-card" key={`${draft.section}-${index}`}><strong>{draft.section}</strong><p>{draft.text}</p><small>证据：{draft.refs.join('、')}</small><button className="secondary-action" onClick={() => void adoptL2(draft)} disabled={saving} data-testid={`memory-adopt-l2-${index}`}>教师采纳</button></article>)}</div> : null}
      </section>

      <section className="work-panel span-2" data-testid="memory-l2-records">
        <div className="workspace-label"><span>02</span><div><h2>{detail?.document.title ?? `${surface} 尚无正式记忆`}</h2><p>操作失败不会隐藏上次成功读取的数据；版本冲突会阻止覆盖。</p></div></div>
        <div className="memory-record-list">{entries.map((entry) => <article className={`memory-entry memory-status-${entry.status}`} key={entry.id} data-testid={`memory-l2-entry-${entry.id}`}><div className="memory-entry-header"><strong>{entry.section}</strong><span>{entry.status} · v{entry.version} · {entry.origin === 'teacher' ? '教师确认' : '派生候选'}</span></div><textarea value={l2Edits[entry.id] ?? entry.text} onChange={(event) => setL2Edits({ ...l2Edits, [entry.id]: event.target.value })} disabled={entry.status === 'deleted'} data-testid={`memory-l2-text-${entry.id}`} /><small>证据：{entry.refs.map((ref) => `${ref.kind}:${ref.id}`).join('、') || '无'}</small><div className="toolbar-row">{entry.status !== 'deleted' ? <button className="secondary-action" onClick={() => void updateL2(entry, { text: l2Edits[entry.id] ?? entry.text })} disabled={saving} data-testid={`memory-save-l2-${entry.id}`}>保存修订</button> : null}{entry.status === 'active' ? <button className="ghost-action" onClick={() => void updateL2(entry, { status: 'disabled' })} disabled={saving} data-testid={`memory-disable-l2-${entry.id}`}>停用</button> : null}{entry.status === 'disabled' ? <button className="ghost-action" onClick={() => void updateL2(entry, { status: 'active' })} disabled={saving} data-testid={`memory-restore-l2-${entry.id}`}>恢复</button> : null}{entry.status !== 'deleted' ? <button className="ghost-action danger-action" onClick={() => void deleteL2(entry)} disabled={saving} data-testid={`memory-delete-l2-${entry.id}`}><Trash2 size={15} />软删除</button> : null}<button className="ghost-action" onClick={() => void loadRevisions(entry)} data-testid={`memory-revisions-l2-${entry.id}`}><History size={15} />修订历史</button></div>{revisions[entry.id] ? <div className="memory-revision-list" data-testid={`memory-revision-list-${entry.id}`}>{revisions[entry.id].map((revision) => <div key={revision.id}><strong>{revision.action}</strong><span> {formatTime(revision.createdAt)} · {revisionSummary(revision)}</span></div>)}</div> : null}</article>)}{!entries.length && !loading ? <div className="empty-state" data-testid="memory-l2-empty">当前 surface 还没有正式 L2 记忆。</div> : null}</div>
      </section>

      <section className="work-panel span-2" data-testid="memory-l3-panel">
        <div className="workspace-label"><span>03</span><div><h2>L3 跨表面综合</h2><p>只综合已确认的 L2，按槽位保存，并始终保留来源 surface。</p></div></div>
        <div className="toolbar-row"><label>综合槽位<select value={slot} onChange={(event) => { setL3Drafts([]); setSlot(event.target.value as AiMemoryL3Slot); }} data-testid="memory-l3-slot">{slots.map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary-action" onClick={() => void draftL3()} disabled={saving} data-testid="memory-draft-l3"><Sparkles size={16} />生成 L3 候选</button></div>
        {l3Drafts.length ? <div data-testid="memory-l3-drafts">{l3Drafts.map((draft, index) => <article className="evidence-card" key={`${draft.text}-${index}`}><p>{draft.text}</p><small>来源：{draft.sourceDocuments.join('、')}</small><button className="secondary-action" onClick={() => void adoptL3(draft)} disabled={saving} data-testid={`memory-adopt-l3-${index}`}>教师采纳</button></article>)}</div> : null}
        <div className="memory-record-list">{l3Entries.map((entry) => <article className={`memory-entry memory-status-${entry.status}`} key={entry.id} data-testid={`memory-l3-entry-${entry.id}`}><div className="memory-entry-header"><strong>{entry.slot}</strong><span>{entry.status} · v{entry.version}</span></div><textarea value={l3Edits[entry.id] ?? entry.text} onChange={(event) => setL3Edits({ ...l3Edits, [entry.id]: event.target.value })} data-testid={`memory-l3-text-${entry.id}`} /><small>来源：{entry.sourceDocuments.join('、')}</small><div className="toolbar-row"><button className="secondary-action" onClick={() => void updateL3(entry, { text: l3Edits[entry.id] ?? entry.text })} disabled={saving} data-testid={`memory-save-l3-${entry.id}`}>保存修订</button>{entry.status === 'active' ? <button className="ghost-action" onClick={() => void updateL3(entry, { status: 'disabled' })} disabled={saving} data-testid={`memory-disable-l3-${entry.id}`}>停用</button> : <button className="ghost-action" onClick={() => void updateL3(entry, { status: 'active' })} disabled={saving} data-testid={`memory-restore-l3-${entry.id}`}>恢复</button>}</div></article>)}{!l3Entries.length && !l3Drafts.length && !loading ? <div className="empty-state" data-testid="memory-l3-empty">当前槽位还没有 L3 综合。</div> : null}</div>
      </section>

      <section className="work-panel" data-testid="memory-governance-report">
        <div className="workspace-label"><span>04</span><div><h2>治理报告</h2><p>{governance?.policyVersion ?? 'memory-governance.v1'}</p></div></div>
        {governance ? <div className="memory-metric-grid"><span>L2 文档<strong>{governance.l2Documents}</strong></span><span>L2 启用<strong>{governance.l2ActiveEntries}</strong></span><span>L3 文档<strong>{governance.l3Documents}</strong></span><span>L3 启用<strong>{governance.l3ActiveEntries}</strong></span><span>停用<strong>{governance.disabledEntries}</strong></span><span>已删除<strong>{governance.deletedEntries}</strong></span><span className={governance.danglingEvidenceRefs ? 'metric-warning' : ''}>悬空引用<strong>{governance.danglingEvidenceRefs}</strong></span><span>AI 直写<strong>{governance.writableByAi ? '开启' : '关闭'}</strong></span></div> : <div className="empty-state">治理报告尚未加载。</div>}
      </section>

      <section className="work-panel" data-testid="memory-evidence-graph">
        <div className="workspace-label"><span>05</span><div><h2>有界证据图</h2><p>{graph ? `${graph.nodes.length} 节点 · ${graph.edges.length} 边` : '尚未加载'}</p></div></div>
        <div className="memory-graph-list">{graph?.nodes.slice(0, 30).map((node) => <div key={node.id} data-testid={`memory-graph-node-${node.kind}`}><span className="status-chip">{node.kind}</span><strong>{node.label}</strong><small>{node.status}</small></div>)}{graph && !graph.nodes.length ? <span>当前没有可追溯节点。</span> : null}</div>
      </section>

      <section className="work-panel span-2">
        <div className="workspace-label"><span>06</span><div><h2>安全边界</h2></div></div><div className="system-list"><span><ShieldCheck size={16} />不展示隐藏推理、完整 prompt 或学生原文</span><span><Database size={16} />证据必须命中本地 run/event，AI 不能直接写正式记忆</span><span><History size={16} />L2 修订可审计；软删除记录不伪装成可恢复能力</span><span><ShieldCheck size={16} />证据图有界：{graph?.bounded === true ? '是' : '待加载'} · 原始 prompt：{graph?.rawPromptIncluded ? '包含' : '不包含'} · 隐藏推理：{graph?.hiddenReasoningIncluded ? '包含' : '不包含'}</span></div>
      </section>

      <aside hidden aria-hidden="true">{documents.length + l3Documents.length}</aside>
    </div>
  );
}
