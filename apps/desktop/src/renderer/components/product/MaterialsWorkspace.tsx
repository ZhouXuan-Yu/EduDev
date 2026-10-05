import {useEffect,useRef,useState} from 'react';
import {Button,Pagination,SearchField} from '@heroui/react';
import {FileText,Plus,RefreshCw,Square} from 'lucide-react';
import {ListView} from '../../heroui-pro/components/list-view';
import type {KnowledgeImportResult} from '../../../shared/contracts';
import {MATERIALS_SCHEMA,MATERIAL_PAGE_SIZE,materialFailureText,type MaterialPage} from '../../../shared/materials';
import {LibraryEmpty} from './LibraryEmpty';
import {MaterialBodyPanel} from './MaterialBodyPanel';
import {libraryFileSize,materialReadiness} from './material-library';
import './teacher-library.css';

/** Local catalogue and committed body pages; never uploads or grants paths. */
export function MaterialsWorkspace() {
 const [catalog,setCatalog]=useState<MaterialPage>(),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[selected,setSelected]=useState('');
 const [loadedQuery,setLoadedQuery]=useState('');
 const [loading,setLoading]=useState(true),[localBusy,setBusy]=useState(false),[hostBusy,setHostBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const busy=localBusy||hostBusy;
 const [imported,setImported]=useState<KnowledgeImportResult>();const listEpoch=useRef(0),lock=useRef(false),alive=useRef(true);
 const location=useRef({query,offset});location.current={query,offset};
 async function load(search=query,start=offset){const stamp=++listEpoch.current;setLoading(true);setError('');try{const next=await window.omniEdu?.listMaterials({schemaVersion:MATERIALS_SCHEMA,query:search,offset:start});if(!next)throw new Error();if(alive.current&&stamp===listEpoch.current){setCatalog(next);setLoadedQuery(search);}}catch{if(alive.current&&stamp===listEpoch.current)setError('无法读取资料，请重试。');}finally{if(alive.current&&stamp===listEpoch.current)setLoading(false);}}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;++listEpoch.current;};},[]);
 useEffect(()=>{let mounted=true,inFlight=false,wasActive=false,external=false;const poll=async()=>{if(inFlight)return;inFlight=true;try{const state=await window.omniEdu?.getMaterialJob();if(!mounted||!state)return;setHostBusy(state.active);if(state.active&&!lock.current)external=true;if(wasActive&&!state.active&&external){void load(location.current.query,location.current.offset);setRevision(v=>v+1);setNotice('资料读取已结束，请查看各份资料的收录状态。');external=false;}wasActive=state.active;}catch{}finally{inFlight=false;}};void poll();const timer=setInterval(()=>void poll(),500);return()=>{mounted=false;clearInterval(timer);};},[]);
 useEffect(()=>{setSelected('');const timer=setTimeout(()=>void load(query,offset),150);return()=>{clearTimeout(timer);++listEpoch.current;};},[query,offset]);
 async function work(retry=false){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{
  if(!window.omniEdu)throw new Error();
  if(retry){const result=await window.omniEdu.retryMaterial(selected);if(!alive.current)return;setNotice(result.resource.parseStatus==='ready'?'正文已收录，可以用于查找。':materialFailureText(result.resource.parseEngine));await load();}
  else {const result=await window.omniEdu.importKnowledgeResources();if(!alive.current)return;setImported(result);const saved=result.items.filter(item=>item.ok).length,ready=result.resources.filter(row=>row.parseStatus==='ready').length;
   setNotice(result.status==='canceled'?(saved?`已停止收录，${saved} 份已添加的资料保留在本机。`:'已取消添加资料。'):`已添加 ${saved} 份资料，${ready} 份正文已收录${result.items.some(item=>!item.ok)?'，部分文件未能添加。':'。'}`);
   setQuery('');setOffset(0);await load('',0);if(result.resources[0])setSelected(result.resources[0].id);
  }
  setRevision(value=>value+1);
 }catch{if(alive.current)setError('未能处理资料，请检查文件是否可读取后重试。');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function stop(){try{await window.omniEdu?.cancelMaterialImport();setNotice('正在停止收录，已保存的资料会保留。');}catch{setError('未能停止，请重试。');}}
 async function locate(){if(!resource||busy)return;setBusy(true);setError('');setNotice('');try{if(!window.omniEdu)throw new Error();await window.omniEdu.showKnowledgeResource(resource.localPath);setNotice('已在文件夹中定位资料。');}catch{setError('无法定位这份资料，请检查本地文件是否仍存在。');}finally{if(alive.current)setBusy(false);}}
 const stale=loadedQuery!==query||!!catalog&&catalog.offset!==offset;
 const fetching=loading||stale&&!error;
 const rows=stale?[]:catalog?.resources||[],resource=rows.find(row=>row.id===selected);
 return <section className="teacher-library" data-testid="materials-workspace" aria-label="我的资料">
  <header className="teacher-library-heading"><div><h1>我的资料</h1><p>教材、教案和自己的文件，放在一起随时查找。</p></div><Button onPress={()=>void work()} isDisabled={busy} isPending={busy} data-testid="materials-import"><Plus size={17}/>添加资料</Button></header>
  <div className="teacher-library-toolbar"><SearchField aria-label="按资料名称或格式查找" value={query} onChange={value=>{setQuery(value);setOffset(0);}} isDisabled={busy} className="teacher-library-search" variant="secondary"><SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="查找全部资料名称或格式" maxLength={128} data-testid="materials-search"/><SearchField.ClearButton aria-label="清除资料查找"/></SearchField.Group></SearchField>
   <Button variant="ghost" onPress={()=>{void load();setRevision(v=>v+1);}} isDisabled={busy||fetching} data-testid="materials-refresh"><RefreshCw size={16}/>刷新</Button>{busy&&<Button variant="secondary" onPress={()=>void stop()} data-testid="materials-stop"><Square size={14}/>停止收录</Button>}</div>
  {busy&&<p role="status" className="teacher-library-caption">正在保存和读取本地资料，原文件不会上传…</p>}
  {notice&&<p role="status" className="teacher-library-notice" data-testid="materials-notice">{notice}</p>}
  {error&&<p role="alert" className="teacher-library-error" data-testid="materials-error">{error}</p>}
  {imported?.items.some(item=>!item.ok)&&<ul className="teacher-library-import-failures" data-testid="materials-import-failures">{imported.items.filter(item=>!item.ok).map((item,index)=><li key={index}>{item.fileName}：未能添加，请检查文件是否可读取。</li>)}</ul>}
  <p className="teacher-library-count" data-testid="materials-count">{fetching?'正在读取资料…':`${catalog?.total||0} 份资料 · 保存在本机`}</p>
  <div className="teacher-library-grid"><div className="teacher-library-directory">
   <ListView aria-label="资料列表" className="teacher-library-list" selectionMode="single" selectionBehavior="replace" disallowEmptySelection selectedKeys={new Set(resource?[resource.id]:[])} onSelectionChange={keys=>{if(keys!=='all')setSelected(String([...keys][0]||''));}} renderEmptyState={()=>fetching?<p role="status">正在读取资料…</p>:<LibraryEmpty title={query?'没有匹配的资料':'先添加一份资料'} description={query?'换个名称或格式，或清除查找条件。':'从本机选择教材、教案、图片或其他教学文件。'}/>}>
    {rows.map(row=>{const readiness=materialReadiness(row);return <ListView.Item id={row.id} key={row.id} textValue={row.title} data-testid={`material-${row.id}`} isDisabled={busy||fetching}>
     <FileText size={19}/><ListView.ItemContent><ListView.Title>{row.title}</ListView.Title><ListView.Description>{row.originalFileName} · {libraryFileSize(row.fileSize)}</ListView.Description></ListView.ItemContent><span className="teacher-library-state" data-tone={readiness.tone}>{readiness.label}</span>
    </ListView.Item>;})}</ListView>
   {!!catalog?.total&&<Pagination aria-label="资料目录翻页" className="teacher-library-pagination"><Pagination.Summary>第 {Math.floor(catalog.offset/MATERIAL_PAGE_SIZE)+1} / {Math.ceil(catalog.total/MATERIAL_PAGE_SIZE)} 页</Pagination.Summary><Pagination.Content><Pagination.Item><Pagination.Previous isDisabled={busy||fetching||offset===0} onPress={()=>setOffset(Math.max(0,offset-MATERIAL_PAGE_SIZE))} data-testid="materials-previous">上一页</Pagination.Previous></Pagination.Item><Pagination.Item><Pagination.Next isDisabled={busy||fetching||!catalog.hasMore} onPress={()=>setOffset(offset+MATERIAL_PAGE_SIZE)} data-testid="materials-next">下一页</Pagination.Next></Pagination.Item></Pagination.Content></Pagination>}
  </div><MaterialBodyPanel resource={resource} busy={busy} revision={revision} locate={()=>void locate()} retry={()=>void work(true)}/></div>
 </section>;
}
