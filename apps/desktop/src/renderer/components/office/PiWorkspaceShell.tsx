import {useEffect,useState,type ReactNode} from 'react';
import {Button,Tooltip,Dropdown,Label} from '@heroui/react';
import {History,PanelRight,Files,SquarePen} from 'lucide-react';
import {useDesktopCommands} from '../desktop/DesktopFrame';
import {EduShell} from '../../ui-system/EduShell';
import {EduPanel} from '../../ui-system/EduPanel';
import {readWorkspacePreferences,writeWorkspacePreferences} from './workspace-preferences';
export function PiWorkspaceShell({title,sidebar,aside,files,children,onSkills,onSettings,visible=true,fileRequest,onNewChat,sessionKey}:{
 title:string;sidebar:ReactNode;aside:ReactNode;children:ReactNode;onLeave:()=>void;onSkills:()=>void;onSettings:()=>void;
 files?:(close:()=>void)=>ReactNode;visible?:boolean;fileRequest?:string;onNewChat?:()=>void;sessionKey?:string;
}){
 const [preferences,setPreferences]=useState(readWorkspacePreferences);
 const [historyOpen,setHistoryOpen]=useState(false);
 useEffect(()=>{if(visible)setPreferences(readWorkspacePreferences());},[visible]);
 useEffect(()=>{setHistoryOpen(false);},[sessionKey]);
 function update(field:'sidebar'|'aside'|'files',value:boolean){setPreferences(previous=>{const next={...previous,[field]:value};writeWorkspacePreferences(next);return next;});}
 useEffect(()=>{if(fileRequest&&visible)update('files',true);},[fileRequest,visible]);
 useDesktopCommands(command=>{if(!visible)return false;if(command==='sidebar'){setHistoryOpen(value=>!value);return true;}if(command==='files'&&files){update('files',!preferences.files);return true;}return false;},20);
 const actions=<>
  <Tooltip><Button variant="ghost" isIconOnly aria-label="对话记录" data-testid="pi-sidebar-toggle" aria-expanded={historyOpen} onPress={()=>setHistoryOpen(!historyOpen)}><History size={18}/></Button><Tooltip.Content>对话记录</Tooltip.Content></Tooltip>
  {onNewChat&&<Tooltip><Button variant="ghost" isIconOnly aria-label="新建对话" data-testid="pi-new-session" onPress={onNewChat}><SquarePen size={18}/></Button><Tooltip.Content>新对话</Tooltip.Content></Tooltip>}
  {files&&<Tooltip><Button variant="ghost" isIconOnly aria-label="本地文件" data-testid="pi-files-toggle" aria-pressed={preferences.files} onPress={()=>update('files',!preferences.files)}><Files size={18}/></Button><Tooltip.Content>本地文件</Tooltip.Content></Tooltip>}
  <Tooltip><Button variant="ghost" isIconOnly aria-label="任务与来源" data-testid="pi-aside-toggle" aria-pressed={preferences.aside} onPress={()=>update('aside',!preferences.aside)}><PanelRight size={18}/></Button><Tooltip.Content>任务与来源</Tooltip.Content></Tooltip>
  <Dropdown><Button variant="ghost" data-testid="pi-workspace-more" aria-label="更多工作区选项">更多</Button><Dropdown.Popover data-heroui-native="" data-theme="light"><Dropdown.Menu aria-label="更多工作区选项" onAction={key=>key==='skills'?onSkills():onSettings()}><Dropdown.Item id="skills" textValue="管理教育技能"><Label>管理教育技能</Label></Dropdown.Item><Dropdown.Item id="settings" textValue="设置"><Label>设置</Label></Dropdown.Item></Dropdown.Menu></Dropdown.Popover></Dropdown>
 </>;
 return <EduShell view="ai" title={title} actions={actions} navigationOpen={preferences.sidebar} testId="xiaozhi-pi-workspace" headerTestId="pi-workspace-header">
  <div className="edu-chat"><div className="edu-chat-main">{children}</div>
   {preferences.files&&files?<EduPanel title="本地文件" onClose={()=>update('files',false)}>{files(()=>update('files',false))}</EduPanel>:preferences.aside?<EduPanel title="任务与来源" onClose={()=>update('aside',false)}><div className="edu-domain" data-edu-domain="">{aside}</div></EduPanel>:null}
  </div>
  {historyOpen&&<EduPanel title="对话记录" history onClose={()=>setHistoryOpen(false)}><div className="edu-history-content">{sidebar}</div></EduPanel>}
 </EduShell>;
}
