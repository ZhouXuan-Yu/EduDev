import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {MATERIAL_IMPORT_SCHEMA as schema,type MaterialBatchPage,type MaterialBatchFiles,type MaterialBatchAction} from '../../../shared/material-import-batch';
import {libraryFileSize} from './material-library';
import {MaterialFolderAiPanel} from './MaterialFolderAiPanel';
const labels={queued:'等待归档',running:'正在归档',paused:'已暂停',completed:'归档完成',partial:'部分文件待重试',failed:'归档中断'};
/** Folder batch progress survives navigation, app shutdown and machine restart. */
export function MaterialImportPanel({revision,changed,open}:{revision:number;changed:()=>void;open:(id:string)=>void}){
 const [page,setPage]=useState<MaterialBatchPage>(),[offset,setOffset]=useState(0),[expanded,setExpanded]=useState(''),[fileOffset,setFileOffset]=useState(0),[files,setFiles]=useState<MaterialBatchFiles>(),[error,setError]=useState(''),[pending,setPending]=useState('');
 const signature=useRef(''),onChanged=useRef(changed);onChanged.current=changed;
 useEffect(()=>{let current=true,reading=false;async function refresh(){if(reading)return;reading=true;try{
  const next=await window.omniEdu?.listMaterialBatches({schemaVersion:schema,offset});if(!current||!next)return;setPage(next);
  const state=JSON.stringify(next.batches.map(b=>[b.id,b.status,b.archived,b.readable,b.failed,b.parseFailed]));
  if(signature.current&&state!==signature.current)onChanged.current();signature.current=state;
  if(expanded){const detail=await window.omniEdu?.getMaterialBatchFiles({schemaVersion:schema,batchId:expanded,offset:fileOffset});if(current)setFiles(detail);}
 }catch{if(current)setError('文件夹进度暂不可用，请稍后重试。');}finally{reading=false;}}
 void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>{current=false;clearInterval(timer);};},[offset,expanded,fileOffset,revision]);
 async function action(batchId:string,action:MaterialBatchAction['action']){if(pending)return;setPending(batchId);setError('');try{await window.omniEdu?.controlMaterialBatch({schemaVersion:schema,batchId,action});onChanged.current();}catch{setError('未能调整归档。请确认处理已停止、原文件夹仍在原位置后重试。');}finally{setPending('');}}
 if(!page?.total&&!error)return null;
 return <section className="material-batches" aria-label="文件夹归档" data-testid="material-batches">
  <h2>文件夹归档</h2><p className="teacher-library-caption">原件自动保存在本机，正文随后整理。关闭小智后，下次打开会接着处理；手动暂停的批次需点击继续。</p>
  {error&&<p role="alert">{error}</p>}
  {page?.batches.map(batch=><article key={batch.id} className="material-batch" data-testid={'material-batch-'+batch.id} data-status={batch.status}>
   <div className="teacher-library-toolbar"><strong>{batch.name}</strong><span role="status">{labels[batch.status]}{batch.status==='running'&&batch.phase==='discover'?' · 扫描目录':''}</span>
    {['queued','running'].includes(batch.status)?<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'pause')} data-testid={'batch-pause-'+batch.id}>暂停归档</Button>:batch.status==='paused'?<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'resume')} data-testid={'batch-resume-'+batch.id}>继续归档</Button>:null}
    {(batch.failed>0||batch.parseFailed>0||batch.status==='failed')&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'retry')} data-testid={'batch-retry-'+batch.id}>重试未完成</Button>}
    <Button size="sm" variant="ghost" onPress={()=>{setExpanded(expanded===batch.id?'':batch.id);setFileOffset(0);setFiles(undefined);}} data-testid={'batch-files-'+batch.id}>{expanded===batch.id?'收起文件':'查看文件'}</Button>
   </div>
   <p className="teacher-library-caption" data-testid={'batch-counts-'+batch.id}>已发现 {batch.scanned} 个文件 · 已归档 {batch.archived} 个（新增 {batch.imported}、复用 {batch.reused}） · {libraryFileSize(batch.archivedBytes)} / {libraryFileSize(batch.bytes)} · {batch.failed} 项失败 · {batch.skipped} 项跳过</p>
   <p className="teacher-library-caption">{batch.readable} 份完整正文可查{batch.partialReadable?`，${batch.partialReadable} 份部分正文可查`:''}，{batch.waiting} 份正在或等待整理{batch.parseFailed?`，${batch.parseFailed} 份正文需重试`:''}。</p>
   {batch.error&&<p role="alert">{batch.error}</p>}
   <MaterialFolderAiPanel batchId={batch.id} open={open}/>
   {expanded===batch.id&&<div data-testid="batch-file-list">{!files?<p role="status">正在读取文件…</p>:!files.total?<p>还没有发现文件。</p>:<>
    <ul>{files.files.map(file=><li key={file.relativePath} className="material-batch-file"><span>{file.relativePath}</span><span>{{pending:'等待归档',saved:'已归档',failed:'未完成',skipped:'已跳过'}[file.status]}</span>{file.error&&<span role={file.status==='failed'?'alert':undefined}>{file.error}</span>}{file.resourceId&&<Button size="sm" variant="ghost" onPress={()=>open(file.resourceId)}>打开资料</Button>}</li>)}</ul>
    <div className="teacher-library-toolbar"><Button size="sm" variant="ghost" isDisabled={!fileOffset} onPress={()=>setFileOffset(v=>Math.max(0,v-20))}>前20个文件</Button><span>共 {files.total} 个文件</span><Button size="sm" variant="ghost" isDisabled={!files.hasMore} onPress={()=>setFileOffset(v=>v+20)}>后20个文件</Button></div>
   </>}</div>}
  </article>)}
  {!!page&&page.total>10&&<div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!offset} onPress={()=>setOffset(v=>Math.max(0,v-10))}>较新批次</Button><span>共 {page.total} 批</span><Button variant="ghost" isDisabled={!page.hasMore} onPress={()=>setOffset(v=>v+10)}>较早批次</Button></div>}
 </section>;
}
