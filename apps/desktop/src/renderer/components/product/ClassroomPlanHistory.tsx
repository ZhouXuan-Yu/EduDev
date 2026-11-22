import {useEffect,useRef,useState} from 'react';
import {Button,Modal} from '@heroui/react';
import type {ClassroomPlanItem} from '../../../shared/classroom-plan';
import {classroomErrors} from '../../../shared/classroom';
import {DisclosureCard} from '../ui/DisclosureCard';
import {ClassroomPlanSnapshot} from './ClassroomPlanSnapshot';

const labels:Record<ClassroomPlanItem['status'],string>={
 draft:'待教师确认',confirmed:'教师已确认',generating:'正在生成课页',
 interrupted:'制作已暂停',ready:'课页待核对',rejected:'已拒绝',
};

export function ClassroomPlanHistory({current,busy,dirty,onRestore}:{
 current:ClassroomPlanItem;busy:boolean;dirty:boolean;onRestore:(plan:ClassroomPlanItem)=>void;
}){
 const [rows,setRows]=useState<ClassroomPlanItem[]>();
 const [preview,setPreview]=useState<ClassroomPlanItem>();
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const live=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 async function load(){
  setLoading(true);setError('');
  try{
   const result=await window.omniEdu?.readClassroomPlanHistory(current.id);
   if(!result?.ok)throw Error(result?.error||'unavailable');
   if(live.current)setRows(result.data);
  }catch(error){
   if(live.current){setRows(undefined);setError(classroomErrors[error instanceof Error?error.message:'']||classroomErrors.unavailable);}
  }finally{if(live.current)setLoading(false);}
 }
 const canRestore=(plan:ClassroomPlanItem)=>!busy&&!dirty&&plan.id!==current.id
  &&current.status!=='generating'&&current.status!=='rejected';
 return <DisclosureCard title="历史版本与恢复" data-testid="classroom-plan-history-toggle">
  <div className="edu-plan-fields">
   <p>可先查看旧版，再恢复到草稿。保存后生成新版本，需重新确认。</p>
   <div><Button variant="secondary" data-testid="classroom-plan-history-load" isDisabled={loading||busy}
     onPress={()=>void load()}>{loading?'正在读取…':'读取历史版本'}</Button></div>
   {error&&<p role="alert">{error}</p>}
   {rows?.map(plan=><div key={plan.id} className="edu-plan-history-row">
    <div><strong>第 {plan.revision} 版 · {plan.document.title}</strong>
     <p className="edu-plan-muted">{plan.id===current.id?'当前版本 · ':''}{labels[plan.status]} · {plan.document.totalMinutes} 分钟</p>
     {plan.restoredFrom&&<p className="edu-plan-muted" data-testid={`classroom-plan-restored-${plan.revision}`}>
      恢复来源 · 第 {rows.find(source=>source.id===plan.restoredFrom?.id)?.revision??'—'} 版
     </p>}
    </div>
    <div className="edu-plan-history-actions">
     <Button size="sm" variant="secondary" data-testid={`classroom-plan-history-open-${plan.revision}`}
      aria-label={`查看第 ${plan.revision} 版正文`}
      onPress={()=>setPreview(plan)}>查看正文</Button>
     {plan.id!==current.id&&<Button size="sm" variant="ghost" data-testid={`classroom-plan-restore-${plan.revision}`}
      aria-label={`恢复第 ${plan.revision} 版到草稿`}
      isDisabled={!canRestore(plan)} onPress={()=>onRestore(plan)}>恢复到草稿</Button>}
    </div>
   </div>)}
  </div>
  {preview&&<Modal.Backdrop isOpen onOpenChange={open=>{if(!open)setPreview(undefined);}}>
   <Modal.Container size="lg" scroll="inside">
    <Modal.Dialog className="pi-themed-surface" data-testid="classroom-plan-history-dialog" data-plan-id={preview.id}>
     <Modal.Header>
      <Modal.Heading>{preview.document.lesson?'教案':'课堂大纲'} · 第 {preview.revision} 版</Modal.Heading>
      <p className="edu-plan-muted">{labels[preview.status]} · 只读预览</p>
     </Modal.Header>
     <Modal.Body><ClassroomPlanSnapshot plan={preview}/></Modal.Body>
     <Modal.Footer><Button variant="secondary" onPress={()=>setPreview(undefined)}>关闭</Button></Modal.Footer>
    </Modal.Dialog>
   </Modal.Container>
  </Modal.Backdrop>}
 </DisclosureCard>;
}
