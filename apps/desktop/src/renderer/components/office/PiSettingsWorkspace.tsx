import {PiManagedTools} from './PiManagedTools';
import {PiCapabilityCenter} from './PiCapabilityCenter';
import {PiPermissionSettings} from './PiPermissionSettings';
import {PiEnvironmentSettings} from './PiEnvironmentSettings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, SearchField, Switch } from '@heroui/react';
import { ArrowLeft, Archive, BookOpen, FolderLock, HardDrive, Monitor, Plug, RefreshCw } from 'lucide-react';
import type { AiConversationWorkspace } from '../../../shared/contracts';
import type { XiaozhiWorkspaceSnapshot } from '../../../shared/xiaozhi-agent';
import { XIAOZHI_ERRORS } from '../../../shared/xiaozhi-projection';
import type { XiaozhiMemoryScopeInput } from '../../../shared/xiaozhi-memory';
import { DataBackupPanel } from '../DataBackupPanel';
import {WindowsUpdatePanel} from '../WindowsUpdatePanel';
import type {RecoveryModelSettings} from '../PortableRecoveryChecklist';
import { PiModelSettings } from './PiModelSettings';
import { PiSkillSettings } from './PiSkillSettings';
import { PiMcpSettings } from './PiMcpSettings';
import { PiDecisionHistory } from './PiDecisionHistory';
import {PiCandidateHistory} from './PiCandidateHistory';
import {PiDiagnostics} from './PiDiagnostics';
import {PiResolvedAgentConfig} from './PiResolvedAgentConfig';
import { PiMemoryScope } from './PiMemoryScope';
import { PiTeacherMemorySettings } from './PiTeacherMemorySettings';
import {PiL2MemorySettings} from './PiL2MemorySettings';
import {PiHistoryMemorySettings} from './PiHistoryMemorySettings';
import { OfficeConversation } from './OfficeConversation';
import { SettingsPage, SettingsStack } from './hana-settings/SettingsPrimitives';
import { SettingsSection } from './hana-settings/SettingsSection';
import { SettingsRow } from './hana-settings/SettingsRow';
import {followUpLabel,alternateFollowUp,saveComposerFollowUp,useComposerFollowUp} from './composer-follow-up';
import { searchSettings, type SettingsSearchEntry } from './hana-settings/settings-search';
import {SettingsSearchResults} from './SettingsSearchResults';
import {SettingsNavigation} from './SettingsNavigation';
import {AppSelect} from '../ui/AppSelect';
import layoutStyles from '../../ui-system/student-settings/student-settings-layout.module.css';
import {teacherWorkspaceLabel} from './workspace-label';
import { readWorkspacePreferences, writeWorkspacePreferences, type WorkspacePreferences } from './workspace-preferences';
import './pi-settings-workspace.css';
import {EduShell} from '../../ui-system/EduShell';
import { useWorkbenchPreferences } from '../../ui-system/WorkbenchState';
import windowStyles from '../../ui-system/settings-window.module.css';
import {useSettingsWindowGuard,useSettingsWindowBlocked} from '../desktop/SettingsCloseGuards';

