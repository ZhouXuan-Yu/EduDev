import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {MATERIAL_IMPORT_SCHEMA as schema,type MaterialBatchPage,type MaterialBatchFiles,type MaterialBatchAction,type MaterialBatchFileFilter} from '../../../shared/material-import-batch';
import {libraryFileSize} from './material-library';
import {MaterialFolderAiPanel} from './MaterialFolderAiPanel';
const labels={queued:'等待归档',running:'正在归档',paused:'已暂停',selecting:'待选择文件',canceled:'已放弃',completed:'归档完成',partial:'部分文件待重试',failed:'归档中断'};
const contentLabels={waiting:'正文等待或整理中',readable:'正文可查',partial:'部分正文可查',empty:'尚无正文，请核对',failed:'正文解析未完成',unavailable:'资料记录不可用'};
const structureLabels={running:'正在恢复结构',paused:'结构恢复已暂停',complete:'结构恢复已完成',attention:'结构恢复有待处理项'};
const structureFileLabels={pending:'结构等待处理',running:'结构恢复中',complete:'结构完整',partial:'结构部分完成，需核对',failed:'结构恢复失败'};
/** Folder batch progress survives navigation, app shutdown and machine restart. */
export function MaterialImportPanel({revision,changed,open,choose}:{revision:number;changed:()=>void;open:(id:string)=>void;choose:(batchId:string)=>void}){
 const [page,setPage]=useState<MaterialBatchPage>(),[offset,setOffset]=useState(0),[expanded,setExpanded]=useState(''),[fileOffset,setFileOffset]=useState(0),[files,setFiles]=useState<MaterialBatchFiles>(),[error,setError]=useState(''),[pending,setPending]=useState('');
 const [fileFilter,setFileFilter]=useState<MaterialBatchFileFilter>('all'),[loadError,setLoadError]=useState('');
 const signature=useRef(''),onChanged=useRef(changed);onChanged.current=changed;
 useEffect(()=>{let current=true,reading=false;async function refresh(){if(reading)return;reading=true;try{
  const next=await window.omniEdu?.listMaterialBatches({schemaVersion:schema,offset});if(!current||!next)return;setPage(next);
  const state=JSON.stringify(next.batches.map(b=>[b.id,b.status,b.archived,b.readable,b.failed,b.parseFailed,b.empty,b.structureAvailable,b.structureUpgradeable,b.structureRecovery]));
  if(signature.current&&state!==signature.current)onChanged.current();signature.current=state;
  if(expanded){const detail=await window.omniEdu?.getMaterialBatchFiles({schemaVersion:schema,batchId:expanded,offset:fileOffset,filter:fileFilter});if(current)setFiles(detail);}
  if(current)setLoadError('');
 }catch{if(current)setLoadError('文件夹进度暂不可用，正在重试读取。');}finally{reading=false;}}
 void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>{current=false;clearInterval(timer);};},[offset,expanded,fileOffset,fileFilter,revision]);
 async function action(batchId:string,action:MaterialBatchAction['action'],relativePath?:string){if(pending)return;setPending(batchId);setError('');try{await window.omniEdu?.controlMaterialBatch({schemaVersion:schema,batchId,action,...(relativePath!==undefined?{relativePath}:{})});onChanged.current();}catch{setError(action.startsWith('structure_')?'结构恢复操作未完成，请刷新查看本批状态后重试；已保存的处理进度会保留。':relativePath!==undefined?'此文件重试未启动，请查看文件原因；其他资料继续处理。':'未能调整归档。请确认处理已停止、原文件夹仍在原位置后重试。');}finally{setPending('');}}
 if(!page?.total&&!error&&!loadError)return null;
 return <section className="material-batches" aria-label="文件夹归档" data-testid="material-batches">
  <h2>文件夹归档</h2><p className="teacher-library-caption">原件自动保存在本机，正文随后整理。关闭小智后，下次打开会接着处理；手动暂停的批次需点击继续。</p>
  {(error||loadError)&&<p role="alert">{error||loadError}</p>}
  {page?.batches.map(batch=><article key={batch.id} className="material-batch" data-testid={'material-batch-'+batch.id} data-status={batch.status}>
   <div className="teacher-library-toolbar"><strong>{batch.name}</strong><span role="status">{batch.phase==='preview'&&batch.status==='running'?'正在查找文件':batch.phase==='preview'&&batch.status==='queued'?'等待查找文件':labels[batch.status]}{batch.status==='running'&&batch.phase==='discover'?' · 扫描目录':''}</span>
    {['queued','running'].includes(batch.status)?<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'pause')} data-testid={'batch-pause-'+batch.id}>{batch.phase==='preview'?'暂停查找':'暂停归档'}</Button>:batch.status==='paused'?<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'resume')} data-testid={'batch-resume-'+batch.id}>{batch.phase==='preview'?'继续查找':'继续归档'}</Button>:null}
    {batch.status==='selecting'&&<Button size="sm" onPress={()=>choose(batch.id)} data-testid={'batch-choose-'+batch.id}>选择要导入的文件</Button>}
    {batch.phase==='preview'&&batch.status==='failed'&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'resume')} data-testid={'batch-retry-'+batch.id}>继续查找文件</Button>}
    {batch.phase!=='preview'&&(batch.failed>0||batch.parseFailed>0||batch.status==='failed')&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'retry')} data-testid={'batch-retry-'+batch.id}>重试未完成</Button>}
    {batch.phase!=='preview'&&<Button size="sm" variant="ghost" onPress={()=>{setExpanded(expanded===batch.id?'':batch.id);setFileOffset(0);setFileFilter('all');setFiles(undefined);}} data-testid={'batch-files-'+batch.id}>{expanded===batch.id?'收起文件':'查看文件'}</Button>}
   </div>
   <p className="teacher-library-caption" data-testid={'batch-counts-'+batch.id}>已发现 {batch.scanned} 个文件 · 已归档 {batch.archived} 个（新增 {batch.imported}、复用 {batch.reused}） · {libraryFileSize(batch.archivedBytes)} / {libraryFileSize(batch.bytes)} · {batch.failed} 项失败 · {batch.skipped} 项跳过</p>
   {batch.phase!=='preview'&&<p className="teacher-library-caption">{batch.readable} 份完整正文可查{batch.partialReadable?`，${batch.partialReadable} 份部分正文可查`:''}，{batch.waiting} 份正在或等待整理{batch.parseFailed?`，${batch.parseFailed} 份正文需重试`:''}{batch.empty?`，${batch.empty} 份尚无正文需核对`:''}。</p>}
   {batch.error&&<p role="alert">{batch.error}</p>}
   {((batch.structureAvailable??0)>0||batch.structureRecovery)&&<div data-testid={'batch-structure-'+batch.id}>
    <div className="teacher-library-toolbar">
     <strong>本地文档结构</strong>
     {!!batch.structureUpgradeable&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'structure_upgrade')} data-testid={'batch-structure-upgrade-'+batch.id}>升级 {batch.structureUpgradeable} 份旧版结构</Button>}
     {batch.structureRecovery?<><span role="status">{structureLabels[batch.structureRecovery.state]}</span>
      {batch.structureRecovery.state==='running'&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'structure_pause')} data-testid={'batch-structure-pause-'+batch.id}>暂停结构恢复</Button>}
      {batch.structureRecovery.state==='paused'&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'structure_resume')} data-testid={'batch-structure-resume-'+batch.id}>继续结构恢复</Button>}
      {batch.structureRecovery.failed>0&&batch.structureRecovery.state!=='running'&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'structure_retry')} data-testid={'batch-structure-retry-'+batch.id}>重试结构恢复失败项</Button>}
      {(batch.structureAvailable??0)>batch.structureRecovery.total&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'structure_start')} data-testid={'batch-structure-add-'+batch.id}>恢复新增 {(batch.structureAvailable??0)-batch.structureRecovery.total} 份资料结构</Button>}
      {(batch.structureRecovery.failed>0||batch.structureRecovery.partial>0)&&<Button size="sm" variant="ghost" onPress={()=>{setExpanded(batch.id);setFileOffset(0);setFileFilter('issues');setFiles(undefined);}} data-testid={'batch-structure-issues-'+batch.id}>查看待核对文件</Button>}
     </>:<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'structure_start')} data-testid={'batch-structure-start-'+batch.id}>恢复本批文档结构</Button>}
    </div>
    {batch.structureRecovery?<>
     <p className="teacher-library-caption" data-testid={'batch-structure-counts-'+batch.id}>共 {batch.structureRecovery.total} 份 · 等待 {batch.structureRecovery.pending} · 处理中 {batch.structureRecovery.running} · 完整 {batch.structureRecovery.complete} · 部分完成 {batch.structureRecovery.partial} · 失败 {batch.structureRecovery.failed}</p>
     {batch.structureRecovery.failed>0&&<p role="alert">{batch.structureRecovery.failed} 份结构恢复失败，可重试失败项；其余资料保留各自处理状态。</p>}
     {batch.structureRecovery.partial>0&&<p className="teacher-library-caption">部分完成的资料仍有结构疑点，请打开资料查看并核对。</p>}
    </>:<p className="teacher-library-caption">本批有 {batch.structureAvailable} 份支持结构恢复的不同资料。在本机恢复段落与试题结构，进度可续办；题目完整性与答案仍需核对。</p>}
   </div>}
   {batch.phase!=='preview'&&<MaterialFolderAiPanel batchId={batch.id} open={open}/>}
   {expanded===batch.id&&<div data-testid="batch-file-list">
    <div className="teacher-library-toolbar"><Button size="sm" variant="ghost" aria-pressed={fileFilter==='all'} onPress={()=>{setFileFilter('all');setFileOffset(0);setFiles(undefined);}} data-testid="batch-files-all">全部文件</Button><Button size="sm" variant="ghost" aria-pressed={fileFilter==='issues'} onPress={()=>{setFileFilter('issues');setFileOffset(0);setFiles(undefined);}} data-testid="batch-files-issues">只看待处理</Button></div>
    {!files?<p role="status">正在读取文件…</p>:!files.total?<p role="status">{fileFilter==='issues'?'当前没有待处理文件。':'还没有发现文件。'}</p>:<>
    <ul>{files.files.map(file=><li key={file.relativePath} className="material-batch-file" data-testid="batch-file" data-path={file.relativePath}>
     <span>{file.relativePath||'导入目录'}</span>
     <span>{{pending:'等待归档',saved:'已归档',failed:'未完成',skipped:'已跳过'}[file.status]}{file.contentState?` · ${contentLabels[file.contentState]}`:''}</span>
     {(file.error||file.contentError)&&<span role={file.status==='failed'||file.contentState==='failed'?'alert':undefined}>{file.error||file.contentError}</span>}
     {file.structureStatus&&<span role={file.structureStatus==='failed'?'alert':undefined} data-testid="batch-file-structure-status">{structureFileLabels[file.structureStatus]}{file.structureError?` · ${file.structureError}`:''}</span>}
     {(file.structureStatus==='failed'||file.structureStatus==='partial')&&<span>打开资料查看结构与原件，核对待处理原因。</span>}
     {file.retryable&&<Button size="sm" variant="secondary" isDisabled={!!pending} onPress={()=>void action(batch.id,'retry',file.relativePath)} data-testid="batch-file-retry">{file.status==='saved'?'重试本地解析':'重试此项归档'}</Button>}
     {file.resourceId&&file.contentState!=='unavailable'&&<Button size="sm" variant="ghost" onPress={()=>open(file.resourceId)}>{file.structureStatus==='failed'||file.structureStatus==='partial'?'打开资料核对结构':'打开资料'}</Button>}
    </li>)}</ul>
    <div className="teacher-library-toolbar"><Button size="sm" variant="ghost" isDisabled={!fileOffset} onPress={()=>{setFiles(undefined);setFileOffset(v=>Math.max(0,v-20));}}>前20个文件</Button><span>共 {files.total} 个{fileFilter==='issues'?'待处理项':'文件'}</span><Button size="sm" variant="ghost" isDisabled={!files.hasMore} onPress={()=>{setFiles(undefined);setFileOffset(v=>v+20);}}>后20个文件</Button></div>
   </>}</div>}
  </article>)}
  {!!page&&page.total>10&&<div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!offset} onPress={()=>setOffset(v=>Math.max(0,v-10))}>较新批次</Button><span>共 {page.total} 批</span><Button variant="ghost" isDisabled={!page.hasMore} onPress={()=>setOffset(v=>v+10)}>较早批次</Button></div>}
 </section>;
}
