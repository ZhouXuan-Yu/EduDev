import {useEffect,useRef,useState} from 'react';
import type {ExerciseSet} from '../../../shared/contracts';
import {PRACTICE_REVIEW_SCHEMA,PRACTICE_REVIEW_ERRORS} from '../../../shared/practice-review';
import {PRACTICE_RESULT_SCHEMA,validPracticeResult,type PracticeResultInput,type SavedPracticeResult} from '../../../shared/practice-result';
import {PracticeSourceButton} from '../office/PiPracticeReview';

const outcomes={correct:'正确',incorrect:'错误',partial:'部分正确'};
export function PracticeResultDetails({value,studentId}:{value:SavedPracticeResult;studentId:string}){
 return <section className="student-practice-details" data-testid="training-practice-saved"><strong>{value.title}</strong>{value.score&&<p data-testid="training-practice-saved-score">教师记录分数：{value.score.earned} / {value.score.max}</p>}<div className="student-practice-items">{value.answers.map(a=><article key={a.index}><strong>第 {a.index+1} 题 · {outcomes[a.result]}</strong><p>实际作答：{a.answer||'未作答'}</p><p>教师反馈：{a.feedback||'未填写反馈'}</p></article>)}</div><PracticeSourceButton source={{schemaVersion:PRACTICE_REVIEW_SCHEMA,studentId,exerciseId:value.exerciseId}}/></section>;
}
/** Reuses confirmed practice readback, never generates an answer or a score. */
export function StudentPracticeResult({studentId,topic,disabled,onChange}:{studentId:string;topic:{name:string;subject:string};disabled:boolean;onChange:(value?:PracticeResultInput,error?:string)=>void}){
 const [choices,setChoices]=useState<ExerciseSet[]>([]),[selected,setSelected]=useState(''),[exercise,setExercise]=useState<ExerciseSet>(),[version,setVersion]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [answers,setAnswers]=useState<{index:number;answer:string;result:string;feedback:string}[]>([]),[scored,setScored]=useState(false),[earned,setEarned]=useState(''),[maximum,setMaximum]=useState('');
 const generation=useRef(0);
 useEffect(()=>{
  const stamp=++generation.current;setLoading(true);setError('');
  void window.omniEdu?.listExerciseSets(studentId).then(list=>{if(stamp===generation.current)setChoices(list.filter(e=>e.reviewSource&&e.subject.trim()===topic.subject.trim()&&e.knowledgePoint.trim()===topic.name.trim()));}).catch(()=>{if(stamp===generation.current)setError('已确认练习未读取，请关闭表单后重试。');}).finally(()=>{if(stamp===generation.current)setLoading(false);});
  return()=>{generation.current++;};
 },[studentId,topic.name,topic.subject]);
 useEffect(()=>{
  if(!selected){onChange(undefined);return;}
  if(loading||!exercise||!version){onChange(undefined,error||'请等待练习来源读取。');return;}
  const value={schemaVersion:PRACTICE_RESULT_SCHEMA,exerciseId:exercise.id,version,answers,...(scored?{score:{earned:earned.trim()?Number(earned):NaN,max:maximum.trim()?Number(maximum):NaN}}:{})};
  if(!validPracticeResult(value)){onChange(undefined,'请逐题选择实际表现，并核对填写的分数。');return;}onChange(value);
 },[selected,loading,exercise,version,answers,scored,earned,maximum,error,onChange]);
 async function choose(id:string){
  const stamp=++generation.current;setSelected(id);setExercise(undefined);setVersion('');setAnswers([]);setError('');setScored(false);setEarned('');setMaximum('');
  onChange(undefined,id?'请等待练习来源读取。':undefined);if(!id){setLoading(false);return;}setLoading(true);
  try{const response=await window.omniEdu?.readPracticeSource({schemaVersion:PRACTICE_REVIEW_SCHEMA,studentId,exerciseId:id});if(stamp!==generation.current)return;if(!response?.ok){setError(response?PRACTICE_REVIEW_ERRORS[response.error]:'练习来源未读取，请重试。');return;}const saved=response.value;if(saved.state!=='confirmed'||!saved.exercise||!saved.exerciseVersion)throw new Error();setExercise(saved.exercise);setVersion(saved.exerciseVersion);setAnswers(saved.exercise.items.map((_,index)=>({index,answer:'',result:'',feedback:''})));}
  catch{if(stamp===generation.current)setError('练习来源未读取，请重新选择后重试。');}finally{if(stamp===generation.current)setLoading(false);}
 }
 function update(index:number,patch:Partial<typeof answers[number]>){setAnswers(items=>items.map(a=>a.index===index?{...a,...patch}:a));}
 return <section className="student-practice-form" data-testid="training-practice-form"><h3>关联本次实际练习</h3><p>只列出当前学生、同科目和知识点的已确认练习。逐题选择实际表现；未作答可留空，分数可不填。</p><label>已确认练习<select data-testid="training-practice-select" value={selected} disabled={disabled||loading} onChange={e=>void choose(e.target.value)}><option value="">本次不关联练习</option>{choices.map(e=><option key={e.id} value={e.id}>{e.title} · {e.items.length} 题</option>)}</select></label>{loading&&<p role="status">正在读取已确认练习…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!choices.length&&<p>当前知识点没有已确认练习；可以先记录整体表现。</p>}
  {exercise&&!loading&&<><div className="student-practice-items">{exercise.items.map((q,index)=><article key={index} data-testid="training-practice-question"><strong>第 {index+1} 题</strong><p>{q.stem}</p><details><summary>查看参考答案与解析</summary><p>{q.answer}</p><p>{q.analysis}</p></details><div className="student-training-fields"><label>实际作答<textarea data-testid={`training-practice-answer-${index}`} maxLength={4000} value={answers[index]?.answer||''} onChange={e=>update(index,{answer:e.target.value})}/></label><label>实际表现<select data-testid={`training-practice-outcome-${index}`} value={answers[index]?.result||''} onChange={e=>update(index,{result:e.target.value})}><option value="">请选择实际表现</option>{Object.entries(outcomes).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>教师反馈<textarea data-testid={`training-practice-feedback-${index}`} maxLength={1000} value={answers[index]?.feedback||''} onChange={e=>update(index,{feedback:e.target.value})}/></label></div></article>)}</div><label className="student-training-historical checkbox-label"><input type="checkbox" data-testid="training-practice-score-toggle" checked={scored} onChange={e=>setScored(e.target.checked)}/>记录本次实际分数</label>{scored&&<div className="student-training-fields"><label>实际得分<input data-testid="training-practice-score-earned" type="number" min="0" step="any" value={earned} onChange={e=>setEarned(e.target.value)}/></label><label>满分<input data-testid="training-practice-score-max" type="number" min="0" step="any" value={maximum} onChange={e=>setMaximum(e.target.value)}/></label></div>}</>}
 </section>;
}
