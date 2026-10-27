import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {TeacherResource} from '../../../shared/contracts';
import type {WordQuestionSource,WordQuestionRole} from '../../../shared/material-word-question';
import {WORD_PROOF_SCHEMA,type WordProof,type WordProofImage,type WordProofBase} from '../../../shared/material-word-proof';

const roles:Record<WordQuestionRole,string>={question:'题面',answer:'答案',analysis:'解析'};
const errors:Record<string,string>={busy:'本机正在生成其他图稿，请稍后重试。',source_changed:'原文来源已变化，请刷新或重新整理 Word 后再生成。',source_incomplete:'原文有缺失图片、公式或合并表格内容，请对照原文件核对。',too_large:'这道题的图文过长或过宽，需要拆分后再处理。',font_unavailable:'本机中文或数学字体暂不可用，无法完整生成图稿。',font_missing_glyph:'原文有本机字体无法显示的字符，请先核对原文件。',disk_full:'保存图稿的磁盘空间不足，请清理空间后重试。',timeout:'本机生成图稿超时，可重试或拆分较长题目。'};
function errorText(error:unknown){const text=error instanceof Error?error.message:'';return Object.entries(errors).find(([code])=>text.includes(code))?.[1]||'图稿暂不可读取，请重试。';}

/** Local source proof only. A rendered preview never changes AI/teacher confirmation or paper eligibility. */
export function MaterialWordProof({resource,source,role,disabled=false}:{resource:TeacherResource;source:WordQuestionSource;role:WordQuestionRole;disabled?:boolean}){
 const [proof,setProof]=useState<WordProof>(),[picture,setPicture]=useState<{key:string;value:WordProofImage}>(),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[stopping,setStopping]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const request=useRef(''),mounted=useRef(true),base:WordProofBase={schemaVersion:WORD_PROOF_SCHEMA,resourceId:resource.id,version:resource.contentHash,ordinal:source.ordinal,documentSha:source.documentSha};
 const pages=proof?.pages.filter(p=>p.role===role)||[],identity=proof?proof.proofId+':'+role+':'+page:'',visible=picture?.key===identity?picture.value:undefined;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const id=request.current;if(id)void window.omniEdu?.cancelMaterialWordProof({schemaVersion:WORD_PROOF_SCHEMA,requestId:id}).catch(()=>{});};},[]);
 useEffect(()=>{setPage(0);setPicture(undefined);const id=request.current;if(id){setStopping(true);void window.omniEdu?.cancelMaterialWordProof({schemaVersion:WORD_PROOF_SCHEMA,requestId:id}).catch(()=>{});}},[role]);
 useEffect(()=>{
  let active=true;setPicture(undefined);setError('');if(!proof){setLoading(false);return;}
  if(!pages.length){setLoading(false);return;}setLoading(true);
  void window.omniEdu?.getMaterialWordProofImage({...base,proofId:proof.proofId,role,index:page}).then(result=>{if(active&&result)setPicture({key:identity,value:result});}).catch(e=>{if(active)setError(errorText(e));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[proof?.proofId,role,page,retry,resource.id,resource.contentHash,source.documentSha,source.ordinal]);
 async function start(){
  const id='wqproof_'+crypto.randomUUID();request.current=id;setBusy(true);setStopping(false);setProof(undefined);setPicture(undefined);setError('');setMessage('正在本机生成完整图文稿…');
  try{const result=await window.omniEdu?.createMaterialWordProof({...base,requestId:id});if(!result)throw Error('unavailable');if(mounted.current&&request.current===id){setProof(result);setPage(0);setMessage('本机图文稿已生成。');}}
  catch(e){if(mounted.current&&request.current===id){if(e instanceof Error&&e.message.includes('cancelled'))setMessage('已停止生成图文稿。');else{setError(errorText(e));setMessage('图文稿生成失败。');}}}
  finally{if(request.current===id){request.current='';if(mounted.current){setBusy(false);setStopping(false);}}}
 }
 async function cancel(){const id=request.current;if(!id)return;setStopping(true);setMessage('正在停止图文稿生成…');try{await window.omniEdu?.cancelMaterialWordProof({schemaVersion:WORD_PROOF_SCHEMA,requestId:id});}catch{if(mounted.current)setError('停止请求未送达，生成结束前仍可重试。');setStopping(false);}}
 return <section className="material-word-proof" data-testid="word-proof" aria-label="本机图文稿">
  <div className="teacher-library-toolbar"><Button variant="secondary" isDisabled={disabled||busy} isPending={busy} onPress={()=>void start()} data-testid="word-proof-start">{proof?'重新生成图文稿':'生成图文稿'}</Button>{busy&&<Button variant="secondary" isDisabled={stopping} onPress={()=>void cancel()} data-testid="word-proof-cancel">{stopping?'正在停止…':'停止生成'}</Button>}</div>
  <p>将当前原文的公式、图片和表格排成完整图稿，便于后续识别与核对。</p>
  {message&&<p role="status" data-testid="word-proof-status">{message}</p>}
  {error&&<p role="alert">{error}{proof&&<Button variant="secondary" onPress={()=>setRetry(v=>v+1)}>重试读取图稿</Button>}</p>}
  {proof&&<>
   <p data-testid="word-proof-summary">当前查看{roles[role]}，共 {pages.length} 片。{source.issues.length?'原文仍有待核对项，请对照上方来源提示。':''}</p>
   {loading?<p role="status">正在读取{roles[role]}图稿…</p>:visible?<img src={visible.dataUrl} alt={'第 '+source.number+' 题 · '+roles[role]+' · 第 '+(page+1)+' 片'} data-testid="word-proof-image"/>:!pages.length?<p>原文没有明确的{roles[role]}图文，后续整理时需要补齐。</p>:null}
   {pages.length>1&&<div className="teacher-library-toolbar"><Button variant="secondary" isDisabled={!page||loading} onPress={()=>setPage(v=>v-1)} data-testid="word-proof-previous">前一片</Button><span>第 {page+1} / {pages.length} 片</span><Button variant="secondary" isDisabled={page+1>=pages.length||loading} onPress={()=>setPage(v=>v+1)} data-testid="word-proof-next">后一片</Button></div>}
  </>}
 </section>;
}
