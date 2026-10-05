import {useEffect,useRef,useState} from 'react';import {Button,Modal} from '@heroui/react';import {Image as ImageIcon} from 'lucide-react';
import {ChatAttachment} from '../../heroui-pro/components/chat-attachment';
import {BROWSER_CAPTURE_SCHEMA,BROWSER_CAPTURE_ERRORS,type BrowserCapture} from '../../../shared/xiaozhi-browser-capture';
import './pi-attachments.css';
/** The existing native Pro attachment and OSS modal display the main-owned local capture. */
export function OfficeBrowserCapture({capture,sessionId}:{capture:BrowserCapture;sessionId:string}){
 const [image,setImage]=useState(''),[error,setError]=useState(''),[reading,setReading]=useState(false),[open,setOpen]=useState(false);const epoch=useRef(0);
 async function read(){const stamp=++epoch.current;setReading(true);setError('');try{
  const result=await window.omniEdu?.previewXiaozhiBrowserCapture({schemaVersion:BROWSER_CAPTURE_SCHEMA,sessionId,captureId:capture.id});
  if(stamp!==epoch.current)return;if(result?.ok)setImage(result.image);else{setImage('');setError(result?BROWSER_CAPTURE_ERRORS[result.error]:'无法读取截图，请重试。');}
 }catch{if(stamp===epoch.current){setImage('');setError('无法读取截图，请重试。');}}finally{if(stamp===epoch.current)setReading(false);}}
 useEffect(()=>{void read();return()=>{epoch.current++;};},[sessionId,capture.id,capture.sha256]);
 return <section className="pi-viewed-images" data-testid="pi-browser-capture" data-capture-id={capture.id}>
  <div className="pi-attachment-item"><ChatAttachment mimeType="image/png" name="网页截图" src={image||undefined}>
   <Button variant="ghost" isIconOnly className="pi-attachment-open" aria-label="查看网页截图" data-testid="pi-browser-capture-open" onPress={()=>{setOpen(true);void read();}}>
    <ChatAttachment.Preview>{image?<img src={image} alt={`网页截图：${capture.title}`}/>:<ImageIcon size={22}/>}</ChatAttachment.Preview>
   </Button><ChatAttachment.Name/>
  </ChatAttachment><span className="pi-attachment-caption">网页截图</span></div>
  <p className="pi-attachment-local-note">{capture.title} · {new Date(capture.observedAt).toLocaleString('zh-CN')}<br/>本地截图，可查看；未发送给模型。</p>
  {reading&&<p role="status">正在读取截图…</p>}{error&&<p role="alert" data-testid="pi-browser-capture-error">{error} <Button variant="ghost" size="sm" onPress={()=>void read()}>重试</Button></p>}
  <Modal.Backdrop isOpen={open} onOpenChange={setOpen}><Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-attachment-dialog pi-themed-surface" data-testid="pi-browser-capture-preview">
   <Modal.Header><Modal.Heading>网页截图</Modal.Heading><p>{capture.title}</p></Modal.Header><Modal.Body aria-busy={reading}>
    {reading?<p role="status">正在读取截图…</p>:error?<div role="alert"><p>{error}</p><Button variant="ghost" size="sm" onPress={()=>void read()}>重试</Button></div>:image?<img src={image} alt={capture.title} data-testid="pi-browser-capture-image"/>:null}
   </Modal.Body><Modal.Footer><Button variant="secondary" data-testid="pi-browser-capture-close" onPress={()=>setOpen(false)}>关闭</Button></Modal.Footer>
  </Modal.Dialog></Modal.Container></Modal.Backdrop>
 </section>;
}
