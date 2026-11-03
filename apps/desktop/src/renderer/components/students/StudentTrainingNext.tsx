import styles from '../../ui-system/student-training.module.css';
import {PaperSelect} from '../paper-ui/PaperSelect';
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
 return <section className={styles.section} data-testid="student-training-next">
  <div><h3>继续学习</h3><p data-testid="training-progress-count">当前计划已有 {progress.recorded} / {progress.total} 项实际结果，其中 {progress.answered} 项已有作答；已记录不等于掌握。</p></div>
  {progress.unansweredDays.length>0&&<p data-testid="training-unanswered-days">第 {progress.unansweredDays.join('、')} 天仍有未答题，待补测；未答不等于答错。</p>}
  {day&&topic?<><p data-testid="training-next-day">{next!==null?'下一项':'可继续复盘'}：第 {day.day} 天 · {topic.subject} · {topic.name}</p><p>{day.notes}</p><div className={styles.actions}><PaperSelect label="辅导方式" testId="training-tutor-mode" value={mode} disabled={disabled} onChange={mode=>setMode(mode as TrainingTutorMode)} options={Object.entries(TRAINING_TUTOR_MODES).map(([id,label])=>({id,label}))}/><Button variant="primary" data-testid="training-next-tutor" isDisabled={disabled} onPress={()=>onTutor(day.day,mode)}>继续当天辅导</Button><Button variant="secondary" data-testid="training-next-record" isDisabled={disabled} onPress={()=>onRecord(day.day)}>记录当天结果</Button></div></>:<p data-testid="training-all-recorded">所有训练项都有实际记录。可以请小智结合新结果重新分析，核对后再安排下一阶段。</p>}
  {review!==undefined&&<div className={styles.actions}><p data-testid="training-review-days">第 {progress.reviewDays.join('、')} 天最近记录仍为错误或部分正确，建议先复盘。</p><Button variant="ghost" data-testid="training-review-tutor" isDisabled={disabled} onPress={()=>onTutor(review,'reflect')}>复盘第 {review} 天</Button></div>}
 </section>;
}
