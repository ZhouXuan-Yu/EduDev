import {useEffect,useRef,useState} from 'react';
import {Button,TextArea} from '@heroui/react';
import {XIAOZHI_ATTACHMENTS_SCHEMA,XIAOZHI_ATTACHMENT_ERRORS,type XiaozhiAttachment,type XiaozhiAttachmentInput,type XiaozhiAttachmentResult} from '../../../shared/xiaozhi-attachments';
import type {AttachmentOcrReview} from '../../../shared/xiaozhi-ocr';

/** Original HeroUI primitives and main-owned local OCR/CAS; no image upload. */
export function AttachmentOcrPanel({sessionId,item,onBusyChange}:{sessionId:string;item:XiaozhiAttachment;onBusyChange:(value:boolean)=>void}){
 const epoch=useRef(0),requests=useRef(new Map<string,XiaozhiAttachmentInput>());
 const [review,setReview]=useState<AttachmentOcrReview|null>(null),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const input=()=>({schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,sessionId,requestId:`xiattach_${crypto.randomUUID()}`,selection:{id:item.id,revision:item.revision}});
 async function call(action:(value:ReturnType<typeof input>)=>Promise<XiaozhiAttachmentResult<AttachmentOcrReview|null>>|undefined){
  const stamp=epoch.current,request=input();requests.current.set(request.requestId,{schemaVersion:request.schemaVersion,sessionId,requestId:request.requestId});setBusy(true);setError('');onBusyChange(true);
  try{const result=await action(request);if(stamp!==epoch.current)return;
   if(!result?.ok){setError(result?XIAOZHI_ATTACHMENT_ERRORS[result.error]:'本地识别暂不可用，请重试。');return;}
   setReview(result.data);setText(result.data?.corrected||result.data?.original||'');
  }catch{if(stamp===epoch.current)setError('本地识别未完成，请重试。');}
  finally{requests.current.delete(request.requestId);if(stamp===epoch.current){setBusy(false);onBusyChange(false);}}
 }
 function cancel(){for(const request of requests.current.values())void window.omniEdu?.cancelXiaozhiAttachment(request).catch(()=>undefined);}
 useEffect(()=>{++epoch.current;void call(value=>window.omniEdu?.reviewXiaozhiAttachmentOcr(value));
  return()=>{++epoch.current;cancel();onBusyChange(false);};},[sessionId,item.id,item.revision]);
 const approved=review?.status==='approved',locked=approved&&item.state==='submitted';
 const status=approved?'已确认文字':review?.status==='review'?'请校正确认':review?.status==='rejected'?'已拒绝此识别结果':review?.status==='interrupted'?'上次识别已中断':review?.status==='processing'?'识别尚未完成':'尚未识别';
 return <section className="pi-attachment-ocr" data-testid="pi-attachment-ocr" aria-busy={busy}>
  <div className="pi-attachment-ocr-heading"><h3>本地文字识别</h3><span data-testid="pi-ocr-status">{status}</span></div>
  <p className="pi-attachment-local-note">原图保留在本机。请核对姓名、数字、公式和识别遗漏；确认后仅提供必要脱敏文字。</p>
  {busy?<p role="status">正在处理本地识别… <Button variant="ghost" size="sm" data-testid="pi-ocr-cancel" onPress={cancel}>取消</Button></p>:
   !review||['rejected','interrupted','processing'].includes(review.status)?<Button variant="secondary" data-testid="pi-ocr-start" onPress={()=>void call(value=>window.omniEdu?.startXiaozhiAttachmentOcr(value))}>{review?'重新识别':'识别图片文字'}</Button>:null}
  {review&&['review','approved'].includes(review.status)&&<>
   <details><summary>查看识别原文</summary><pre data-testid="pi-ocr-original">{review.original}</pre></details>
   <label htmlFor={`ocr-${item.id}`}>校正文字</label><TextArea id={`ocr-${item.id}`} aria-label="校正识别文字" data-testid="pi-ocr-corrected" fullWidth rows={6} value={text} maxLength={128000} disabled={busy} readOnly={locked} onChange={event=>setText(event.target.value)}/>
   {locked?<p className="pi-attachment-local-note">本轮已保存确认文字。需要新版本时，可重新添加图片并校正。</p>:<div className="pi-attachment-ocr-actions">
    <Button variant="secondary" isDisabled={busy} data-testid="pi-ocr-reject" onPress={()=>void call(value=>window.omniEdu?.decideXiaozhiAttachmentOcr({...value,ocrRevision:review.revision,decision:'reject',text:''}))}>拒绝此结果</Button>
    <Button isDisabled={busy||!text.trim()} data-testid="pi-ocr-approve" onPress={()=>void call(value=>window.omniEdu?.decideXiaozhiAttachmentOcr({...value,ocrRevision:review.revision,decision:'approve',text}))}>确认校正文字</Button>
   </div>}
  </>}{error&&<p role="alert" data-testid="pi-ocr-error">{error}</p>}
 </section>;
}
