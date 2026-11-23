import type {ClassroomPlanItem} from '../../../shared/classroom-plan';
import {curriculumLabel} from '../../../shared/material-curriculum';
import {lessonDetailKeys,lessonDetailLabels,lessonPhaseLabels,teachingLessonIssues} from '../../../shared/teaching-lesson';
import {DisclosureCard} from '../ui/DisclosureCard';
import {ClassroomSources} from './ClassroomSources';

const goalNumbers=(indices:number[])=>indices.map(index=>`目标 ${index+1}`).join('、');

/** Reads the saved version and its original evidence as prose. */
export function ClassroomPlanSnapshot({plan}:{plan:ClassroomPlanItem}){
 const {document,context}=plan;
 const {lesson}=document;
 const phases=new Map(lesson?.phases.map(phase=>[phase.sceneId,phase]));
 const issues=teachingLessonIssues(document);
 return <div className="edu-plan-snapshot edu-plan-section-stack">
  <section>
   <h3>{document.title}</h3>
   <p>{lesson&&`${lesson.subject} · ${lesson.grade} · `}{document.totalMinutes} 分钟</p>
   {issues.map(issue=><p key={issue}>{issue}</p>)}
  </section>
  <section>
   <h4>教学目标</h4>
   <ol>{document.objectives.map((goal,index)=><li key={index}>
    <p>{goal}</p>
    {lesson&&<p className="edu-plan-muted">达成标准 · {lesson.goalCriteria[index]}</p>}
   </li>)}</ol>
  </section>
  {!!lesson?.preparation.length&&<section><h4>准备材料</h4>
   <ul>{lesson.preparation.map((material,index)=><li key={index}>{material}</li>)}</ul>
  </section>}
  {lesson?.details&&<DisclosureCard title="教学内容、板书与课后安排" data-testid="classroom-history-lesson-details">
   <dl>{lessonDetailKeys.map(key=><div key={key}><dt>{lessonDetailLabels[key]}</dt><dd>{lesson.details?.[key]||'待补充'}</dd></div>)}</dl>
  </DisclosureCard>}
  <section className="edu-plan-section-stack">
   <h4>{lesson?'教学环节':'课堂页安排'}</h4>
   {document.scenes.map((scene,index)=>{
    const phase=phases.get(scene.sceneId);
    const kind=phase?lessonPhaseLabels[phase.kind]:scene.type==='slide'?'讲解页':'随堂题';
    return <DisclosureCard key={scene.sceneId} title={`${index+1}. ${scene.title} · ${kind} · ${scene.durationMinutes} 分钟`}
      defaultExpanded={index===0} data-testid={`classroom-history-scene-${scene.sceneId}`}>
     <p>{scene.activity}</p>
     {phase&&<>
      <p className="edu-plan-muted">{goalNumbers(phase.objectiveIndices)}</p>
      <dl><dt>教师提示语</dt><dd>{phase.teacherPrompt}</dd></dl>
      {phase.checks.map((check,number)=><dl key={number}>
       <dt>检查 {number+1} · {goalNumbers(check.objectiveIndices)}</dt><dd>{check.prompt}</dd>
       <dt>预期证据</dt><dd>{check.expectedEvidence}</dd>
       <dt>判断标准</dt><dd>{check.criterion}</dd>
      </dl>)}
     </>}
    </DisclosureCard>;
   })}
  </section>
  <DisclosureCard title="当时的资料与依据" data-testid="classroom-history-sources">
   <ClassroomSources context={context}/>
   {context.adopted?.map((entry,index)=><p key={entry.id}>依据 {index+1} · {curriculumLabel(entry.metadata)}</p>)}
   {lesson?.mappings.map(mapping=><section key={`${mapping.objectiveIndex}/${mapping.curriculumIndex}`}>
    <h4>目标 {mapping.objectiveIndex+1} · 依据 {mapping.curriculumIndex+1}</h4>
    <blockquote>{mapping.quote}</blockquote><p>{mapping.explanation}</p>
   </section>)}
   {!!lesson?.missingSources.length&&<section><h4>待补资料</h4>
    <ul>{lesson.missingSources.map((source,index)=><li key={index}>{source}</li>)}</ul>
   </section>}
  </DisclosureCard>
 </div>;
}
