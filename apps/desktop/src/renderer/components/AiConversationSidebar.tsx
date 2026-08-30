import { Folder, FolderPlus, Inbox, MessageSquare, Plus } from 'lucide-react';
import { useEffect, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { ChatListView } from '../heroui-pro/components/chat-list-view';
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
  folders: AiConversationFolder[];
  sessions: AiConversationSession[];
  activeSessionId: string;
  onOpenSession: (sessionId: string) => Promise<void> | void;
  onNewSession: (folderId: string | null) => Promise<void> | void;
  onCreateFolder: (name: string) => Promise<void>;
  onMoveSession: (sessionId: string, folderId: string | null) => Promise<void>;
  onRename: (target: AiConversationTarget, value: string) => Promise<void>;
  onArchive: (target: AiConversationTarget) => Promise<void>;
};

export function AiConversationFeedback({ state }: { state: AiConversationFeedbackState }) {
  if (state.status === 'idle') return <div className="ai-conversation-feedback" data-testid="ai-conversation-idle">右键可重命名或归档；拖动对话可分类。</div>;
  return <div className={`ai-conversation-feedback ${state.status}`} role={state.status === 'error' ? 'alert' : 'status'} data-testid={`ai-conversation-${state.status}`}>{state.message}</div>;
}

export function AiConversationArchiveConfirmation({ target, busy, onConfirm, onCancel }: { target: AiConversationTarget; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
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

export function AiConversationSidebar({ folders, sessions, activeSessionId, onOpenSession, onNewSession, onCreateFolder, onMoveSession, onRename, onArchive }: AiConversationSidebarProps) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AiConversationTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<AiConversationFeedbackState>({ status: 'idle', message: '' });

  useEffect(() => {
    if (!contextTarget) return undefined;
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
  }, [contextTarget]);

  const sessionsInFolder = (folderId: string | null) => sessions.filter((session) => (session.folderId ?? null) === folderId);

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
          <ChatListView.Item id={session.id} key={session.id} textValue={session.title}>
            <ChatListView.ItemContent
              className={session.id === activeSessionId ? 'active' : ''}
              data-testid={`ai-conversation-session-${session.id}`}
              data-session-id={session.id}
              draggable={!busy}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextTarget({ type: 'session', id: session.id, name: session.title, x: event.clientX, y: event.clientY });
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', session.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              <ChatListView.Icon><MessageSquare size={15} /></ChatListView.Icon>
              <ChatListView.Text>
                <ChatListView.Title>
                  {renameTarget?.type === 'session' && renameTarget.id === session.id ? (
                    <input autoFocus className="ai-inline-rename" value={renameTarget.value} onChange={(event) => setRenameTarget({ ...renameTarget, value: event.target.value })} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Enter') void rename(); if (event.key === 'Escape') setRenameTarget(null); }} data-testid={`ai-conversation-rename-session-${session.id}`} />
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

  return (
    <aside className="work-panel ai-session-sidebar" data-testid="ai-conversation-sidebar">
      <div className="ai-session-header">
        <div className="workspace-label"><span>01</span><div><h2>对话</h2><p>本地保存，可拖入文件夹分类。</p></div></div>
        <button className="icon-button" aria-label="新建对话" onClick={() => void onNewSession(sessions.find((session) => session.id === activeSessionId)?.folderId ?? null)} disabled={busy} data-testid="ai-conversation-new"><Plus size={16} /></button>
      </div>
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
        {folders.map((folder) => <section className="ai-folder" key={folder.id} data-testid={`ai-conversation-folder-${folder.id}`}>{renderDropZone(folder.id, <><div className="ai-folder-title" onContextMenu={(event) => { event.preventDefault(); setContextTarget({ type: 'folder', id: folder.id, name: folder.name, x: event.clientX, y: event.clientY }); }}><Folder size={15} /><span>{renameTarget?.type === 'folder' && renameTarget.id === folder.id ? <input autoFocus className="ai-inline-rename" value={renameTarget.value} onChange={(event) => setRenameTarget({ ...renameTarget, value: event.target.value })} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Enter') void rename(); if (event.key === 'Escape') setRenameTarget(null); }} data-testid={`ai-conversation-rename-folder-${folder.id}`} /> : folder.name}</span><em>{sessionsInFolder(folder.id).length}</em></div>{renderSessionList(folder.id)}</>)}</section>)}
      </div>
      {contextTarget ? <div className="ai-context-menu" style={{ left: contextTarget.x, top: contextTarget.y }} onClick={(event) => event.stopPropagation()} data-testid="ai-conversation-context-menu"><button onClick={() => { setRenameTarget({ ...contextTarget, value: contextTarget.name }); setContextTarget(null); }} data-testid="ai-conversation-context-rename">重命名</button><button onClick={() => { setArchiveTarget(contextTarget); setContextTarget(null); }} data-testid="ai-conversation-context-archive">归档</button></div> : null}
      {archiveTarget ? <AiConversationArchiveConfirmation target={archiveTarget} busy={busy} onConfirm={() => void archive()} onCancel={() => setArchiveTarget(null)} /> : null}
    </aside>
  );
}
