import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Globe,PanelRight,Plus,X} from 'lucide-react';
import {BrowserAddress,BrowserControlBanner,browserTabLabel} from './components/office/BrowserChrome';
import type {XiaozhiBrowserStatus} from '../shared/xiaozhi-agent';
import {BROWSER_CHROME_ERRORS,browserChromeError,type BrowserChromeResult,type BrowserControlCommand} from '../shared/xiaozhi-browser';
import './ui-system/browser-workspace.css';

declare global {
  interface Window {xiaozhiBrowserToolbar:{run:(command:BrowserControlCommand,value?:string)=>Promise<BrowserChromeResult>}}
}

function FloatingBrowserToolbar(){
  const [status,setStatus]=useState<XiaozhiBrowserStatus>({open:false});
  const [error,setError]=useState('');
  const tab=status.tabs?.find(item=>item.active);
  const manual=status.owner==='teacher';
  async function run(action:BrowserControlCommand,value?:string){
    const result=await window.xiaozhiBrowserToolbar.run(action,value);
    if(result.status)setStatus(result.status);
    if(action!=='status')setError(result.ok?'':BROWSER_CHROME_ERRORS[browserChromeError(result.error)||'unavailable']);
    return result.ok;
  }
  useEffect(()=>{
    let pending=false;
    async function update(){if(pending)return;pending=true;try{await run('status');}finally{pending=false;}}
    const timer=window.setInterval(()=>void update(),400);void update();
    return ()=>window.clearInterval(timer);
  },[]);
  return <main className="floating-browser-toolbar" aria-label="独立浏览器工具栏">
    <div className="browser-workspace-top">
      <div className="browser-tab-strip" aria-label="网页标签">
        {status.tabs?.map(item=><div className="browser-tab" data-selected={item.active} key={item.tabId}>
          <button type="button" aria-pressed={item.active} onClick={()=>void run('select-tab',item.tabId)}><Globe size={14}/><span>{browserTabLabel(item)}</span></button>
          <button type="button" aria-label={'关闭网页 '+browserTabLabel(item)} onClick={()=>void run('close-tab',item.tabId)}><X size={13}/></button>
        </div>)}
      </div>
      <button type="button" aria-label="新建网页标签" title="新建网页标签" onClick={()=>void run('new-tab')}><Plus size={18}/></button>
      <button type="button" title="放回对话" aria-label="放回对话" onClick={()=>void run('redock')}><PanelRight size={18}/></button>
    </div>
    {status.open&&<BrowserControlBanner status={status} run={run}/>}
    <BrowserAddress key={tab?.tabId??'start'} tab={tab} run={async(action,value)=>{
      if(!manual&&status.open&&!(await run('teacher')))return false;
      return run(action,value);
    }}/>
    {error&&<p role="status" className="browser-action-message">{error}</p>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<FloatingBrowserToolbar/>);