const tabs = [
  { id: 'models', label: '模型与连接', icon: Plug },
  { id: 'skills', label: '教育技能', icon: BookOpen },
  { id: 'capabilities', label: '能力中心', icon: Plug },
  { id: 'tools', label: '外部工具', icon: Plug },
  { id: 'permissions', label: '资料与权限', icon: FolderLock },
  { id: 'teacher-memory', label: '教师记忆', icon: BookOpen },
  { id: 'interface', label: '界面偏好', icon: Monitor },
  { id: 'archives', label: '归档', icon: Archive },
  { id: 'backup', label: '备份与归档', icon: HardDrive },
  { id: 'diagnostics', label: '策略与诊断', icon: RefreshCw },
] as const;
type Tab = typeof tabs[number]['id'];
const CLOSE_GUARD_NOTICE='请先保存或放弃未保存的更改，并等待当前操作结束。';
// Capability-only metadata. Never index credentials, history, paths or document contents.
export const XIAOZHI_SETTINGS_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  ...tabs.map(tab => ({ id: `tab-${tab.id}`, tabId: tab.id, title: tab.label, path: [tab.label] })),
  { id: 'pi-settings-key', tabId: 'models', title: 'API 密钥', path: ['模型与连接', 'DeepSeek', 'API 密钥'], aliases: ['api key', '连接', 'deepseek', '密钥配置'] },
  { id:'pi-web-settings',tabId:'models',title:'联网资料',path:['模型与连接','联网资料'],aliases:['搜索','网络解析','DNS','网页','来源'] },
  { id: 'pi-settings-default-model', tabId: 'models', title: '新对话默认模型', path: ['模型与连接', '默认模型'], aliases: ['default model', 'flash', 'pro'] },
  { id: 'pi-skill-import', tabId: 'skills', title: '导入本地技能', path: ['技能', '导入'], aliases: ['skills', 'skill import', 'SKILL.md', '启用', '停用', '编辑'] },
  { id: 'pi-mcp-name', tabId: 'tools', title: '外部工具连接', path: ['外部工具（高级）', 'MCP'], aliases: ['mcp', 'stdio', '外部服务', '工具授权'] },
  { id: 'pi-settings-workspace-choose', tabId: 'permissions', title: '本会话工作目录', path: ['工作目录与权限', '工作目录'], aliases: ['workspace', 'folder', '文件', '写入', '授权', '确认'] },
  { id: 'pi-memory-scope', tabId: 'permissions', title: '本会话记忆', path: ['工作目录与权限', '记忆'], aliases: ['memory', '脱敏', '摘要', '撤权', '隐私'] },
  { id: 'pi-teacher-memory', tabId: 'teacher-memory', title: '教学画像和长期偏好', path: ['教师记忆', '教师画像和长期偏好'], aliases: ['教学画像', '学科', '年级', '教材', '停用'] },
  { id: 'pi-preference-sidebar', tabId: 'interface', title: '展开左侧导航', path: ['界面偏好', '展开左侧导航'], aliases: ['sidebar', '侧边栏', '会话侧栏'] },
  { id: 'pi-preference-aside', tabId: 'interface', title: '任务详情', path: ['界面偏好', '任务详情'], aliases: ['aside', '任务面板'] },
  { id: 'pi-preference-files', tabId: 'interface', title: '本地文件面板', path: ['界面偏好', '本地文件面板'], aliases: ['files', 'file panel', '预览'] },
  { id: 'pi-queue-mode', tabId: 'interface', title: '追加消息的发送时机', path: ['界面偏好', '追加消息的发送时机'], aliases: ['排队', '补充', '回车', 'steer', 'queue'] },
  { id: 'pi-settings-archives', tabId: 'archives', title: '已归档对话', path: ['归档', '对话记录'], aliases: ['archived chats', 'history', '历史'] },
  { id: 'data-backup-export', tabId: 'backup', title: '创建本地备份', path: ['备份', '创建'], aliases: ['backup export', '导出备份', '数据'] },
  { id: 'data-backup-verify', tabId: 'backup', title: '检查已有备份', path: ['备份', '检查'], aliases: ['backup verify', '校验', '完整性'] },
  { id: 'pi-diagnostic-preview', tabId: 'diagnostics', title: '本轮诊断', path: ['策略与诊断', '本轮诊断'], aliases: ['诊断导出', '错误记录', 'diagnostic', '脱敏'] },
  { id: 'pi-resolved-config', tabId: 'diagnostics', title: '当前配置来源', path: ['策略与诊断', '当前配置来源'], aliases: ['模型来源', '配置版本', '只读'] },
];

