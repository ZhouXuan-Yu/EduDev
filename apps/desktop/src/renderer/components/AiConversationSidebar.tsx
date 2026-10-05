import { ArrowLeft, Folder, FolderPlus, Inbox, MessageSquare, Plus, Search, SquarePen } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Button, Dropdown, Label, Modal } from '@heroui/react';
import { createPortal } from 'react-dom';
import { ChatListView } from '../heroui-pro/components/chat-list-view';
import { Sidebar } from '../heroui-pro/components/sidebar';
import type { AiConversationFolder, AiConversationSession } from '../../shared/contracts';

export type AiConversationTarget = {
  type: 'session' | 'folder';
  id: string;
  name: string;
};

type ContextTarget = AiConversationTarget & { x: number; y: number };
type RenameTarget = AiConversationTarget & { value: string };
export type AiConversationFeedbackState = {
  status: 'idle' | 'working' | 'success' | 'error';
  message: string;
};

type AiConversationSidebarProps = {
  codexStyle?: boolean;
  folders: AiConversationFolder[];
  sessions: AiConversationSession[];
  activeSessionId: string;
  onOpenSession: (sessionId: string) => Promise<void> | void;
  onNewSession: (folderId: string | null) => Promise<void> | void;
  onCreateFolder: (name: string) => Promise<void>;
  onMoveSession: (sessionId: string, folderId: string | null) => Promise<void>;
  onRename: (target: AiConversationTarget, value: string) => Promise<void>;
  onArchive: (target: AiConversationTarget) => Promise<void>;
  onLeaveAi: () => void;
};

export function AiConversationFeedback({ state }: { state: AiConversationFeedbackState }) {
  if (state.status === 'idle') return <div className="ai-conversation-feedback" data-testid="ai-conversation-idle">右键可重命名或归档；拖动对话可分类。</div>;
  return <div className={`ai-conversation-feedback ${state.status}`} role={state.status === 'error' ? 'alert' : 'status'} data-testid={`ai-conversation-${state.status}`}>{state.message}</div>;
}

export function AiConversationArchiveConfirmation({ target, busy, onConfirm, onCancel, modal = false }: { target: AiConversationTarget; busy: boolean; onConfirm: () => void; onCancel: () => void; modal?: boolean }) {
  if (modal) return <Modal.Backdrop isOpen isDismissable={false} isKeyboardDismissDisabled={busy} onOpenChange={open => { if (!open && !busy) onCancel(); }}>
    <Modal.Container size="sm" scroll="inside"><Modal.Dialog role="alertdialog" className="pi-conversation-dialog pi-themed-surface" data-testid="ai-conversation-archive-confirmation">
      <Modal.Header><Modal.Heading>确认归档{target.type === 'folder' ? '文件夹' : '对话'}？</Modal.Heading></Modal.Header>
      <Modal.Body><p>{target.type === 'folder' ? '文件夹及其中对话将从小智侧栏隐藏，但本地消息不会删除。' : '对话将从小智侧栏隐藏，但本地消息不会删除。'}</p></Modal.Body>
      <Modal.Footer><Button autoFocus variant="secondary" isDisabled={busy} onPress={onCancel} data-testid="ai-conversation-archive-cancel">取消</Button><Button variant="primary" isDisabled={busy} onPress={onConfirm} data-testid="ai-conversation-archive-confirm">{busy ? '归档中…' : '确认归档'}</Button></Modal.Footer>
    </Modal.Dialog></Modal.Container>
  </Modal.Backdrop>;
  return (
    <div className="ai-conversation-confirmation" role="alertdialog" aria-modal="true" data-testid="ai-conversation-archive-confirmation">
      <strong>确认归档{target.type === 'folder' ? '文件夹' : '对话'}？</strong>
      <p>{target.type === 'folder' ? '文件夹及其中对话将从小智侧栏隐藏，但本地消息不会删除。' : '对话将从小智侧栏隐藏，但本地消息不会删除。'}</p>
      <div className="toolbar-row">
        <button className="secondary-action compact-button" onClick={onCancel} disabled={busy} data-testid="ai-conversation-archive-cancel">取消</button>
        <button className="ghost-action" onClick={onConfirm} disabled={busy} data-testid="ai-conversation-archive-confirm">{busy ? '归档中…' : '确认归档'}</button>
      </div>
    </div>
  );
}

