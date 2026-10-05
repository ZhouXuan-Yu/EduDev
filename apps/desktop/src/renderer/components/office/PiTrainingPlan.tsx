import {trainingDayDate,validTrainingDate,type TrainingPlan,type TrainingDay} from '../../../shared/training-plan';
import './pi-learning-review.css';
const activity={review:'间隔复习',practice:'针对练习',reflection:'解释与复盘',rest:'休息'};
const difficulty={warmup:'巩固基础',standard:'常规应用',challenge:'适度挑战'};
/** One editable or read-only view inside the existing Pro approval and history. */
export function PiTrainingPlan({plan,onChange}:{plan:TrainingPlan;onChange?:(plan:TrainingPlan)=>void}){
 const edit=(day:number,patch:Partial<TrainingDay>)=>onChange?.({...plan,days:plan.days.map(d=>d.day===day?{...d,...patch}:d)});
 return <section className="pi-training-plan" data-testid="pi-training-plan">
  {onChange?<div className="pi-training-heading"><label>计划名称<input data-testid="training-title" value={plan.title} maxLength={160} onChange={e=>onChange({...plan,title:e.target.value})}/></label><label>开始日期<input data-testid="training-start-date" type="date" value={plan.startDate} onChange={e=>onChange({...plan,startDate:e.target.value})}/></label></div>:<><strong>{plan.title}</strong><p>开始日期：{plan.startDate} · 两周安排</p></>}
  <p>依据已保存的学习结果制定。难度与训练量是建议，实际完成后需另记学习结果。</p>
  <div className="pi-training-calendar" tabIndex={0} aria-label="十四天训练安排">
   {plan.days.map(d=><article key={d.day} data-testid={`training-day-${d.day}`} className="pi-training-day">
    <strong>第 {d.day} 天 · {validTrainingDate(plan.startDate)?trainingDayDate(plan.startDate,d.day):'请选择开始日期'}</strong>
    {onChange?<><div className="pi-training-row">
     <label>安排<select data-testid={`training-activity-${d.day}`} value={d.activity} onChange={e=>{const value=e.target.value as TrainingDay['activity'];edit(d.day,{activity:value,pointId:value==='rest'?null:d.pointId||plan.topics[0].id,count:value==='rest'?0:Math.max(d.count,1)});}}>{Object.entries(activity).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
     <label>知识点<select data-testid={`training-topic-${d.day}`} value={d.pointId||''} disabled={d.activity==='rest'} onChange={e=>edit(d.day,{pointId:e.target.value})}>{d.activity==='rest'&&<option value="">不安排训练</option>}{plan.topics.map(p=><option key={p.id} value={p.id}>{p.subject} · {p.name}</option>)}</select></label>
    </div><div className="pi-training-row">
     <label>训练量<input data-testid={`training-count-${d.day}`} type="number" min={d.activity==='rest'?0:1} max="20" step="1" value={d.count} disabled={d.activity==='rest'} onChange={e=>edit(d.day,{count:e.target.valueAsNumber})}/></label>
     <label>难度<select data-testid={`training-difficulty-${d.day}`} value={d.difficulty} disabled={d.activity==='rest'} onChange={e=>edit(d.day,{difficulty:e.target.value as TrainingDay['difficulty']})}>{Object.entries(difficulty).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div><label>教学说明<textarea data-testid={`training-notes-${d.day}`} maxLength={300} value={d.notes} onChange={e=>edit(d.day,{notes:e.target.value})}/></label></>:<><p>{activity[d.activity]}{d.pointId?` · ${plan.topics.find(p=>p.id===d.pointId)?.name} · ${d.count} 项 · ${difficulty[d.difficulty]}`:''}</p><p>{d.notes}</p></>}
   </article>)}
  </div>
 </section>;
}
