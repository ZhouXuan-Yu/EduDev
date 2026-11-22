import {useEffect,useRef} from 'react';
import {Button,Card} from '@heroui/react';
import type {ClassroomPlanReview} from '../../../shared/classroom-plan';
import {useDesktopNavigation} from '../desktop/DesktopFrame';

const statusLabels:Record<ClassroomPlanReview['status'],string>={
 draft:'待教师确认',confirmed:'教师已确认',generating:'正在制作课页',
 interrupted:'课页制作已暂停',ready:'课页待核对',rejected:'已拒绝',
};

export function PiClassroomPlanReview({review,compact=false,focus=false}:{
 review:ClassroomPlanReview;compact?:boolean;focus?:boolean;
}){
 const nav=useDesktopNavigation();
 const action=useRef<HTMLButtonElement>(null);
 const label=review.kind==='lesson'?'教案':'课堂大纲';
 useEffect(()=>{
  if(!focus)return;
  const timer=requestAnimationFrame(()=>{
   action.current?.focus({preventScroll:true});
   action.current?.scrollIntoView({block:'nearest'});
  });
  return()=>cancelAnimationFrame(timer);
 },[focus]);
 return <Card data-testid={compact?'pi-context-classroom-plan':'pi-classroom-plan-review'}
   data-root-id={review.rootId} data-plan-id={review.id} data-origin-run-id={review.originRunId}>
  <Card.Header>
   <Card.Title>{review.title}</Card.Title>
   <Card.Description>{label} · 第 {review.revision} 版 · {review.totalMinutes} 分钟 · {statusLabels[review.status]}</Card.Description>
  </Card.Header>
  {compact&&<Card.Content>
   <ul aria-label="教学目标">{review.objectives.map((goal,index)=><li key={index}>{goal}</li>)}</ul>
   <p>{review.stages.join(' → ')}</p>
  </Card.Content>}
  <Card.Footer>
   <Button ref={action} size="sm" variant="secondary" data-testid="pi-classroom-plan-open" onPress={()=>
    nav.navigate({view:'artifacts',classroomPlan:{sessionId:review.sessionId,rootId:review.rootId}})}>
    {review.status==='rejected'?'查看'+label:'打开'+label+'编辑器'}
   </Button>
  </Card.Footer>
 </Card>;
}
