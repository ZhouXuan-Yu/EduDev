import { ArchiveRestore, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, SearchField } from '@heroui/react';
import { ListView } from '../heroui-pro/components/list-view';
import { Markdown } from '../heroui-pro/components/markdown';
import { LibraryEmpty } from './product/LibraryEmpty';
import type { TeacherNotebook, TeacherNotebookRecord, TeacherNotebookRecordType } from '../../shared/contracts';
import './product/teacher-library.css';
import './product/teacher-notebook.css';

type Props = { setStatus: (message: string) => void };
const recordTypeLabels: Record<TeacherNotebookRecordType, string> = {
  solve: '解题', question: '问题', research: '教研', chat: '讨论', co_writer: '共同备课', tutorbot: '辅导', guided_learning: '学习引导',
};
const emptyRecordDraft = { recordType: 'research' as TeacherNotebookRecordType, title: '', summary: '', userQuery: '', output: '' };
const displayDate = (value: string) => new Date(value).toLocaleDateString('zh-CN');

/** Existing local notebook domain; UI never owns SQL, filesystem or a second agent. */
export function TeacherNotebookWorkspace({ setStatus }: Props) {
  const [notebooks, setNotebooks] = useState<TeacherNotebook[]>([]);
  const [records, setRecords] = useState<TeacherNotebookRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [includeDeletedRecords, setIncludeDeletedRecords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recordDraft, setRecordDraft] = useState(emptyRecordDraft);
  const [editingRecordId, setEditingRecordId] = useState('');
  const listEpoch = useRef(0), recordEpoch = useRef(0), actionLock = useRef(false), selectedRef = useRef('');
  const selected = useMemo(() => notebooks.find(item => item.id === selectedId), [notebooks, selectedId]);
  const filtered = notebooks.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const blocked = saving || loading || catalogueFailed;

  function api() { if (!window.omniEdu) throw new Error('Notebook host unavailable'); return window.omniEdu; }
  function success(message: string) { setNotice(message); setErrorMessage(''); setStatus(''); }
  function fail(error: unknown, fallback: string) {
    const raw = error instanceof Error ? error.message : '';
    const message = /版本|version|conflict|已被.*修改/i.test(raw) ? '内容已在其他地方修改，请刷新后再试。' : fallback;
    setErrorMessage(message); setNotice(''); setStatus('');
  }
  function resetRecord() { setEditingRecordId(''); setRecordDraft(emptyRecordDraft); }
  function choose(id: string) {
    ++recordEpoch.current; selectedRef.current = id; setSelectedId(id); setRecords([]); resetRecord();
    setErrorMessage(''); setNotice('');
    if (!id) { setName(''); setDescription(''); setRecordsLoading(false); }
  }
  async function loadNotebooks(preferredId = selectedRef.current, showDeleted = includeDeleted) {
    const stamp = ++listEpoch.current; setLoading(true); setErrorMessage('');
    try {
      const next = await api().listTeacherNotebooks(showDeleted);
      if (stamp !== listEpoch.current) return false;
      setCatalogueFailed(false);
      setNotebooks(next);
      const nextId = next.some(item => item.id === preferredId) ? preferredId : next.find(item => item.status === 'active')?.id ?? next[0]?.id ?? '';
      if (nextId !== selectedRef.current) choose(nextId);
      return true;
    } catch (error) {
      if (stamp !== listEpoch.current) return false;
      setCatalogueFailed(true); setNotebooks([]); choose(''); fail(error, '无法读取备课本，请点击刷新重试。'); return false;
    } finally { if (stamp === listEpoch.current) setLoading(false); }
  }
  async function loadRecords(notebookId = selectedRef.current, showDeleted = includeDeletedRecords) {
    const stamp = ++recordEpoch.current; setRecords([]);
    if (!notebookId) { setRecordsLoading(false); return; }
    setRecordsLoading(true);
    try {
      const next = await api().listTeacherNotebookRecords(notebookId, showDeleted);
      if (stamp === recordEpoch.current && selectedRef.current === notebookId) { setRecords(next); return true; }
      return false;
    } catch (error) {
      if (stamp === recordEpoch.current) fail(error, '无法读取备课笔记，请点击刷新重试。');
      return false;
    } finally { if (stamp === recordEpoch.current) setRecordsLoading(false); }
  }
  useEffect(() => { void loadNotebooks(); return () => { ++listEpoch.current; ++recordEpoch.current; }; }, []);
  useEffect(() => { void loadRecords(selectedId, includeDeletedRecords); }, [selectedId, includeDeletedRecords]);
  useEffect(() => { if (selected) { setName(selected.name); setDescription(selected.description); } }, [selected?.id, selected?.version]);

  async function action(work: () => Promise<void>, fallback: string) {
    if (actionLock.current || loading || catalogueFailed) return;
    actionLock.current = true; setSaving(true); setErrorMessage(''); setNotice('');
    try { await work(); } catch (error) { fail(error, fallback); }
    finally { actionLock.current = false; setSaving(false); }
  }
  function createNotebook() {
    if (!name.trim()) { fail(undefined, '请输入备课本名称。'); return; }
    void action(async () => {
      const created = await api().createTeacherNotebook({ name: name.trim(), description: description.trim() });
      if (await loadNotebooks(created.id)) success('备课本已保存到本机。');
      else setNotice('备课本已保存，请刷新列表后继续操作。');
    }, '创建失败，填写的内容已保留，请重试。');
  }
  function updateNotebook() {
    if (!selected || selected.status !== 'active') return;
    if (!name.trim()) { fail(undefined, '请输入备课本名称。'); return; }
    void action(async () => {
      const updated = await api().updateTeacherNotebook(selected.id, { name: name.trim(), description: description.trim(), version: selected.version });
      if (await loadNotebooks(updated.id)) success('备课本信息已保存。');
      else setNotice('信息已保存，请刷新列表后继续操作。');
    }, '保存失败，填写的内容已保留，请重试。');
  }
  function deleteNotebook() {
    if (!selected || selected.status !== 'active') return;
    void action(async () => {
      await api().deleteTeacherNotebook(selected.id); setIncludeDeleted(true); const loaded = await loadNotebooks(selected.id, true);
      resetRecord(); if (loaded) success('备课本已删除，可在“显示已删除”中恢复。');
      else setNotice('备课本已删除，请刷新后查看。');
    }, '删除失败，请重试。');
  }
  function restoreNotebook() {
    if (!selected || selected.status !== 'deleted') return;
    void action(async () => { await api().restoreTeacherNotebook(selected.id); if (await loadNotebooks(selected.id)) success('备课本已恢复。'); else setNotice('备课本已恢复，请刷新后查看。'); }, '恢复失败，请重试。');
  }
  function editRecord(item: TeacherNotebookRecord) {
    setEditingRecordId(item.id); setRecordDraft({ recordType: item.recordType, title: item.title, summary: item.summary, userQuery: item.userQuery, output: item.output });
    setNotice(''); setErrorMessage('');
  }
  function saveRecord() {
    if (!selected || selected.status !== 'active' || recordsLoading) return;
    if (!recordDraft.title.trim() || !recordDraft.output.trim()) { fail(undefined, '请填写笔记标题和正文。'); return; }
    void action(async () => {
      const current = records.find(item => item.id === editingRecordId);
      if (editingRecordId && !current) throw new Error('Record no longer loaded');
      if (current) await api().updateTeacherNotebookRecord(current.id, { ...recordDraft, version: current.version });
      else await api().addTeacherNotebookRecord({ notebookId: selected.id, ...recordDraft });
      resetRecord(); const loaded = await Promise.all([loadRecords(selected.id), loadNotebooks(selected.id)]);
      if (loaded.every(Boolean)) success(current ? '备课笔记已更新。' : '备课笔记已保存。');
      else setNotice('笔记已保存，请刷新后查看。');
    }, '笔记未能保存，填写的内容已保留，请重试。');
  }
  function deleteRecord(item: TeacherNotebookRecord) {
    void action(async () => {
      await api().deleteTeacherNotebookRecord(item.id); if (editingRecordId === item.id) resetRecord();
      const loaded = await Promise.all([loadRecords(selectedId), loadNotebooks(selectedId)]);
      if (loaded.every(Boolean)) success('笔记已删除，可在“显示已删除笔记”中查看。');
      else setNotice('笔记已删除，请刷新后查看。');
    }, '删除笔记失败，请重试。');
  }
  async function refresh() { if (saving || loading) return; if (await loadNotebooks()) await loadRecords(); }

  return <section className="teacher-library teacher-notebook-workspace" data-testid="teacher-notebook-workspace" aria-label="备课本">
    <header className="teacher-library-heading"><div><h1>备课本</h1><p>按课程整理笔记、教学想法和课堂准备。</p></div>
      <Button variant="secondary" isDisabled={blocked} onPress={() => { setQuery(''); choose(''); }} data-testid="teacher-notebook-new"><Plus size={17}/>新建备课本</Button></header>
    <div className="teacher-library-toolbar"><SearchField value={query} onChange={setQuery} aria-label="查找备课本" variant="secondary" className="teacher-library-search"><SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="查找名称或说明" maxLength={128} data-testid="teacher-notebook-search"/><SearchField.ClearButton aria-label="清除备课本查找"/></SearchField.Group></SearchField>
      <Button variant="ghost" aria-label="刷新备课本" isDisabled={saving || loading} onPress={() => void refresh()} data-testid="teacher-notebook-refresh"><RefreshCw size={16}/>刷新</Button></div>
    {errorMessage && <p className="teacher-library-error" role="alert" data-testid="teacher-notebook-error">{errorMessage}</p>}
    {notice && <p className="teacher-library-notice" role="status" data-testid="teacher-notebook-notice">{notice}</p>}
    <div className="teacher-notebook-grid">
      <aside className="teacher-notebook-directory" data-testid="teacher-notebook-list-panel">
        <label className="teacher-notebook-check"><input type="checkbox" checked={includeDeleted} disabled={blocked} onChange={event => { setIncludeDeleted(event.target.checked); void loadNotebooks(selectedId, event.target.checked); }} data-testid="teacher-notebook-show-deleted"/>显示已删除</label>
        <p className="teacher-library-count">{loading ? '正在读取备课本…' : `${filtered.length} 本备课本`}</p>
        <ListView aria-label="备课本列表" className="teacher-library-list" selectionMode="single" selectionBehavior="replace" disallowEmptySelection
          selectedKeys={new Set(selectedId ? [selectedId] : [])} disabledKeys={blocked ? filtered.map(item => item.id) : []}
          onSelectionChange={keys => { if (keys === 'all' || blocked) return; const id = String([...keys][0] || ''); if (id && id !== selectedRef.current) choose(id); }}
          renderEmptyState={() => loading ? <p role="status" data-testid="teacher-notebook-loading">正在读取备课本…</p> : errorMessage ? <p>刷新后重新读取备课本。</p> : <div data-testid={query ? 'teacher-notebook-filter-empty' : 'teacher-notebook-empty'}><LibraryEmpty title={query ? '没有匹配的备课本' : '还没有备课本'} description={query ? '换个关键词，或清除查找条件。' : '为一门课程建一个备课本，从第一条笔记开始。'}/></div>}>
          {(loading ? [] : filtered).map(item => <ListView.Item key={item.id} id={item.id} textValue={item.name} data-testid={`teacher-notebook-item-${item.id}`}><ListView.ItemContent><ListView.Title>{item.name}</ListView.Title><ListView.Description>{item.status === 'deleted' ? '已删除' : `${item.recordCount} 条笔记`} · {displayDate(item.updatedAt)}</ListView.Description></ListView.ItemContent></ListView.Item>)}
        </ListView>
      </aside>
      <div className="teacher-notebook-main">
        <section className="teacher-library-detail" data-testid="teacher-notebook-editor-panel"><header><div><h2>{selected ? selected.status === 'deleted' ? '已删除的备课本' : '备课本信息' : '新建备课本'}</h2><p>{selected?.status === 'deleted' ? '恢复后可以继续编辑，原笔记仍保留。' : '填写课程名称和说明，保存后继续添加笔记。'}</p></div></header>
          <fieldset disabled={blocked || selected?.status === 'deleted'} className="teacher-notebook-fields"><label>名称<input value={name} onChange={event => setName(event.target.value)} data-testid="teacher-notebook-name"/></label><label>说明<textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} data-testid="teacher-notebook-description"/></label></fieldset>
          <div className="teacher-library-detail-actions">{!selected && <Button onPress={createNotebook} isDisabled={blocked} isPending={saving} data-testid="teacher-notebook-create">创建备课本</Button>}
            {selected?.status === 'active' && <><Button onPress={updateNotebook} isDisabled={blocked} isPending={saving} data-testid="teacher-notebook-save"><Save size={16}/>保存信息</Button><Button variant="danger-soft" onPress={deleteNotebook} isDisabled={blocked} data-testid="teacher-notebook-delete"><Trash2 size={16}/>删除备课本</Button></>}
            {selected?.status === 'deleted' && <Button onPress={restoreNotebook} isDisabled={blocked} data-testid="teacher-notebook-restore"><ArchiveRestore size={16}/>恢复备课本</Button>}</div>
        </section>
        <section className="teacher-library-detail" data-testid="teacher-notebook-records-panel"><header><div><h2>备课笔记</h2><p>保留教学思路、问题和可再次使用的内容。</p></div><label className="teacher-notebook-check"><input type="checkbox" checked={includeDeletedRecords} disabled={blocked || recordsLoading} onChange={event => setIncludeDeletedRecords(event.target.checked)} data-testid="teacher-notebook-records-show-deleted"/>显示已删除笔记</label></header>
          {!selected ? <div data-testid="teacher-notebook-records-no-selection"><LibraryEmpty title="先选择一个备课本" description="选择或新建备课本后，在这里添加笔记。"/></div> : recordsLoading ? <p role="status" data-testid="teacher-notebook-records-loading">正在读取笔记…</p> : !records.length ? <div data-testid="teacher-notebook-records-empty"><LibraryEmpty title="从第一条笔记开始" description="记下课程目标、课堂活动或需要讲解的问题。"/></div> : null}
          <div className="teacher-notebook-record-list">{records.map(item => <article key={item.id} className="teacher-notebook-record" data-testid={`teacher-notebook-record-${item.id}`}><div className="teacher-notebook-record-meta">{recordTypeLabels[item.recordType]}{item.deletedAt ? ' · 已删除' : ''}</div><h3>{item.title}</h3>{item.summary && <p className="teacher-library-caption">{item.summary}</p>}
            <Markdown components={{ img: ({alt}) => <span>［图片：{alt || '未加载'}］</span>, a: ({children}) => <span>{children}</span> }}>{item.output}</Markdown>
            {!item.deletedAt && selected?.status === 'active' && <div className="teacher-library-detail-actions"><Button variant="secondary" onPress={() => editRecord(item)} isDisabled={blocked || recordsLoading} data-testid={`teacher-notebook-record-edit-${item.id}`}>编辑</Button><Button variant="danger-soft" onPress={() => deleteRecord(item)} isDisabled={blocked || recordsLoading} data-testid={`teacher-notebook-record-delete-${item.id}`}>删除笔记</Button></div>}</article>)}</div>
          {selected?.status === 'active' && <div className="teacher-notebook-record-form" data-testid="teacher-notebook-record-form"><h3>{editingRecordId ? '编辑笔记' : '添加笔记'}</h3><fieldset disabled={blocked || recordsLoading} className="teacher-notebook-fields"><div className="teacher-notebook-record-identity"><label>类型<select value={recordDraft.recordType} onChange={event => setRecordDraft({...recordDraft, recordType: event.target.value as TeacherNotebookRecordType})} data-testid="teacher-notebook-record-type">{Object.entries(recordTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>标题<input value={recordDraft.title} onChange={event => setRecordDraft({...recordDraft,title:event.target.value})} data-testid="teacher-notebook-record-title"/></label></div>
            <label>正文<textarea value={recordDraft.output} onChange={event => setRecordDraft({...recordDraft,output:event.target.value})} rows={7} data-testid="teacher-notebook-record-output"/></label>
            <details><summary>补充问题和摘要</summary><label>问题或任务<textarea value={recordDraft.userQuery} onChange={event => setRecordDraft({...recordDraft,userQuery:event.target.value})} rows={2} data-testid="teacher-notebook-record-query"/></label><label>摘要<textarea value={recordDraft.summary} onChange={event => setRecordDraft({...recordDraft,summary:event.target.value})} rows={2} data-testid="teacher-notebook-record-summary"/></label></details></fieldset>
            <div className="teacher-library-detail-actions"><Button onPress={saveRecord} isDisabled={blocked || recordsLoading} isPending={saving} data-testid="teacher-notebook-record-save"><Save size={16}/>{editingRecordId ? '保存修改' : '保存笔记'}</Button><Button variant="ghost" onPress={() => {resetRecord();success('已取消笔记编辑。');}} isDisabled={blocked} data-testid="teacher-notebook-record-cancel">取消编辑</Button></div></div>}
        </section>
      </div>
    </div>
  </section>;
}
