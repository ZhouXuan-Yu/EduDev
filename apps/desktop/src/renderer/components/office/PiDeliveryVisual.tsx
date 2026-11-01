import { DisclosureCard } from '../ui/DisclosureCard';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {DeliveryVisualEvidence,DeliveryVisualResult} from '../../../shared/xiaozhi-delivery-checks';

/** One image on demand. Never embed all captured pages in the conversation state. */
export function PiDeliveryVisual({sessionId,reportId,fileSha256,evidence,historical}:{sessionId:string;reportId:string;fileSha256:string;evidence:DeliveryVisualEvidence[];historical:boolean}){
 const [selected,setSelected]=useState(0),[image,setImage]=useState<Extract<DeliveryVisualResult,{ok:true}>>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0),dialog=useRef<HTMLDialogElement>(null),signature=evidence.map(e=>e.sha256).join('|');
 useEffect(()=>{epoch.current++;setSelected(0);setImage(undefined);setError('');setBusy(false);dialog.current?.close();return()=>{epoch.current++;dialog.current?.close();};},[sessionId,reportId,signature]);
 const current=evidence[selected];
 async function load(){
  if(!current||busy)return;const generation=++epoch.current;setBusy(true);setError('');setImage(undefined);
  try{const value=await window.omniEdu?.getXiaozhiDeliveryVisual({sessionId,id:reportId,sha256:current.sha256});if(generation!==epoch.current)return;
   if(value?.ok&&value.evidence.sha256===current.sha256&&value.fileSha256===fileSha256)setImage(value);
   else setError(value&&!value.ok&&value.error==='permission_denied'?'当前无法读取本条截图。':'截图缓存已清理、缺失或损坏。检查记录仍保留，可重新检查当前文件生成截图。');
  }catch{if(generation===epoch.current)setError('截图暂时无法读取，请稍后重试。');}finally{if(generation===epoch.current)setBusy(false);}
 }
 const old=historical||image?.historical,src=image?'data:image/png;base64,'+image.dataBase64:undefined;
 return <section className="pi-check-visual" data-testid="pi-check-visual" aria-label="实际检查截图">
  <strong>实际检查截图</strong><p>{old?'这是旧版本检查时的截图，不代表当前文件。':'截图对应本次检查时的文件版本。'}图片仅保存在本机。</p>
  {evidence.length?<><div className="pi-file-check-actions"><label>页面与视口（CSS像素） <select aria-label="检查截图尺寸" value={selected} onChange={event=>{epoch.current++;setSelected(Number(event.target.value));setImage(undefined);setError('');setBusy(false);}} data-testid="pi-check-visual-select">
   {evidence.map((item,index)=><option key={item.sha256+index} value={index}>第{item.page}页 · {item.viewport}</option>)}</select></label>
   <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void load()} data-testid="pi-check-visual-load">{busy?'读取中…':'查看截图'}</Button>
   {image&&<Button size="sm" variant="ghost" onPress={()=>dialog.current?.showModal()} data-testid="pi-check-visual-expand">放大查看</Button>}</div>
   {error&&<p role="status" data-testid="pi-check-visual-error">{error}</p>}
   {src&&image&&current&&<><img src={src} alt={`第${current.page}页 ${current.viewport}实际检查截图${old?'（历史版本）':''}`} loading="lazy" data-testid="pi-check-visual-image"/>
    <DisclosureCard title={<>截图版本信息</>}><p className="pi-file-check-hash">文件SHA：{fileSha256}<br/>截图SHA：{image.evidence.sha256}<br/>{image.evidence.bytes.toLocaleString()}字节 · 实际PNG：{image.evidence.width}×{image.evidence.height}像素</p></DisclosureCard>
    <dialog ref={dialog} className="pi-check-visual-dialog" aria-label="放大检查截图" onKeyDown={event=>{if(event.key==='Escape')event.stopPropagation();}} data-testid="pi-check-visual-dialog"><div><strong>{old?'历史版本':'本次检查'} · 第{current.page}页 · {current.viewport}</strong><Button size="sm" variant="ghost" onPress={()=>dialog.current?.close()} data-testid="pi-check-visual-close">关闭</Button></div><img src={src} alt="放大的实际检查截图"/></dialog>
   </>}
  </>:<p>本条检查未留存截图。可重新检查当前文件；未渲染的页面仍属于视觉未检查。</p>}
 </section>;
}
