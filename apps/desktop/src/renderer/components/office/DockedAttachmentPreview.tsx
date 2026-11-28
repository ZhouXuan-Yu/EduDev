import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import {XIAOZHI_ATTACHMENTS_SCHEMA,XIAOZHI_ATTACHMENT_ERRORS,type XiaozhiAttachment,type XiaozhiAttachmentPreview} from '../../../shared/xiaozhi-attachments';
import {LocalFileContent} from './LocalFileContent';

export function DockedAttachmentPreview({sessionId,item,onClose,onDetails}:{
  sessionId:string;item:XiaozhiAttachment;onClose:()=>void;onDetails:(item:XiaozhiAttachment)=>void;
}){
  const [version,retry]=useState(0);
  const [preview,setPreview]=useState<XiaozhiAttachmentPreview>();
  const [error,setError]=useState('');
  useEffect(()=>{
    let current=true;
    const request={schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,sessionId,requestId:`xiattach_${crypto.randomUUID()}`};
    setPreview(undefined);
    setError('');
    void (async()=>{
      try{
        const result=await window.omniEdu?.previewXiaozhiAttachment({...request,selection:{id:item.id,revision:item.revision}});
        if(!current)return;
        if(result?.ok)setPreview(result.data);
        else setError(result?XIAOZHI_ATTACHMENT_ERRORS[result.error]:'本地预览暂不可用。');
      }catch{if(current)setError('无法读取此附件，请重试。');}
    })();
    return ()=>{current=false;void window.omniEdu?.cancelXiaozhiAttachment(request).catch(()=>undefined);};
  },[sessionId,item.id,item.revision,version]);
  return <section data-edu-domain="" className="docked-attachment-preview" aria-label={item.name} data-testid="pi-docked-attachment-preview">
    <header className="docked-attachment-heading">
      <strong title={item.name}>{item.name}</strong>
      {item.format==='image'&&<Button variant="ghost" size="sm" onPress={()=>onDetails(item)}>本地文字识别</Button>}
      <Button variant="ghost" size="sm" data-testid="pi-docked-attachment-close" aria-label="关闭预览" onPress={onClose}>关闭</Button>
    </header>
    <div className="pi-file-preview docked-attachment-body" aria-busy={!preview&&!error}>
      {error?<div role="alert"><p>{error}</p><Button variant="secondary" size="sm" onPress={()=>retry(v=>v+1)}>重试</Button></div>:
        preview?<LocalFileContent file={preview} imageTestId="pi-attachment-image" textTestId="pi-attachment-text" />:
        <p role="status">正在读取本地附件…</p>}
    </div>
  </section>;
}
