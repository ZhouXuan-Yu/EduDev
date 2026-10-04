import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { BookOpen, Home, MessageSquare, Settings, Folder, PanelRight } from 'lucide-react';
import { AppLayout } from '../../heroui-pro/components/app-layout';
import { Sidebar } from '../../heroui-pro/components/sidebar';
import { useDesktopCommands } from '../desktop/DesktopFrame';
import { readWorkspacePreferences, writeWorkspacePreferences } from './workspace-preferences';

/** Existing Pro scaffold owns disclosures; preferences contain no task/file authority. */
export function PiWorkspaceShell({title,sidebar,aside,files,children,onLeave,onSkills,onSettings,visible=true,fileRequest}: {
  title:string;sidebar:ReactNode;aside:ReactNode;children:ReactNode;
  onLeave:()=>void;onSkills:()=>void;onSettings:()=>void;
  files?:(close:()=>void)=>ReactNode;
  visible?:boolean;
  fileRequest?:string;
}) {
  const [preferences,setPreferences]=useState(readWorkspacePreferences);
  useEffect(()=>{if(visible)setPreferences(readWorkspacePreferences());},[visible]);
  function update(field:'sidebar'|'aside'|'files',value:boolean){setPreferences(previous=>{
    const next={...previous,[field]:value};writeWorkspacePreferences(next);return next;
  });}
  useEffect(()=>{if(fileRequest&&visible)update('files',true);},[fileRequest,visible]);
  useDesktopCommands(command=>{
    if(!visible)return false;
    if(command==='sidebar'){update('sidebar',!preferences.sidebar);return true;}
    if(command==='files'&&files){update('files',!preferences.files);return true;}
    return false;
  },20);
  return <div className="ai-console-v2 ai-console-v3 xiaozhi-pi-workspace" data-testid="xiaozhi-pi-workspace">
    <nav className="pi-icon-rail" aria-label="小智工作区导航" data-testid="pi-icon-rail">
      <Button variant="ghost" isIconOnly aria-label="返回教师工作台" onPress={onLeave} data-testid="pi-rail-home"><Home size={22}/></Button>
      <Button variant="ghost" isIconOnly aria-label="显示或隐藏会话侧栏" aria-pressed={preferences.sidebar} onPress={()=>update('sidebar',!preferences.sidebar)} data-testid="pi-rail-chats"><MessageSquare size={21}/></Button>
      <Button variant="ghost" isIconOnly aria-label="教育技能" onPress={onSkills}><BookOpen size={21}/></Button>
      <div className="pi-rail-spacer"/>
      <Button variant="ghost" isIconOnly aria-label="小智模型设置" onPress={onSettings}><Settings size={21}/></Button>
    </nav>
    <AppLayout className={`pi-shell${preferences.files?' pi-shell-files':''}`} sidebarCollapsible="offcanvas" scrollMode="content" reduceMotion
      sidebar={sidebar} aside={preferences.files&&files?files(()=>update('files',false)):aside} asideMobile="hidden" sidebarOpen={preferences.sidebar} asideOpen={preferences.files||preferences.aside}
      asideResizable={preferences.files} asideResizeBehavior="preserve-pixel-size" asideDefaultSize={50} asideMinSize="360px" asideMaxSize={65} resizableAutoSaveId={preferences.files?'xiaozhi.files.layout.v1':undefined}
      onSidebarOpenChange={value=>update('sidebar',value)} onAsideOpenChange={value=>update(preferences.files?'files':'aside',value)}
      navbar={<div className="ai-chat-header" data-testid="pi-workspace-header">
        <Sidebar.Trigger aria-label="显示或隐藏会话侧栏" data-testid="pi-sidebar-toggle"/>
        <div className="ai-chat-header-title"><Folder size={17}/><strong title={title}>{title}</strong></div>
        <div className="pi-header-spacer"/>
        <Button variant="ghost" size="sm" data-testid="pi-skills-open" onPress={onSkills}>技能</Button>
        {files&&<Button variant="ghost" isIconOnly size="sm" aria-label="显示或隐藏文件面板" aria-pressed={preferences.files} data-testid="pi-files-toggle" onPress={()=>update('files',!preferences.files)}><PanelRight size={18}/></Button>}
        <AppLayout.AsideTrigger aria-label="显示或隐藏任务资料" data-testid="pi-aside-toggle"/>
      </div>}>{children}</AppLayout>
  </div>;
}
