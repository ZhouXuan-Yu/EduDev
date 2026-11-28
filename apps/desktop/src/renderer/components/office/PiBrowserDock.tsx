import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {Button} from '@heroui/react';
import {ExternalLink,FileText,FolderOpen,Globe,PanelRightClose,Plus,X} from 'lucide-react';
import type {XiaozhiBrowserStatus} from '../../../shared/xiaozhi-agent';
import type {BrowserControlCommand} from '../../../shared/xiaozhi-browser';
import '../../ui-system/browser-workspace.css';
import {BrowserAddress,BrowserControlBanner,browserTabLabel} from './BrowserChrome';

export type FileTabRequest={id:string;requestId?:string;path?:string;artifactId?:string;title?:string;version?:string;workspaceVersion?:string};
const folderTab={id:'directory',title:'对话文件'};
const fileKey=(request:FileTabRequest)=>request.artifactId?'saved:'+request.artifactId:request.path?'file:'+request.path:'directory';
const browserError:Record<string,string>={
  invalid_input:'无法识别此地址或标签页。',permission_denied:'请使用公开 HTTP(S) 地址。去对话文件打开本地资料。',
  busy:'正在处理浏览器操作，请稍后重试。',network:'网页连接失败，请检查网络后重试。'
};

export function PiBrowserDock({id,initial,visible,covered,width,fileRequest,files,onClose}:{
  id:string;initial?:XiaozhiBrowserStatus;visible:boolean;covered:boolean;width:number;fileRequest?:FileTabRequest;
  files?:(close:()=>void,request?:FileTabRequest,openFile?:(request:FileTabRequest)=>void)=>ReactNode;onClose:()=>void;
}){
  const [status,setStatus]=useState<XiaozhiBrowserStatus>(initial??{open:false});
  const [fileTabs,setFileTabs]=useState<FileTabRequest[]>([]);
  const [fileId,setFileId]=useState<string>();
  const lastFileRequest=useRef<string>(undefined);
  const [message,setMessage]=useState('');
  const [forget,setForget]=useState(false);
  const [working,setWorking]=useState(false);
  const slot=useRef<HTMLDivElement>(null);
  const strip=useRef<HTMLDivElement>(null);
  const active=status.tabs?.find(tab=>tab.active);
  const selectedFile=fileTabs.find(tab=>tab.id===fileId);
  const manual=status.owner==='teacher';
  const floating=status.presentation==='floating';
  const blank=!active||active.state==='blank';
  const inflight=useRef(0);

  async function command(action:BrowserControlCommand,value?:string){
    const stamp=++inflight.current;
    setWorking(true);
    try {
      const result=await window.omniEdu?.controlXiaozhiBrowser(id,action,undefined,value);
      if(stamp!==inflight.current)return false;
      if(result?.status)setStatus(result.status);
      if(!result?.ok){setMessage(browserError[result?.error||'']||'浏览器操作未完成，请重试。');return false;}
      if(['new-tab','select-tab','redock'].includes(action))setFileId(undefined);
      setMessage(action==='forget'?'已清除此站保存在小智中的登录信息。':'');setForget(false);
      return true;
    }catch{setMessage('浏览器连接已中断，请重新打开。');return false;}
    finally{if(stamp===inflight.current)setWorking(false);}
  }
  function openFile(request:FileTabRequest){
    const key=fileKey(request);
    const tab={...request,id:key,requestId:crypto.randomUUID(),title:request.title||request.path?.split(/[\\/]/).at(-1)||folderTab.title};
    setFileTabs(previous=>previous.some(item=>item.id===key)?previous.map(item=>item.id===key?tab:item):[...previous,tab]);
    setFileId(key);
  }
  function closeFile(key:string){
    const index=fileTabs.findIndex(tab=>tab.id===key);
    if(fileId===key)setFileId(fileTabs[index+1]?.id??fileTabs[index-1]?.id);
    setFileTabs(tabs=>tabs.filter(tab=>tab.id!==key));
  }
  useEffect(()=>{
    const row=strip.current;
    const selected=row?.querySelector('[data-selected="true"]');
    if(!visible||!row||!selected)return;
    const current=selected.getBoundingClientRect(),bounds=row.getBoundingClientRect();
    if(current.left<bounds.left)row.scrollLeft-=bounds.left-current.left;
    else if(current.right>bounds.right)row.scrollLeft+=current.right-bounds.right;
  },[visible,fileId,active?.tabId,fileTabs.length,status.tabs?.length]);
  useEffect(()=>{
    if(!fileRequest||fileRequest.id===lastFileRequest.current)return;
    lastFileRequest.current=fileRequest.id;
    openFile(fileRequest);
  },[fileRequest]);
  useEffect(()=>{
    if(!visible)return;
    let live=true;
    async function refresh(){
      const stamp=inflight.current;
      const result=await window.omniEdu?.controlXiaozhiBrowser(id,'status');
      if(live&&stamp===inflight.current&&result?.status){const next=result.status;setStatus(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);}
    }
    void refresh().catch(()=>{});
    const timer=window.setInterval(()=>void refresh().catch(()=>{}),400);
    const remove=window.omniEdu?.onXiaozhiBrowserDock?.(target=>{if(target===id){setFileId(undefined);void refresh().catch(()=>{});}});
    return ()=>{live=false;clearInterval(timer);remove?.();};
  },[id,visible]);
  useEffect(()=>{
    const element=slot.current;
    if(!element||floating||!visible||selectedFile)return;
    let frame=0,last='';
    const place=()=>{
      frame=0;
      const r=element.getBoundingClientRect();
      const box={x:Math.ceil(r.left),y:Math.ceil(r.top),width:Math.max(0,Math.floor(r.right)-Math.ceil(r.left)),height:Math.max(0,Math.floor(r.bottom)-Math.ceil(r.top))};
      const modal=document.querySelector('[aria-modal="true"],dialog[open],[role="menu"],[data-overlay-container] [data-open="true"]');
      const obstructed=covered||document.hidden||!!modal||box.width<32||box.height<32||r.left<0||r.top<0||
        r.right>window.innerWidth+1||r.bottom>window.innerHeight+1||
        document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)!==element;
      const key=obstructed?'cover':JSON.stringify(box);
      if(last===key)return;last=key;
      void window.omniEdu?.controlXiaozhiBrowser(id,obstructed?'cover':'dock',obstructed?undefined:box).then(result=>{if(!result.ok)last='';});
    };
    const update=()=>{if(!frame)frame=requestAnimationFrame(place);};
    const size=new ResizeObserver(update);size.observe(element);
    const tree=new MutationObserver(update);tree.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','class','aria-modal','data-open','style']});
    window.addEventListener('resize',update);window.addEventListener('scroll',update,true);document.addEventListener('visibilitychange',update);place();
    return ()=>{cancelAnimationFrame(frame);tree.disconnect();size.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);document.removeEventListener('visibilitychange',update);void window.omniEdu?.controlXiaozhiBrowser(id,'cover');};
  },[id,floating,covered,visible,selectedFile?.id,active?.state]);
  return <aside hidden={!visible} className="pi-browser-dock" style={{'--browser-workspace-width':width+'px'} as CSSProperties} aria-label="右侧工作区" data-testid="pi-browser-dock">
    <div className="browser-workspace-top">
      <div ref={strip} className="browser-tab-strip" aria-label="已打开的网页和文件">
        {!status.tabs?.length&&!fileTabs.length&&<span className="browser-empty-tab"><Globe size={14}/>新标签页</span>}
        {status.tabs?.map(tab=><div className="browser-tab" data-selected={!fileId&&tab.active} key={tab.tabId}>
          <button type="button" aria-pressed={!fileId&&tab.active} title={browserTabLabel(tab)} onClick={()=>{if(tab.active)setFileId(undefined);else void command('select-tab',tab.tabId);}}><Globe size={14}/><span>{browserTabLabel(tab)}</span></button>
          <button type="button" aria-label={'关闭网页 '+browserTabLabel(tab)} onClick={()=>void command('close-tab',tab.tabId)}><X size={13}/></button>
        </div>)}
        {fileTabs.map(tab=><div className="browser-tab" data-selected={fileId===tab.id} key={tab.id}>
          <button type="button" aria-pressed={fileId===tab.id} title={tab.title} onClick={()=>setFileId(tab.id)}><FileText size={14}/><span>{tab.title}</span></button>
          <button type="button" aria-label={'关闭文件 '+tab.title} onClick={()=>closeFile(tab.id)}><X size={13}/></button>
        </div>)}
      </div>
      <button type="button" aria-label="新建网页标签" title="新建网页标签" onClick={()=>void command('new-tab')}><Plus size={18}/></button>
      {files&&<button type="button" aria-label="在右侧工作区打开对话文件" title="对话文件" onClick={()=>openFile(folderTab)}><FolderOpen size={17}/></button>}
      <button type="button" aria-label="收起" title="收起右侧工作区" onClick={onClose}><PanelRightClose size={18}/></button>
    </div>
    {!selectedFile&&status.open&&<BrowserControlBanner status={status} run={command} busy={working}/>}
    {!selectedFile&&status.open&&<div className="pi-browser-actions">
      <Button size="sm" variant="ghost" onPress={()=>void command(floating?'redock':'float')}><ExternalLink size={14}/>{floating?'放回对话':'独立窗口'}</Button>
      {manual&&status.siteOrigin&&!status.remembered&&active&&<Button size="sm" variant="ghost" isDisabled={working} onPress={()=>void command('remember')}>打开此站的本机登录</Button>}
      {manual&&status.siteOrigin&&<Button size="sm" variant="ghost" isDisabled={working} onPress={()=>forget?void command('forget'):setForget(true)}>{forget?'确认清除此站登录':'清除此站登录'}</Button>}
    </div>}
    {message&&<p role="status" className="browser-action-message">{message}</p>}
    {files&&fileTabs.map(tab=><div className="browser-file-surface" hidden={tab.id!==fileId||!visible} key={tab.id}>{files(()=>closeFile(tab.id),tab,openFile)}</div>)}
    {!selectedFile&&(floating?<div className="browser-start"><p>网页已在独立窗口打开。</p></div>:blank?
      <div className="browser-start"><h2>打开网页</h2><BrowserAddress key={active?.tabId??'start'} tab={active} run={async(action,value)=>{
        if(action==='navigate'&&status.open&&!manual&&!(await command('teacher')))return false;
        return command(action,value);
      }} starter/>{files&&<Button variant="ghost" onPress={()=>openFile(folderTab)}><FolderOpen size={16}/>浏览对话文件</Button>}</div>:
      <><BrowserAddress key={active.tabId} tab={active} run={async(action,value)=>{
        if(!manual&&!(await command('teacher')))return false;
        return command(action,value);
      }}/><div ref={slot} className="pi-browser-slot" data-testid="pi-browser-slot"/></>)}
  </aside>;
}
