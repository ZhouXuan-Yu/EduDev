import {useEffect,useState} from 'react';
import {Button,Modal} from '@heroui/react';
import {MATERIAL_IMPORT_SCHEMA as schema,MATERIAL_SELECTION_LIMIT,type MaterialBatchFiles} from '../../../shared/material-import-batch';
import {libraryFileSize} from './material-library';
import styles from '../../ui-system/material-library/material-import-selection.module.css';

export function MaterialImportSelection({batchId,close,finish}:{
 batchId:string;close:()=>void;finish:(canceled:boolean)=>void;
}){
 const [page,setPage]=useState<MaterialBatchFiles>(),[offset,setOffset]=useState(0);
 const [all,setAll]=useState(true),[exceptions,setExceptions]=useState(new Set<string>());
 const [busy,setBusy]=useState(false),[loadError,setLoadError]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  let current=true,loading=false;
  async function refresh(){
   if(loading)return;
   loading=true;
   try{
    const result=await window.omniEdu!.getMaterialBatchFiles({schemaVersion:schema,batchId,offset,filter:'selectable'});
    if(current){setPage(result);setLoadError('');}
   }catch{if(current)setLoadError('暂时无法读取文件列表，正在重试。');}
   finally{loading=false;}
  }
  void refresh();
  const timer=setInterval(()=>void refresh(),1000);
  return()=>{current=false;clearInterval(timer);};
 },[batchId,offset]);
 const selection=page?.selection,ready=selection?.status==='selecting';
 const chosen=all?Math.max(0,(page?.total||0)-exceptions.size):exceptions.size;
 function chooseAll(value:boolean){setAll(value);setExceptions(new Set());}
 function toggle(relativePath:string){
  setExceptions(previous=>{
   const next=new Set(previous);
   if(next.has(relativePath))next.delete(relativePath);else if(next.size<MATERIAL_SELECTION_LIMIT)next.add(relativePath);
   return next;
  });
 }
 async function submit(cancel:boolean){
  if(busy||!ready)return;
  setBusy(true);setError('');
  try{
   const base={schemaVersion:schema,batchId};
   await window.omniEdu!.selectMaterialBatch(cancel?{...base,mode:'cancel'}:{...base,mode:all?'all_except':'only',paths:[...exceptions]});
   finish(cancel);
  }catch(e){
   setError(String(e).includes('invalid_root')?'源文件夹已移动或不可读取，请恢复后重试。':'文件列表或批次状态已变化，请核对后重试。');
  }finally{setBusy(false);}
 }
 return <Modal.Backdrop isOpen onOpenChange={open=>{if(!open&&!busy)close();}}>
  <Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-themed-surface" data-testid="material-import-selection">
   <Modal.Header><Modal.Heading>选择要导入的资料</Modal.Heading></Modal.Header>
   <Modal.Body>
    {selection&&<p className="teacher-library-caption">{selection.name} · 包含子文件夹，只列出可导入格式。</p>}
    {loadError&&<p role="alert">{loadError}</p>}{error&&<p role="alert">{error}</p>}
    {!page||selection?.status==='queued'||selection?.status==='running'?<p role="status">正在本机查找文件…</p>:null}
    {selection?.status==='paused'&&<p role="status">文件发现已暂停，可从处理队列继续。</p>}
    {selection?.status==='failed'&&<p role="alert">{selection.error||'文件发现未完成。'} 可从处理队列继续。</p>}
    {page&&!selection&&<p role="status">此批次已经结束或已提交，请查看处理队列。</p>}
    {ready&&page&&<>
     {page.total?<>
      <div className="teacher-library-toolbar">
       <Button size="sm" variant="secondary" onPress={()=>chooseAll(true)} isDisabled={busy}>全选所有文件</Button>
       <Button size="sm" variant="ghost" onPress={()=>chooseAll(false)} isDisabled={busy}>清空选择</Button>
       <span role="status">已选 {chosen} / {page.total} 个文件</span>
      </div>
      {exceptions.size===MATERIAL_SELECTION_LIMIT&&<p role="status">已达到本次单独勾选的上限，可用全选或清空重新选择。</p>}
      <ul className={styles.choices} aria-label="待导入文件">{page.offset===offset&&page.files.map(file=><li key={file.relativePath}>
       <label title={file.relativePath}>
        <input type="checkbox" checked={all!==exceptions.has(file.relativePath)} disabled={busy} onChange={()=>toggle(file.relativePath)}/>
        <span>{file.relativePath}</span><small>{libraryFileSize(file.bytes)}</small>
       </label>
      </li>)}</ul>
     </>:<p role="status">这个文件夹没有可导入的文件。</p>}
    </>}
   </Modal.Body>
   <Modal.Footer><div className={styles.footer}>
    {ready&&page&&page.total>20&&<nav className={styles.toolbar} aria-label="待导入文件翻页">
       <Button size="sm" variant="ghost" isDisabled={busy||!offset||page.offset!==offset} onPress={()=>setOffset(offset-20)}>上一页</Button>
       <span>第 {Math.floor(offset/20)+1} / {Math.ceil(page.total/20)} 页</span>
       <Button size="sm" variant="ghost" isDisabled={busy||!page.hasMore||page.offset!==offset} onPress={()=>setOffset(offset+20)}>下一页</Button>
    </nav>}
    <div className={styles.toolbar}>
     {ready&&<Button variant="ghost" isDisabled={busy} onPress={()=>void submit(true)}>放弃本批</Button>}
     <Button variant="secondary" isDisabled={busy} onPress={close}>{ready?'稍后选择':'关闭'}</Button>
     <Button isDisabled={busy||!ready||!chosen||!!loadError} onPress={()=>void submit(false)}>导入 {chosen} 个文件</Button>
    </div>
   </div></Modal.Footer>
  </Modal.Dialog></Modal.Container>
 </Modal.Backdrop>;
}
