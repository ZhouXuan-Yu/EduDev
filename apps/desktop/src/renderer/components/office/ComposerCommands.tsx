import { Archive, BookOpen, CircleHelp, Gauge, Layers, Plus, Settings, Sparkles, Target } from 'lucide-react';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';

export const COMPOSER_COMMANDS = [
  { id:'new', command:'/new', label:'新建对话', description:'打开空白对话，当前记录保留', icon:Plus },
  { id:'compact', command:'/compact', label:'压缩上下文', description:'整理较早的内容，保留当前对话', icon:Layers },
  { id:'status', command:'/status', label:'查看对话状态', description:'查看当前模型、上下文与处理状态', icon:Gauge },
  { id:'model', command:'/model', label:'选择模型', description:'选择这段对话使用的模型', icon:Sparkles },
  { id:'goal', command:'/goal', label:'持续目标', description:'设置或查看持续推进的教学目标', icon:Target },
  { id:'permissions', command:'/permissions', label:'工作目录与权限', description:'查看资料范围和操作审批设置', icon:Settings },
  { id:'skills', command:'/skills', label:'教育技能', description:'查看和管理本地教育技能', icon:BookOpen },
  { id:'clear', command:'/clear', label:'开始新对话', description:'新建一段对话，原历史仍可查看', icon:Archive },
  { id:'help', command:'/help', label:'命令帮助', description:'查看本地命令与键盘操作', icon:CircleHelp },
] as const;

type Command = typeof COMPOSER_COMMANDS[number];
export type ComposerCommandId = Command['id'];
export function composerCommandText(value:string){
  const match=value.trimStart().match(/^[／/]([a-zA-Z\p{Script=Han}-]*)(?:[ \t]+([^\n]*))?$/u);
  if(!match)return;
  const name=match[1].toLowerCase();
  return {name,argument:match[2]?.trim()||'',exact:COMPOSER_COMMANDS.find(item=>item.id===name)};
}

export function matchComposerCommands(name:string){
  return COMPOSER_COMMANDS.filter(item=>item.id.startsWith(name)||item.label.includes(name));
}

export function ComposerCommandList({id,items,selected,enabled,choose}:{
  id:string;items:readonly Command[];selected:number;enabled:(id:ComposerCommandId)=>boolean;choose:(id:ComposerCommandId)=>void;
}){
  const options=useRef<HTMLDivElement>(null);
  const [height,setHeight]=useState<number>();
  useLayoutEffect(()=>{
    const anchor=options.current?.parentElement?.parentElement;
    if(!anchor)return;
    const fit=()=>{
      const ceiling=anchor.closest('.ai-chat-surface')?.getBoundingClientRect().top??0;
      setHeight(Math.max(64,Math.min(300,anchor.getBoundingClientRect().top-Math.max(ceiling,70)-52)));
    };
    fit();
    window.addEventListener('resize',fit);
    return ()=>window.removeEventListener('resize',fit);
  },[]);
  useEffect(()=>{
    const list=options.current;
    const row=list?.querySelector('[aria-selected="true"]');
    if(!list||!row)return;
    const bounds=list.getBoundingClientRect(),item=row.getBoundingClientRect();
    if(item.top<bounds.top)list.scrollTop+=item.top-bounds.top;
    else if(item.bottom>bounds.bottom)list.scrollTop+=item.bottom-bounds.bottom;
  },[selected,height]);
  return <div className="edu-slash-suggestions" data-testid="pi-slash-commands">
    <div className="edu-slash-keys"><span>对话命令</span><small>↑ ↓ 选择 · Enter 执行 · Esc 关闭</small></div>
    <div id={id} ref={options} role="listbox" aria-label="对话命令" className="edu-slash-options" style={{maxHeight:height}}>
      {items.map(({id:key,command,label,description,icon:Icon},index)=>
        <button type="button" role="option" aria-selected={selected===index} disabled={!enabled(key)}
          data-testid={`pi-slash-${key}`} tabIndex={-1} id={`${id}-${key}`} key={key}
          onPointerDown={event=>event.preventDefault()} onClick={()=>choose(key)}>
          <Icon size={16} aria-hidden="true"/><span><strong>{label} <code>{command}</code></strong><small>{description}</small></span>
        </button>)}
    </div>
    {!items.length&&<p role="status">未找到该命令。输入 / 查看可用命令，按 Esc 保留输入。</p>}
  </div>;
}
