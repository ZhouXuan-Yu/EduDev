import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {History,FolderOpen,ExternalLink} from 'lucide-react';
import {OFFICE_VERSIONS_SCHEMA,OFFICE_VERSION_ERRORS,type OfficeVersionView,type OfficeVersionInput} from '../../../shared/xiaozhi-office-versions';
import './pi-office-versions.css';
import {ScienceDemoFrame} from './ScienceDemoFrame';

/** Resolve on click, so old chat cards never silently open an obsolete default. */
export function PiOfficeCurrent({sessionId,artifactId,fallbackPath,onOpen,action='preview',label='打开当前文件',testId='pi-office-open',disabled=false}:{sessionId:string;artifactId:string;fallbackPath:string;onOpen:(path:string)=>void;action?:'preview'|'open'|'locate';label?:string;testId?:string;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const lock=useRef(false),identity=`${sessionId}:${artifactId}`,current=useRef(identity);current.current=identity;
 async function open(){if(lock.current||disabled)return;const start=identity;lock.current=true;setBusy(true);setError('');setNotice('');
  try{
   const call=(id:string,op:'view'|'open'|'locate')=>window.omniEdu?.officeVersion({schemaVersion:OFFICE_VERSIONS_SCHEMA,sessionId,artifactId:id,action:op});
   let result=await call(artifactId,'view');if(current.current!==start)return;
   // Confirmed paper/classroom exports keep their original domain-owned preview.
   if(result&&!result.ok&&result.error==='unsupported'&&action==='preview'&&artifactId.startsWith('artifact_')){onOpen(fallbackPath);return;}
   if(!result?.ok)throw Error(result&&!result.ok?result.error:'configuration');
   const id=result.value.currentArtifactId;
   result=await call(id,action==='preview'?'view':action);if(current.current!==start)return;
   if(!result?.ok)throw Error(result&&!result.ok?result.error:'configuration');
   if(result.value.sessionId!==sessionId||result.value.selectedArtifactId!==id||result.value.currentArtifactId!==id)throw Error('conflict');
   if(result.value.integrity!=='same')throw Error(result.value.integrity);
   const selected=result.value.versions.find(v=>v.artifactId===id);if(!selected)throw Error('configuration');
   if(action==='preview')onOpen(selected.path);else setNotice(action==='open'?'已交给系统打开当前文件。':'已在文件夹中定位当前文件。');
  }catch(raw){if(current.current===start)setError(OFFICE_VERSION_ERRORS[(raw instanceof Error?raw.message:'configuration') as keyof typeof OFFICE_VERSION_ERRORS]||OFFICE_VERSION_ERRORS.configuration);}
  finally{lock.current=false;if(current.current===start)setBusy(false);}
 }
 useEffect(()=>{current.current=identity;setBusy(false);setError('');setNotice('');return()=>{current.current='';};},[identity]);
 return <span><Button size="sm" variant="ghost" isDisabled={busy||disabled} onPress={()=>void open()} data-testid={testId}>{busy?'正在核对当前版本…':label}</Button>{error&&<span role="alert" data-testid={testId+'-error'}>{error}</span>}{notice&&<span role="status">{notice}</span>}</span>;
}

/** Same ledger-backed control in chat and Teaching Files. It runs only after an explicit click. */
export function PiOfficeVersions({sessionId,artifactId,running=false,onOpen,onRefresh}:{sessionId:string;artifactId:string;running?:boolean;onOpen:(path:string)=>void;onRefresh?:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[view,setView]=useState<OfficeVersionView>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState(false);
 const epoch=useRef(0),lock=useRef(false),identity=`${sessionId}:${artifactId}`,current=useRef(identity),command=useRef<{key:string;id:string}|undefined>(undefined);current.current=identity;
 const [preview,setPreview]=useState(false);
 useEffect(()=>{++epoch.current;lock.current=false;setOpen(false);setView(undefined);setBusy(false);setError('');setNotice('');setConfirm(false);command.current=undefined;return()=>{++epoch.current;};},[identity]);
 async function act(action:OfficeVersionInput['action']='view',id=view?.selectedArtifactId??artifactId){
  if(lock.current||action!=='view'&&running)return;
  const stamp=++epoch.current;lock.current=true;setBusy(true);setError('');setNotice('');setConfirm(false);setPreview(false);
  const address={schemaVersion:OFFICE_VERSIONS_SCHEMA,sessionId,artifactId:id};
  let input:OfficeVersionInput;
  if(action==='restore'){
   if(!view?.canRestore){lock.current=false;setBusy(false);return;}
   const key=`${identity}:${id}:${view.currentArtifactId}`;if(command.current?.key!==key)command.current={key,id:`xicmd_${crypto.randomUUID()}`};
   input={...address,action,currentArtifactId:view.currentArtifactId,commandId:command.current.id};
  }else input={...address,action};
  try{
   const result=await window.omniEdu?.officeVersion(input);if(epoch.current!==stamp||current.current!==identity)return;
   if(!result?.ok){setError(result?OFFICE_VERSION_ERRORS[result.error]:'未能读取版本记录，请重试。');return;}
   if(result.value.schemaVersion!==OFFICE_VERSIONS_SCHEMA||result.value.sessionId!==sessionId||!result.value.versions.some(v=>v.artifactId===result.value.selectedArtifactId)){setError('版本记录已变化，请重新读取。');return;}
   setView(result.value);setNotice(action==='restore'?'已恢复为新版本，原有各版仍保留。':action==='open'?'已交给系统打开。':action==='locate'?'已在文件夹中定位。':'');
   if(action==='restore')await onRefresh?.();
  }catch{if(epoch.current===stamp&&current.current===identity)setError('操作结果尚未确认，请刷新历史；已有文件会保留。');}
  finally{if(epoch.current===stamp&&current.current===identity){lock.current=false;setBusy(false);}}
 }
 const selected=view?.versions.find(v=>v.artifactId===view.selectedArtifactId),latest=view?.versions.find(v=>v.artifactId===view.currentArtifactId);
 return <div className="pi-office-versions" data-edu-domain="" data-testid="pi-office-versions" data-artifact-id={artifactId}>
  <Button size="sm" variant="ghost" onPress={()=>{setOpen(v=>!v);if(!open)void act();}} data-testid="office-versions-toggle" aria-expanded={open}><History size={15}/>版本历史</Button>
  {open&&<section aria-label="成果版本历史" className="pi-office-versions-body" data-testid="office-versions-body">
   {busy&&<p role="status">正在核对本地版本…</p>}
   {error&&<p role="alert" data-testid="office-versions-error">{error}</p>}{notice&&<p role="status" data-testid="office-versions-notice">{notice}</p>}
   {view&&<><p data-testid="office-versions-current">当前：第 {latest?.number} 版 · {latest?.path}</p>
    <label>查看版本<select value={view.selectedArtifactId} disabled={busy} onChange={event=>void act('view',event.target.value)} data-testid="office-version-select">{view.versions.map(v=><option key={v.artifactId} value={v.artifactId}>第 {v.number} 版 · {v.path}{v.artifactId===view.currentArtifactId?'（当前）':''}</option>)}</select></label>
    {selected&&<><p>{selected.title} · {selected.format.toUpperCase()} · {new Date(selected.savedAt).toLocaleString()} · {selected.size.toLocaleString()} 字节</p><p data-testid="office-version-change">{selected.change}</p></>}
    <p data-testid="office-version-integrity" data-integrity={view.integrity}>{view.integrity==='same'?(view.historyBacking==='text_ledger'?'历史内容保存在原修改记录中；系统打开历史版会制作查看副本。':'本次核对：文件与保存记录一致；内容质量请查看原检查。'):view.integrity==='missing'?OFFICE_VERSION_ERRORS.missing:OFFICE_VERSION_ERRORS.changed}</p>
    <div className="pi-office-version-actions">
     <Button size="sm" variant="secondary" isDisabled={busy||view.integrity!=='same'} onPress={()=>{if(view.htmlPreview)setPreview(true);else if(selected)onOpen(selected.path);}} data-testid="office-version-preview">预览此版</Button>
     <Button size="sm" variant="ghost" isDisabled={busy||running||view.integrity!=='same'} onPress={()=>void act('open')} data-testid="office-version-open"><ExternalLink size={14}/>系统打开</Button>
     <Button size="sm" variant="ghost" isDisabled={busy||running||view.integrity!=='same'} onPress={()=>void act('locate')} data-testid="office-version-locate"><FolderOpen size={14}/>定位</Button>
     <Button size="sm" variant="ghost" isDisabled={busy||running||!view.canRestore} onPress={()=>setConfirm(true)} data-testid="office-version-restore">恢复此版</Button>
    </div>
    {preview&&view.htmlPreview&&<ScienceDemoFrame html={view.htmlPreview}/>}
    {confirm&&<div role="group" aria-label="确认恢复版本"><p>将第 {selected?.number} 版另存为新的当前版本，所有历史文件都会保留。</p><Button size="sm" variant="secondary" isDisabled={busy||running} onPress={()=>void act('restore')} data-testid="office-version-confirm">确认恢复为新版本</Button><Button size="sm" variant="ghost" onPress={()=>setConfirm(false)}>取消</Button></div>}
   </>}
   <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void act()} data-testid="office-versions-refresh">刷新历史</Button>
  </section>}
 </div>;
}
