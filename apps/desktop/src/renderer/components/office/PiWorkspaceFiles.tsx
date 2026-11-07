import styles from '../../ui-system/delivery-layout.module.css';
import { DisclosureCard } from '../ui/DisclosureCard';
import {PiDeliveryCheck} from './PiDeliveryCheck';
import {ScienceClassroomExport} from './ScienceClassroomExport';
import { useEffect, useRef, useState } from 'react';
import {ScienceDemoFrame} from './ScienceDemoFrame';
import { Button, Tabs } from '@heroui/react';
import { FileText, Folder, RefreshCw, X, PanelRight } from 'lucide-react';
import { FileTree } from '../../heroui-pro/components/file-tree';
import { Markdown } from '../../heroui-pro/components/markdown';
import { XIAOZHI_FILES_SCHEMA, XIAOZHI_FILE_ERRORS, type XiaozhiFileEntry, type XiaozhiFilePreview } from '../../../shared/xiaozhi-files';
import type { XiaozhiChangeSummary } from '../../../shared/xiaozhi-changes';
import type {OfficeArtifactSummary} from '../../../shared/xiaozhi-office-artifacts';
import {teacherWorkspaceLabel} from './workspace-label';
import './pi-workspace-files.css';
import {ConversationSavedFiles,ConversationSavedPreview,useConversationSavedFiles} from './ConversationSavedFiles';

function markdownOutline(text:string){
  const result:{level:number;title:string}[]=[];let fenced=false;
  for(const line of text.split(/\r?\n/)){
    if(/^\s*(```|~~~)/.test(line)){fenced=!fenced;continue;}
    if(fenced)continue;
    const match=/^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if(!match)continue;
    const title=match[2].replace(/[*_~`[\]]/g,'').trim();
    if(title)result.push({level:match[1].length,title});
    if(result.length>=32)break;
  }
  return result;
}

