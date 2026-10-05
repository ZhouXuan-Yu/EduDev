import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, SearchField, Switch } from '@heroui/react';
import { ArrowLeft, Archive, BookOpen, FolderLock, HardDrive, Monitor, Plug, RefreshCw } from 'lucide-react';
import type { AiConversationWorkspace } from '../../../shared/contracts';
import type { XiaozhiWorkspaceSnapshot } from '../../../shared/xiaozhi-agent';
import { XIAOZHI_ERRORS } from '../../../shared/xiaozhi-projection';
import type { XiaozhiMemoryScopeInput } from '../../../shared/xiaozhi-memory';
import { DataBackupPanel } from '../DataBackupPanel';
import { PiModelSettings } from './PiModelSettings';
import { PiSkillSettings } from './PiSkillSettings';
import { PiMemoryScope } from './PiMemoryScope';
import { OfficeConversation } from './OfficeConversation';
import { SettingsPage, SettingsStack } from './hana-settings/SettingsPrimitives';
import { SettingsSection } from './hana-settings/SettingsSection';
import { SettingsRow } from './hana-settings/SettingsRow';
import { searchSettings, type SettingsSearchEntry } from './hana-settings/settings-search';
import navStyles from './hana-settings/workspace-nav.module.css';
import { readWorkspacePreferences, writeWorkspacePreferences, type WorkspacePreferences } from './workspace-preferences';
import './pi-settings-workspace.css';
import { ProductRail } from '../product/ProductRail';

const tabs = [
  { id: 'models', label: '模型与连接', icon: Plug },
  { id: 'skills', label: '技能', icon: BookOpen },
  { id: 'permissions', label: '工作目录与权限', icon: FolderLock },
  { id: 'interface', label: '界面偏好', icon: Monitor },
  { id: 'archives', label: '归档', icon: Archive },
  { id: 'backup', label: '备份', icon: HardDrive },
] as const;
type Tab = typeof tabs[number]['id'];
// Capability-only metadata. Never index credentials, history, paths or document contents.
export const XIAOZHI_SETTINGS_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  ...tabs.map(tab => ({ id: `tab-${tab.id}`, tabId: tab.id, title: tab.label, path: [tab.label] })),
  { id: 'pi-settings-key', tabId: 'models', title: 'API 密钥', path: ['模型与连接', 'DeepSeek', 'API 密钥'], aliases: ['api key', '连接', 'deepseek', '密钥配置'] },
  { id:'pi-web-settings',tabId:'models',title:'联网资料',path:['模型与连接','联网资料'],aliases:['搜索','网络解析','DNS','网页','来源'] },
  { id: 'pi-settings-default-model', tabId: 'models', title: '新对话默认模型', path: ['模型与连接', '默认模型'], aliases: ['default model', 'flash', 'pro'] },
  { id: 'pi-skill-import', tabId: 'skills', title: '导入本地技能', path: ['技能', '导入'], aliases: ['skills', 'skill import', 'SKILL.md', '启用', '停用', '编辑'] },
  { id: 'pi-settings-workspace-choose', tabId: 'permissions', title: '本会话工作目录', path: ['工作目录与权限', '工作目录'], aliases: ['workspace', 'folder', '文件', '写入', '授权', '确认'] },
  { id: 'pi-memory-scope', tabId: 'permissions', title: '本会话记忆', path: ['工作目录与权限', '记忆'], aliases: ['memory', '脱敏', '摘要', '撤权', '隐私'] },
  { id: 'pi-preference-sidebar', tabId: 'interface', title: '会话侧栏', path: ['界面偏好', '会话侧栏'], aliases: ['sidebar', '侧边栏'] },
  { id: 'pi-preference-aside', tabId: 'interface', title: '任务详情', path: ['界面偏好', '任务详情'], aliases: ['aside', '任务面板'] },
  { id: 'pi-preference-files', tabId: 'interface', title: '本地文件面板', path: ['界面偏好', '本地文件面板'], aliases: ['files', 'file panel', '预览'] },
  { id: 'pi-settings-archives', tabId: 'archives', title: '已归档对话', path: ['归档', '对话记录'], aliases: ['archived chats', 'history', '历史'] },
  { id: 'data-backup-export', tabId: 'backup', title: '创建本地备份', path: ['备份', '创建'], aliases: ['backup export', '导出备份', '数据'] },
  { id: 'data-backup-verify', tabId: 'backup', title: '检查已有备份', path: ['备份', '检查'], aliases: ['backup verify', '校验', '完整性'] },
];