export function AiConversationSidebar({ codexStyle = false, folders, sessions, activeSessionId, onOpenSession, onNewSession, onCreateFolder, onMoveSession, onRename, onArchive, onLeaveAi }: AiConversationSidebarProps) {
  const [searchOpen, setSearchOpen] = useState(false), [search, setSearch] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AiConversationTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<AiConversationFeedbackState>({ status: 'idle', message: '' });
  const menuAnchor = useRef<HTMLSpanElement>(null);
  const menuPopover = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  function openMenu(target: AiConversationTarget, element: HTMLElement, point?: { x: number; y: number }) {
    if (busy || renameTarget || archiveTarget) return;
    const trigger = element.closest<HTMLElement>('[role="row"]') ?? element;
    if (codexStyle) trigger.focus({ preventScroll: true });
    returnFocus.current = trigger;
    const rect = trigger.getBoundingClientRect();
    const anchor = point ?? { x: rect.left + 12, y: rect.bottom };
    // Keep the point inside the overlay's safe viewport inset; RAC owns panel collision/flip.
    setContextTarget({ ...target, x: Math.max(12, Math.min(anchor.x, window.innerWidth - 12)), y: Math.max(12, Math.min(anchor.y, window.innerHeight - 12)) });
  }

  function keyboardMenu(event: KeyboardEvent<HTMLElement>, target: AiConversationTarget, trigger = event.currentTarget) {
    if (!codexStyle || (event.target as HTMLElement).closest('input')) return;
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      openMenu(target, trigger);
    }
  }

  useEffect(() => {
    if (!contextTarget || !codexStyle) return;
    const closeOnOutsideScroll = (event: Event) => {
      if (!menuPopover.current?.contains(event.target as Node)) setContextTarget(null);
    };
    window.addEventListener('scroll', closeOnOutsideScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', closeOnOutsideScroll, true);
  }, [contextTarget, codexStyle]);

  useEffect(() => {
    if (!codexStyle || contextTarget || renameTarget || archiveTarget || !returnFocus.current) return;
    const frame = requestAnimationFrame(() => {
      const trigger = returnFocus.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('[data-testid="ai-conversation-new"]')?.focus();
      returnFocus.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [codexStyle, contextTarget, renameTarget, archiveTarget]);

  useEffect(() => {
    if (!contextTarget || codexStyle) return undefined;
    const close = () => setContextTarget(null);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextTarget, codexStyle]);

  const sessionsInFolder = (folderId: string | null) => sessions.filter((session) => (session.folderId ?? null) === folderId && (!codexStyle || session.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())));

  async function runAction(message: string, successMessage: string, action: () => Promise<void>) {
    setBusy(true);
    setFeedback({ status: 'working', message });
    try {
      await action();
      setFeedback({ status: 'success', message: successMessage });
      return true;
    } catch (error) {
      setFeedback({ status: 'error', message: error instanceof Error ? error.message : '对话库操作失败，请重试。' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createFolder() {
    const name = folderName.trim();
    if (!name) {
      setFeedback({ status: 'error', message: '文件夹名称不能为空。' });
      return;
    }
    if (!await runAction('正在创建文件夹…', `文件夹“${name}”已创建。`, () => onCreateFolder(name))) return;
    setFolderName('');
    setCreatingFolder(false);
  }

  async function rename() {
    if (!renameTarget) return;
    const value = renameTarget.value.trim();
    if (!value) {
      setFeedback({ status: 'error', message: '名称不能为空。' });
      return;
    }
    if (!await runAction('正在重命名…', `已重命名为“${value}”。`, () => onRename(renameTarget, value))) return;
    setRenameTarget(null);
  }

  async function move(sessionId: string, folderId: string | null) {
    await runAction('正在移动对话…', folderId ? '对话已移动到文件夹。' : '对话已移回未归档。', () => onMoveSession(sessionId, folderId));
  }

  async function archive() {
    if (!archiveTarget) return;
    if (!await runAction('正在归档…', archiveTarget.type === 'folder' ? '文件夹及其中对话已归档。' : '对话已归档。', () => onArchive(archiveTarget))) return;
    setArchiveTarget(null);
  }

  const renderSessionList = (folderId: string | null) => {
    const folderSessions = sessionsInFolder(folderId);
    if (!folderSessions.length) return <div className="ai-session-empty" data-testid={`ai-conversation-empty-${folderId ?? 'inbox'}`}>暂无对话</div>;
    return (
      <ChatListView.Root<AiConversationSession> aria-label={folderId ? '文件夹对话' : '未归档对话'} className="ai-session-list" density="compact" selectionMode="none" onAction={(key) => void onOpenSession(String(key))}>
        {folderSessions.map((session) => (
          <ChatListView.Item id={session.id} key={session.id} textValue={session.title}
            onContextMenu={event => { event.preventDefault(); openMenu({ type: 'session', id: session.id, name: session.title }, event.currentTarget, { x: event.clientX, y: event.clientY }); }}>
            <ChatListView.ItemContent
              className={session.id === activeSessionId ? 'active' : ''}
              data-testid={`ai-conversation-session-${session.id}`}
              data-session-id={session.id}
              draggable={!busy}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', session.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              <ChatListView.Icon><MessageSquare size={15} /></ChatListView.Icon>
              <ChatListView.Text>
                <ChatListView.Title>
                  {renameTarget?.type === 'session' && renameTarget.id === session.id ? (
                    <input autoFocus aria-label="对话名称" disabled={busy} className="ai-inline-rename" value={renameTarget.value} onChange={(event) => setRenameTarget({ ...renameTarget, value: event.target.value })} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') void rename(); if (event.key === 'Escape' && !busy) setRenameTarget(null); }} data-testid={`ai-conversation-rename-session-${session.id}`} />
                  ) : session.title}
                </ChatListView.Title>
                <ChatListView.Preview>{session.lastResponsePreview || session.lastPrompt || '新对话'}</ChatListView.Preview>
              </ChatListView.Text>
              <ChatListView.Meta>{session.messageCount}</ChatListView.Meta>
            </ChatListView.ItemContent>
          </ChatListView.Item>
        ))}
      </ChatListView.Root>
    );
  };

  const renderDropZone = (folderId: string | null, children: ReactNode) => (
    <div className="ai-folder-dropzone" data-folder-id={folderId ?? 'inbox'} data-testid={`ai-conversation-drop-${folderId ?? 'inbox'}`} onDragOver={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); const sessionId = event.dataTransfer.getData('text/plain'); if (sessionId) void move(sessionId, folderId); }}>
      {children}
    </div>
  );

  const Container = codexStyle ? Sidebar : 'aside';
  return (
    <Container className={`work-panel ai-session-sidebar${codexStyle ? ' pi-conversation-sidebar' : ''}`} data-testid="ai-conversation-sidebar" onKeyDownCapture={event => {
      const row = (event.target as HTMLElement).closest<HTMLElement>('[role="row"]');
      const id = row?.querySelector('[data-session-id]')?.getAttribute('data-session-id');
      const session = sessions.find(value => value.id === id);
      if (row && session) keyboardMenu(event, { type: 'session', id: session.id, name: session.title }, row);
    }}>
      {!codexStyle && <button className="ai-sidebar-return" onClick={onLeaveAi} data-testid="ai-return-workspace"><ArrowLeft size={16} /><span>工作台</span></button>}
      <div className="ai-session-header">
        <div className="workspace-label"><div><h2>小智</h2>{!codexStyle && <p>本地会话</p>}</div></div>
        {codexStyle ? <button className="icon-button" aria-label="搜索对话" aria-expanded={searchOpen} onClick={()=>{setSearchOpen(value=>!value);setSearch('');}} data-testid="pi-conversation-search"><Search size={18}/></button> : <button className="icon-button" aria-label="新建对话" onClick={() => void onNewSession(sessions.find((session) => session.id === activeSessionId)?.folderId ?? null)} disabled={busy} data-testid="ai-conversation-new"><Plus size={16} /></button>}
      </div>
      {codexStyle && <>
        {searchOpen && <input className="pi-conversation-search-input" aria-label="搜索本地对话" placeholder="搜索对话…" autoFocus value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'){setSearchOpen(false);setSearch('');}}} data-testid="pi-conversation-search-input"/>}
        <button className="pi-new-chat" aria-label="新建对话" onClick={()=>void onNewSession(sessions.find(session=>session.id===activeSessionId)?.folderId??null)} disabled={busy} data-testid="ai-conversation-new"><SquarePen size={18}/><span>新聊天</span></button>
      </>}
      <div className="ai-folder-actions">
        {creatingFolder ? (
          <div className="ai-folder-create">
            <input aria-label="文件夹名称" placeholder="文件夹名称" value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') void createFolder(); if (event.key === 'Escape') { setCreatingFolder(false); setFolderName(''); } }} data-testid="ai-conversation-folder-name" />
            <button className="primary-action compact-button" onClick={() => void createFolder()} disabled={busy} data-testid="ai-conversation-folder-save">保存</button>
            <button className="ghost-action compact-button" onClick={() => { setCreatingFolder(false); setFolderName(''); }} disabled={busy} data-testid="ai-conversation-folder-cancel">取消</button>
          </div>
        ) : <button className="secondary-action wide" onClick={() => setCreatingFolder(true)} disabled={busy} data-testid="ai-conversation-folder-new"><FolderPlus size={16} />新建文件夹</button>}
      </div>
      <AiConversationFeedback state={feedback} />
      <div className="ai-folder-group">{renderDropZone(null, <><div className="ai-folder-title"><Inbox size={15} /><span>未归档</span><em>{sessionsInFolder(null).length}</em></div>{renderSessionList(null)}</>)}</div>
      <div className="ai-folder-group">
        {folders.map((folder) => <section className="ai-folder" key={folder.id} data-testid={`ai-conversation-folder-${folder.id}`}>{renderDropZone(folder.id, <><div className="ai-folder-title" tabIndex={codexStyle ? 0 : undefined} aria-label={`文件夹：${folder.name}`} onKeyDown={event => keyboardMenu(event, { type: 'folder', id: folder.id, name: folder.name })} onContextMenu={(event) => { event.preventDefault(); openMenu({ type: 'folder', id: folder.id, name: folder.name }, event.currentTarget, { x: event.clientX, y: event.clientY }); }}><Folder size={15} /><span>{renameTarget?.type === 'folder' && renameTarget.id === folder.id ? <input autoFocus aria-label="文件夹名称" disabled={busy} className="ai-inline-rename" value={renameTarget.value} onChange={(event) => setRenameTarget({ ...renameTarget, value: event.target.value })} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') void rename(); if (event.key === 'Escape' && !busy) setRenameTarget(null); }} data-testid={`ai-conversation-rename-folder-${folder.id}`} /> : folder.name}</span><em>{sessionsInFolder(folder.id).length}</em></div>{renderSessionList(folder.id)}</>)}</section>)}
      </div>
      {codexStyle && typeof document !== 'undefined' && createPortal(<span ref={menuAnchor} data-testid="ai-conversation-menu-anchor" aria-hidden="true" style={{ position: 'fixed', left: contextTarget?.x ?? 0, top: contextTarget?.y ?? 0, width: 0, height: 0, pointerEvents: 'none' }} />, document.body)}
      {contextTarget && codexStyle ? <Dropdown.Popover ref={menuPopover} isOpen triggerRef={menuAnchor} placement="bottom start" offset={2} containerPadding={12} onOpenChange={open => { if (!open) setContextTarget(null); }} className="dropdown__popover pi-office-menu" data-testid="ai-conversation-context-menu">
        <Dropdown.Menu className="dropdown__menu" aria-label={`${contextTarget.type === 'folder' ? '文件夹' : '对话'}操作`} autoFocus="first" onClose={() => setContextTarget(null)} onAction={key => {
          if (key === 'rename') setRenameTarget({ ...contextTarget, value: contextTarget.name });
          if (key === 'archive') setArchiveTarget(contextTarget);
          setContextTarget(null);
        }}>
          <Dropdown.Item id="rename" textValue="重命名" data-testid="ai-conversation-context-rename"><Label>重命名</Label></Dropdown.Item>
          <Dropdown.Item id="archive" textValue="归档" data-testid="ai-conversation-context-archive"><Label>归档</Label></Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover> : contextTarget ? <div className="ai-context-menu" style={{ left: contextTarget.x, top: contextTarget.y }} onClick={(event) => event.stopPropagation()} data-testid="ai-conversation-context-menu"><button onClick={() => { setRenameTarget({ ...contextTarget, value: contextTarget.name }); setContextTarget(null); }} data-testid="ai-conversation-context-rename">重命名</button><button onClick={() => { setArchiveTarget(contextTarget); setContextTarget(null); }} data-testid="ai-conversation-context-archive">归档</button></div> : null}
      {archiveTarget ? <AiConversationArchiveConfirmation modal={codexStyle} target={archiveTarget} busy={busy} onConfirm={() => void archive()} onCancel={() => setArchiveTarget(null)} /> : null}
    </Container>
  );
}
