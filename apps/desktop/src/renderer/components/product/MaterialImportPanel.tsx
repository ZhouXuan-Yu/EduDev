import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {MATERIAL_IMPORT_SCHEMA as schema,type MaterialBatchPage,type MaterialBatchFiles,type MaterialBatchAction,type MaterialBatchFileFilter} from '../../../shared/material-import-batch';
import {libraryFileSize} from './material-library';
import {MaterialFolderAiPanel} from './MaterialFolderAiPanel';
const labels={queued:'等待归档',running:'正在归档',paused:'已暂停',completed:'归档完成',partial:'部分文件待重试',failed:'归档中断'};
const contentLabels={waiting:'正文等待或整理中',readable:'正文可查',partial:'部分正文可查',empty:'尚无正文，请核对',failed:'正文解析未完成',unavailable:'资料记录不可用'};
/** Folder batch progress survives navigation, app shutdown and machine restart. */
export function MaterialImportPanel({revision,changed,open}:{revision:number;changed:()=>void;open:(id:string)=>void}){
 const [page,setPage]=useState<MaterialBatchPage>(),[offset,setOffset]=useState(0),[expanded,setExpanded]=useState(''),[fileOffset,setFileOffset]=useState(0),[files,setFiles]=useState<MaterialBatchFiles>(),[error,setError]=useState(''),[pending,setPending]=useState('');
 const [fileFilter,setFileFilter]=useState<MaterialBatchFileFilter>('all'),[loadError,setLoadError]=useState('');
 const signature=useRef(''),onChanged=useRef(changed);onChanged.current=changed;
 useEffect(()=>{let current=true,reading=false;async function refresh(){if(reading)return;reading=true;try{
  const next=await window.omniEdu?.listMaterialBatches({schemaVersion:schema,offset});if(!current||!next)return;setPage(next);
  const state=JSON.stringify(next.batches.map(b=>[b.id,b.status,b.archived,b.readable,b.failed,b.parseFailed,b.empty]));
  if(signature.current&&state!==signature.current)onChanged.current();signature.current=state;
  if(expanded){const detail=await window.omniEdu?.getMaterialBatchFiles({schemaVersion:schema,batchId:expanded,offset:fileOffset,filter:fileFilter});if(current)setFiles(detail);}
  if(current)setLoadError('');
 }catch{if(current)setLoadError('文件夹进度暂不可用，正在重试读取。');}finally{reading=false;}}
 void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>{current=false;clearInterval(timer);};},[offset,expanded,fileOffset,fileFilter,revision]);
 async function action(batchId:string,action:MaterialBatchAction['action'],relativePath?:string){if(pending)return;setPending(batchId);setError('');try{await window.omniEdu?.controlMaterialBatch({schemaVersion:schema,batchId,action,...(relativePath!==undefined?{relativePath}:{})});onChanged.current();}catch{setError(relativePath!==undefined?'此文件重试未启动，请查看文件原因；其他资料继续处理。':'未能调整归档。请确认处理已停止、原文件夹仍在原位置后重试。');}finally{setPending('');}}
 if(!page?.total&&!error&&!loadError)return null;
 return <section className="material-batches" aria-label="文件夹归档" data-testid="material-batches">
  <h2>文件夹归档</h2><p className="teacher-library-caption">原件自动保存在本机，正文随后整理。关闭小智后，下次打开会接着处理；手动暂停的批次需点击继续。</p>
  {(error||loadError)&&<p role="alert">{error||loadError}</p>}
  {page?.batches.map(batch=><article key={batch.id} className="material-batch" data-testid={'material-batch-'+batch.id} data-status={batch.status}>
   <div className="teacher-library-toolbar"><strong>{batch.name}</strong><span role="status">{labels[batch.status]}{batch.status==='running'&&batch.phase==='discover'?' · 扫描目录':''}</span>
    {['queued','running'].includes(batch.status)?<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'pause')} data-testid={'batch-pause-'+batch.id}>暂停归档</Button>:batch.status==='paused'?<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'resume')} data-testid={'batch-resume-'+batch.id}>继续归档</Button>:null}
    {(batch.failed>0||batch.parseFailed>0||batch.status==='failed')&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'retry')} data-testid={'batch-retry-'+batch.id}>重试未完成</Button>}
    <Button size="sm" variant="ghost" onPress={()=>{setExpanded(expanded===batch.id?'':batch.id);setFileOffset(0);setFileFilter('all');setFiles(undefined);}} data-testid={'batch-files-'+batch.id}>{expanded===batch.id?'收起文件':'查看文件'}</Button>
   </div>
   <p className="teacher-library-caption" data-testid={'batch-counts-'+batch.id}>已发现 {batch.scanned} 个文件 · 已归档 {batch.archived} 个（新增 {batch.imported}、复用 {batch.reused}） · {libraryFileSize(batch.archivedBytes)} / {libraryFileSize(batch.bytes)} · {batch.failed} 项失败 · {batch.skipped} 项跳过</p>
   <p className="teacher-library-caption">{batch.readable} 份完整正文可查{batch.partialReadable?`，${batch.partialReadable} 份部分正文可查`:''}，{batch.waiting} 份正在或等待整理{batch.parseFailed?`，${batch.parseFailed} 份正文需重试`:''}{batch.empty?`，${batch.empty} 份尚无正文需核对`:''}。</p>
   {batch.error&&<p role="alert">{batch.error}</p>}
   <MaterialFolderAiPanel batchId={batch.id} open={open}/>
   {expanded===batch.id&&<div data-testid="batch-file-list">
    <div className="teacher-library-toolbar"><Button size="sm" variant="ghost" aria-pressed={fileFilter==='all'} onPress={()=>{setFileFilter('all');setFileOffset(0);setFiles(undefined);}} data-testid="batch-files-all">全部文件</Button><Button size="sm" variant="ghost" aria-pressed={fileFilter==='issues'} onPress={()=>{setFileFilter('issues');setFileOffset(0);setFiles(undefined);}} data-testid="batch-files-issues">只看待处理</Button></div>
    {!files?<p role="status">正在读取文件…</p>:!files.total?<p role="status">{fileFilter==='issues'?'当前没有待处理文件。':'还没有发现文件。'}</p>:<>
    <ul>{files.files.map(file=><li key={file.relativePath} className="material-batch-file" data-testid="batch-file" data-path={file.relativePath}><span>{file.relativePath||'导入目录'}</span><span>{{pending:'等待归档',saved:'已归档',failed:'未完成',skipped:'已跳过'}[file.status]}{file.contentState?` · ${contentLabels[file.contentState]}`:''}</span>{(file.error||file.contentError)&&<span role={file.status==='failed'||file.contentState==='failed'?'alert':undefined}>{file.error||file.contentError}</span>}{file.retryable&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'retry',file.relativePath)} data-testid="batch-file-retry">{file.status==='saved'?'重试本地解析':'重试此项归档'}</Button>}{file.resourceId&&file.contentState!=='unavailable'&&<Button size="sm" variant="ghost" onPress={()=>open(file.resourceId)}>打开资料</Button>}</li>)}</ul>
    <div className="teacher-library-toolbar"><Button size="sm" variant="ghost" isDisabled={!fileOffset} onPress={()=>{setFiles(undefined);setFileOffset(v=>Math.max(0,v-20));}}>前20个文件</Button><span>共 {files.total} 个{fileFilter==='issues'?'待处理项':'文件'}</span><Button size="sm" variant="ghost" isDisabled={!files.hasMore} onPress={()=>{setFiles(undefined);setFileOffset(v=>v+20);}}>后20个文件</Button></div>
   </>}</div>}
  </article>)}
  {!!page&&page.total>10&&<div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!offset} onPress={()=>setOffset(v=>Math.max(0,v-10))}>较新批次</Button><span>共 {page.total} 批</span><Button variant="ghost" isDisabled={!page.hasMore} onPress={()=>setOffset(v=>v+10)}>较早批次</Button></div>}
 </section>;
}
