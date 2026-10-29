import {useEffect,useState} from 'react';
import {MATERIAL_AI_PAGE,type AiPageView} from '../../../shared/material-ai-page';
import {MaterialOriginalPreview} from './MaterialOriginalPreview';
import './material-ai.css';
export function MaterialAiPagePanel({batchId,ordinal=1,units,start=1}:{batchId:string;ordinal?:number;units?:{ordinal:number;pageSource?:boolean}[];start?:number}){
 const choices=units?.filter(u=>u.pageSource).map(u=>u.ordinal)||[ordinal];
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(ordinal),[view,setView]=useState<AiPageView>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{setSelected(choices.includes(ordinal)?ordinal:choices[0]||ordinal);setOpen(false);},[batchId,ordinal]);
 useEffect(()=>{setSelected(current=>choices.includes(current)?current:choices[0]||ordinal);},[choices.join(','),ordinal]);
 useEffect(()=>{
  if(!open)return;let current=true;setBusy(true);setView(undefined);setError('');
  void window.omniEdu!.getMaterialAiPage({schemaVersion:MATERIAL_AI_PAGE,batchId,ordinal:selected}).then(r=>{if(current)setView(r);}).catch(()=>{if(current)setError('还原结果尚未完成，或原件、识别回执及隐私状态已变化。请刷新状态后重试。');}).finally(()=>{if(current)setBusy(false);});return()=>{current=false;};
 },[open,batchId,selected,revision]);
 if(!choices.length)return null;
 return <section className="material-ai-page" data-testid="material-ai-page-panel">
  <button className="secondary-action" data-testid="material-ai-page-open" onClick={()=>setOpen(v=>!v)}>{open?'收起还原正文':'查看原页与AI还原正文'}</button>
  {open&&<div>
   {choices.length>1&&<label>查看项目<select data-testid="material-ai-page-select" value={selected} onChange={e=>setSelected(Number(e.target.value))}>{choices.map(n=><option key={n} value={n}>第{start+n-1}项</option>)}</select></label>}
   {busy&&<p role="status">正在核对原页来源及两遍回执…</p>}{error&&<p role="alert" data-testid="material-ai-page-error">{error}</p>}
   {!busy&&<button className="secondary-action" data-testid="material-ai-page-refresh" onClick={()=>setRevision(n=>n+1)}>重新核对</button>}
   {view&&<>
    <p data-testid="material-ai-page-status">原件第{view.source.page}页 · {view.status==='needs_review'?'整页内容仍需核对':view.status==='blank'?'AI两遍判断为空白，可回看原页核对':'AI整页转录，未经教师逐字核验'}</p>
    <MaterialOriginalPreview key={`${batchId}:${selected}:${revision}`} resource={view.resource} initialPage={view.source.page} busy={busy}/>
    <details><summary>本地识别对照文字</summary><pre className="material-ai-page-text" data-testid="material-ai-page-ocr">{view.ocrText||'本地识别未获得文字；这不代表原页为空白。'}</pre></details>
    <p>AI还原正文 · 补充推导的答案保留在题本，不写成原资料正文。</p><pre className="material-ai-page-text" data-testid="material-ai-page-text">{view.text||'本次原图两遍复核未转录出文字。'}</pre>
   </>}
  </div>}
 </section>;
}
