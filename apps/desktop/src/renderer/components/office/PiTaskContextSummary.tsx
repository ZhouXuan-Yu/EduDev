import type {XiaozhiWorkspaceSnapshot} from '../../../shared/xiaozhi-agent';
import {taskStepState, type TaskStepState} from '../../../shared/xiaozhi-task';
import {LESSON_ROLES} from '../../../shared/science-lesson';
import {TaskArtifactRelations} from './workbench/TaskArtifactRelations';
import type {workspaceTaskScope} from './workspace-task-context';
import {PiPaperReview} from './PiPaperReview';
import {paperReviewVersions} from './paper-review-versions';
import {PiClassroomPlanReview} from './PiClassroomPlanReview';
import {PiTeachingHandout} from './PiTeachingHandout';

const stepLabels:Record<TaskStepState,string>={pending:'待执行',executing:'执行中',waiting_dependency:'等待前置步骤',needs_check:'待核对',verified:'已核验',needs_fix:'需修正'};
const taskLabels={active:'执行中',review_required:'待教师核对',paused:'已暂停',interrupted:'未完成',completed:'教师已确认',ended:'已结束'};

export function PiTaskContextSummary({snapshot,scope,onRefresh}:{snapshot:XiaozhiWorkspaceSnapshot;scope:NonNullable<ReturnType<typeof workspaceTaskScope>>;onRefresh:()=>Promise<void>}) {
  const {task,runIds}=scope;
  const title=task.criteria.find(criterion=>criterion.id==='teacher_request')?.text;
  const reviews=snapshot.paperReviews??[];
  const anchor=[...runIds].reverse().map(runId=>reviews.find(item=>item.runId===runId)).find(Boolean);
  const paper=anchor?paperReviewVersions(anchor,reviews).latest:undefined;
  const lesson=snapshot.deliveries?.findLast(item=>runIds.has(item.runId)&&item.lesson)?.lesson;
  const classroomPlans=snapshot.classroomPlanReviews?.filter(item=>runIds.has(item.originRunId))||[];
  const collection=snapshot.questionCollections?.findLast(item=>runIds.has(item.runId));
  const steps=task.steps.map(step=>({step,state:taskStepState(task,step.id)}));
  return <>
    <section data-testid="pi-context-task" data-task-id={task.id} aria-label="当前任务">
      <h4>当前任务</h4>
      {title&&<p className="pi-context-task-title">{title}</p>}
      <p>{taskLabels[task.state]}{steps.length>0&&` · ${steps.filter(item=>item.state==='verified').length}/${steps.length} 步已核验`}</p>
      {steps.length>0&&<ol className="pi-context-steps" aria-label="任务步骤">{steps.map(({step,state})=><li key={step.id} data-state={state}>
        <span>{step.text}</span><small>{stepLabels[state]}</small>
      </li>)}</ol>}
    </section>
    {anchor&&paper&&<section data-testid="pi-context-paper" data-paper-id={paper.id}>
      <h4>试卷</h4><p>{paper.title}</p>
      <p>{paper.count} 题 · {paper.totalPoints} 分 · {paper.state==='confirmed'?'教师已确认':paper.state==='rejected'?'已拒绝':paper.complete?'待教师核对':'题目尚未配齐'}</p>
      <PiPaperReview key={anchor.id} sessionId={task.sessionId} review={anchor} reviews={reviews} running={snapshot.running} onRefresh={onRefresh} compact/>
    </section>}
    {lesson&&<section data-testid="pi-context-lesson">
      <h4>备课成果</h4><p>{lesson.title} · 第 {lesson.revision} 版 · {lesson.minutes} 分钟</p>
      {lesson.goals.length>0&&<ul aria-label="教学目标">{lesson.goals.map((goal,index)=><li key={index}>{goal}</li>)}</ul>}
      <p>{lesson.roles.map(item=>LESSON_ROLES[item.role]).join('、')}</p><p>来源 {lesson.sourceTitle}</p>
    </section>}
    {classroomPlans.map(review=><PiClassroomPlanReview key={review.rootId} review={review} compact/>)}
    {snapshot.teachingHandouts?.filter(item=>item.taskId===task.id&&runIds.has(item.runId))
      .map(handout=><PiTeachingHandout key={handout.bookId} handout={handout} compact/>)}
    {collection&&<section data-testid="pi-context-questions" data-collection-id={collection.id}>
      <h4>{collection.purpose==='explanation'?'讲解题目':'题目收集'}</h4><p>{collection.title}</p>
      <p>{collection.count}/{collection.required} 题 · {collection.state==='confirmed'?'已确认':collection.state==='rejected'?'已拒绝':collection.phase==='drafting'?'整理中':'待教师核对'}</p>
    </section>}
    <section><TaskArtifactRelations key={task.id} query={{schemaVersion:1,kind:'task_artifacts',sessionId:task.sessionId,taskId:task.id}}
      refreshKey={task.revision}/></section>
  </>;
}
