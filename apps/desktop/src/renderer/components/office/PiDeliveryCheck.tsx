import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {PiDeliveryVisual} from './PiDeliveryVisual';
import {PiRequirementCoverage} from './PiRequirementCoverage';
import {CHECK_CLASSES,CHECK_LABELS,CHECK_STATE_LABELS,DELIVERY_CHECK_SCHEMA,type DeliveryCheckReport,type OfficeCheckEngine} from '../../../shared/xiaozhi-delivery-checks';
const states:Record<DeliveryCheckReport['state'],string>={passed:'本次约定检查通过',failed:'检查发现问题',partial:'部分检查完成',stale:'检查已过期',cancelled:'检查已停止'};
export function PiDeliveryCheck({sessionId,path,version,workspaceVersion,draftId}:{sessionId:string;path:string;version?:string;workspaceVersion?:string;draftId?:string}){
 const [report,setReport]=useState<DeliveryCheckReport>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [officeEngine,setOfficeEngine]=useState<OfficeCheckEngine>('auto'),officeFile=/\.(docx|pptx)$/i.test(path);
 const live=useRef(true),request=useRef(''),loading=useRef(false),epoch=useRef(0);
 useEffect(()=>{live.current=true;return()=>{live.current=false;const requestId=request.current;if(requestId)void window.omniEdu?.cancelXiaozhiDeliveryCheck({sessionId,requestId});};},[sessionId]);
 async function latest(){
  if(loading.current||busy)return;loading.current=true;setError('');const generation=++epoch.current;
  try{const list=await window.omniEdu?.listXiaozhiDeliveryChecks({sessionId});if(!live.current)return;
   if(!list?.ok){setError('检查记录暂时无法读取。');return;}let item=list.items.find(r=>r.files.some(f=>f.path===path));
   if(draftId){item=undefined;for(const entry of list.items.filter(r=>r.files.some(f=>f.path===path))){const result=await window.omniEdu?.getXiaozhiDeliveryCheck({sessionId,id:entry.id});if(result?.ok&&result.report.files.some(f=>f.candidate?.id===draftId)){if(live.current&&generation===epoch.current)setReport(result.report);return;}}}
   if(!item){if(generation===epoch.current)setReport(undefined);return;}const value=await window.omniEdu?.getXiaozhiDeliveryCheck({sessionId,id:item.id});if(live.current&&generation===epoch.current){if(value?.ok)setReport(value.report);else setError('检查记录不可用，请重新检查当前文件。');}
  }catch{if(live.current)setError('检查记录暂时无法读取。');}finally{loading.current=false;}
 }
 async function inspect(){
  if(busy||draftId)return;++epoch.current;setBusy(true);setError('');const requestId=`xicheckreq_${crypto.randomUUID()}`;request.current=requestId;
  const previous=report?.contextCurrent!==false&&(report?.state!=='stale'||report?.contextCurrent===true)?report?.files.find(f=>f.path===path)?.rules:undefined;
  try{const value=await window.omniEdu?.inspectXiaozhiDelivery({schemaVersion:DELIVERY_CHECK_SCHEMA,sessionId,requestId,workspaceVersion,files:[{path,version,...(previous||officeFile?{rules:{...previous,...(officeFile?{officeEngine}:{})}}:{})}]});if(!live.current)return;
   if(value?.ok)setReport(value.report);else setError(value?.error==='cancelled'?'检查已停止，已有文件保留。':value?.error==='changed'?'文件或要求版本已变化，请刷新文件后重试。':value?.error==='busy'?'检查队列暂忙，请稍后重试。':'检查未完成，已有文件保留。');
  }catch{if(live.current)setError('检查未完成，已有文件保留。');}finally{request.current='';if(live.current)setBusy(false);}
 }
 const file=report?.files.find(f=>f.path===path);
 return <details data-edu-domain="delivery-check" className="pi-file-check" data-testid="pi-delivery-check" onToggle={event=>{if(event.target===event.currentTarget&&event.currentTarget.open)void latest();}}>
  <summary>文件检查{report?` · ${states[report.state]}`:''}</summary>
  <div className="pi-file-check-actions">{!draftId&&officeFile&&<label>检查应用 <select aria-label="文件检查应用" data-testid="pi-file-check-engine" value={officeEngine} disabled={busy} onChange={event=>setOfficeEngine(event.target.value as OfficeCheckEngine)}><option value="auto">自动选择</option><option value="microsoft">Microsoft Office</option><option value="wps">WPS</option></select></label>}
   {!draftId&&<Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void inspect()} data-testid="pi-file-check-run">检查当前文件</Button>}
   <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void latest()} data-testid="pi-file-check-refresh">刷新检查记录</Button>
   {busy&&<Button size="sm" variant="ghost" onPress={()=>{if(request.current)void window.omniEdu?.cancelXiaozhiDeliveryCheck({sessionId,requestId:request.current});}} data-testid="pi-file-check-cancel">停止检查</Button>}</div>
  {busy&&<p role="status">正在本机读取和检查，已有文件保持原样…</p>}{error&&<p role="status" data-testid="pi-file-check-error">{error}</p>}
  {report&&file?<div data-testid="pi-file-check-result" data-state={report.state}><p><strong>{states[report.state]}</strong> · {new Date(report.createdAt).toLocaleString()}</p>
   <p>{report.candidate?'这是交付前草稿检查，不代表文件已保存。':'保存状态与检查状态分别记录。'}未检查的项目不代表通过。</p>
   <PiRequirementCoverage report={report}/>
   {report.repairExhausted?.length&&<p role="status">已达到每类2轮自动修复上限，失败草稿与先前结果保留。</p>}
   <dl>{CHECK_CLASSES.map(kind=>{const checks=file.checks.filter(c=>c.kind===kind),state=checks.some(c=>c.state==='failed')?'failed':checks.some(c=>c.state==='unchecked')?'unchecked':checks.some(c=>c.state==='passed')?'passed':'not_applicable';return <div key={kind} data-check-kind={kind} data-check-state={state}><dt>{CHECK_LABELS[kind]}</dt><dd>{CHECK_STATE_LABELS[state]}</dd></div>;})}</dl>
   <p>实际页数：{file.pageCount??'未确定'}；实际渲染页：{file.renderedPages.length?file.renderedPages.join('、'):'未渲染'}。</p>
   {file.sha256&&<PiDeliveryVisual key={report.id+file.sha256} sessionId={sessionId} reportId={report.id} fileSha256={file.sha256} evidence={file.visualEvidence||[]} historical={report.state==='stale'||file.state==='stale'}/>}
   <details><summary>逐项结果与版本</summary><ul>{file.checks.map((check,index)=><li key={index} data-check-state={check.state}>{CHECK_STATE_LABELS[check.state]}{check.page?` · 第${check.page}页`:''}：{check.message}</li>)}</ul><p className="pi-file-check-hash">文件摘要：{file.sha256||'未取得'}</p></details>
  </div>:!busy&&<p>尚无当前文件的检查记录。小智可按教学任务提供页数、备注、数值与交互约定；这里可直接检查文件的可用性。</p>}
 </details>;
}
