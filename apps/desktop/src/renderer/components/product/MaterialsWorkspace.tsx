import {useEffect,useRef,useState} from 'react';
import {Button,Pagination,SearchField} from '@heroui/react';
import {FileText,FolderPlus,Plus,RefreshCw,Square} from 'lucide-react';
import {ListView} from '../../heroui-pro/components/list-view';
import type {KnowledgeImportResult} from '../../../shared/contracts';
import {MATERIALS_SCHEMA,MATERIAL_PAGE_SIZE,materialFailureText,type MaterialJob,type MaterialPage,type MaterialSourceView,type MaterialFolderResult} from '../../../shared/materials';
import {LibraryEmpty} from './LibraryEmpty';
import {MaterialBodyPanel} from './MaterialBodyPanel';
import {libraryFileSize,materialReadiness} from './material-library';
import './teacher-library.css';
import {MATERIAL_TASK_SCHEMA,type MaterialQueueView} from '../../../shared/material-parse-task';

/** Local catalogue and committed body pages; never uploads or grants paths. */
export function MaterialsWorkspace({sourceView}:{sourceView?:MaterialSourceView}) {
 const [catalog,setCatalog]=useState<MaterialPage>(),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[selected,setSelected]=useState('');
 const [loadedQuery,setLoadedQuery]=useState('');
 const [loading,setLoading]=useState(true),[localBusy,setBusy]=useState(false),[hostBusy,setHostBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const busy=localBusy||hostBusy;
 const [queue,setQueue]=useState<MaterialQueueView>();
 const [scan,setScan]=useState<MaterialJob['scan']>();
 const [folderProgress,setFolderProgress]=useState<MaterialJob['folder']>();
 const [imported,setImported]=useState<KnowledgeImportResult>();const listEpoch=useRef(0),lock=useRef(false),alive=useRef(true);
 const [sourceActive,setSourceActive]=useState(!!sourceView);
 useEffect(()=>{setSourceActive(!!sourceView);},[sourceView]);
 const location=useRef({query,offset});location.current={query,offset};
 const selectedTask=useRef(selected);selectedTask.current=sourceActive?sourceView?.body.resource.id||selected:selected;
 async function load(search=query,start=offset){const stamp=++listEpoch.current;setLoading(true);setError('');try{const next=await window.omniEdu?.listMaterials({schemaVersion:MATERIALS_SCHEMA,query:search,offset:start});if(!next)throw new Error();if(alive.current&&stamp===listEpoch.current){setCatalog(next);setLoadedQuery(search);}}catch{if(alive.current&&stamp===listEpoch.current)setError('无法读取资料，请重试。');}finally{if(alive.current&&stamp===listEpoch.current)setLoading(false);}}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;++listEpoch.current;};},[]);
 useEffect(()=>{let mounted=true,inFlight=false,last='';const poll=async()=>{if(inFlight)return;inFlight=true;try{const [state,next]=await Promise.all([window.omniEdu?.getMaterialJob(),window.omniEdu?.getMaterialQueue(selectedTask.current||undefined)]);if(!mounted||!state)return;setHostBusy(state.active);setScan(state.scan);setFolderProgress(state.folder);setQueue(next);const signature=JSON.stringify(next);if(last&&last!==signature&&!lock.current){void load(location.current.query,location.current.offset);setRevision(v=>v+1);}last=signature;}catch{if(mounted)setError('后台收录状态暂不可用，请刷新重试。');}finally{inFlight=false;}};void poll();const timer=setInterval(()=>void poll(),500);return()=>{mounted=false;clearInterval(timer);};},[]);
 useEffect(()=>{setSelected('');const timer=setTimeout(()=>void load(query,offset),150);return()=>{clearTimeout(timer);++listEpoch.current;};},[query,offset]);
 async function work(retry=false,folder=false){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{
  if(!window.omniEdu)throw new Error();
  if(retry){if(!resource)throw new Error();setQueue(await window.omniEdu.controlMaterialTask({schemaVersion:MATERIAL_TASK_SCHEMA,resourceId:resource.id,version:resource.contentHash,action:'retry'}));if(!alive.current)return;setNotice('已安排优先收录，可以继续浏览其他资料。');await load();}
  else {const result=folder?await window.omniEdu.importMaterialsFolder():await window.omniEdu.importMaterialsBackground();if(!alive.current)return;setImported(result);const summary=(result as Partial<MaterialFolderResult>).summary;
   const saved=summary?summary.imported+summary.reused:result.items.filter(item=>item.ok).length,reused=summary?.reused??result.items.filter(item=>item.ok&&item.reused).length,ready=result.resources.filter(row=>row.parseStatus==='ready').length;
   setNotice(summary?`${result.status==='canceled'?'已停止添加。':''}已新增 ${summary.imported} 份资料，复用 ${summary.reused} 份；${summary.failed} 项未能添加，${summary.skipped} 项已跳过（非支持文件、链接或不可收录目录）。新资料在本机后台收录，停止或失败状态保留。`:result.status==='canceled'?(saved?`已停止添加，${saved} 份资料保留在本机。`:'已取消添加资料。'):`已新增 ${saved-reused} 份资料${reused?`，${reused} 份内容未变，已复用原资料`:''}；${ready} 份正文已收录。新资料在本机后台收录，原有停止或失败状态保留${result.items.some(item=>!item.ok)?'，部分文件未能添加。':'。'}`);
   setSourceActive(false);setQuery('');setOffset(0);await load('',0);if(result.resources[0])setSelected(result.resources[0].id);
  }
  setRevision(value=>value+1);
 }catch{if(alive.current)setError('未能处理资料，请检查文件是否可读取后重试。');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function stop(){try{await window.omniEdu?.cancelMaterialImport();setNotice('正在停止收录，已保存的资料会保留。');}catch{setError('未能停止，请重试。');}}
 async function control(action:'prioritize'|'cancel'){if(!resource||!window.omniEdu)return;try{setQueue(await window.omniEdu.controlMaterialTask({schemaVersion:MATERIAL_TASK_SCHEMA,resourceId:resource.id,version:resource.contentHash,action}));setNotice(action==='cancel'?'已停止这份资料的收录，原文件仍保存在本机。':'已安排优先处理这份资料。');}catch{setError('未能调整收录，请刷新确认原件版本后重试。');}}
 async function locate(){if(!resource||busy)return;setBusy(true);setError('');setNotice('');try{if(!window.omniEdu)throw new Error();await window.omniEdu.showKnowledgeResource(resource.localPath);setNotice('已在文件夹中定位资料。');}catch{setError('无法定位这份资料，请检查本地文件是否仍存在。');}finally{if(alive.current)setBusy(false);}}
 const stale=loadedQuery!==query||!!catalog&&catalog.offset!==offset;
 const fetching=loading||stale&&!error;
 const rows=stale?[]:catalog?.resources||[],resource=sourceActive?sourceView?.body.resource:rows.find(row=>row.id===selected);
 const task=queue?.tasks.find(task=>task.resourceId===resource?.id),background=!!queue&&(queue.pending>0||queue.running>0);
 return <section className="teacher-library" data-testid="materials-workspace" aria-label="我的资料">
  <header className="teacher-library-heading"><div><h1>我的资料</h1><p>教材、教案和自己的文件，放在一起随时查找。</p></div><div className="teacher-library-toolbar"><Button variant="secondary" onPress={()=>void work(false,true)} isDisabled={busy} data-testid="materials-import-folder"><FolderPlus size={17}/>添加文件夹</Button><Button onPress={()=>void work()} isDisabled={busy} isPending={busy} data-testid="materials-import"><Plus size={17}/>添加资料</Button></div></header>
  <div className="teacher-library-toolbar"><SearchField aria-label="按资料名称或格式查找" value={query} onChange={value=>{setQuery(value);setOffset(0);}} isDisabled={busy} className="teacher-library-search" variant="secondary"><SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="查找全部资料名称或格式" maxLength={128} data-testid="materials-search"/><SearchField.ClearButton aria-label="清除资料查找"/></SearchField.Group></SearchField>
   <Button variant="ghost" onPress={()=>{void load();setRevision(v=>v+1);}} isDisabled={busy||fetching} data-testid="materials-refresh"><RefreshCw size={16}/>刷新</Button>{(busy||background)&&<Button variant="secondary" onPress={()=>void stop()} data-testid="materials-stop"><Square size={14}/>停止收录</Button>}</div>
  {(busy||background)&&<p role="status" className="teacher-library-caption" data-testid="materials-progress">{folderProgress?`正在添加文件夹：已查看 ${folderProgress.scanned} 个文件，新增 ${folderProgress.imported} 份、复用 ${folderProgress.reused} 份；原件不会上传…`:scan?`正在本机识别第 ${scan.page} / ${scan.total} 页，原文件不会上传…`:background?`${queue?.pending} 份等待收录，${queue?.running} 份正在处理，可以继续浏览…`:'正在保存本地资料，原文件不会上传…'}</p>}
  {!!queue?.invalid&&<p role="alert" className="teacher-library-error">有收录记录不可读取，尚未执行。请保留原件并重新添加。</p>}
  {task&&<div className="teacher-library-toolbar" data-testid="materials-task" data-status={task.status}><p role="status">{task.title}：{{pending:'等待收录',running:'正在收录',succeeded:'正文已收录',failed:'收录未完成',cancelled:'已停止'}[task.status]}{task.error&&task.status==='failed'?` · ${materialFailureText('parser:'+task.error)}`:''}</p>{(task.status==='pending'||task.status==='running'&&task.priority===0)&&<Button variant="secondary" onPress={()=>void control('prioritize')} isDisabled={busy} data-testid="materials-prioritize">优先处理</Button>}{['pending','running'].includes(task.status)&&<Button variant="ghost" onPress={()=>void control('cancel')} isDisabled={busy} data-testid="materials-task-stop">停止这份</Button>}</div>}
  {notice&&<p role="status" className="teacher-library-notice" data-testid="materials-notice">{notice}</p>}
  {error&&<p role="alert" className="teacher-library-error" data-testid="materials-error">{error}</p>}
  {imported?.items.some(item=>!item.ok)&&<ul className="teacher-library-import-failures" data-testid="materials-import-failures">{imported.items.filter(item=>!item.ok).map((item,index)=><li key={index}>{item.fileName}：未能添加，请检查文件是否可读取。</li>)}</ul>}
  <p className="teacher-library-count" data-testid="materials-count">{fetching?'正在读取资料…':`${catalog?.total||0} 份资料 · 保存在本机`}</p>
  <div className="teacher-library-grid"><div className="teacher-library-directory">
   <ListView aria-label="资料列表" className="teacher-library-list" selectionMode="single" selectionBehavior="replace" disallowEmptySelection selectedKeys={new Set(resource?[resource.id]:[])} onSelectionChange={keys=>{if(keys!=='all'){setSourceActive(false);setSelected(String([...keys][0]||''));}}} renderEmptyState={()=>fetching?<p role="status">正在读取资料…</p>:<LibraryEmpty title={query?'没有匹配的资料':'先添加一份资料'} description={query?'换个名称或格式，或清除查找条件。':'从本机选择教材、教案、图片或其他教学文件。'}/>}>
    {rows.map(row=>{const readiness=materialReadiness(row);return <ListView.Item id={row.id} key={row.id} textValue={row.title} data-testid={`material-${row.id}`} isDisabled={busy||fetching}>
     <FileText size={19}/><ListView.ItemContent><ListView.Title>{row.title}</ListView.Title><ListView.Description>{row.originalFileName} · {libraryFileSize(row.fileSize)}</ListView.Description></ListView.ItemContent><span className="teacher-library-state" data-tone={readiness.tone}>{readiness.label}</span>
    </ListView.Item>;})}</ListView>
   {!!catalog?.total&&<Pagination aria-label="资料目录翻页" className="teacher-library-pagination"><Pagination.Summary>第 {Math.floor(catalog.offset/MATERIAL_PAGE_SIZE)+1} / {Math.ceil(catalog.total/MATERIAL_PAGE_SIZE)} 页</Pagination.Summary><Pagination.Content><Pagination.Item><Pagination.Previous isDisabled={busy||fetching||offset===0} onPress={()=>setOffset(Math.max(0,offset-MATERIAL_PAGE_SIZE))} data-testid="materials-previous">上一页</Pagination.Previous></Pagination.Item><Pagination.Item><Pagination.Next isDisabled={busy||fetching||!catalog.hasMore} onPress={()=>setOffset(offset+MATERIAL_PAGE_SIZE)} data-testid="materials-next">下一页</Pagination.Next></Pagination.Item></Pagination.Content></Pagination>}
  </div><MaterialBodyPanel resource={resource} sourceView={sourceActive?sourceView:undefined} busy={busy} revision={revision} taskStatus={task?.status} locate={()=>void locate()} retry={()=>void work(true)}/></div>
 </section>;
}
