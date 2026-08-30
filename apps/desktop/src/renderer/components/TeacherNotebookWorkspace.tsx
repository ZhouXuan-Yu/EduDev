import { ArchiveRestore, BookOpenCheck, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TeacherNotebook, TeacherNotebookRecord, TeacherNotebookRecordType } from '../../shared/contracts';

type Props = { setStatus: (message: string) => void };

const recordTypeLabels: Record<TeacherNotebookRecordType, string> = {
  solve: '解题', question: '问题', research: '研究', chat: '对话', co_writer: '协作写作', tutorbot: '辅导', guided_learning: '引导学习',
};

const emptyRecordDraft = { recordType: 'research' as TeacherNotebookRecordType, title: '', summary: '', userQuery: '', output: '' };

export function TeacherNotebookWorkspace({ setStatus }: Props) {
  const [notebooks, setNotebooks] = useState<TeacherNotebook[]>([]);
  const [records, setRecords] = useState<TeacherNotebookRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [includeDeletedRecords, setIncludeDeletedRecords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recordDraft, setRecordDraft] = useState(emptyRecordDraft);
  const [editingRecordId, setEditingRecordId] = useState('');

  const selected = useMemo(() => notebooks.find((item) => item.id === selectedId), [notebooks, selectedId]);

  async function loadNotebooks(preferredId = selectedId, showDeleted = includeDeleted) {
    setLoading(true);
    setErrorMessage('');
    try {
      const next = await window.omniEdu?.listTeacherNotebooks(showDeleted) ?? [];
      setNotebooks(next);
      const nextId = next.some((item) => item.id === preferredId) ? preferredId : next.find((item) => item.status === 'active')?.id ?? next[0]?.id ?? '';
      setSelectedId(nextId);
      if (!nextId) setRecords([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取备课本失败，请稍后重试。';
      setErrorMessage(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecords(notebookId = selectedId, showDeleted = includeDeletedRecords) {
    if (!notebookId) { setRecords([]); return; }
    try {
      setRecords(await window.omniEdu?.listTeacherNotebookRecords(notebookId, showDeleted) ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取备课笔记失败。';
      setErrorMessage(message);
      setStatus(message);
    }
  }

  useEffect(() => { void loadNotebooks(); }, []);
  useEffect(() => { void loadRecords(selectedId, includeDeletedRecords); }, [selectedId, includeDeletedRecords]);
  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description);
  }, [selected?.id, selected?.version]);

  async function createNotebook() {
    if (!name.trim()) { setStatus('请输入备课本名称。'); return; }
    setSaving(true);
    try {
      const created = await window.omniEdu?.createTeacherNotebook({ name: name.trim(), description: description.trim() });
      if (!created) throw new Error('创建备课本未返回结果');
      setName(''); setDescription('');
      await loadNotebooks(created.id, includeDeleted);
      setStatus('备课本已创建并写入本地 SQLite。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '创建备课本失败。'); }
    finally { setSaving(false); }
  }

  async function updateNotebook() {
    if (!selected || selected.status !== 'active') return;
    setSaving(true);
    try {
      const updated = await window.omniEdu?.updateTeacherNotebook(selected.id, { name: name.trim(), description: description.trim(), version: selected.version });
      await loadNotebooks(updated?.id ?? selected.id, includeDeleted);
      setStatus('备课本信息已保存。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '保存备课本失败。'); await loadNotebooks(selected.id, includeDeleted); }
    finally { setSaving(false); }
  }

  async function deleteNotebook() {
    if (!selected || selected.status !== 'active') return;
    setSaving(true);
    try {
      await window.omniEdu?.deleteTeacherNotebook(selected.id);
      setIncludeDeleted(true);
      await loadNotebooks(selected.id, true);
      setStatus('备课本已软删除，可在“显示已删除”中恢复。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '删除备课本失败。'); }
    finally { setSaving(false); }
  }

  async function restoreNotebook() {
    if (!selected || selected.status !== 'deleted') return;
    setSaving(true);
    try {
      await window.omniEdu?.restoreTeacherNotebook(selected.id);
      await loadNotebooks(selected.id, includeDeleted);
      setStatus('备课本已恢复。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '恢复备课本失败。'); }
    finally { setSaving(false); }
  }

  function editRecord(item: TeacherNotebookRecord) {
    setEditingRecordId(item.id);
    setRecordDraft({ recordType: item.recordType, title: item.title, summary: item.summary, userQuery: item.userQuery, output: item.output });
  }

  async function saveRecord() {
    if (!selected || selected.status !== 'active') { setStatus('请先选择有效备课本。'); return; }
    if (!recordDraft.title.trim() || !recordDraft.output.trim()) { setStatus('笔记标题和正文不能为空。'); return; }
    setSaving(true);
    try {
      const current = records.find((item) => item.id === editingRecordId);
      if (current) {
        await window.omniEdu?.updateTeacherNotebookRecord(current.id, { ...recordDraft, version: current.version });
        setStatus('备课笔记已更新。');
      } else {
        await window.omniEdu?.addTeacherNotebookRecord({ notebookId: selected.id, ...recordDraft });
        setStatus('备课笔记已保存。');
      }
      setEditingRecordId(''); setRecordDraft(emptyRecordDraft);
      await Promise.all([loadRecords(selected.id, includeDeletedRecords), loadNotebooks(selected.id, includeDeleted)]);
    } catch (error) { setStatus(error instanceof Error ? error.message : '保存备课笔记失败。'); await loadRecords(selected.id, includeDeletedRecords); }
    finally { setSaving(false); }
  }

  async function deleteRecord(item: TeacherNotebookRecord) {
    setSaving(true);
    try {
      await window.omniEdu?.deleteTeacherNotebookRecord(item.id);
      await Promise.all([loadRecords(selectedId, includeDeletedRecords), loadNotebooks(selectedId, includeDeleted)]);
      setStatus('备课笔记已软删除。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '删除备课笔记失败。'); }
    finally { setSaving(false); }
  }

  return (
    <div className="page-grid teacher-notebook-workspace" data-testid="teacher-notebook-workspace">
      <section className="work-panel" data-testid="teacher-notebook-list-panel">
        <div className="panel-heading"><div><h2>教师备课本</h2><p className="muted">小智可按需读取的教师语境；正文始终保存在本地。</p></div><button className="icon-button" aria-label="刷新备课本" onClick={() => void loadNotebooks()} data-testid="teacher-notebook-refresh"><RefreshCw size={16} /></button></div>
        <label className="checkbox-label"><input type="checkbox" checked={includeDeleted} onChange={(event) => { setIncludeDeleted(event.target.checked); void loadNotebooks(selectedId, event.target.checked); }} data-testid="teacher-notebook-show-deleted" />显示已删除</label>
        {loading ? <p data-testid="teacher-notebook-loading">正在读取本地备课本…</p> : null}
        {errorMessage ? <div className="warning-box" role="alert" data-testid="teacher-notebook-error">{errorMessage}</div> : null}
        {!loading && !notebooks.length ? <div className="empty-state" data-testid="teacher-notebook-empty"><BookOpenCheck size={20} /><span>还没有备课本，请先创建。</span></div> : null}
        <div className="teacher-notebook-list">{notebooks.map((item) => <button key={item.id} className={item.id === selectedId ? 'teacher-notebook-list-item active' : 'teacher-notebook-list-item'} onClick={() => setSelectedId(item.id)} data-testid={`teacher-notebook-item-${item.id}`}><strong>{item.name}</strong><span>{item.status === 'deleted' ? '已删除' : `${item.recordCount} 条笔记`} · v{item.version}</span></button>)}</div>
      </section>

      <section className="work-panel" data-testid="teacher-notebook-editor-panel">
        <div className="panel-heading"><div><h3>{selected ? '备课本信息' : '新建备课本'}</h3><p className="muted">更新使用版本锁；冲突时刷新后重试。</p></div></div>
        <label>名称<input value={name} onChange={(event) => setName(event.target.value)} disabled={selected?.status === 'deleted'} data-testid="teacher-notebook-name" /></label>
        <label>说明<textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={selected?.status === 'deleted'} data-testid="teacher-notebook-description" /></label>
        <div className="toolbar-row">
          {!selected ? <button className="primary-action" onClick={() => void createNotebook()} disabled={saving} data-testid="teacher-notebook-create"><Plus size={16} />创建备课本</button> : null}
          {selected?.status === 'active' ? <><button className="primary-action" onClick={() => void updateNotebook()} disabled={saving} data-testid="teacher-notebook-save"><Save size={16} />保存信息</button><button className="secondary-action" onClick={() => void deleteNotebook()} disabled={saving} data-testid="teacher-notebook-delete"><Trash2 size={16} />软删除</button></> : null}
          {selected?.status === 'deleted' ? <button className="primary-action" onClick={() => void restoreNotebook()} disabled={saving} data-testid="teacher-notebook-restore"><ArchiveRestore size={16} />恢复备课本</button> : null}
          {selected ? <button className="ghost-action" onClick={() => { setSelectedId(''); setName(''); setDescription(''); }} data-testid="teacher-notebook-new">新建另一本</button> : null}
        </div>
      </section>

      <section className="work-panel span-2" data-testid="teacher-notebook-records-panel">
        <div className="panel-heading"><div><h3>备课笔记</h3><p className="muted">解题、研究、协作写作等记录共享同一可检查语境，不自动写入学生档案。</p></div><label className="checkbox-label"><input type="checkbox" checked={includeDeletedRecords} onChange={(event) => setIncludeDeletedRecords(event.target.checked)} data-testid="teacher-notebook-records-show-deleted" />显示已删除笔记</label></div>
        {!selected ? <div className="empty-state" data-testid="teacher-notebook-records-no-selection">选择或创建备课本后添加笔记。</div> : null}
        {selected && !records.length ? <div className="empty-state" data-testid="teacher-notebook-records-empty">当前备课本还没有笔记。</div> : null}
        <div className="teacher-notebook-record-list">{records.map((item) => <article key={item.id} className="teacher-notebook-record" data-testid={`teacher-notebook-record-${item.id}`}><div><span className="status-chip">{recordTypeLabels[item.recordType]}</span>{item.deletedAt ? <span className="status-chip">已删除</span> : null}<h4>{item.title}</h4><p>{item.summary || '暂无摘要'}</p></div><pre>{item.output}</pre>{!item.deletedAt && selected?.status === 'active' ? <div className="toolbar-row"><button className="secondary-action compact-button" onClick={() => editRecord(item)} data-testid={`teacher-notebook-record-edit-${item.id}`}>编辑</button><button className="ghost-action" onClick={() => void deleteRecord(item)} data-testid={`teacher-notebook-record-delete-${item.id}`}>删除</button></div> : null}</article>)}</div>
        {selected?.status === 'active' ? <div className="teacher-notebook-record-form" data-testid="teacher-notebook-record-form"><h4>{editingRecordId ? '编辑笔记' : '添加笔记'}</h4><label>类型<select value={recordDraft.recordType} onChange={(event) => setRecordDraft({ ...recordDraft, recordType: event.target.value as TeacherNotebookRecordType })} data-testid="teacher-notebook-record-type">{Object.entries(recordTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>标题<input value={recordDraft.title} onChange={(event) => setRecordDraft({ ...recordDraft, title: event.target.value })} data-testid="teacher-notebook-record-title" /></label><label>问题/任务<textarea value={recordDraft.userQuery} onChange={(event) => setRecordDraft({ ...recordDraft, userQuery: event.target.value })} data-testid="teacher-notebook-record-query" /></label><label>摘要<textarea value={recordDraft.summary} onChange={(event) => setRecordDraft({ ...recordDraft, summary: event.target.value })} data-testid="teacher-notebook-record-summary" /></label><label>正文<textarea value={recordDraft.output} onChange={(event) => setRecordDraft({ ...recordDraft, output: event.target.value })} data-testid="teacher-notebook-record-output" /></label><div className="toolbar-row"><button className="primary-action" onClick={() => void saveRecord()} disabled={saving} data-testid="teacher-notebook-record-save"><Save size={16} />{editingRecordId ? '保存修改' : '保存笔记'}</button>{editingRecordId ? <button className="secondary-action" onClick={() => { setEditingRecordId(''); setRecordDraft(emptyRecordDraft); }} data-testid="teacher-notebook-record-cancel">取消编辑</button> : null}</div></div> : null}
      </section>
    </div>
  );
}
