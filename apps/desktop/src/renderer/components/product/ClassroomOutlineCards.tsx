import {Input,Label,TextArea,TextField} from '@heroui/react';
import type {ClassroomPlanDocument,ClassroomPlanItem} from '../../../shared/classroom-plan';
import {ClassroomSources} from './ClassroomSources';
import {DisclosureCard} from '../ui/DisclosureCard';

/** Layout only: approval, drafts and source authority remain in the editor/main. */
export function ClassroomOutlineSceneCard({plan,document,readOnly,onChange}:{
 plan:ClassroomPlanItem;
 document:ClassroomPlanDocument;
 readOnly:boolean;
 onChange:(index:number,key:'title'|'activity'|'durationMinutes',value:string|number)=>void;
}){
 return <section className="edu-plan-section-stack" data-testid="classroom-plan-scenes-card" aria-label="课页安排">
  <header><h3>课页安排</h3><p className="edu-plan-muted">{document.scenes.length} 页 · 展开课页核对标题、活动与时长</p></header>
    {document.scenes.map((scene,index)=><DisclosureCard key={plan.id+'/'+scene.sceneId} headingLevel={4} defaultExpanded={index===0} data-testid={'classroom-plan-scene-toggle-'+scene.sceneId} title={
      <span className="edu-plan-scene-summary"><span>{index+1}. {scene.title}</span><span className="edu-plan-muted">{scene.type==='slide'?'讲解页':'选择题与反馈'} · {scene.durationMinutes} 分钟 · {plan.checkpoints.some(c=>c.sceneId===scene.sceneId)?'已保存':'待制作'}</span></span>
    }>
      <div className="edu-plan-fields">
       <div className="edu-plan-scene-fields">
        <TextField isDisabled={readOnly}><Label>页标题</Label><Input aria-label={`第${index+1}页标题`} value={scene.title} maxLength={160} onChange={e=>onChange(index,'title',e.target.value)}/></TextField>
        <TextField isDisabled={readOnly}><Label>分钟</Label><Input aria-label={`第${index+1}页时长`} type="number" min={1} max={120} value={String(scene.durationMinutes)} onChange={e=>onChange(index,'durationMinutes',Number(e.target.value))}/></TextField>
       </div>
       <TextField isDisabled={readOnly}><Label>课堂活动</Label><TextArea aria-label={`第${index+1}页活动`} value={scene.activity} maxLength={3000} onChange={e=>onChange(index,'activity',e.target.value)}/></TextField>
      </div>
    </DisclosureCard>)}
 </section>;
}

export function ClassroomOutlineReferenceCard({plan}:{plan:ClassroomPlanItem}){
 return <section className="edu-plan-section-stack" data-testid="classroom-plan-reference-card" aria-label="课堂来源与使用范围">
  <DisclosureCard key={plan.id+'/sources'} data-testid="classroom-plan-sources-toggle" title={<>课堂参考资料 · {plan.context.materials.length} 段</>}><ClassroomSources context={plan.context}/></DisclosureCard>
  <DisclosureCard key={plan.id+'/scope'} data-testid="classroom-plan-scope-toggle" title="确认与使用范围"><p>修改大纲须重新确认，既有页不会当作新版本成果。大纲确认后，完整课堂仍须单独核对；导出文件另需批准。</p><p>仅支持已收录资料段落、讲解页和选择题反馈，不含 AI 还原页或学生证据个性化；预演作答不会写入成绩。</p></DisclosureCard>
 </section>;
}
