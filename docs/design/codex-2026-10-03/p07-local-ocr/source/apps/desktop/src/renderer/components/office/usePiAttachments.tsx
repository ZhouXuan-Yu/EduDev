import {useEffect,useRef,useState} from 'react';
import {Button,Modal} from '@heroui/react';
import {FileText} from 'lucide-react';
import {XIAOZHI_ATTACHMENTS_SCHEMA,XIAOZHI_ATTACHMENT_ERRORS,type XiaozhiAttachmentInput,type XiaozhiAttachment,type XiaozhiAttachmentPreview} from '../../../shared/xiaozhi-attachments';
import {ChatAttachment,ChatAttachmentGroup} from '../../heroui-pro/components/chat-attachment';
import {Markdown} from '../../heroui-pro/components/markdown';
import './pi-attachments.css';
import type {OfficeProjectedItem} from '../../../shared/office-agent';
import {AttachmentOcrPanel} from './AttachmentOcrPanel';

/** Local drafts and previews. Actual message delivery is a separate durable operation. */
export function usePiAttachments(sessionId:string,visible:boolean,history:OfficeProjectedItem[]=[]){
 const epoch=useRef(0),requests=useRef(new Map<string,XiaozhiAttachmentInput>()),mutation=useRef(false);
 const [items,setItems]=useState<XiaozhiAttachment[]>([]),[thumbnails,setThumbnails]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState<XiaozhiAttachment>(),[preview,setPreview]=useState<XiaozhiAttachmentPreview>();
 const [reading,setReading]=useState(false),[previewError,setPreviewError]=useState('');
 const [ocrBusy,setOcrBusy]=useState(false);
 const cancel=()=>{for(const input of requests.current.values())void window.omniEdu?.cancelXiaozhiAttachment(input).catch(()=>undefined);requests.current.clear();};
 const input=():XiaozhiAttachmentInput=>({schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,sessionId,requestId:`xiattach_${crypto.randomUUID()}`});
 async function tracked<T>(request:XiaozhiAttachmentInput,action:()=>Promise<T>|undefined){
  requests.current.set(request.requestId,{schemaVersion:request.schemaVersion,sessionId:request.sessionId,requestId:request.requestId});
  try{return await action();}finally{requests.current.delete(request.requestId);}
 }
 async function refresh(stamp=epoch.current){
  const request=input();
  try{
   const result=await tracked(request,()=>window.omniEdu?.listXiaozhiAttachments(request));
   if(stamp!==epoch.current)return;
   if(!result?.ok){setNotice(result?XIAOZHI_ATTACHMENT_ERRORS[result.error]:'无法读取附件，请重试。');return;}
   setItems(result.data);setLoading(false);
   // Sequential requests keep room for foreground preview/cancel and never exceed the host pool.
   for(const item of result.data.filter(v=>v.format==='image')){
    if(stamp!==epoch.current)return;
    const thumbRequest={...input(),selection:{id:item.id,revision:item.revision}};
    const thumb=await tracked(thumbRequest,()=>window.omniEdu?.thumbnailXiaozhiAttachment(thumbRequest));
    if(stamp!==epoch.current)return;
    if(thumb?.ok)setThumbnails(previous=>({...previous,[`${item.id}:${item.revision}`]:thumb.data.thumbnail}));
    else if(thumb)setNotice(`${item.name}：${XIAOZHI_ATTACHMENT_ERRORS[thumb.error]}`);
   }
  }catch{if(stamp===epoch.current)setNotice('无法读取附件，请重试。');}
 }
 useEffect(()=>{
  const stamp=++epoch.current;cancel();mutation.current=false;
  setItems([]);setThumbnails({});setSelected(undefined);setPreview(undefined);setBusy(false);setReading(false);setOcrBusy(false);setNotice('');setLoading(true);
  if(sessionId&&visible)void refresh(stamp);
  return()=>{++epoch.current;cancel();};
 },[sessionId,visible]);
 const historyImages=history.flatMap(item=>item.attachments||[]).filter(item=>item.format==='image');
 const historyKey=JSON.stringify(historyImages.map(item=>[item.id,item.revision]));
 useEffect(()=>{
  if(!sessionId||!visible)return;let current=true;const stamp=epoch.current;
  const pending:XiaozhiAttachmentInput[]=[];
  void(async()=>{for(const item of historyImages){
   if(!current||stamp!==epoch.current)return;
   const request={...input(),selection:{id:item.id,revision:item.revision}};pending.push(request);
   const result=await tracked(request,()=>window.omniEdu?.thumbnailXiaozhiAttachment(request));
   if(result?.ok&&current&&stamp===epoch.current)setThumbnails(previous=>({...previous,[`${item.id}:${item.revision}`]:result.data.thumbnail}));
  }})().catch(()=>undefined);
  return()=>{current=false;for(const request of pending)void window.omniEdu?.cancelXiaozhiAttachment({schemaVersion:request.schemaVersion,sessionId:request.sessionId,requestId:request.requestId}).catch(()=>undefined);};
 },[sessionId,visible,historyKey]);
 async function choose(){
  if(!sessionId||!visible||mutation.current)return;
  mutation.current=true;setBusy(true);setNotice('');const stamp=epoch.current,request=input();
  try{
   const result=await tracked(request,()=>window.omniEdu?.chooseXiaozhiAttachments(request));
   if(stamp!==epoch.current)return;
   if(!result?.ok)setNotice(result?XIAOZHI_ATTACHMENT_ERRORS[result.error]:'文件选择未完成，请重试。');
   else if(result.data.failures.length)setNotice(result.data.failures.map(v=>`${v.name}：${XIAOZHI_ATTACHMENT_ERRORS[v.error]}`).join('；'));
   await refresh(stamp);
  }catch{if(stamp===epoch.current)setNotice('文件选择未完成，请重试。');}
  finally{if(stamp===epoch.current){mutation.current=false;setBusy(false);}}
 }
 async function remove(item:XiaozhiAttachment){
  if(mutation.current)return;mutation.current=true;setBusy(true);setNotice('');const stamp=epoch.current;
  const request={...input(),selection:{id:item.id,revision:item.revision}};
  try{
   const result=await tracked(request,()=>window.omniEdu?.removeXiaozhiAttachment(request));
   if(stamp!==epoch.current)return;
   if(!result?.ok)setNotice(result?XIAOZHI_ATTACHMENT_ERRORS[result.error]:'附件未移除，请重试。');
   else{if(selected?.id===item.id){setSelected(undefined);setPreview(undefined);}await refresh(stamp);}
  }catch{if(stamp===epoch.current)setNotice('附件未移除，请重试。');}
  finally{if(stamp===epoch.current){mutation.current=false;setBusy(false);}}
 }
 const previewRequest=useRef<XiaozhiAttachmentInput|undefined>(undefined);
 function closePreview(){
  if(previewRequest.current)void window.omniEdu?.cancelXiaozhiAttachment(previewRequest.current).catch(()=>undefined);
  previewRequest.current=undefined;setSelected(undefined);setPreview(undefined);setReading(false);
 }
 async function open(item:XiaozhiAttachment){
  closePreview();setSelected(item);setReading(true);setPreviewError('');const stamp=epoch.current;
  const request={...input(),selection:{id:item.id,revision:item.revision}};
  previewRequest.current={schemaVersion:request.schemaVersion,sessionId:request.sessionId,requestId:request.requestId};
  try{
   const result=await tracked(request,()=>window.omniEdu?.previewXiaozhiAttachment(request));
   if(stamp!==epoch.current||previewRequest.current?.requestId!==request.requestId)return;
   if(result?.ok)setPreview(result.data);else setPreviewError(result?XIAOZHI_ATTACHMENT_ERRORS[result.error]:'无法预览附件，请重试。');
  }catch{if(stamp===epoch.current&&previewRequest.current?.requestId===request.requestId)setPreviewError('无法预览附件，请重试。');}
  finally{if(stamp===epoch.current&&previewRequest.current?.requestId===request.requestId)setReading(false);}
 }
 const renderCards=(values:XiaozhiAttachment[],submitted=false)=><ChatAttachmentGroup>{values.map(item=><div key={item.id} className="pi-attachment-item" data-testid={`pi-attachment-${item.id}`} data-state={item.state}>
    <ChatAttachment mimeType={item.mime} name={item.name} src={thumbnails[`${item.id}:${item.revision}`]}>
     <Button variant="ghost" isIconOnly className="pi-attachment-open" aria-label={`预览附件 ${item.name}`} onPress={()=>void open(item)}>
      <ChatAttachment.Preview>{item.format==='image'&&thumbnails[`${item.id}:${item.revision}`]?<img src={thumbnails[`${item.id}:${item.revision}`]} alt={item.name}/>:<FileText size={22}/>}</ChatAttachment.Preview>
     </Button>
     <ChatAttachment.Name/>
     {!submitted&&<ChatAttachment.Remove aria-label={`移除附件 ${item.name}`} isDisabled={busy} onPress={()=>void remove(item)}/>}
    </ChatAttachment><span className="pi-attachment-caption" title={item.name}>{item.name}</span>
   </div>)}</ChatAttachmentGroup>;
 const renderHistory=(item:OfficeProjectedItem)=>item.attachments?.length?<section className="pi-attachments pi-attachment-history" data-testid="pi-attachment-history" aria-label="本轮已发送附件">
  {renderCards(item.attachments,true)}<p className="pi-attachment-local-note">本地附件 · {item.attachments.length} 个</p>
 </section>:undefined;
 const cards=<section className="pi-attachments" data-testid="pi-attachments" aria-label="本地待发送附件">
  {items.length>0&&<><p className="pi-attachment-count" data-testid="pi-attachment-count">附件 {items.length}/8 · 待发送</p>
   {renderCards(items)}<p className="pi-attachment-local-note">已保存在本机，发送后可从本轮消息打开。</p></>}
  {busy&&<p role="status">正在添加或更新附件… <Button variant="ghost" size="sm" onPress={cancel}>取消</Button></p>}
  {notice&&<p role="alert" data-testid="pi-attachment-error">{notice} <Button variant="ghost" size="sm" onPress={()=>void refresh()}>重新读取</Button></p>}
 </section>;
 const modal=selected&&<Modal.Backdrop isOpen onOpenChange={value=>{if(!value)closePreview();}}>
  <Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-attachment-dialog" data-testid="pi-attachment-preview">
   <Modal.Header><Modal.Heading>{selected.name}</Modal.Heading><p>本地预览 · 原文件保存在本机</p></Modal.Header>
   <Modal.Body aria-busy={reading}>
    {reading?<p role="status">正在读取附件…</p>:previewError?<div role="alert"><p>{previewError}</p><Button variant="ghost" size="sm" onPress={()=>void open(selected)}>重试</Button></div>:
     preview?.image?<><img src={preview.image} alt={preview.name} data-testid="pi-attachment-image"/><AttachmentOcrPanel key={`${selected.id}:${selected.revision}`} sessionId={sessionId} item={selected} onBusyChange={setOcrBusy}/></>:
     preview?.format==='markdown'||preview?.format==='office'?<><p>{preview.document?.format.toUpperCase()} · 本地提取正文，版式以原文件为准</p>
      <Markdown components={{img:({alt})=><span>［图片：{alt||'文档图片'}，未加载］</span>,a:({children})=><span>{children}</span>}}>{preview.text||''}</Markdown></>:
      <pre data-testid="pi-attachment-text">{preview?.text}</pre>}
   </Modal.Body>
   <Modal.Footer><Button variant="secondary" data-testid="pi-attachment-preview-close" onPress={closePreview}>关闭</Button></Modal.Footer>
  </Modal.Dialog></Modal.Container>
 </Modal.Backdrop>;
 return {cards,modal,choose,busy,refresh,renderHistory,hasAttachments:items.length>0,
  selections:items.map(item=>({id:item.id,revision:item.revision})),sendBlocked:loading||busy||ocrBusy};
}
