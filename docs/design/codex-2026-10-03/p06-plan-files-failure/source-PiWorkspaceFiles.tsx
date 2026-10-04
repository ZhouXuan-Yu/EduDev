import { useEffect, useRef, useState } from 'react';
import { Button, Tabs } from '@heroui/react';
import { FileText, Folder, RefreshCw, X, PanelRight } from 'lucide-react';
import { FileTree } from '../../heroui-pro/components/file-tree';
import { Markdown } from '../../heroui-pro/components/markdown';
import { XIAOZHI_FILES_SCHEMA, XIAOZHI_FILE_ERRORS, type XiaozhiFileEntry, type XiaozhiFilePreview } from '../../../shared/xiaozhi-files';
import './pi-workspace-files.css';

/** Local-only data from typed main. No paths/bytes are sent to the model or persisted. */
export function PiWorkspaceFiles({sessionId,onChoose,onClose}:{sessionId:string;onChoose:()=>void;onClose:()=>void}) {
  const [directories,setDirectories]=useState<Record<string,XiaozhiFileEntry[]>>({});
  const [expanded,setExpanded]=useState(new Set<string>()),[label,setLabel]=useState('教学工作目录'),[query,setQuery]=useState('');
  const [tabs,setTabs]=useState<XiaozhiFileEntry[]>([]),[selected,setSelected]=useState(''),[preview,setPreview]=useState<XiaozhiFilePreview>();
  const [explorerOpen,setExplorerOpen]=useState(true);
  const [error,setError]=useState(''),[previewError,setPreviewError]=useState(''),[partial,setPartial]=useState(false),[loading,setLoading]=useState(false),[reading,setReading]=useState(false);
  const authority=useRef(''),epoch=useRef(0),previewEpoch=useRef(0),requests=useRef(new Set<string>()),loadedCount=useRef(0);
  const request=()=>{const id=`xifile_${crypto.randomUUID()}`;requests.current.add(id);return id;};
  function cancelAll(){for(const requestId of requests.current)void window.omniEdu?.cancelXiaozhiFile({sessionId,requestId});requests.current.clear();}
  async function list(relative='.') {
    const stamp=epoch.current,requestId=request();setLoading(true);setError('');
    try{
      const result=await window.omniEdu?.listXiaozhiFiles({schemaVersion:XIAOZHI_FILES_SCHEMA,sessionId,requestId,path:relative,...(authority.current?{workspaceVersion:authority.current}:{})});
      if(stamp!==epoch.current)return;
      if(!result?.ok){setError(result?XIAOZHI_FILE_ERRORS[result.error]:'无法读取本地目录，请重试。');return;}
      if(loadedCount.current+result.data.entries.length>1024){setError('已加载较多文件，请刷新后选择更具体的目录。');return;}
      authority.current=result.workspaceVersion;loadedCount.current+=result.data.entries.length;setLabel(result.data.label);setPartial(value=>value||result.data.partial);
      setDirectories(previous=>({...previous,[relative]:result.data.entries}));if(relative!=='.')setExpanded(previous=>new Set([...previous,relative]));
    }catch{if(stamp===epoch.current)setError('无法读取本地目录，请重试。');}
    finally{requests.current.delete(requestId);if(stamp===epoch.current)setLoading(false);}
  }
  async function openFile(entry:XiaozhiFileEntry) {
    const stamp=++previewEpoch.current,life=epoch.current;cancelAll();setLoading(false);setPreview(undefined);setPreviewError('');setReading(true);setSelected(entry.path);
    setTabs(previous=>previous.some(tab=>tab.path===entry.path)?previous.map(tab=>tab.path===entry.path?entry:tab):[...previous.slice(-7),entry]);
    const requestId=request();
    try{
      const result=await window.omniEdu?.previewXiaozhiFile({schemaVersion:XIAOZHI_FILES_SCHEMA,sessionId,requestId,path:entry.path,workspaceVersion:authority.current,version:entry.version});
      if(stamp!==previewEpoch.current||life!==epoch.current)return;
      if(!result?.ok)setPreviewError(result?XIAOZHI_FILE_ERRORS[result.error]:'无法预览文件，请重试。');else setPreview(result.data);
    }catch{if(stamp===previewEpoch.current&&life===epoch.current)setPreviewError('无法预览文件，请重试。');}
    finally{requests.current.delete(requestId);if(stamp===previewEpoch.current&&life===epoch.current)setReading(false);}
  }
  function closeTab(target:string){cancelAll();++previewEpoch.current;setReading(false);setPreview(undefined);setPreviewError('');const next=tabs.filter(tab=>tab.path!==target);setTabs(next);if(selected===target){setSelected('');if(next.length)void openFile(next.at(-1)!);}}
  function refresh(){cancelAll();++epoch.current;++previewEpoch.current;loadedCount.current=0;authority.current='';setDirectories({});setExpanded(new Set());setPartial(false);setPreview(undefined);setPreviewError('');setReading(false);void list();}
  useEffect(()=>{void list();return()=>{++epoch.current;++previewEpoch.current;cancelAll();};},[sessionId]);
  const matches=(entry:XiaozhiFileEntry):boolean=>!query||entry.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())||(directories[entry.path]||[]).some(matches);
  function tree(relative:string):React.ReactNode {return (directories[relative]||[]).filter(matches).map(entry=><FileTree.Item key={entry.path} id={entry.path} textValue={entry.name} title={entry.name} data-testid={`pi-file-entry-${entry.path}`}
    icon={entry.kind==='directory'?<Folder size={16}/>:<FileText size={16}/>}>
    {entry.kind==='directory'&&directories[entry.path]?.length?tree(entry.path):undefined}
  </FileTree.Item>);}
  return <section className="pi-file-panel" aria-label="本地文件工作面板" data-testid="pi-file-panel">
    <div className="pi-file-toolbar">
        {!!tabs.length?<Tabs selectedKey={selected||undefined} onSelectionChange={key=>{const entry=tabs.find(tab=>tab.path===key);if(entry&&entry.path!==selected)void openFile(entry);}} data-testid="pi-file-tabs">
          <Tabs.ListContainer><Tabs.List aria-label="已打开的教学文件">{tabs.map(tab=><Tabs.Tab key={tab.path} id={tab.path}><FileText size={14}/><span>{tab.name}</span><Tabs.Indicator/></Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
        </Tabs>:<span className="pi-file-toolbar-empty"><FileText size={16}/>本地文件</span>}
      <Button variant="ghost" isIconOnly size="sm" aria-label="刷新文件目录" onPress={refresh} data-testid="pi-files-refresh"><RefreshCw size={16}/></Button>
      <Button variant="ghost" isIconOnly size="sm" aria-label="显示或隐藏文件树" aria-pressed={explorerOpen} onPress={()=>setExplorerOpen(value=>!value)} data-testid="pi-files-explorer-toggle"><PanelRight size={16}/></Button>
      <Button variant="ghost" isIconOnly size="sm" aria-label="关闭文件面板" onPress={onClose} data-testid="pi-files-close"><X size={16}/></Button>
    </div>
    <div className="pi-file-body">
      <div className="pi-file-reading">
        {selected&&<div className="pi-file-breadcrumb"><span title={selected}>{selected}</span><Button variant="ghost" size="sm" isIconOnly aria-label="关闭当前文件" onPress={()=>closeTab(selected)} data-testid="pi-file-tab-close"><X size={14}/></Button></div>}
        <div className="pi-file-preview" data-testid="pi-file-preview" aria-busy={reading}>
          {reading?<p role="status">正在读取文件…</p>:previewError?<div role="alert"><p>{previewError}</p><p>刷新目录后，选择最新文件继续预览。</p><Button variant="ghost" size="sm" onPress={refresh} data-testid="pi-file-preview-refresh">刷新目录</Button></div>:preview?.format==='image'?<img src={preview.image} alt={preview.name} data-testid="pi-file-image"/>:
            preview?.format==='markdown'?<Markdown components={{img:({alt})=><span>［图片：{alt||'引用图片'}，未加载］</span>,a:({children})=><span>{children}</span>}}>{preview.text||''}</Markdown>:
            preview?.format==='text'?<pre data-testid="pi-file-text">{preview.text}</pre>:preview?<div><h3>{preview.name}</h3><p>{preview.size} 字节</p><p>暂不支持此格式的内容预览。</p></div>:<p className="pi-file-empty">从右侧选择教学文件进行本地预览。</p>}
        </div>
      </div>
      <aside className="pi-file-explorer" hidden={!explorerOpen}>
        <strong title={label}>{label}</strong><input aria-label="筛选已加载文件" placeholder="筛选已加载文件…" value={query} onChange={event=>setQuery(event.target.value)} data-testid="pi-file-filter"/>
        {error&&<div role="alert" data-testid="pi-file-error"><p>{error}</p><Button size="sm" variant="ghost" onPress={onChoose} data-testid="pi-files-choose">选择工作目录</Button><Button size="sm" variant="ghost" onPress={refresh}>重试</Button></div>}
        {loading&&<p role="status">正在读取目录…</p>}
        {directories['.']?.length?<FileTree aria-label="教学工作目录文件" reduceMotion expandedKeys={expanded} onExpandedChange={keys=>setExpanded(new Set([...keys].map(String)))}
          onAction={key=>{const entry=Object.values(directories).flat().find(item=>item.path===key);if(!entry)return;if(entry.kind==='directory'){if(!directories[entry.path])void list(entry.path);else setExpanded(previous=>{const next=new Set(previous);next.has(entry.path)?next.delete(entry.path):next.add(entry.path);return next;});}else void openFile(entry);}}>{tree('.')}</FileTree>:
          !loading&&!error&&<p>此目录没有可显示的文件。</p>}
        {partial&&<p role="status">目录较大，只显示本次读取范围内的文件。</p>}
      </aside>
    </div>
  </section>;
}
