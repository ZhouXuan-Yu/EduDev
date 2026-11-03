import {useState} from 'react';
import {Button,Input,Modal} from '@heroui/react';
import type {ExerciseSet} from '../../../shared/contracts';
import type {PracticeReviewDraft,PracticeReviewView} from '../../../shared/practice-review';
import {DIAGNOSIS_CATEGORIES} from '../../../shared/learning-diagnosis';
import {practiceTargetIssues,studentPractice} from '../../../shared/practice-target';
import styles from '../../ui-system/practice-target.module.css';

export function PracticeTargetSummary({view,draft,onChange}:{view:PracticeReviewView;draft:PracticeReviewDraft;onChange?:(d:PracticeReviewDraft)=>void}){
 if(!draft.target||!view.target)return null;
 const target=draft.target,basis=view.target.basis,diagnosis=basis.diagnosis;
 const issues=practiceTargetIssues(target,draft.subject,draft.knowledgePoint,draft.items.map(i=>view.questions[i.index].question),basis);
 return <section className={styles.summary} data-testid="practice-target-summary" aria-label="针对练习的依据与要求">
  <p>针对 {basis.subject} · {basis.knowledgePoint}，共 {target.basic+target.advanced} 题。基础对应题库“简单”，提高对应“困难”；标签匹配仍需逐题核对教学同类性。</p>
  {onChange?<div className={styles.quotas}><label>基础题数<Input data-testid="practice-target-basic" type="number" min={0} max={8} value={String(target.basic)} onChange={e=>onChange({...draft,target:{...target,basic:Number(e.target.value)}})}/></label><label>提高题数<Input data-testid="practice-target-advanced" type="number" min={0} max={8} value={String(target.advanced)} onChange={e=>onChange({...draft,target:{...target,advanced:Number(e.target.value)}})}/></label></div>:<p>基础 {target.basic} 题 · 提高 {target.advanced} 题</p>}
  {diagnosis?<><p>教师诊断第 {basis.assessmentVersion} 版：{DIAGNOSIS_CATEGORIES[diagnosis.category]}</p><p>{diagnosis.interpretation}</p><p data-testid="practice-target-intervention">本次干预：{diagnosis.intervention}</p></>:<p>本次来源尚无已确认细分诊断，不将初步推断当教师结论。</p>}
  {view.targetCurrent===false&&<p role="alert" data-testid="practice-target-changed">本练习所依据的学习证据或教师判断已有变化；历史保留。待确认练习请拒绝后按最新判断重新安排。</p>}
  {issues.map(issue=><p role="alert" key={issue}>{issue}</p>)}
  <ol className={styles.checks}>{draft.items.map((item,n)=>{const answer=view.target!.answers[item.index];return <li key={item.index} data-testid="practice-target-answer">第 {n+1} 题：{answer.state==='matched'?'完整方程与参考答案经 S02 精确核验一致；讲解与教学适用性仍请核对。':'此题不在自动精确方程核验范围，答案与解析需教师人工核验。'}</li>;})}</ol>
 </section>;
}
export function StudentPracticeButton({exercise}:{exercise:ExerciseSet}){
 const [open,setOpen]=useState(false),student=studentPractice(exercise);
 return <><Button variant="secondary" data-testid="practice-student-open" onPress={()=>setOpen(true)}>学生版预览</Button>
 {open&&<Modal.Backdrop isOpen onOpenChange={setOpen}><Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-themed-surface" data-testid="practice-student-dialog"><Modal.Header><Modal.Heading>{student.title}</Modal.Heading></Modal.Header><Modal.Body><p>{student.subject} · {student.knowledgePoint} · 共 {student.items.length} 题</p><div className={styles.studentItems}>{student.items.map((q,i)=><section className={styles.studentItem} key={i}><h3>第 {i+1} 题</h3><p className="pi-practice-text" data-testid="practice-student-stem">{q.stem}</p><p>作答：</p><div className={styles.answerSpace}/></section>)}</div></Modal.Body><Modal.Footer><Button variant="secondary" data-testid="practice-student-close" onPress={()=>setOpen(false)}>关闭</Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop>}</>;
}
