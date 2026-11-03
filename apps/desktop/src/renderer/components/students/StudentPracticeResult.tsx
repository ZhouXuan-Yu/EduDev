import {Input,TextArea} from '@heroui/react';
import {PaperSelect} from '../paper-ui/PaperSelect';
import styles from '../../ui-system/student-training.module.css';
import {useEffect,useRef,useState} from 'react';
import {DisclosureCard} from '../ui/DisclosureCard';
import type {ExerciseSet} from '../../../shared/contracts';
import {PRACTICE_REVIEW_SCHEMA,PRACTICE_REVIEW_ERRORS} from '../../../shared/practice-review';
import {PRACTICE_RESULT_V2_SCHEMA,PRACTICE_OUTCOMES,practiceCoverage,validPracticeResult,type PracticeResultInput,type SavedPracticeResult} from '../../../shared/practice-result';
import {PracticeSourceButton} from '../office/PiPracticeReview';

const outcomes=PRACTICE_OUTCOMES;
export function PracticeResultDetails({value,studentId}:{value:SavedPracticeResult;studentId:string}){
 return <section className={styles.section} data-testid="training-practice-saved"><strong>{value.title}</strong>{value.schemaVersion===PRACTICE_RESULT_V2_SCHEMA&&<p data-testid="training-practice-coverage">共 {value.answers.length} 题 · 已答 {practiceCoverage(value.answers).answered} 题 · 待补测 {practiceCoverage(value.answers).unanswered} 题；整体表现仅概括已答题。</p>}{value.score&&<p data-testid="training-practice-saved-score">教师记录分数：{value.score.earned} / {value.score.max}</p>}<div className={styles.items}>{value.answers.map(a=><article key={a.index}><strong>第 {a.index+1} 题 · {outcomes[a.result]}</strong><p>实际作答：{a.answer||(a.result==='unanswered'?'未作答':'未记录作答原文')}</p><p>教师反馈：{a.feedback||'未填写反馈'}</p></article>)}</div><PracticeSourceButton source={{schemaVersion:PRACTICE_REVIEW_SCHEMA,studentId,exerciseId:value.exerciseId}}/></section>;
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
  const value={schemaVersion:PRACTICE_RESULT_V2_SCHEMA,exerciseId:exercise.id,version,answers,...(scored?{score:{earned:earned.trim()?Number(earned):NaN,max:maximum.trim()?Number(maximum):NaN}}:{})};
  if(!validPracticeResult(value)){onChange(undefined,'已答题请填写实际作答（口述可简记）；未答请选择未作答并留空，同时核对分数。');return;}onChange(value);
 },[selected,loading,exercise,version,answers,scored,earned,maximum,error,onChange]);
 async function choose(id:string){
  const stamp=++generation.current;setSelected(id);setExercise(undefined);setVersion('');setAnswers([]);setError('');setScored(false);setEarned('');setMaximum('');
  onChange(undefined,id?'请等待练习来源读取。':undefined);if(!id){setLoading(false);return;}setLoading(true);
  try{const response=await window.omniEdu?.readPracticeSource({schemaVersion:PRACTICE_REVIEW_SCHEMA,studentId,exerciseId:id});if(stamp!==generation.current)return;if(!response?.ok){setError(response?PRACTICE_REVIEW_ERRORS[response.error]:'练习来源未读取，请重试。');return;}const saved=response.value;if(saved.state!=='confirmed'||!saved.exercise||!saved.exerciseVersion)throw new Error();setExercise(saved.exercise);setVersion(saved.exerciseVersion);setAnswers(saved.exercise.items.map((_,index)=>({index,answer:'',result:'',feedback:''})));}
  catch{if(stamp===generation.current)setError('练习来源未读取，请重新选择后重试。');}finally{if(stamp===generation.current)setLoading(false);}
 }
 function update(index:number,patch:Partial<typeof answers[number]>){setAnswers(items=>items.map(a=>a.index===index?{...a,...patch}:a));}
 return <section className={styles.section} data-testid="training-practice-form"><h3>关联本次实际练习</h3><p>只列出当前学生、同科目和知识点的已确认练习。逐题记录实际作答和表现；未作答请选择“未作答，待补测”并留空，分数可不填。混合结果只概括已答题，未答题仍需补测。</p><PaperSelect label="已确认练习" testId="training-practice-select" value={selected} disabled={disabled||loading} onChange={id=>void choose(id)} options={[{id:'',label:'本次不关联练习'},...choices.map(e=>({id:e.id,label:`${e.title} · ${e.items.length} 题`}))]}/>{loading&&<p role="status">正在读取已确认练习…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!choices.length&&<p>当前知识点没有已确认练习；可以先记录整体表现。</p>}
  {exercise&&!loading&&<><div className={styles.items}>{exercise.items.map((q,index)=><article key={index} data-testid="training-practice-question"><strong>第 {index+1} 题</strong><p>{q.stem}</p><DisclosureCard title="查看参考答案与解析"><p>{q.answer}</p><p>{q.analysis}</p></DisclosureCard><div className={styles.fields}><label>实际作答<TextArea rows={3} data-testid={`training-practice-answer-${index}`} maxLength={4000} disabled={disabled} value={answers[index]?.answer||''} onChange={e=>update(index,{answer:e.target.value})}/></label><PaperSelect label="实际表现" testId={`training-practice-outcome-${index}`} value={answers[index]?.result||''} onChange={result=>update(index,{result})} options={[{id:'',label:'请选择实际表现'},...Object.entries(outcomes).map(([id,label])=>({id,label}))]}/><label>教师反馈<TextArea rows={3} data-testid={`training-practice-feedback-${index}`} maxLength={1000} disabled={disabled} value={answers[index]?.feedback||''} onChange={e=>update(index,{feedback:e.target.value})}/></label></div></article>)}</div><label className="student-training-historical checkbox-label"><input type="checkbox" data-testid="training-practice-score-toggle" checked={scored} onChange={e=>setScored(e.target.checked)}/>记录本次实际分数</label>{scored&&<div className={styles.fields}><label>实际得分<Input data-testid="training-practice-score-earned" type="number" min="0" step="any" value={earned} onChange={e=>setEarned(e.target.value)}/></label><label>满分<Input data-testid="training-practice-score-max" type="number" min="0" step="any" value={maximum} onChange={e=>setMaximum(e.target.value)}/></label></div>}</>}
 </section>;
}
