import {useRef,useState} from 'react';
import {Button,Checkbox} from '@heroui/react';
import type {QuestionBankItem} from '../../shared/contracts';
import {questionFacts} from '../../shared/question-facts';
import {emptyQuestionProjection,validQuestionProjection} from '../../shared/question-projection';
import {QUESTION_CONTEXT_EDIT_SCHEMA} from '../../shared/question-context-edit';
import {QUESTION_REVIEW_ERRORS} from '../../shared/question-review';
import {QuestionProjectionFields} from './office/QuestionProjectionFields';

/** Teacher-only transcription repair; original approval and answer provenance stay intact. */
export function QuestionContextEditor({question,onSaved}:{question:QuestionBankItem;onSaved:()=>Promise<void>}){
 const initial=()=>question.document?.schemaVersion==='xiaozhi.question-document.v2'?structuredClone(question.document.context.projection):emptyQuestionProjection(question.stem);
 const [open,setOpen]=useState(false),[projection,setProjection]=useState(initial),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false),request=useRef('');
 if(!question.document)return null;
 function reset(){setProjection(initial());setChecked(false);setError('');request.current='';}
 async function save(){
  if(lock.current||!checked||!validQuestionProjection(projection,true))return;
  lock.current=true;setBusy(true);setError('');
  try{
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(questionFacts(question))));
   const version=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   request.current||=`xicontext_${crypto.randomUUID()}`;
   const result=await window.omniEdu?.completeOriginalQuestionContext({schemaVersion:QUESTION_CONTEXT_EDIT_SCHEMA,questionId:question.id,version,requestId:request.current,projection,complete:true});
   if(!result?.ok){setError(result?QUESTION_REVIEW_ERRORS[result.error]:'题面保存未完成，请重试。');return;}
   await onSaved();setOpen(false);
  }catch{setError('题面保存或重新读取未完成，请重试。');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="pi-learning-review question-context-editor" data-testid="question-context-editor">
  {!open?<Button variant="secondary" data-testid="question-context-open" onPress={()=>{reset();setOpen(true);}}>{question.document.schemaVersion==='xiaozhi.question-document.v2'?'修改完整题面':'补全题面供小智读取'}</Button>:<>
   <h4>对照上方原图补全题面</h4><p>保留原图、来源和答案。这里只修订转写；确认转写不代表答案已经验证。取消会放弃本次未保存修改。</p>
   <QuestionProjectionFields value={projection} disabled={busy} onChange={value=>{setProjection(value);setChecked(false);request.current='';setError('');}}/>
   <Checkbox isSelected={checked} isDisabled={busy||!validQuestionProjection(projection,true)} onChange={setChecked} data-testid="question-context-complete"><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control><span>我已逐项对照原图，完整转写或确认本题没有此项</span></Checkbox.Content></Checkbox>
   {error&&<p role="alert" data-testid="question-context-error">{error}</p>}
   {busy&&<p role="status">正在保存并核对原图…</p>}
   <div className="toolbar-row"><Button data-testid="question-context-save" isDisabled={busy||!checked||!validQuestionProjection(projection,true)} onPress={()=>void save()}>确认并保存题面</Button><Button variant="secondary" data-testid="question-context-cancel" isDisabled={busy} onPress={()=>{reset();setOpen(false);}}>取消修改</Button></div>
  </>}
 </section>;
}