export function PiSettingsWorkspace({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('models'), [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState<AiConversationWorkspace>(), [sessionId, setSessionId] = useState('');
  const [snapshot, setSnapshot] = useState<XiaozhiWorkspaceSnapshot>(), [dataRoot, setDataRoot] = useState('');
  const [locked, setLocked] = useState(true), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const [preferences, setPreferences] = useState(readWorkspacePreferences), [preferenceNotice, setPreferenceNotice] = useState('');
  const [actionBusy, setActionBusy] = useState(false), [childBusy, setChildBusy] = useState(false);
  const [archive, setArchive] = useState<{ title: string; value: XiaozhiWorkspaceSnapshot }>(), [archiveLoading, setArchiveLoading] = useState(false), [archiveNotice, setArchiveNotice] = useState('');
  const live = useRef(true), request = useRef(0), archiveRequest = useRef(0), action = useRef(false), target = useRef('');
  const busy = actionBusy || childBusy;
  const results = useMemo(() => searchSettings(query, XIAOZHI_SETTINGS_SEARCH_ENTRIES, key => key), [query]);
  async function reload() {
    const own = ++request.current;
    try {
      const api = window.omniEdu; if (!api) throw new Error('unavailable');
      const [list, settings, root] = await Promise.all([api.listAiConversations(), api.getXiaozhiSettings(), api.getDataRoot()]);
      if (!live.current || request.current !== own) return;
      let remembered = '';
      try { remembered = localStorage.getItem('xiaozhi.current-session.v1') || ''; } catch { /* No authority in preferences. */ }
      const id = list.sessions.find(item => item.id === remembered)?.id || list.sessions[0]?.id || '';
      const current = id ? await api.getXiaozhiSnapshot(id) : undefined;
      if (!live.current || request.current !== own) return;
      setWorkspace(list); setSessionId(id); setSnapshot(current); setDataRoot(root);
      setLocked(!settings.ok || settings.value.locked); setNotice(settings.ok ? '' : '暂时无法读取任务状态，请刷新。');
    } catch { if (live.current && request.current === own) { setLocked(true); setNotice('设置状态未读取，请刷新重试。'); } }
    finally { if (live.current && request.current === own) setLoading(false); }
  }
  useEffect(() => {
    live.current = true; void reload();
    const unsubscribe = window.omniEdu?.onXiaozhiEvent(event => { if (event.kind === 'status') void reload(); });
    return () => { live.current = false; request.current++; archiveRequest.current++; unsubscribe?.(); };
  }, []);
  useEffect(() => {
    if (!target.current) return;
    const element = document.querySelector<HTMLElement>(`[data-testid="${target.current}"]`);
    if (element) { element.scrollIntoView({ block: 'center' }); if (element.matches('button,input')) element.focus(); target.current = ''; }
  }, [tab, loading, snapshot, childBusy]);
  function open(next: string, focus = '') {
    if (busy || !tabs.some(item => item.id === next)) return;
    target.current = focus; setTab(next as Tab); setQuery('');
    archiveRequest.current++; setArchive(undefined); setArchiveNotice(''); setArchiveLoading(false);
    // Same-tab search also needs to focus an already mounted target.
    if (next === tab && focus) { const element = document.querySelector<HTMLElement>(`[data-testid="${focus}"]`); element?.scrollIntoView({ block: 'center' }); if (element?.matches('button,input')) element.focus(); target.current = ''; }
  }
  function updatePreference(field: keyof WorkspacePreferences, value: boolean) {
    const next = { ...preferences, [field]: value };
    if (writeWorkspacePreferences(next)) { setPreferences(next); setPreferenceNotice('已保存，返回小智后生效。'); }
    else setPreferenceNotice('未能保存界面偏好。请确认本机存储可用后重试。');
  }
  async function mutatePermission(work: () => Promise<void>) {
    if (action.current || childBusy) throw new Error('busy');
    action.current = true; setActionBusy(true); setNotice('');
    try { await work(); if (live.current) await reload(); }
    finally { action.current = false; if (live.current) setActionBusy(false); }
  }
  async function saveMemory(input: XiaozhiMemoryScopeInput) {
    await mutatePermission(async () => {
      const result = await window.omniEdu?.setXiaozhiMemoryScope(input);
      if (!result?.ok) throw new Error('memory_not_saved');
    });
  }
  async function chooseWorkspace() {
    if (!sessionId || locked || busy) return;
    await mutatePermission(async () => {
      const result = await window.omniEdu?.selectXiaozhiWorkspace(sessionId);
      if (live.current && result && !result.ok) setNotice(XIAOZHI_ERRORS[result.error]);
      if (!result?.ok) throw new Error('workspace_not_saved');
    }).catch(() => { if (live.current) setNotice('目录未更改。已有对话的目录保持绑定；请刷新核对或在新对话中选择。'); });
  }
  async function readArchive(id: string, title: string) {
    const own = ++archiveRequest.current; setArchive(undefined); setArchiveLoading(true); setArchiveNotice('');
    try {
      const api = window.omniEdu; if (!api) throw new Error('unavailable');
      const latest = await api.listAiConversations();
      if (!latest.archivedSessions.some(item => item.id === id)) throw new Error('no_longer_archived');
      const value = await api.getXiaozhiSnapshot(id);
      if (live.current && archiveRequest.current === own) setArchive({ title, value });
    } catch { if (live.current && archiveRequest.current === own) setArchiveNotice('归档记录未读取，请刷新列表后重试。'); }
    finally { if (live.current && archiveRequest.current === own) setArchiveLoading(false); }
  }
  const title = tabs.find(item => item.id === tab)!.label;
  return <div className="product-settings-frame pi-themed-surface"><ProductRail active="settings" disabled={busy}/><div className="pi-settings-workspace pi-themed-surface" data-testid="pi-settings-workspace" data-tab={tab}>
    <header><Button variant="ghost" size="sm" data-testid="nav-ai" isDisabled={busy} onPress={onBack}><ArrowLeft size={17}/>返回小智</Button><span>设置</span>{busy && <span role="status">正在保存或处理本地资料…</span>}</header>
    <div className="pi-settings-body">
      <nav className="pi-settings-nav" aria-label="小智设置分类">
        <SearchField value={query} onChange={setQuery} aria-label="搜索设置" isDisabled={busy} className="pi-settings-search">
          <SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="搜索设置" data-testid="pi-settings-search" onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }}/><SearchField.ClearButton aria-label="清空设置搜索"/></SearchField.Group>
        </SearchField>
        {query.trim() ? <div className={navStyles['settings-search-results']} data-testid="pi-settings-search-results" aria-live="polite">
          <span className={navStyles['settings-search-results-title']}>搜索结果</span>
          {results.map(result => <Button key={result.id} variant="ghost" className={navStyles['settings-search-result']} onPress={() => open(result.tabId, result.id.startsWith('tab-') ? '' : result.id)}>
            <span className={navStyles['settings-search-result-title']}>{result.title}</span><span className={navStyles['settings-search-result-path']}>{result.path}</span>
          </Button>)}
          {!results.length && <p className={navStyles['settings-search-empty']} data-testid="pi-settings-search-empty">没有找到设置，试试“技能”“目录”或“备份”。</p>}
        </div> : tabs.map(item => <Button key={item.id} variant="ghost" className={`${navStyles['settings-nav-item']} ${tab === item.id ? navStyles.active : ''}`} aria-current={tab === item.id ? 'page' : undefined} data-testid={`pi-settings-tab-${item.id}`} isDisabled={busy} onPress={() => open(item.id)}><item.icon size={18}/>{item.label}</Button>)}
      </nav>
      <main className="pi-settings-main" aria-label={title} data-testid="pi-settings-main">
        {notice && <div className="pi-settings-state" role="alert" data-testid="pi-settings-state"><p>{notice}</p><Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void reload()}>刷新</Button></div>}
        {tab === 'models' && <PiModelSettings embedded onBack={onBack} onBusyChange={setChildBusy}/>}
        {tab === 'skills' && <PiSkillSettings embedded running={locked} onClose={onBack} onChanged={reload} onBusyChange={setChildBusy}/>}
        {tab === 'permissions' && <SettingsPage tab={tab}><SettingsStack gap="lg"><div><h1>{title}</h1><p>授权属于当前对话，写入资料前仍需你的确认。</p></div>
          {loading ? <p role="status">正在读取本地授权…</p> : !sessionId || !snapshot ? <p data-testid="pi-settings-no-session">还没有可设置的对话，请返回小智新建对话。</p> : <>
            <SettingsSection title="本会话工作目录" description={workspace?.sessions.find(item => item.id === sessionId)?.title}>
              <SettingsRow label={snapshot.workspace?.label || '尚未选择工作目录'} hint="仅可读取已授权的本地目录；写入、复制和移动需要逐次确认。" control={<Button size="sm" variant="secondary" data-testid="pi-settings-workspace-choose" isDisabled={locked || busy || snapshot.projection.turns.length > 0} onPress={() => void chooseWorkspace()}>选择目录</Button>}/>
              {snapshot.projection.turns.length > 0 && <SettingsSection.Note>该对话已绑定目录。需要其他目录时，请新建对话再选择。</SettingsSection.Note>}
            </SettingsSection>
            <SettingsSection title="联网与资料保护" surface="plain"><SettingsStack gap="sm"><p>小智可以按任务检索网页和读取网页。每次请求显示真实工具过程与来源。</p><p>原始资料与学生图片保留本机。模型只使用完成任务所需的脱敏文本；技能与界面偏好不会扩大文件权限。</p></SettingsStack></SettingsSection>
            {snapshot.memoryScope && <PiMemoryScope key={sessionId} sessionId={sessionId} scope={snapshot.memoryScope} running={locked || busy} onSave={saveMemory} onRefresh={reload}/>}</>}
        </SettingsStack></SettingsPage>}
        {tab === 'interface' && <SettingsPage tab={tab}><SettingsStack gap="lg"><div><h1>{title}</h1><p>调整小智工作区的面板显示。</p></div><SettingsSection title="工作区面板">
          {([{ field: 'sidebar', label: '会话侧栏', hint: '显示项目和最近对话。' }, { field: 'aside', label: '任务详情', hint: '显示任务、来源和本会话设置。' }, { field: 'files', label: '本地文件面板', hint: '打开时显示已授权目录中的文件，替代任务详情面板。' }] as const).map(item => <SettingsRow key={item.field} label={item.label} hint={item.hint} control={<Switch aria-label={item.label} data-testid={`pi-preference-${item.field}`} isSelected={preferences[item.field]} onChange={value => updatePreference(item.field, value)}><Switch.Content><Switch.Control><Switch.Thumb/></Switch.Control></Switch.Content></Switch>}/>)}
        </SettingsSection>{preferenceNotice && <p role="status" data-testid="pi-preference-notice">{preferenceNotice}</p>}</SettingsStack></SettingsPage>}
        {tab === 'archives' && <SettingsPage tab={tab}><SettingsStack gap="lg"><div><h1>{title}</h1><p>查看保存在本机的归档记录。</p></div><div className="pi-settings-actions"><Button size="sm" variant="ghost" onPress={() => { setArchive(undefined); void reload(); }}><RefreshCw size={15}/>刷新归档</Button></div>
          <SettingsSection title="已归档对话"><div data-testid="pi-settings-archives">
            {loading ? <p>正在读取…</p> : !workspace?.archivedSessions.length ? <p data-testid="pi-settings-archive-empty">没有已归档的对话。</p> : workspace.archivedSessions.map(item => <SettingsRow key={item.id} label={item.title} hint={`${item.messageCount} 条消息`} control={<Button size="sm" variant="ghost" data-testid={`pi-archive-read-${item.id}`} onPress={() => void readArchive(item.id, item.title)}>查看记录</Button>}/>)}</div></SettingsSection>
          {!!workspace?.archivedFolders.length && <SettingsSection title="已归档项目">{workspace.archivedFolders.map(item => <SettingsRow key={item.id} label={item.name} control={<span>已归档</span>}/>)}</SettingsSection>}
          {archiveLoading && <p role="status">正在读取归档记录…</p>}{archiveNotice && <p role="alert">{archiveNotice}</p>}
          {archive && <section className="pi-settings-archive-reader" data-testid="pi-settings-archive-reader"><h2>{archive.title}</h2><p>只读记录</p><OfficeConversation projection={archive.value.projection}/></section>}
        </SettingsStack></SettingsPage>}
        {tab === 'backup' && <SettingsPage tab={tab}><SettingsStack gap="lg"><div><h1>{title}</h1><p>在本机保存和检查资料副本。</p></div><SettingsSection title="本地备份"><DataBackupPanel modern dataRoot={dataRoot} disabled={locked || actionBusy} onBusyChange={setChildBusy}/></SettingsSection></SettingsStack></SettingsPage>}
      </main>
    </div>
  </div></div>;
}
