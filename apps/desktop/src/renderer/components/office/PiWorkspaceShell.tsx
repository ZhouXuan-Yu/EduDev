import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, Tooltip, Dropdown, Label } from '@heroui/react';
import { History, PanelRight, Files, SquarePen, Ellipsis } from 'lucide-react';
import { useDesktopCommands } from '../desktop/DesktopFrame';
import { EduShell } from '../../ui-system/EduShell';
import { EduPanel } from '../../ui-system/EduPanel';
import { readWorkspacePreferences, writeWorkspacePreferences } from './workspace-preferences';
import { ColumnResizeHandle, readColumnWidth, writeColumnWidth } from '../../ui-system/ColumnResizeHandle';
import { WorkbenchContextPanel, type WorkbenchPanelMode } from './WorkbenchContextPanel';

export function PiWorkspaceShell({ title, sidebar, aside, files, children, onSkills, onSettings, visible = true, fileRequest, onNewChat, sessionKey }: {
  title: string; sidebar: ReactNode; aside: ReactNode; children: ReactNode;
  onLeave: () => void; onSkills: () => void; onSettings: () => void;
  files?: (close: () => void) => ReactNode; visible?: boolean; fileRequest?: string; onNewChat?: () => void; sessionKey?: string;
}) {
  const [preferences, setPreferences] = useState(readWorkspacePreferences);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyWasOpen = useRef(false);
  const [panelWidth, setPanelWidth] = useState(() => readColumnWidth('xiaozhi.ui.panelWidth.v1', 340, 300, 680));
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 1050px)').matches);
  const [requestedInNarrow, setRequestedInNarrow] = useState(false);
  const open = (preferences.files || preferences.aside) && (!narrow || requestedInNarrow);
  const mode: WorkbenchPanelMode = preferences.files ? 'files' : 'tasks';
  function panel(next: WorkbenchPanelMode | 'closed') {
    if (next === 'closed') document.querySelector<HTMLElement>(`[data-testid="${mode === 'files' ? 'pi-files-toggle' : 'pi-aside-toggle'}"]`)?.focus();
    setRequestedInNarrow(next !== 'closed');
    setPreferences(previous => {
      const value = { ...previous, files: next === 'files', aside: next === 'tasks' };
      writeWorkspacePreferences(value);
      return value;
    });
  }
  useEffect(() => {
    const query = matchMedia('(max-width: 1050px)');
    const resize = () => { setNarrow(query.matches); setRequestedInNarrow(false); };
    query.addEventListener('change', resize);
    return () => query.removeEventListener('change', resize);
  }, []);
  useEffect(() => { writeColumnWidth('xiaozhi.ui.panelWidth.v1', panelWidth); }, [panelWidth]);
  useEffect(() => { if (visible) setPreferences(readWorkspacePreferences()); }, [visible]);
  useEffect(() => { setHistoryOpen(false); }, [sessionKey]);
  useEffect(() => { if (fileRequest && visible) panel('files'); }, [fileRequest, visible]);
  useEffect(() => {
    if (historyWasOpen.current && !historyOpen) document.querySelector<HTMLElement>('[data-testid="pi-sidebar-toggle"]')?.focus();
    historyWasOpen.current = historyOpen;
  }, [historyOpen]);
  useDesktopCommands(command => {
    if (!visible) return false;
    if (command === 'files' && files) { panel(open && mode === 'files' ? 'closed' : 'files'); return true; }
    return false;
  }, 20);
  const actions = <>
    <Tooltip><Button variant="ghost" isIconOnly aria-label="管理对话记录" data-testid="pi-sidebar-toggle" aria-expanded={historyOpen} onPress={() => setHistoryOpen(!historyOpen)}><History size={18} /></Button><Tooltip.Content>管理对话记录</Tooltip.Content></Tooltip>
    {onNewChat && <Tooltip><Button variant="ghost" isIconOnly aria-label="新建对话" data-testid="pi-new-session" onPress={onNewChat}><SquarePen size={18} /></Button><Tooltip.Content>新建对话</Tooltip.Content></Tooltip>}
    {files && <Tooltip><Button variant="ghost" isIconOnly aria-label="本地文件" data-testid="pi-files-toggle" aria-pressed={open && mode === 'files'} onPress={() => panel(open && mode === 'files' ? 'closed' : 'files')}><Files size={18} /></Button><Tooltip.Content>本地文件</Tooltip.Content></Tooltip>}
    <Tooltip><Button variant="ghost" isIconOnly aria-label="任务与来源" data-testid="pi-aside-toggle" aria-pressed={open && mode === 'tasks'} onPress={() => panel(open && mode === 'tasks' ? 'closed' : 'tasks')}><PanelRight size={18} /></Button><Tooltip.Content>任务与来源</Tooltip.Content></Tooltip>
    <Dropdown><Button variant="ghost" isIconOnly data-testid="pi-workspace-more" aria-label="更多工作区选项"><Ellipsis size={18} /></Button><Dropdown.Popover data-heroui-native="" data-theme="light"><Dropdown.Menu aria-label="更多工作区选项" onAction={key => key === 'skills' ? onSkills() : onSettings()}><Dropdown.Item id="skills" textValue="管理教育技能"><Label>管理教育技能</Label></Dropdown.Item><Dropdown.Item id="settings" textValue="设置"><Label>设置</Label></Dropdown.Item></Dropdown.Menu></Dropdown.Popover></Dropdown>
  </>;
  return <EduShell view="ai" title={title} actions={actions} navigationResizable testId="xiaozhi-pi-workspace" headerTestId="pi-workspace-header">
    <div className="edu-chat" data-context-open={open} style={{ '--edu-panel-width': `${panelWidth}px` } as CSSProperties}>
      <div className="edu-chat-main">{children}</div>
      {open && <ColumnResizeHandle side="right" width={panelWidth} min={300} max={680} label="调整右侧任务栏宽度" onResize={setPanelWidth} onReset={() => setPanelWidth(340)} />}
      {open && <WorkbenchContextPanel mode={mode} onModeChange={panel} onClose={() => panel('closed')} tasks={aside} files={files?.(() => panel('closed'))} />}
    </div>
    {historyOpen && <EduPanel title="对话记录" history onClose={() => setHistoryOpen(false)}><div className="edu-history-content">{sidebar}</div></EduPanel>}
  </EduShell>;
}