export function PiSettingsWorkspace({ onBack,standalone=false }: { onBack: () => void;standalone?:boolean }) {
  const followUp=useComposerFollowUp();
  const [followUpSaveFailed,setFollowUpSaveFailed]=useState(false);
  const [tab, setTab] = useState<Tab>('models'), [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState<AiConversationWorkspace>(), [sessionId, setSessionId] = useState('');
  const [snapshot, setSnapshot] = useState<XiaozhiWorkspaceSnapshot>(), [dataRoot, setDataRoot] = useState('');
  const [recoveryModel, setRecoveryModel] = useState<RecoveryModelSettings>();
  const [readFailed, setReadFailed] = useState(false);
  const [locked, setLocked] = useState(true), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const [preferences, setPreferences] = useState(readWorkspacePreferences), [preferenceNotice, setPreferenceNotice] = useState('');
  const navigationPreferences = useWorkbenchPreferences();
  const [actionBusy, setActionBusy] = useState(false), [childBusy, setChildBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [archive, setArchive] = useState<{ title: string; value: XiaozhiWorkspaceSnapshot }>(), [archiveLoading, setArchiveLoading] = useState(false), [archiveNotice, setArchiveNotice] = useState('');
  const live = useRef(true), request = useRef(0), archiveRequest = useRef(0), action = useRef(false), target = useRef('');
  const localBusy = actionBusy || childBusy || updateBusy;
  useSettingsWindowGuard(localBusy,'请先保存或放弃更改，并等待当前操作结束。');
  const guarded=useSettingsWindowBlocked();
  const busy=localBusy||guarded;
  useEffect(()=>{if(!busy)setNotice(current=>current===CLOSE_GUARD_NOTICE?'':current);},[busy]);
  const results = useMemo(() => searchSettings(query, XIAOZHI_SETTINGS_SEARCH_ENTRIES, key => key), [query]);
  async function reload() {
    const own = ++request.current;
    setLoading(true);
    try {
      const api = window.omniEdu; if (!api) throw new Error('unavailable');
      const [list, settings, root] = await Promise.all([api.listAiConversations(), api.getXiaozhiSettings(), api.getDataRoot()]);
      if (!live.current || request.current !== own) return;
      let remembered = '';
      if(standalone)remembered=window.settingsWindow?.getScope()?.sessionId||'';
      else try { remembered = localStorage.getItem('xiaozhi.current-session.v1') || ''; } catch { /* No authority in preferences. */ }
      const id = list.sessions.find(item => item.id === remembered)?.id || '';
      const current = id ? await api.getXiaozhiSnapshot(id) : undefined;
      if (!live.current || request.current !== own) return;
      setWorkspace(list); setSessionId(id); setSnapshot(current); setDataRoot(root); setReadFailed(false);
      setRecoveryModel(settings.ok ? settings.value : undefined);
      setLocked(!settings.ok || settings.value.locked); setNotice(settings.ok ? '' : '暂时无法读取任务状态，请刷新。');
    } catch { if (live.current && request.current === own) { setReadFailed(true); setLocked(true); setNotice('设置状态未读取，请刷新重试。'); } }
    finally { if (live.current && request.current === own) setLoading(false); }
  }
  useEffect(() => {
    live.current = true; void reload();
    const unsubscribe = window.omniEdu?.onXiaozhiEvent(event => { if (event.kind === 'status') void reload(); });
    const scope=standalone?window.settingsWindow?.onScope(()=>{request.current++;archiveRequest.current++;setSessionId('');setSnapshot(undefined);setArchive(undefined);void reload();}):undefined;
    const changed=standalone?window.settingsWindow?.onChanged(()=>void reload()):undefined;
    const blocked=standalone?window.settingsWindow?.onCloseBlocked(()=>setNotice(CLOSE_GUARD_NOTICE)):undefined;
    return () => { live.current = false; request.current++; archiveRequest.current++; unsubscribe?.();scope?.();changed?.();blocked?.(); };
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
    const saved = field === 'sidebar' ? navigationPreferences.update({ collapsed: !value }) : writeWorkspacePreferences(next);
    if (saved) { setPreferences(next); setPreferenceNotice('已保存，返回小智后生效。'); }
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
  return <EduShell view="settings" navigationOpen={!standalone} disabled={busy} actions={<Button variant="ghost" data-testid={standalone?'settings-window-close':'nav-ai'} isDisabled={busy} onPress={onBack}>{!standalone&&<ArrowLeft size={17}/>}{standalone?'关闭设置':'返回对话'}</Button>}>
    <div className={`${layoutStyles.workspace} ${standalone?windowStyles.workspace:''} edu-domain`} data-edu-domain="" data-testid="pi-settings-workspace" data-tab={tab}>
      {!standalone&&<header className={layoutStyles.heading}><h1>设置</h1><p>日常设置直接可见，技术细节按需查看。</p></header>}
      <div className={standalone?windowStyles.layout:layoutStyles.layout}>
        <nav className={`${layoutStyles.sidebar} ${standalone?windowStyles.sidebar:''}`} aria-label="小智设置分类">
          {query.trim() ? <SettingsSearchResults results={results} disabled={busy} onSelect={result=>open(result.tabId, result.id.startsWith('tab-') ? '' : result.id)}/> : <SettingsNavigation tabs={tabs} active={tab} disabled={busy} onSelect={open} icons={standalone}/>}
          {!standalone&&!query.trim()&&<button type="button" className={layoutStyles.navigationEntry} aria-current={tab==='capabilities'?'page':undefined} disabled={busy} data-testid="pi-settings-tab-capabilities" onClick={()=>open('capabilities')}>能力中心</button>}
          <SearchField fullWidth value={query} onChange={setQuery} aria-label="搜索设置" isDisabled={busy}>
            <SearchField.Group><SearchField.SearchIcon/><SearchField.Input size={1} className={`edu-settings-search-input ${layoutStyles.readablePlaceholder}`} placeholder="搜索设置" data-testid="pi-settings-search" onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }}/><SearchField.ClearButton aria-label="清空设置搜索"/></SearchField.Group>
          </SearchField>
        </nav>
        <main className={`${layoutStyles.main} ${standalone?windowStyles.main:''}`} aria-label={title} data-testid="pi-settings-main">
          {standalone&&<p className={windowStyles.context} data-testid="settings-window-scope">{sessionId?`当前对话：${workspace?.sessions.find(item=>item.id===sessionId)?.title||'正在读取'}`:'未选择对话；全局设置仍可使用。'}</p>}
          {(tab === 'backup' || tab === 'archives') && <nav className={layoutStyles.sectionNavigation} aria-label="备份与归档">
            <Button variant={tab === 'backup' ? 'secondary' : 'ghost'} aria-pressed={tab === 'backup'} isDisabled={busy} data-testid="pi-settings-backup-panel" onPress={() => open('backup')}>本地备份</Button>
            <Button variant={tab === 'archives' ? 'secondary' : 'ghost'} aria-pressed={tab === 'archives'} isDisabled={busy} data-testid="pi-settings-tab-archives" onPress={() => open('archives')}>归档</Button>
          </nav>}
          {notice && <div className="pi-settings-state" role="alert" data-testid="pi-settings-state"><p>{notice}</p><Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void reload()}>刷新</Button></div>}
          {tab === 'models' && <PiModelSettings embedded onBack={onBack} onBusyChange={setChildBusy} onSaved={setRecoveryModel}/>}
          {tab === 'skills' && <PiSkillSettings embedded running={locked} onClose={onBack} onChanged={reload} onBusyChange={setChildBusy}/>}
          {tab === 'capabilities' && <SettingsPage tab={tab}><PiCapabilityCenter sessionId={sessionId||undefined} task={snapshot?.task&&snapshot.task.sessionId===sessionId?{id:snapshot.task.id,requirementsVersion:snapshot.task.requirementsVersion}:undefined} onNavigate={open}/></SettingsPage>}
          {tab === 'tools' && <SettingsPage tab={tab}><PiManagedTools sessionId={sessionId} running={locked||actionBusy} onBusyChange={setChildBusy}/><PiMcpSettings sessionId={sessionId} running={locked || actionBusy} onBusyChange={setChildBusy}/></SettingsPage>}
          {tab === 'permissions' && <SettingsPage tab={tab}><SettingsStack gap="lg"><div><h2 className={layoutStyles.subheading}>{title}</h2><p>授权属于当前对话，明确范围内自动执行，新增范围集中申请。</p></div>
            {loading ? <p role="status">正在读取本地授权…</p> : readFailed ? <p>当前对话的授权状态尚未读取，请刷新重试。</p> : !sessionId || !snapshot ? <p data-testid="pi-settings-no-session">尚未选定可设置的对话，请返回小智选择或新建对话。</p> : <>
              <SettingsSection title="本会话工作目录" description={workspace?.sessions.find(item => item.id === sessionId)?.title}>
                <SettingsRow label={snapshot.workspace ? teacherWorkspaceLabel(snapshot.workspace.label) : '尚未选择工作目录'} hint="实际操作按当前主进程授权范围执行，新范围集中申请。" control={<Button size="sm" variant="secondary" data-testid="pi-settings-workspace-choose" isDisabled={locked || busy || snapshot.projection.turns.length > 0} onPress={() => void chooseWorkspace()}>选择目录</Button>}/>
                {snapshot.projection.turns.length > 0 && <SettingsSection.Note>该对话已绑定目录。需要其他目录时，请新建对话再选择。</SettingsSection.Note>}
              </SettingsSection>
              <PiPermissionSettings key={'permissions-' + sessionId} sessionId={sessionId}/>
              <PiEnvironmentSettings key={'environment-' + sessionId} sessionId={sessionId}/>
              <SettingsSection title="联网与资料保护" surface="plain"><SettingsStack gap="sm"><p>小智可以按任务检索网页和读取网页。每次请求显示真实工具过程与来源。</p><p>原始资料与学生图片保留本机。模型只使用完成任务所需的脱敏文本；技能与界面偏好不会扩大文件权限。</p></SettingsStack></SettingsSection>
              {snapshot.memoryScope && <PiMemoryScope key={sessionId} sessionId={sessionId} scope={snapshot.memoryScope} running={locked || busy} onSave={saveMemory} onRefresh={reload}/>}
              </>}
          </SettingsStack></SettingsPage>}
          {tab === 'teacher-memory' && <SettingsPage tab={tab}><SettingsStack gap="lg">
            <h2 className={layoutStyles.subheading}>{title}</h2>
            <PiTeacherMemorySettings running={locked || actionBusy} onBusyChange={setChildBusy}/>
            <PiL2MemorySettings/>
            <PiHistoryMemorySettings/>
          </SettingsStack></SettingsPage>}
          {tab === 'diagnostics' && <SettingsPage tab={tab}><SettingsStack gap="lg"><div><h2 className={layoutStyles.subheading}>策略与诊断</h2><p>按需核对执行策略与候选记录，不改变会话权限。</p></div>
            {!loading&&<PiResolvedAgentConfig key={sessionId} sessionId={sessionId||undefined} onNavigate={open}/>}
            {loading ? <p role="status">正在读取记录…</p> : readFailed ? <p>对话记录尚未读取，请刷新重试。</p> : !sessionId || !snapshot ? <p>尚未选定可查看的对话，请返回小智选择或新建对话。</p> : <>
              <PiDecisionHistory key={'decisions-'+sessionId} sessionId={sessionId} running={locked||actionBusy} onBusyChange={setChildBusy}/>
              <PiCandidateHistory key={'candidates-'+sessionId} sessionId={sessionId} running={locked||actionBusy} onBusyChange={setChildBusy}/>
              <PiDiagnostics key={'diagnostics-'+sessionId} sessionId={sessionId} turns={snapshot.projection.turns} onBusyChange={setChildBusy}/>
            </>}</SettingsStack></SettingsPage>}
          {tab === 'interface' && <SettingsPage tab={tab}><SettingsStack gap="lg"><div><h2 className={layoutStyles.subheading}>{title}</h2></div>
            <SettingsSection title="对话">
              <SettingsRow label="追加消息的发送时机" hint={`Enter ${followUpLabel(followUp)} · Ctrl+Enter ${followUpLabel(alternateFollowUp(followUp))}`}
                control={<AppSelect label="追加消息的发送时机" hideLabel testId="pi-queue-mode" value={followUp}
                  options={[{id:'followUp',label:'本轮结束后发送'},{id:'steer',label:'补充到本轮'}]}
                  onChange={value=>setFollowUpSaveFailed(!saveComposerFollowUp(value==='steer'?'steer':'followUp'))}/>}/>
              {followUpSaveFailed&&<p role="alert">发送偏好未保存，请重试。</p>}
            </SettingsSection>
            <SettingsSection title="工作区面板">
            {([{ field: 'sidebar', label: '展开左侧导航', hint: '关闭后保留图标导航，收起项目和最近对话。' }, { field: 'aside', label: '任务详情', hint: '显示任务、来源和本会话设置。' }, { field: 'files', label: '本地文件面板', hint: '有对话内容时恢复文件面板；空白对话按需手动打开，替代任务详情面板。' }] as const).map(item => <SettingsRow key={item.field} label={item.label} hint={item.hint} control={<Switch aria-label={item.label} data-testid={`pi-preference-${item.field}`} isSelected={item.field === 'sidebar' ? !navigationPreferences.preferences.collapsed : preferences[item.field]} onChange={value => updatePreference(item.field, value)}><Switch.Content><Switch.Control><Switch.Thumb/></Switch.Control></Switch.Content></Switch>}/>)}
          </SettingsSection>{preferenceNotice && <p role="status" data-testid="pi-preference-notice">{preferenceNotice}</p>}</SettingsStack></SettingsPage>}
          {tab === 'archives' && <SettingsPage tab={tab}><SettingsStack gap="lg"><div><h2 className={layoutStyles.subheading}>{title}</h2><p>查看保存在本机的归档记录。</p></div><div className="pi-settings-actions"><Button size="sm" variant="ghost" onPress={() => { setArchive(undefined); void reload(); }}><RefreshCw size={15}/>刷新归档</Button></div>
            <SettingsSection title="已归档对话"><div data-testid="pi-settings-archives">
              {loading ? <p>正在读取…</p> : readFailed ? <p data-testid="pi-settings-archive-read-failed">归档列表尚未读取，请刷新重试。</p> : !workspace?.archivedSessions.length ? <p data-testid="pi-settings-archive-empty">没有已归档的对话。</p> : workspace.archivedSessions.map(item => <SettingsRow key={item.id} label={item.title} hint={`${item.messageCount} 条消息`} control={<Button size="sm" variant="ghost" data-testid={`pi-archive-read-${item.id}`} onPress={() => void readArchive(item.id, item.title)}>查看记录</Button>}/>)}</div></SettingsSection>
            {!!workspace?.archivedFolders.length && <SettingsSection title="已归档项目">{workspace.archivedFolders.map(item => <SettingsRow key={item.id} label={item.name} control={<span>已归档</span>}/>)}</SettingsSection>}
            {archiveLoading && <p role="status">正在读取归档记录…</p>}{archiveNotice && <p role="alert">{archiveNotice}</p>}
            {archive && <section className="pi-settings-archive-reader" data-testid="pi-settings-archive-reader"><h2 className={layoutStyles.subheading}>{archive.title}</h2><p>只读记录</p><OfficeConversation projection={archive.value.projection}/></section>}
          </SettingsStack></SettingsPage>}
          {tab === 'backup' && <SettingsPage tab={tab}><SettingsStack gap="lg"><div><h2 className={layoutStyles.subheading}>{title}</h2><p>在本机保存和检查资料副本。</p></div><SettingsSection title="本地备份"><DataBackupPanel modern dataRoot={dataRoot} disabled={locked || actionBusy || updateBusy} onBusyChange={setChildBusy}
            recoveryModel={recoveryModel} onOpenRecoverySetting={setting => open(setting)}/></SettingsSection>
            <WindowsUpdatePanel disabled={locked || actionBusy || childBusy} onBusyChange={setUpdateBusy}/>
          </SettingsStack></SettingsPage>}
        </main>
      </div>
  </div></EduShell>;
}
