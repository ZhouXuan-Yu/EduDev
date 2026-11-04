import {MaterialBookMatches} from './MaterialBookMatches';
import {MaterialSourceReadings} from './MaterialSourceReadings';
import {useEffect,useState} from 'react';
import {MATERIAL_AI_PAGE,MATERIAL_IMAGE_SOURCE,type AiPageView} from '../../../shared/material-ai-page';
import {MaterialBookAnswers} from './MaterialBookAnswers';
import {MaterialOriginalPreview} from './MaterialOriginalPreview';
import './material-ai.css';
import type {AiTextSource} from '../../../shared/material-ai-text';
import {DisclosureCard} from '../ui/DisclosureCard';
export function MaterialAiPagePanel({batchId,ordinal=1,units,start=1,reference,initiallyOpen=false,bookRevision,questionId,onDraftDirty}:{batchId:string;ordinal?:number;units?:{ordinal:number;pageSource?:boolean}[];start?:number;reference?:AiTextSource;initiallyOpen?:boolean;bookRevision?:number;questionId?:string;onDraftDirty?:(dirty:boolean)=>void}){
 const [draftDirty,setDraftDirty]=useState(false);
 useEffect(()=>{onDraftDirty?.(draftDirty);},[draftDirty,onDraftDirty]);
 const choices=units?.filter(u=>u.pageSource).map(u=>u.ordinal)||[ordinal];
 const referenceKey=reference?JSON.stringify(reference):'';
 const [open,setOpen]=useState(initiallyOpen),[selected,setSelected]=useState(ordinal),[view,setView]=useState<AiPageView>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[imageOpen,setImageOpen]=useState(false);
 const [questionBookRevision,setQuestionBookRevision]=useState(0),[bookError,setBookError]=useState('');
 useEffect(()=>{setSelected(choices.includes(ordinal)?ordinal:choices[0]||ordinal);setOpen(initiallyOpen);},[batchId,ordinal,referenceKey,initiallyOpen]);
 useEffect(()=>{setSelected(current=>choices.includes(current)?current:choices[0]||ordinal);},[choices.join(','),ordinal]);
 useEffect(()=>{
  if(!open)return;let current=true;setBusy(true);setView(undefined);setError('');setImageOpen(false);setQuestionBookRevision(0);setBookError('');
  const reading=reference?window.omniEdu!.getMaterialSource(reference).then(r=>{if(!r.restored)throw Error('source_changed');return r.restored;}):window.omniEdu!.getMaterialAiPage({schemaVersion:MATERIAL_AI_PAGE,batchId,ordinal:selected});
  void reading.then(async r=>{
   if(r.source.schemaVersion===MATERIAL_IMAGE_SOURCE){
    const pictured=await window.omniEdu!.getMaterialAiPage({schemaVersion:MATERIAL_AI_PAGE,batchId,ordinal:selected,includeImage:true});
    if(JSON.stringify(pictured.source)!==JSON.stringify(r.source)||pictured.text!==r.text)throw Error('source_changed');r=pictured;
   }
   if(current)setView(r);
   if(questionId&&!bookRevision){
    try{const pair=await window.omniEdu!.getMaterialBookPair(r.source.resourceId);if(current&&pair.current&&pair.role?.kind==='questions'&&pair.role.questionVersion===r.source.version)setQuestionBookRevision(pair.revision);}
    catch{if(current)setBookError('独立答案册关联读取未完成，可重新核对原页后重试。');}
   }
  }).catch(()=>{if(current)setError('还原结果尚未完成，或原件、识别回执及隐私状态已变化。请刷新状态后重试。');}).finally(()=>{if(current)setBusy(false);});return()=>{current=false;};
 },[open,batchId,selected,revision,referenceKey,questionId,bookRevision]);
 if(!choices.length)return null;
 return <section className="material-ai-page" data-testid="material-ai-page-panel">
  <button className="secondary-action" data-testid="material-ai-page-open" disabled={draftDirty} onClick={()=>setOpen(v=>!v)}>{open?'收起还原正文':'查看原页与AI还原正文'}</button>
  {draftDirty&&<p role="note" data-testid="material-ai-page-unsaved">原页有临时校对文字。切换还原项、重新核对或收起前，请先复制所需文字，再清除选择和暂存文字；切换资料分区会保留。</p>}
  {open&&<div>
   {choices.length>1&&<label>查看项目<select data-testid="material-ai-page-select" value={selected} disabled={draftDirty} onChange={e=>{if(!draftDirty)setSelected(Number(e.target.value));}}>{choices.map(n=><option key={n} value={n}>第{start+n-1}项</option>)}</select></label>}
   {busy&&<p role="status">正在核对原页来源及两遍回执…</p>}{error&&<p role="alert" data-testid="material-ai-page-error">{error}</p>}
   {!busy&&<button className="secondary-action" data-testid="material-ai-page-refresh" disabled={draftDirty} onClick={()=>{if(!draftDirty)setRevision(n=>n+1);}}>重新核对</button>}
   {view&&<>
    <p data-testid="material-ai-page-status">原件第{view.source.page}页 · {view.bookAnswers?(view.bookAnswers.pageUncertain?'答案整页转录仍有疑点':view.status==='needs_review'?'答案按条目核对，局部待核项已保留':'AI答案转录，未经教师逐字核验'):view.status==='needs_review'?(view.transcriptionStatus==='complete'?'正文可检索，题目仍需核对':'正文和题目仍需核对'):view.status==='blank'?'AI两遍判断为空白，可回看原页核对':'AI整页转录，未经教师逐字核验'}</p>
    {view.status==='needs_review'&&view.transcriptionStatus==='complete'&&<p data-testid="material-ai-page-transcription-status">正文双遍转录一致，可检索；本页题目仍有待核项，未经教师逐字核验。</p>}
    {view.continuation&&<p role="note" data-testid="material-ai-page-continuation">已合并第{view.continuation.source.page}页的续题区域；完整题目仍须通过来源与质量核对。可在原件预览中切换到该页查看。</p>}
    <MaterialOriginalPreview key={`${batchId}:${selected}:${revision}`} onDraftDirty={setDraftDirty} resource={view.resource} initialPage={view.source.page} busy={busy}/>
    {view.inputImage&&<div>
     <button className="secondary-action" data-testid="material-ai-page-image-open" onClick={()=>setImageOpen(v=>!v)}>{imageOpen?'收起核对图':'查看AI核对输入图'}</button>
     {imageOpen&&<><p>这是两遍AI实际核对的输入图，可能经过缩放；完整原件保留在本机资料库。</p><img src={view.inputImage.dataUrl} alt="两遍AI核对的资料图片" style={{maxWidth:'100%',height:'auto'}} data-testid="material-ai-page-image"/></>}
    </div>}
    {view.sourceReadings&&<MaterialSourceReadings readings={view.sourceReadings}/>}
    {bookError&&<p role="alert">{bookError}</p>}
    {!!(bookRevision||questionBookRevision)&&<MaterialBookMatches key={`${batchId}:${selected}:${bookRevision||questionBookRevision}:${questionId||''}`} batchId={batchId} ordinal={selected} revision={bookRevision||questionBookRevision} questionId={questionId}/>}
    {view.bookAnswers&&<MaterialBookAnswers page={view.bookAnswers}/>}
    <DisclosureCard title="本地识别对照文字" headingLevel={4} data-testid="material-ai-ocr-reference"><pre className="material-ai-page-text" data-testid="material-ai-page-ocr">{view.ocrText||'本地识别未获得文字；这不代表原页为空白。'}{view.continuation&&`\n\n第${view.continuation.source.page}页续题区域：\n${view.continuation.ocrText}`}</pre></DisclosureCard>
    <p>AI还原正文 · 补充推导的答案保留在题本，不写成原资料正文。</p><pre className="material-ai-page-text" data-testid="material-ai-page-text">{view.text||'本次原图两遍复核未转录出文字。'}</pre>
   </>}
  </div>}
 </section>;
}
