import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, Modal } from '@heroui/react';
import { BookOpen, ChevronRight, Folder, FolderPlus, Library, MessageSquare, PanelLeftClose, PanelLeftOpen, Search, Settings, SlidersHorizontal, Sparkles, SquarePen, Users, type LucideIcon } from 'lucide-react';
import { useDesktopCommands, useDesktopNavigation } from '../components/desktop/DesktopFrame';
import { PAGE_CONTRACTS } from './page-contracts';
import { useWorkbenchState, useWorkbenchPreferences } from './WorkbenchState';
import './workbench-navigation.css';

type Dialog = 'new' | 'search' | 'folder' | 'history';
const workbenches = [
  { id: 'teaching', title: '教学工作台', group: '教学', disclosure: 'teaching', Icon: BookOpen },
  { id: 'student_workbench', title: '学生工作台', group: '学生', disclosure: 'students', Icon: Users },
] as const;
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function WorkbenchNavigation({ view, disabled = false }: { view: string; disabled?: boolean }) {
  const { data } = useWorkbenchState();
  const navigation = useDesktopNavigation();
  const root = useRef<HTMLElement>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const lock = useRef(false);
  const panelId = useId();
  const { preferences: { collapsed: storedCollapsed, expanded, openFolders }, update } = useWorkbenchPreferences();
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 700px)').matches);
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = narrow ? !mobileOpen : storedCollapsed;
  useEffect(() => {
    const query = matchMedia('(max-width: 700px)');
    const changed = () => { setNarrow(query.matches); setMobileOpen(false); };
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  const setExpanded = (value: (old: Record<string, boolean>) => Record<string, boolean>) => update({ expanded: value(expanded) });
  const setOpenFolders = (value: (old: Record<string, boolean>) => Record<string, boolean>) => update({ openFolders: value(openFolders) });
  const [dialog, setDialog] = useState<Dialog>();
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState('');
  const [folderName, setFolderName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unavailable = disabled || busy || !data || data.blocked;
  function toggleCollapsed() {
    if (disabled) return;
    if (narrow) setMobileOpen(!mobileOpen);
    else update({ collapsed: !storedCollapsed });
  }
  useDesktopCommands(command => {
    if (command !== 'sidebar' || !root.current || root.current.closest('[hidden]')) return false;
    toggleCollapsed();
    return true;
  }, 30);
  useEffect(() => {
    if (!root.current || root.current.closest('[hidden]')) return;
    const group = workbenches.find(item => view !== item.id && PAGE_CONTRACTS.some(page => page.id === view && page.group === item.group));
    if (group && !expanded[group.disclosure]) update({ expanded: { ...expanded, [group.disclosure]: true } });
    const frame = requestAnimationFrame(() => root.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [view]);
  const folders = useMemo(() => (data?.folders ?? []).filter(folder => !folder.archivedAt).slice().sort((a, b) => a.sortOrder - b.sortOrder), [data?.folders]);
  const sessions = useMemo(() => (data?.sessions ?? []).filter(session => !session.archivedAt).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [data?.sessions]);
  const matches = sessions.filter(session => session.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const searchGroups = [{ id: '', name: '未分组对话' }, ...folders].map(folder => ({ ...folder, sessions: matches.filter(session => folder.id ? session.folderId === folder.id : !session.folderId || !folders.some(item => item.id === session.folderId)) })).filter(group => group.sessions.length);
  function showDialog(next: Dialog) {
    if (unavailable) return;
    dialogTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError(''); setQuery(''); setTitle(''); setFolderId(''); setFolderName(''); setDialog(next);
  }
  function closeDialog() {
    setDialog(undefined); setError('');
    requestAnimationFrame(() => dialogTrigger.current?.isConnected && dialogTrigger.current.focus());
  }
  async function run(action: () => Promise<void>, close = false) {
    if (unavailable || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); if (close) closeDialog(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }
  function openSession(id: string) {
    void run(() => data!.onOpenSession(id), true);
  }
  function navItem(id: string, label: string, Icon: LucideIcon) {
    return <button type="button" key={id} className="wb-item" disabled={disabled} aria-label={label} title={label}
      data-testid={id === 'ai' ? 'nav-ai-workspace' : id === 'student_workbench' ? 'nav-student-workbench' : `nav-${id}`}
      aria-current={view === id ? 'page' : undefined} onClick={() => { setMobileOpen(false); navigation.navigate({ view: id }); }}>
      <Icon size={19} aria-hidden="true" /><span className="wb-label">{label}</span>
    </button>;
  }
  function sessionItem(session: (typeof sessions)[number], withTime = false) {
    return <button key={session.id} type="button" className="wb-item wb-session" disabled={unavailable} title={session.title || '未命名对话'} aria-label={session.title || '未命名对话'}
      data-testid={`workbench-session-${session.id}`} aria-current={view === 'ai' && data?.activeSessionId === session.id ? 'page' : undefined} onClick={() => openSession(session.id)}>
      <MessageSquare size={16} aria-hidden="true" /><span className="wb-session-copy"><span>{session.title || '未命名对话'}</span>{withTime && <time dateTime={session.updatedAt}>{dateLabel(session.updatedAt)}</time>}</span>
    </button>;
  }
  return <aside ref={root} className="edu-navigation wb-navigation" data-testid="edu-navigation" data-collapsed={collapsed}>
    <header className="wb-brand"><span className="wb-logo" aria-hidden="true"><BookOpen size={23} /></span><strong className="wb-label">小智</strong>
      <button type="button" className="wb-icon-button" disabled={disabled} onClick={toggleCollapsed} aria-label={collapsed ? '展开侧栏' : '折叠侧栏'} title={collapsed ? '展开侧栏' : '折叠侧栏'} data-testid="workbench-sidebar-toggle">{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
    </header>
    <nav className="wb-scroll" aria-label="教师工作空间" data-testid="product-rail">
      {navItem('ai', '问小智', Sparkles)}
      <button type="button" className="wb-item" disabled={unavailable} title="新建对话" aria-label="新建对话" data-testid="workbench-new-session" onClick={() => showDialog('new')}><SquarePen size={19} /><span className="wb-label">新建对话</span></button>
      <button type="button" className="wb-item" disabled={unavailable} title="搜索对话" aria-label="搜索对话" data-testid="workbench-search" onClick={() => showDialog('search')}><Search size={19} /><span className="wb-label">搜索对话</span></button>
      <section className="wb-conversations" aria-label="教学空间">
        <div className="wb-section-heading"><span>教学空间</span><button type="button" className="wb-icon-button" disabled={unavailable} aria-label="新建教学空间" title="新建教学空间" data-testid="workbench-new-folder" onClick={() => showDialog('folder')}><FolderPlus size={16} /></button></div>
        {folders.map(folder => <div key={folder.id}>
          <button type="button" className="wb-item" disabled={disabled} title={folder.name} aria-expanded={!!openFolders[folder.id]} aria-controls={`${panelId}-${folder.id}`} onClick={() => setOpenFolders(old => ({ ...old, [folder.id]: !old[folder.id] }))}><Folder size={17} /><span className="wb-label">{folder.name}</span><ChevronRight size={14} className="wb-chevron" data-expanded={!!openFolders[folder.id]} /></button>
          <div id={`${panelId}-${folder.id}`} hidden={!openFolders[folder.id]} className="wb-subnav">{sessions.filter(session => session.folderId === folder.id).map(session => sessionItem(session))}{!sessions.some(session => session.folderId === folder.id) && <p className="wb-empty">暂无对话</p>}</div>
        </div>)}
        {!folders.length && <p className="wb-empty">{data ? '还没有教学空间' : '会话加载后显示'}</p>}
        <div className="wb-section-heading"><span>最近对话</span><button type="button" className="wb-icon-button" disabled={unavailable} aria-label="管理对话" title="管理对话" data-testid="workbench-manage-history" onClick={() => showDialog('history')}><SlidersHorizontal size={16} /></button></div>
        {sessions.slice(0, 8).map(session => sessionItem(session))}
        {!sessions.length && <p className="wb-empty">暂无最近对话</p>}
      </section>
      <div className="wb-destinations">
        {navItem('knowledge', '资料库', Library)}
        {workbenches.map(({ id, title: label, group, disclosure, Icon }) => <section key={id}>
          <div className="wb-workbench-row">{navItem(id, label, Icon)}<button type="button" className="wb-icon-button wb-disclosure" disabled={disabled} title={`${expanded[disclosure] ? '收起' : '展开'}${label}页面`} aria-label={`${expanded[disclosure] ? '收起' : '展开'}${label}页面`} data-testid={`nav-group-${disclosure}`} aria-expanded={expanded[disclosure]} aria-controls={`${panelId}-${disclosure}`} onClick={() => { if (collapsed) toggleCollapsed(); setExpanded(old => ({ ...old, [disclosure]: !old[disclosure] })); }}><ChevronRight size={15} className="wb-chevron" data-expanded={expanded[disclosure]} /></button></div>
          <div className="wb-subnav" id={`${panelId}-${disclosure}`} hidden={collapsed || !expanded[disclosure]}>{PAGE_CONTRACTS.filter(page => page.group === group && page.id !== id).map(page => navItem(page.id, page.title, Icon))}</div>
        </section>)}
      </div>
    </nav>
    <footer className="wb-footer" data-testid="edu-navigation-footer" aria-label="工作台设置">{navItem('settings', '设置', Settings)}</footer>
    {error && !dialog && <p className="wb-error" role="alert">{error}</p>}
    {dialog && <Modal.Backdrop isOpen onOpenChange={open => { if (!open) closeDialog(); }}>
      <Modal.Container size={dialog === 'history' ? 'lg' : 'md'} scroll="inside"><Modal.Dialog data-testid={`workbench-${dialog}-dialog`}>
        <Modal.Header><Modal.Heading>{({ new: '新建对话', search: '搜索对话', folder: '新建教学空间', history: '管理对话' })[dialog]}</Modal.Heading></Modal.Header>
        <Modal.Body>
          {dialog === 'new' && <form id={`${panelId}-new`} className="wb-form" onSubmit={event => { event.preventDefault(); void run(() => data!.onNewSession(folderId || null, title.trim() || undefined), true); }}>
            <label>对话标题（可选）<input autoFocus value={title} maxLength={200} disabled={unavailable} onChange={event => setTitle(event.target.value)} placeholder="为这次教学任务命名" /></label>
            <label>教学空间<select aria-label="教学空间" value={folderId} disabled={unavailable} onChange={event => setFolderId(event.target.value)}><option value="">未分组</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
          </form>}
          {dialog === 'folder' && <form id={`${panelId}-folder`} className="wb-form" onSubmit={event => { event.preventDefault(); if (folderName.trim()) void run(() => data!.onCreateFolder(folderName.trim()), true); }}><label>空间名称<input autoFocus required maxLength={100} value={folderName} disabled={unavailable} onChange={event => setFolderName(event.target.value)} /></label></form>}
          {dialog === 'search' && <div className="wb-search"><label className="wb-form">对话标题<input autoFocus type="search" value={query} disabled={disabled || busy} onChange={event => setQuery(event.target.value)} placeholder="搜索已有对话" /></label>
            {searchGroups.map(group => <section key={group.id}><h3 className="wb-section-heading">{group.name}</h3>{group.sessions.map(session => sessionItem(session, true))}</section>)}
            {!matches.length && <p className="wb-empty">{query ? '没有匹配的对话，试试其他标题。' : '暂无对话。'}</p>}
          </div>}
          {dialog === 'history' && <div className="wb-history" inert={disabled || !!data?.blocked || !data}>{data?.history(closeDialog) ?? <p>会话管理尚未就绪。</p>}</div>}
          {error && <p role="alert" className="wb-error">{error}</p>}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onPress={closeDialog}>关闭</Button>
          {dialog === 'new' && <Button type="submit" form={`${panelId}-new`} isDisabled={unavailable}>{busy ? '正在创建…' : '创建对话'}</Button>}
          {dialog === 'folder' && <Button type="submit" form={`${panelId}-folder`} isDisabled={unavailable || !folderName.trim()}>{busy ? '正在创建…' : '创建空间'}</Button>}
        </Modal.Footer>
      </Modal.Dialog></Modal.Container>
    </Modal.Backdrop>}
  </aside>;
}