/** Local-only data from typed main. No paths/bytes are sent to the model or persisted. */
export function PiWorkspaceFiles({sessionId,onChoose,onClose,reveal,changes=[],officeArtifacts=[]}:{sessionId:string;onChoose?:()=>void;onClose:()=>void;reveal?:{id:string;path:string;version?:string;workspaceVersion?:string};changes?:XiaozhiChangeSummary[];officeArtifacts?:OfficeArtifactSummary[]}) {
  const [directories,setDirectories]=useState<Record<string,XiaozhiFileEntry[]>>({});
  const [expanded,setExpanded]=useState(new Set<string>()),[label,setLabel]=useState('教学工作目录'),[query,setQuery]=useState('');
  const [tabs,setTabs]=useState<XiaozhiFileEntry[]>([]),[selected,setSelected]=useState(''),[preview,setPreview]=useState<XiaozhiFilePreview>();
  const [explorerOpen,setExplorerOpen]=useState(true),[outlineNotice,setOutlineNotice]=useState('');
  const saved=useConversationSavedFiles(sessionId,[...changes,...officeArtifacts].map(row=>`${row.id}:${row.revision}:${row.state}`).join('|'));
  const [savedId,setSavedId]=useState('');const savedSelection=saved.rows.find(row=>row.id===savedId);
  const [error,setError]=useState(''),[previewError,setPreviewError]=useState(''),[partial,setPartial]=useState(false),[loading,setLoading]=useState(false),[reading,setReading]=useState(false);
  const authority=useRef(''),epoch=useRef(0),previewEpoch=useRef(0),requests=useRef(new Set<string>()),loadedCount=useRef(0);
  const toolbar=useRef<HTMLDivElement>(null),panel=useRef<HTMLElement>(null),previewRoot=useRef<HTMLDivElement>(null);
  // Keep the current original HeroUI tab visible when the split pane resizes.
  // Scroll only its horizontal scroller; never move the chat or steal focus.
  useEffect(()=>{
    const root=toolbar.current,scroller=root?.querySelector<HTMLElement>('[data-slot="scroll-shadow"]');
    if(!root||!scroller)return;
    let frame=0;
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const tab=root.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');if(!tab)return;
      const current=tab.getBoundingClientRect(),viewport=scroller.getBoundingClientRect();
      const offset=current.left<viewport.left?current.left-viewport.left:current.right>viewport.right?current.right-viewport.right:0;
      if(offset)scroller.scrollLeft+=offset;
    });};
    const observer=new ResizeObserver(schedule);observer.observe(scroller);schedule();
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[selected,tabs]);
  const fileFacts=[...changes.filter(item=>item.path===selected),...officeArtifacts.filter(item=>item.path===selected)].map(item=>`${item.id}:${item.revision}`).join('|');
  const previousFacts=useRef({selected,facts:fileFacts});
  const request=()=>{const id=`xifile_${crypto.randomUUID()}`;requests.current.add(id);return id;};
  function cancelAll(){for(const requestId of requests.current)void window.omniEdu?.cancelXiaozhiFile({sessionId,requestId});requests.current.clear();}
  async function list(relative='.') {
    const stamp=epoch.current,requestId=request();setLoading(true);setError('');
    try{
      const version=reveal?.workspaceVersion||authority.current;
      const result=await window.omniEdu?.listXiaozhiFiles({schemaVersion:XIAOZHI_FILES_SCHEMA,sessionId,requestId,path:relative,...(version?{workspaceVersion:version}:{})});
      if(stamp!==epoch.current)return;
      if(!result?.ok){setError(result?XIAOZHI_FILE_ERRORS[result.error]:'无法读取本地目录，请重试。');return;}
      if(loadedCount.current+result.data.entries.length>1024){setError('已加载较多文件，请刷新后选择更具体的目录。');return;}
      authority.current=result.workspaceVersion;loadedCount.current+=result.data.entries.length;setLabel(teacherWorkspaceLabel(result.data.label));setPartial(value=>value||result.data.partial);
      setDirectories(previous=>({...previous,[relative]:result.data.entries}));if(relative!=='.')setExpanded(previous=>new Set([...previous,relative]));
      return result.data.entries;
    }catch{if(stamp===epoch.current)setError('无法读取本地目录，请重试。');}
    finally{requests.current.delete(requestId);if(stamp===epoch.current)setLoading(false);}
  }
  async function openFile(entry:XiaozhiFileEntry) {
    setSavedId('');
    const stamp=++previewEpoch.current,life=epoch.current;cancelAll();setLoading(false);setPreview(undefined);setPreviewError('');setReading(true);setSelected(entry.path);
    setOutlineNotice('');
    if((panel.current?.clientWidth??Number.POSITIVE_INFINITY)<=760)setExplorerOpen(false);
    setTabs(previous=>previous.some(tab=>tab.path===entry.path)?previous.map(tab=>tab.path===entry.path?entry:tab):[...previous.slice(-7),entry]);
    const requestId=request();
    try{
      const result=await window.omniEdu?.previewXiaozhiFile({schemaVersion:XIAOZHI_FILES_SCHEMA,sessionId,requestId,path:entry.path,workspaceVersion:authority.current,version:entry.path===reveal?.path&&reveal.version?reveal.version:entry.version});
      if(stamp!==previewEpoch.current||life!==epoch.current)return;
      if(!result?.ok)setPreviewError(result?XIAOZHI_FILE_ERRORS[result.error]:'无法预览文件，请重试。');else setPreview(result.data);
    }catch{if(stamp===previewEpoch.current&&life===epoch.current)setPreviewError('无法预览文件，请重试。');}
    finally{requests.current.delete(requestId);if(stamp===previewEpoch.current&&life===epoch.current)setReading(false);}
  }
  function closeTab(target:string){cancelAll();++previewEpoch.current;setReading(false);setPreview(undefined);setPreviewError('');const next=tabs.filter(tab=>tab.path!==target);setTabs(next);if(selected===target){setSelected('');if(next.length)void openFile(next.at(-1)!);}}
  function refresh(){cancelAll();++epoch.current;++previewEpoch.current;loadedCount.current=0;authority.current='';setDirectories({});setExpanded(new Set());setPartial(false);setPreview(undefined);setPreviewError('');setReading(false);setSavedId('');saved.refresh();void list();}
  function selectSaved(id:string){if(!saved.rows.some(row=>row.id===id))return;cancelAll();++previewEpoch.current;setReading(false);setPreviewError('');setSelected('');setSavedId(id);if((panel.current?.clientWidth??Infinity)<=760)setExplorerOpen(false);}
  function closeSaved(){const id=savedId,life=epoch.current;setSavedId('');setExplorerOpen(true);requestAnimationFrame(()=>{if(life===epoch.current)[...panel.current?.querySelectorAll<HTMLElement>('[data-testid="conversation-saved-file"]')??[]].find(el=>el.dataset.artifactId===id)?.focus({preventScroll:true});});}
  async function openSavedPath(relative:string){const stamp=++previewEpoch.current,life=epoch.current,parent=relative.includes('/')?relative.slice(0,relative.lastIndexOf('/')):'.';setPreviewError('');const entries=await list(parent);if(stamp!==previewEpoch.current||life!==epoch.current)return;const entry=entries?.find(row=>row.path===relative&&row.kind==='file');if(entry)await openFile(entry);else setPreviewError('当前工作目录没有该文件；请在教学文件页核对原保存位置。');}
  function jumpToHeading(index:number,title:string){
    const root=previewRoot.current;const headings=[...root?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')??[]];
    const target=headings[index];if(!target)return;
    target.scrollIntoView({block:'start'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});setOutlineNotice(`已定位到：${title}`);
  }
  useEffect(()=>{if(!reveal)void list();return()=>{++epoch.current;++previewEpoch.current;cancelAll();};},[sessionId]);
  useEffect(()=>{
    const before=previousFacts.current;previousFacts.current={selected,facts:fileFacts};
    if(!selected||before.selected!==selected||before.facts===fileFacts)return;
    cancelAll();++previewEpoch.current;setPreview(undefined);setReading(false);setPreviewError('这个文件的修改状态已更新，请刷新目录后查看当前版本。');
  },[selected,fileFacts]);
  useEffect(()=>{
    if(!reveal)return;
    cancelAll();++epoch.current;++previewEpoch.current;loadedCount.current=0;authority.current='';setDirectories({});setExpanded(new Set());setPartial(false);setPreview(undefined);setReading(false);
    const life=epoch.current;let live=true;
    void (async()=>{
      if(reveal.workspaceVersion)authority.current=reveal.workspaceVersion;
      const parts=reveal.path.split('/');
      if(parts.length>1)await list('.');
      for(let i=1;i<parts.length-1;i++){if(!live||life!==epoch.current)return;await list(parts.slice(0,i).join('/'));}
      if(!live||life!==epoch.current)return;
      const parent=parts.length>1?parts.slice(0,-1).join('/') : '.';
      const entries=await list(parent);if(!live||life!==epoch.current)return;
      const entry=entries?.find(item=>item.path===reveal.path&&item.kind==='file');
      if(entry)await openFile(entry);else setError('当前目录没有该文件，请刷新后检查。');
    })().catch(()=>{if(live&&life===epoch.current)setError('无法打开文件，请刷新后重试。');});
    return()=>{live=false;};
  },[sessionId,reveal?.id]);
  const outline=preview?.format==='markdown'?markdownOutline(preview.text||''):[];
  const matches=(entry:XiaozhiFileEntry):boolean=>!query||entry.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())||(directories[entry.path]||[]).some(matches);
  function tree(relative:string):React.ReactNode {return (directories[relative]||[]).filter(matches).map(entry=><FileTree.Item key={entry.path} id={entry.path} textValue={entry.name} title={entry.name} data-testid={`pi-file-entry-${entry.path}`}
    icon={entry.kind==='directory'?<Folder size={16}/>:<FileText size={16}/>}>
    {entry.kind==='directory'&&directories[entry.path]?.length?tree(entry.path):undefined}
  </FileTree.Item>);}
  return <section ref={panel} className="pi-file-panel" data-edu-domain="" data-has-preview={Boolean(selected||savedSelection)} aria-label="本地文件工作面板" data-testid="pi-file-panel">
    <div className="pi-file-toolbar" ref={toolbar}>
        {!!tabs.length?<Tabs selectedKey={selected||undefined} onSelectionChange={key=>{const entry=tabs.find(tab=>tab.path===key);if(entry&&entry.path!==selected)void openFile(entry);}} data-testid="pi-file-tabs">
          <Tabs.ListContainer><Tabs.List aria-label="已打开的教学文件">{tabs.map(tab=><Tabs.Tab key={tab.path} id={tab.path}><FileText size={14}/><span>{tab.name}</span><Tabs.Indicator/></Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
        </Tabs>:<span className="pi-file-toolbar-empty"><FileText size={16}/>本地文件</span>}
      {onChoose&&<Button variant="ghost" isIconOnly size="sm" aria-label="选择教学工作目录" onPress={onChoose} data-testid="pi-files-choose"><Folder size={16}/></Button>}
      <Button variant="ghost" isIconOnly size="sm" aria-label="刷新文件目录" onPress={refresh} data-testid="pi-files-refresh"><RefreshCw size={16}/></Button>
      <Button className="pi-file-explorer-toggle" variant="ghost" size="sm"
        aria-label={explorerOpen?'收起文件列表，扩大正文':'显示文件列表'} aria-pressed={explorerOpen}
        onPress={()=>setExplorerOpen(value=>!value)} data-testid="pi-files-explorer-toggle"><PanelRight size={16}/><span>{explorerOpen?'收起列表':'文件列表'}</span></Button>
      <Button variant="ghost" isIconOnly size="sm" aria-label="关闭文件面板" onPress={onClose} data-testid="pi-files-close"><X size={16}/></Button>
    </div>
    <div className="pi-file-body">
      <div className="pi-file-reading">
        {selected&&<div className="pi-file-breadcrumb"><span title={selected}>{selected}</span><Button variant="ghost" size="sm" isIconOnly aria-label="关闭当前文件" onPress={()=>closeTab(selected)} data-testid="pi-file-tab-close"><X size={14}/></Button></div>}
        {preview?.format==='markdown'&&outline.length>1&&<DisclosureCard className="pi-file-outline" data-testid="pi-file-outline" key={preview.path+preview.version} title={<>文章目录 · {outline.length} 节</>}>

          <div className={`pi-file-outline-list ${styles.outline}`}>{outline.map((item,index)=><Button key={`${item.level}:${index}:${item.title}`} size="sm" variant="ghost"
            className="pi-file-outline-item" data-level={item.level} onPress={()=>jumpToHeading(index,item.title)} data-testid={`pi-file-outline-item-${index}`}>{item.title}</Button>)}</div>
          {outlineNotice&&<p className="pi-file-outline-status" role="status" data-testid="pi-file-outline-status">{outlineNotice}</p>}
        </DisclosureCard>}
        {preview&&<PiDeliveryCheck key={sessionId+preview.path} sessionId={sessionId} path={preview.path} version={preview.version} workspaceVersion={authority.current}/>}
        <div ref={previewRoot} className="pi-file-preview" data-testid="pi-file-preview" aria-busy={reading}>
          {savedSelection?<>{previewError&&<p role="alert">{previewError}</p>}<ConversationSavedPreview artifact={savedSelection} onClose={closeSaved} onOpenPath={path=>void openSavedPath(path)}/></>:reading?<p role="status">正在读取文件…</p>:previewError?<div role="alert"><p>{previewError}</p><p>{reveal?.version?'此处核对引用时的版本；刷新仍保留版本检查。请回来源对话重新读取当前资料。':'刷新目录后，选择最新文件继续预览。'}</p><Button variant="ghost" size="sm" onPress={refresh} data-testid="pi-file-preview-refresh">刷新目录</Button></div>:preview?.format==='image'?<img src={preview.image} alt={preview.name} data-testid="pi-file-image"/>:
            preview?.format==='html'?<ScienceDemoFrame html={preview.html||''}/>:preview?.format==='science_demo'?<><ScienceClassroomExport key={preview.path+preview.version} sessionId={sessionId} workspaceVersion={authority.current} preview={preview}/><ScienceDemoFrame html={preview.html||''}/></>:preview?.format==='office'?<div data-testid="pi-file-document"><p role="status" data-testid="pi-file-document-info">{preview.document?.format.toUpperCase()} · 本地提取正文，版式以原文件为准</p><Markdown components={{img:({alt})=><span>［图片：{alt||'文档图片'}，未加载］</span>,a:({children})=><span>{children}</span>}}>{preview.text||''}</Markdown></div>:
            preview?.format==='markdown'?<Markdown components={{img:({alt})=><span>［图片：{alt||'引用图片'}，未加载］</span>,a:({children})=><span>{children}</span>}}>{preview.text||''}</Markdown>:
            preview?.format==='text'?<pre data-testid="pi-file-text">{preview.text}</pre>:preview?<div><h3>{preview.name}</h3><p>{preview.size} 字节</p><p>暂不支持此格式的内容预览。</p></div>:<p className="pi-file-empty">从右侧选择教学文件进行本地预览。</p>}
        </div>
      </div>
      <aside className="pi-file-explorer" hidden={!explorerOpen}>
        <ConversationSavedFiles rows={saved.rows} loading={saved.loading} error={saved.error} onRetry={saved.refresh} onSelect={selectSaved}/>
        <strong title={label}>工作目录 · {label}</strong><input aria-label="筛选已加载文件" placeholder="筛选已加载文件…" value={query} onChange={event=>setQuery(event.target.value)} data-testid="pi-file-filter"/>
        {error&&<div role="alert" data-testid="pi-file-error"><p>{error}</p><Button size="sm" variant="ghost" onPress={refresh}>重试</Button></div>}
        {loading&&<p role="status">正在读取目录…</p>}
        {directories['.']?.length?<FileTree aria-label="教学工作目录文件" reduceMotion expandedKeys={expanded} onExpandedChange={keys=>setExpanded(new Set([...keys].map(String)))}
          onAction={key=>{const entry=Object.values(directories).flat().find(item=>item.path===key);if(!entry)return;if(entry.kind==='directory'){if(!directories[entry.path])void list(entry.path);else setExpanded(previous=>{const next=new Set(previous);next.has(entry.path)?next.delete(entry.path):next.add(entry.path);return next;});}else void openFile(entry);}}>{tree('.')}</FileTree>:
          !loading&&!error&&<p>此目录没有可显示的文件。</p>}
        {partial&&<p role="status">目录较大，只显示本次读取范围内的文件。</p>}
      </aside>
    </div>
  </section>;
}
