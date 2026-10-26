import {useState} from 'react';
import {Button} from '@heroui/react';
import type {StudentTrainingView} from '../../../shared/student-training';
import {TRAINING_TUTOR_MODES,type TrainingTutorMode} from '../../../shared/training-progress';

/** Compact next-action view over host-derived coverage, without a second path store. */
export function StudentTrainingNext({value,disabled,onTutor,onRecord}:{value:StudentTrainingView;disabled:boolean;onTutor:(day:number,mode:TrainingTutorMode)=>void;onRecord:(day:number)=>void}){
 const [mode,setMode]=useState<TrainingTutorMode>('hint'),{plan,progress}=value;
 if(!plan||!progress)return null;
 const next=progress.nextDay,review=progress.reviewDays[0],target=next??review;
 const day=plan.plan.days.find(d=>d.day===target),topic=plan.plan.topics.find(t=>t.id===day?.pointId);
 return <section className="student-training-next" data-testid="student-training-next">
  <div><h3>继续学习</h3><p data-testid="training-progress-count">当前计划已有 {progress.recorded} / {progress.total} 项实际结果；已记录不等于掌握。</p></div>
  {day&&topic?<><p data-testid="training-next-day">{next!==null?'下一项':'可继续复盘'}：第 {day.day} 天 · {topic.subject} · {topic.name}</p><p>{day.notes}</p><div className="student-training-actions"><label>辅导方式<select data-testid="training-tutor-mode" value={mode} disabled={disabled} onChange={e=>setMode(e.target.value as TrainingTutorMode)}>{Object.entries(TRAINING_TUTOR_MODES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><Button variant="primary" data-testid="training-next-tutor" isDisabled={disabled} onPress={()=>onTutor(day.day,mode)}>继续当天辅导</Button><Button variant="secondary" data-testid="training-next-record" isDisabled={disabled} onPress={()=>onRecord(day.day)}>记录当天结果</Button></div></>:<p data-testid="training-all-recorded">所有训练项都有实际记录。可以请小智结合新结果重新分析，核对后再安排下一阶段。</p>}
  {review!==undefined&&<div className="student-training-actions"><p data-testid="training-review-days">第 {progress.reviewDays.join('、')} 天最近记录仍为错误或部分正确，建议先复盘。</p><Button variant="ghost" data-testid="training-review-tutor" isDisabled={disabled} onPress={()=>onTutor(review,'reflect')}>复盘第 {review} 天</Button></div>}
 </section>;
}
