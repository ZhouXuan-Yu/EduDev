import {useEffect,useState} from 'react';
import type {QuestionBankItem} from '../../shared/contracts';
import {questionFacts} from '../../shared/question-facts';
import {NATIVE_IMAGE_SCHEMA} from '../../shared/native-question-image';
import {NATIVE_QUESTION_ROLES,type NativeQuestionRole} from '../../shared/native-question';
const names={question:'题面',answer:'原文答案',analysis:'原文解析'};
export function NativeQuestionPicture({question}:{question:QuestionBankItem}){
 const [open,setOpen]=useState(false),[role,setRole]=useState<NativeQuestionRole>('question'),[index,setIndex]=useState(0),[image,setImage]=useState<{key:string;src:string}>(),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 const facts=JSON.stringify(questionFacts(question)),native=question.archive!.native!,pages=native.roles[role].figures,pictureKey=JSON.stringify([facts,role,index]);
 useEffect(()=>{if(!open)return;let active=true;setImage(undefined);setError('');if(!pages.length){setLoading(false);return;}setLoading(true);
  void crypto.subtle.digest('SHA-256',new TextEncoder().encode(facts)).then(bytes=>window.omniEdu!.getNativeQuestionImage({schemaVersion:NATIVE_IMAGE_SCHEMA,questionId:question.id,version:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''),role,index})).then(value=>{if(active)setImage({key:pictureKey,src:value.dataUrl});}).catch(()=>{if(active)setError('题图暂不可读取，或题目、来源权限已变化。请刷新题本后重试。');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[facts,question.id,open,role,index,retry,pages.length,pictureKey]);
 return <section className="question-original-picture" data-testid="native-question-picture"><p>AI 图文整理 · 图片保留原文角色与来源，答案仍可修正。</p>
  {!open?<button className="secondary-action" data-testid="native-picture-open" onClick={()=>setOpen(true)}>查看按角色题图</button>:<>
   <div className="toolbar-row">{NATIVE_QUESTION_ROLES.map(r=><button key={r} className="secondary-action" data-testid={'native-picture-role-'+r} aria-pressed={role===r} onClick={()=>{setRole(r);setIndex(0);setImage(undefined);}}>{names[r]}（{native.roles[r].figures.length}）</button>)}</div>
   {!pages.length&&<p data-testid="native-picture-no-source">当前{names[role]}使用文字内容，没有获准使用的原文图片。教师或AI改写不会保留旧答案图。</p>}
   {loading&&<p role="status">正在读取已保存题图…</p>}{image?.key===pictureKey&&pages.length>index&&<div className="pi-original-paper" tabIndex={0}><img data-testid="native-picture-image" src={image.src} alt={names[role]+'来源图 '+(index+1)}/></div>}
   {error&&<p role="alert">{error}<button className="secondary-action" data-testid="native-picture-retry" onClick={()=>setRetry(v=>v+1)}>重试读取</button></p>}
   {pages.length>1&&<div className="toolbar-row"><button disabled={!index} onClick={()=>setIndex(i=>i-1)}>上一张</button><span>{index+1}/{pages.length}</span><button disabled={index>=pages.length-1} onClick={()=>setIndex(i=>i+1)}>下一张</button></div>}
  </>}
 </section>;
}
