import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import type {TeacherResource} from '../../../shared/contracts';
import type {MaterialPdfStatus} from '../../../shared/material-pdf-file';
import {MATERIAL_TASK_SCHEMA} from '../../../shared/material-parse-task';
export function MaterialPdfProgress({resource}:{resource:TeacherResource}){
 const [status,setStatus]=useState<MaterialPdfStatus>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let current=true,reading=false;async function refresh(){if(reading)return;reading=true;try{const value=await window.omniEdu?.getMaterialPdfStatus(resource.id);if(current){setStatus(value);setError('');}}catch{if(current)setError('页处理进度暂不可用，请稍后重试。');}finally{reading=false;}}void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>{current=false;clearInterval(timer);};},[resource.id,resource.contentHash]);
 if(!status&&!error)return ['queued','imported'].includes(resource.parseStatus)?<p className="teacher-library-caption">正在等待本机处理并清点页数，原件保存在本机。</p>:<p className="teacher-library-caption">这份资料还没有逐页覆盖记录。<Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void action('retry')}>按页重新整理</Button>重新整理会更新正文，引用旧正文的题目可能需要重新核对。</p>;
 const labels:Record<string,string>={page_timeout:'本页处理超时',interrupted:'上次处理被中断',too_large:'本页文字、图像或对象超限',configuration:'识别组件需要修复',invalid_input:'本页结构无效',page_failed:'本页解析失败',parse_failed:'本页读取失败',ocr_empty:'本页图像未识别到文字',text_conflict:'原生文字与识别结果有疑点'};
 async function action(action:'cancel'|'retry'){if(busy)return;setBusy(true);setError('');try{await window.omniEdu!.controlMaterialTask({schemaVersion:MATERIAL_TASK_SCHEMA,resourceId:resource.id,version:resource.contentHash,action});}catch{setError('未能调整页处理，请刷新资料后重试。');}finally{setBusy(false);}}
 return <section className="material-batches" data-testid="material-pdf-progress">
  <h3>按页整理 PDF</h3>{status&&<>
   <p role="status" data-testid="material-pdf-counts">共 {status.total||'待清点'} 页 · 已处理 {status.complete} 页 · 空白 {status.blank} 页 · 待核对 {status.review} 页 · 失败 {status.failed} 页 · 未完成 {status.pending} 页</p>
   <p className="teacher-library-caption">{status.state==='complete'?'全部页面已处理；文字、图表与答案仍需核对。':status.state==='processing'?'正在本机逐页处理，成功页会保留。':status.state==='partial'?'部分正文可查，整本尚未完整处理。':'已保留成功页，继续后处理尚未完成的页面。'}原生文字和识别结果分别保存在本机；页处理完成不代表题目或答案已确认。</p>
   {status.state!=='complete'&&<Button size="sm" variant="secondary" isPending={busy} isDisabled={busy} onPress={()=>void action(status.state==='processing'?'cancel':'retry')} data-testid="material-pdf-action">{status.state==='processing'?'停止页处理':status.state==='complete'?'重新检查未完成页':'继续未完成页'}</Button>}
   {status.state!=='processing'&&(status.failed>0||status.review>0)&&<Button size="sm" variant="secondary" isDisabled={busy} onPress={async()=>{setBusy(true);setError('');try{await window.omniEdu!.retryMaterialPdfPages({schemaVersion:'xiaozhi.local-pdf-file.v3',resourceId:resource.id,version:resource.contentHash});}catch{setError('未能重试问题页，请停止当前处理后重试。');}finally{setBusy(false);}}} data-testid="material-pdf-retry">重试失败与待核对页</Button>}
   {status.state!=='complete'&&<p className="teacher-library-caption">继续会保留成功页，并跳过待核对及已达重试上限的页面；需要重新识别这些页时，请选“重试失败与待核对页”。</p>}
   {status.failures.length>0&&<ul>{status.failures.map(f=><li key={f.page}>第 {f.page} 页：{labels[f.error]||'本页需检查'}{f.attempts>=3?'（已达自动重试上限）':''}</li>)}</ul>}
  </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
