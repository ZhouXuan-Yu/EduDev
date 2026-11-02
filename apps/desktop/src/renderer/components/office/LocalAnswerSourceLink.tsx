import {useEffect,useRef,useState} from 'react';
import {Button,Modal} from '@heroui/react';
import {BookOpen} from 'lucide-react';
import {validLocalAnswerSource,type LocalAnswerSource} from '../../../shared/local-answer-source';
import {XIAOZHI_ATTACHMENTS_SCHEMA,XIAOZHI_ATTACHMENT_ERRORS,type XiaozhiAttachmentInput} from '../../../shared/xiaozhi-attachments';
import {XIAOZHI_FILES_SCHEMA,XIAOZHI_FILE_ERRORS} from '../../../shared/xiaozhi-files';

/** Existing typed previews recheck current scope and the exact cited version; no model request. */
export function LocalAnswerSourceLink({source,title,sessionId}:{source:LocalAnswerSource;title:string;sessionId:string}) {
  const [opened,setOpened]=useState(false),[busy,setBusy]=useState(false),[text,setText]=useState(''),[error,setError]=useState('');
  const epoch=useRef(0),cancels=useRef<(()=>void)[]>([]);
  function cancel(){++epoch.current;for(const fn of cancels.current)fn();cancels.current=[];}
  useEffect(()=>{close();return()=>cancel();},[sessionId,JSON.stringify(source)]);
  function close(){cancel();setOpened(false);setText('');setError('');setBusy(false);}
  async function open(){
    cancel();const stamp=epoch.current;setOpened(true);setBusy(true);setText('');setError('');
    try{
      if(!validLocalAnswerSource(source))throw Error('来源记录无效，请重新读取。');
      let body:string|undefined;
      if(source.kind==='attachment'){
        const request:XiaozhiAttachmentInput={schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,sessionId,requestId:'xiattach_'+crypto.randomUUID()};
        cancels.current.push(()=>{void window.omniEdu?.cancelXiaozhiAttachment(request).catch(()=>undefined);});
        const selected={...request,selection:{id:source.id,revision:source.revision}};
        const preview=await window.omniEdu?.previewXiaozhiAttachment(selected);
        if(stamp!==epoch.current)return;
        if(!preview?.ok)throw Error(preview?XIAOZHI_ATTACHMENT_ERRORS[preview.error]:'本地预览暂不可用。');
        if(preview.data.version!==source.version)throw Error('来源版本已变化，请让小智重新读取后引用。');
        if(source.locator==='ocr_lines'){
          const reviewRequest={...selected,requestId:'xiattach_'+crypto.randomUUID()};
          cancels.current.push(()=>{void window.omniEdu?.cancelXiaozhiAttachment(reviewRequest).catch(()=>undefined);});
          const review=await window.omniEdu?.reviewXiaozhiAttachmentOcr(reviewRequest);
          if(stamp!==epoch.current)return;
          if(!review?.ok||review.data?.status!=='approved'||review.data.revision!==source.ocrRevision)throw Error('教师校正文字已变化，请重新读取后引用。');
          body=review.data.corrected;
        }else body=preview.data.text;
      }else{
        const request={schemaVersion:XIAOZHI_FILES_SCHEMA,sessionId,requestId:'xifile_'+crypto.randomUUID(),path:'.'};
        cancels.current.push(()=>{void window.omniEdu?.cancelXiaozhiFile({sessionId,requestId:request.requestId}).catch(()=>undefined);});
        const workspace=await window.omniEdu?.listXiaozhiFiles(request);
        if(stamp!==epoch.current)return;
        if(!workspace?.ok)throw Error(workspace?XIAOZHI_FILE_ERRORS[workspace.error]:'无法读取工作目录。');
        const requestId='xifile_'+crypto.randomUUID();
        cancels.current.push(()=>{void window.omniEdu?.cancelXiaozhiFile({sessionId,requestId}).catch(()=>undefined);});
        const preview=await window.omniEdu?.previewXiaozhiFile({...request,requestId,path:source.path,workspaceVersion:workspace.workspaceVersion,version:source.version});
        if(stamp!==epoch.current)return;
        if(!preview?.ok)throw Error(preview?XIAOZHI_FILE_ERRORS[preview.error]:'本地预览暂不可用。');
        if(preview.data.version!==source.version)throw Error('来源版本已变化，请重新读取后引用。');
        if(source.locator==='extracted_lines'&&(preview.data.format!=='office'||!preview.data.document))throw Error('此来源没有可核对的办公文档提取正文。');
        body=preview.data.text;
      }
      if(typeof body!=='string')throw Error('此来源没有可定位的文字。');
      const lines=body.split('\n');
      if(source.endLine>lines.length)throw Error('来源行号已变化，请重新读取后引用。');
      if(stamp===epoch.current)setText(lines.slice(source.startLine-1,source.endLine).join('\n').slice(0,65536));
    }catch(reason){if(stamp===epoch.current)setError(reason instanceof Error?reason.message:'无法打开来源，请重试。');}
    finally{if(stamp===epoch.current)setBusy(false);}
  }
  return <li><Button variant="ghost" className="pi-material-source" data-testid="pi-local-source-open" onPress={()=>void open()}><BookOpen size={16}/><span>{title}</span></Button>
    {opened&&<Modal.Backdrop isOpen onOpenChange={value=>{if(!value)close();}}><Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-attachment-dialog pi-themed-surface" data-testid="pi-local-source-preview">
      <Modal.Header><Modal.Heading>{title}</Modal.Heading><p>本机{source.kind==='attachment'?'附件':'工作文件'} · {source.locator==='extracted_lines'?'提取文字':source.locator==='ocr_lines'?'教师校正文字':'文本'}第{source.startLine}–{source.endLine}行{source.partialLine?'（末行部分读取）':''}</p></Modal.Header>
      <Modal.Body aria-busy={busy}>{busy?<p role="status">正在核对来源并读取…</p>:error?<p role="alert">{error}</p>:<pre data-testid="pi-local-source-text" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{text}</pre>}</Modal.Body>
      <Modal.Footer><Button variant="secondary" onPress={close}>关闭</Button></Modal.Footer>
    </Modal.Dialog></Modal.Container></Modal.Backdrop>}
  </li>;
}
