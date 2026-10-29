import {useCallback,useState} from 'react';
import {Button} from '@heroui/react';
import {DELIVERY_SCHEMA,type DeliverySummary} from '../../../shared/xiaozhi-delivery';
import {OFFICE_ARTIFACT_ERRORS} from '../../../shared/xiaozhi-office-artifacts';
import {PiTextChangeCard} from './PiTextChangeCard';
import {PiOfficeArtifactCard} from './PiOfficeArtifactCard';
import {useOfficeControlState} from './OfficeComposerState';

const labels={preparing:'正在整理整包文件',pending:'整包待确认',approving:'正在确认文件版本',approved:'整包已确认',executing:'正在保存整包',saved:'整包已保存并核验',partial:'部分文件已保存，仍有未完成文件',failed:'整包尚未交付',rejected:'已拒绝整包',interrupted:'整包已中断',conflict:'文件或要求已变化，请重新整理'};
const errors:Record<string,string>={configuration:'文件生成或保存失败，请续做未完成部分。',conflict:'文件、来源或目标已变化；请核对后另存。',permission_denied:'当前目录不可写或授权已变化，请检查目录后续做。',cancelled:'任务已停止，已保存文件保留。',too_large:'内容超过当前格式上限，请精简后重新提出。'};
export function PiDeliveryBundleCard({delivery,sessionId,running,onRefresh,onOpen}:{delivery:DeliverySummary;sessionId:string;running:boolean;onRefresh:()=>Promise<void>;onOpen:(path:string)=>void}){
 const {draft,update,lock}=useOfficeControlState('delivery:'+delivery.id);
 const [ready,setReady]=useState<Record<string,boolean>>({});
 const readiness=useCallback((id:string,value:boolean)=>setReady(old=>old[id]===value?old:{...old,[id]:value}),[]);
 const pending=delivery.state==='pending',complete=delivery.files.filter(f=>f.change?.state==='applied'||f.artifact?.state==='saved').length;
 const allReady=delivery.files.every(f=>f.carried||!!f.draftId&&ready[f.draftId]);
 async function decide(action:'approve'|'reject'){
  if(lock.current||!running||!pending||action==='approve'&&!allReady)return;lock.current=true;update({busy:true,error:''});
  try{const result=await window.omniEdu?.decideXiaozhiDelivery({schemaVersion:DELIVERY_SCHEMA,sessionId,bundleId:delivery.id,revision:delivery.revision,fingerprint:delivery.fingerprint,action});if(!result?.ok)update({error:result?OFFICE_ARTIFACT_ERRORS[result.error]:'整包没有提交，请刷新后重试。'});await onRefresh();}
  catch{update({error:'整包状态未能确认，请刷新后检查。'});}finally{lock.current=false;update({busy:false});}
 }
 async function resume(){
  if(lock.current||running)return;lock.current=true;update({busy:true,error:''});
  try{
   const result=await window.omniEdu?.startXiaozhi({sessionId,commandId:`xicmd_${crypto.randomUUID()}`,prompt:`继续交付“${delivery.files.map(f=>f.path).join('、')}”这组教学文件，只续做未完成部分。已保存文件请核验并保留，重新审阅后保存。`});
   if(!result?.ok)update({error:'续做尚未启动，请检查当前会话状态后重试。'});await onRefresh();
  }catch{update({error:'续做状态未能确认，请刷新后检查。'});}finally{lock.current=false;update({busy:false});}
 }
 return <section className="pi-delivery-bundle" data-testid="pi-delivery-bundle" data-bundle-id={delivery.id} data-state={delivery.state} aria-label="整包教学文件">
  <strong>{labels[delivery.state]}</strong><p>{complete} / {delivery.files.length} 份已保存。{pending?'请核对下面各文件；PPT修改后先保存拟内容，再一次确认整包。':complete<delivery.files.length?'已保存文件保留，续做仅处理未完成部分。':'可分别打开文件继续使用。'}</p>
  {delivery.files.map(f=><div key={f.fileId} data-testid="pi-delivery-file" data-file-id={f.fileId}>
   {f.carried&&<p>已保存并核验，续做时保留：{f.path}</p>}
   {f.change&&<PiTextChangeCard bundled change={f.change} sessionId={sessionId} running={running&&pending} onRefresh={onRefresh} onOpen={onOpen} onReadiness={readiness}/>}
   {f.artifact&&<PiOfficeArtifactCard bundled artifact={f.artifact} sessionId={sessionId} running={running&&pending} onRefresh={onRefresh} onOpen={onOpen} onReadiness={readiness}/>}
   {!f.draftId&&<p>{f.path} · 未完成草稿提交</p>}
   {f.error&&<p role="status">{errors[f.error]??'此文件未确认完成，请检查后续做。'}</p>}
  </div>)}
  {pending&&<div className="pi-office-actions"><Button variant="primary" isDisabled={draft.busy||!running||!allReady} onPress={()=>void decide('approve')} data-testid="pi-delivery-approve">确认保存整包</Button><Button variant="ghost" isDisabled={draft.busy||!running} onPress={()=>void decide('reject')} data-testid="pi-delivery-reject">拒绝整包</Button></div>}
  {delivery.continuedBy?<p>这组成果已在后续任务中完成。</p>:['partial','interrupted','failed','conflict'].includes(delivery.state)&&<Button variant="secondary" isDisabled={running||draft.busy} onPress={()=>void resume()} data-testid="pi-delivery-resume">续做未完成文件</Button>}
  {draft.busy&&<p role="status">正在提交…</p>}
  {draft.error&&<p role="alert">{draft.error}</p>}
 </section>;
}
