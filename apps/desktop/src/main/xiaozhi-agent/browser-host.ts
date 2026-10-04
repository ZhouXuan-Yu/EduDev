import type {BaseWindow,WebContentsView,Session} from 'electron';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {officeWebUrl,waitOfficeAbort,type OfficeDnsMode} from '../office-agent/office-network';
import {createPublicBrowserProxy} from './browser-proxy';
import {SNAPSHOT_SCRIPT} from './vendor/hana/browser/snapshot';
import {validBrowserInput,type XiaozhiBrowserInput,type XiaozhiBrowserReceipt} from '../../shared/xiaozhi-browser';
import {BROWSER_CAPTURE_SCHEMA,validBrowserCapture} from '../../shared/xiaozhi-browser-capture';
import {browserScreenshotFilename} from './vendor/hana/browser/screenshot-filename';
import {approvedFile} from './workspace-authority';
import {readBrowserCapture} from './browser-capture-reader';

type Tab={id:string;view:WebContentsView;session:Session;state:'loading'|'ready'|'failed';error?:string;snapshotId?:string;refs:Map<number,string>;write?:{origin:string;until:number};revision:number};
type Group={window:BaseWindow;status:WebContentsView;tabs:Map<string,Tab>;active:string;proxy:Awaited<ReturnType<typeof createPublicBrowserProxy>>;busy:boolean;closing:boolean};
const sensitive=/sk-[\w-]{20,}|(?:api[-_]?key|token|secret|password|authorization)=/i;
let nativeRuntime:typeof import('electron')|undefined;
async function electronRuntime(){if(!nativeRuntime){const loaded=await import('electron');nativeRuntime=loaded.default||loaded;}return nativeRuntime;}

/** Hana's Electron view + original DOM/ref snapshot; authority and safe transport stay in main. */
export function createXiaozhiBrowserHost(options:{root:string;sanitize:(text:string)=>Promise<string>;
  /** Main-only path for isolated acceptance builds. No renderer or tool parameter. */
  statusFile?:string;
  /** Main-only isolated native acceptance fixture, never installed by production. */
  afterTabCreated?:(contents:WebContentsView['webContents'],partition:Session)=>Promise<void>}) {
  const groups=new Map<string,Group>(),pending=new Map<string,Promise<Group>>();let disposed=false;
  const safeUrl=async(raw:string)=>{const url=officeWebUrl(raw).href;let decoded:string;try{decoded=decodeURIComponent(url);}catch{throw new Error('permission_denied');}if(sensitive.test(decoded)||(await options.sanitize(decoded))!==decoded)throw new Error('permission_denied');return url;};
  function showStatus(g:Group,state:string){if(g.closing||g.status.webContents.isDestroyed())return;g.status.setVisible(true);g.window.contentView.removeChildView(g.status);g.window.contentView.addChildView(g.status);void g.status.webContents.executeJavaScript(`location.hash=${JSON.stringify(state)}`).catch(()=>{});g.window.setTitle('小智 · 浏览器');}
  function showTab(g:Group,tab:Tab){for(const t of g.tabs.values())t.view.setVisible(t===tab);g.active=tab.id;if(tab.state==='ready')g.status.setVisible(false);else showStatus(g,tab.error||'loading');}
  async function closeGroup(id:string){const group=groups.get(id);if(!group)return;groups.delete(id);group.closing=true;for(const tab of group.tabs.values())if(!tab.view.webContents.isDestroyed())tab.view.webContents.close({waitForBeforeUnload:false});if(!group.status.webContents.isDestroyed())group.status.webContents.close({waitForBeforeUnload:false});if(!group.window.isDestroyed())group.window.destroy();await group.proxy.close();}
  async function group(id:string,dnsMode:OfficeDnsMode){
    if(disposed||!/^aisession_[a-f0-9-]{36}$/i.test(id))throw new Error('permission_denied');
    const existing=groups.get(id);if(existing){if(!existing.busy&&existing.proxy.setDnsMode(dnsMode))await Promise.all([...existing.tabs.values()].map(t=>t.session.closeAllConnections()));return existing;}const started=pending.get(id);if(started)return started;
    const job=(async()=>{const proxy=await createPublicBrowserProxy(dnsMode);if(disposed){await proxy.close();throw new Error('cancelled');}
      const electron=await electronRuntime();const window=new electron.BaseWindow({width:1100,height:760,title:'小智 · 浏览器',show:false,backgroundColor:'#ffffff'});window.setMenu(null);
      const status=new electron.WebContentsView({webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
      status.webContents.setWindowOpenHandler(()=>({action:'deny'}));status.webContents.on('will-navigate',event=>event.preventDefault());
      const value:Group={window,status,tabs:new Map(),active:'',proxy,busy:false,closing:false};
      try{if(process.env.ELECTRON_RENDERER_URL&&!options.statusFile){const url=new URL('browser-status.html',process.env.ELECTRON_RENDERER_URL+'/');url.hash='loading';await status.webContents.loadURL(url.href);}else await status.webContents.loadFile(options.statusFile||path.resolve(import.meta.dirname,'../renderer/browser-status.html'),{hash:'loading'});}catch(error){status.webContents.close();window.destroy();await proxy.close();throw error;}
      groups.set(id,value);window.contentView.addChildView(status);const [width,height]=window.getContentSize();status.setBounds({x:0,y:0,width,height});
      window.on('resize',()=>{const [width,height]=window.getContentSize();value.status.setBounds({x:0,y:0,width,height});for(const tab of value.tabs.values())tab.view.setBounds({x:0,y:0,width,height});});
      window.on('closed',()=>{void closeGroup(id);});return value;})();pending.set(id,job);try{return await job;}finally{pending.delete(id);}
  }
  async function createTab(id:string,g:Group){
    const electron=await electronRuntime();
    const partition=electron.session.fromPartition('xiaozhi-browser-'+randomUUID(),{cache:false});
    partition.setPermissionRequestHandler((_wc,_permission,done)=>done(false));partition.setPermissionCheckHandler(()=>false);
    partition.on('will-download',(event)=>event.preventDefault());
    await partition.setProxy({mode:'fixed_servers',proxyRules:`http://127.0.0.1:${g.proxy.port}`,proxyBypassRules:'<-loopback>'});
    await partition.closeAllConnections();
    if(disposed||g.closing)throw new Error('cancelled');
    const view=new electron.WebContentsView({webPreferences:{session:partition,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,devTools:false,spellcheck:false}});
    const tab:Tab={id:'pibrowser_'+randomUUID(),view,session:partition,refs:new Map(),revision:0,state:'loading'};
    const wc=view.webContents;wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');wc.setWindowOpenHandler(()=>({action:'deny'}));
    wc.on('will-attach-webview',event=>event.preventDefault());
    wc.on('login',(event,details,authInfo,callback)=>{event.preventDefault();if(authInfo.isProxy&&authInfo.host==='127.0.0.1'&&authInfo.port===g.proxy.port)callback(g.proxy.username,g.proxy.password);else callback();});
    wc.on('did-start-navigation',()=>{tab.revision++;tab.snapshotId=undefined;tab.refs.clear();tab.write=undefined;});
    wc.on('did-start-loading',()=>{tab.state='loading';tab.error=undefined;if(g.active===tab.id)showStatus(g,'loading');});
    wc.on('did-finish-load',()=>{if(tab.error)return;const error=g.proxy.failureFor(wc.getURL());if(error){tab.state='failed';tab.error=error;if(g.active===tab.id)showStatus(g,error);return;}tab.state='ready';if(g.active===tab.id)showTab(g,tab);});
    wc.on('did-fail-load',(_event,code,_description,url,isMainFrame)=>{if(!isMainFrame||code===-3&&tab.error)return;tab.state='failed';tab.error=g.proxy.failureFor(url)||(code===-3?'cancelled':code===-7?'timeout':'network');if(g.active===tab.id)showStatus(g,tab.error);});
    wc.on('page-title-updated',()=>{if(!g.window.isDestroyed()&&g.active===tab.id)g.window.setTitle('小智 · 浏览器 · '+wc.getTitle().slice(0,150));});
    partition.webRequest.onBeforeRequest((request,done)=>{void(async()=>{try{
      if(disposed||g.closing||wc.isDestroyed())throw new Error('cancelled');await safeUrl(request.url);
      if(!['GET','HEAD'].includes(request.method)){
        const permission=tab.write;if(!permission||permission.until<Date.now()||new URL(request.url).origin!==permission.origin||request.webContentsId!==wc.id)throw new Error('permission_denied');
      }done({cancel:false});
    }catch{done({cancel:true});}})();});
    await options.afterTabCreated?.(wc,partition);
    g.tabs.set(tab.id,tab);g.active=tab.id;g.window.contentView.addChildView(view);const [width,height]=g.window.getContentSize();view.setBounds({x:0,y:0,width,height});showTab(g,tab);return tab;
  }
  async function snapshot(tab:Tab,signal:AbortSignal):Promise<XiaozhiBrowserReceipt>{
    signal=AbortSignal.any([signal,AbortSignal.timeout(15000)]);
    signal.throwIfAborted();if(tab.state!=='ready')throw new Error(tab.error||'network');const wc=tab.view.webContents,revision=tab.revision;await safeUrl(wc.getURL());
    const result=await waitOfficeAbort(wc.executeJavaScript(SNAPSHOT_SCRIPT),signal) as {title:string;currentUrl:string;text:string};
    const refs=await waitOfficeAbort(wc.executeJavaScript(`Array.from(document.querySelectorAll('[data-hana-ref]')).slice(0,100000).map(el=>[Number(el.getAttribute('data-hana-ref')),el.outerHTML.length<=16384?el.outerHTML:''])`),signal) as [number,string][];
    const receipt={tabId:tab.id,title:(await options.sanitize(result.title)).slice(0,200),url:await safeUrl(result.currentUrl),observedAt:new Date().toISOString(),snapshotId:'pisnapshot_'+randomUUID(),text:(await options.sanitize(result.text)).slice(0,30000),untrusted:true as const};
    signal.throwIfAborted();if(tab.revision!==revision||wc.isDestroyed())throw new Error('attachment_changed');tab.refs=new Map(refs.filter(([_ref,html])=>!!html));tab.snapshotId=receipt.snapshotId;return receipt;
  }
  return {
    async status(id:string){const g=groups.get(id);if(!g||g.closing)return {open:false};const tabs=[];for(const tab of g.tabs.values()){if(tab.state!=='ready'||tab.view.webContents.isDestroyed())continue;try{tabs.push({tabId:tab.id,title:(await options.sanitize(tab.view.webContents.getTitle())).slice(0,200),url:await safeUrl(tab.view.webContents.getURL()),active:tab.id===g.active});}catch{/* Blank/blocked pages are not a source. */}}return {open:true,tabs};},
    show(id:string){const g=groups.get(id);if(!g||g.closing||g.window.isDestroyed())throw new Error('permission_denied');g.window.show();g.window.focus();},
    async execute(id:string,input:XiaozhiBrowserInput,context:{signal:AbortSignal;dnsMode:OfficeDnsMode;current:()=>boolean;confirm:(question:string,signal:AbortSignal)=>Promise<boolean>}):Promise<XiaozhiBrowserReceipt|{tabs:{tabId:string;title:string;url:string;active:boolean}[]}|{closed:true}> {
      if(!validBrowserInput(input)||disposed)throw new Error('invalid_input');const check=()=>{context.signal.throwIfAborted();if(!context.current())throw new Error('cancelled');};check();
      if(input.action==='close'&&!input.tabId){await closeGroup(id);return {closed:true};}
      const g=await group(id,context.dnsMode);check();if(g.busy)throw new Error('busy');g.busy=true;
      let tab:Tab|undefined;
      const stop=()=>{tab?.view.webContents.stop();g.proxy.stopConnections();if(tab){tab.write=undefined;if(tab.state==='loading'){tab.state='failed';tab.error='cancelled';showStatus(g,'cancelled');}}};context.signal.addEventListener('abort',stop,{once:true});
      try{
        if(input.action==='tabs')return {tabs:await Promise.all([...g.tabs.values()].filter(t=>t.state==='ready').map(async t=>({tabId:t.id,title:(await options.sanitize(t.view.webContents.getTitle())).slice(0,200),url:await safeUrl(t.view.webContents.getURL()),active:t.id===g.active})))};
        tab=input.tabId?g.tabs.get(input.tabId):g.tabs.get(g.active);if(input.tabId&&!tab)throw new Error('permission_denied');
        if(input.action==='navigate'&&(input.newTab||!tab))tab=await createTab(id,g);if(!tab||tab.view.webContents.isDestroyed())throw new Error('permission_denied');check();
        const wc=tab.view.webContents;
        const activate=()=>{showTab(g,tab!);g.window.show();g.window.focus();};
        const navigate=async(raw:string)=>{const signal=AbortSignal.any([context.signal,AbortSignal.timeout(30000)]);let url:string|undefined;try{url=await safeUrl(raw);check();tab!.state='loading';tab!.error=undefined;showStatus(g,'loading');await waitOfficeAbort(wc.loadURL(url),signal);check();const failure=g.proxy.failureFor(wc.getURL());if(failure)throw new Error(failure);tab!.state='ready';showTab(g,tab!);}catch(error){wc.stop();g.proxy.stopConnections();const code=(error as Error).message;const reason=context.signal.aborted?'cancelled':signal.aborted?'timeout':url&&g.proxy.failureFor(url)||(['permission_denied','dns_blocked','cancelled','timeout'].includes(code)?code:'network');tab!.state='failed';tab!.error=reason;tab!.snapshotId=undefined;tab!.refs.clear();showStatus(g,reason);throw new Error(reason);}};
        const refScript=(body:string)=>{if(input.snapshotId!==tab!.snapshotId)throw new Error('attachment_changed');const expected=tab!.refs.get(input.ref!);if(!expected)throw new Error('attachment_changed');return `(function(){const el=document.querySelector('[data-hana-ref="${input.ref}"]');if(!el||el.outerHTML!==${JSON.stringify(expected)})throw new Error('Browser reference changed');${body}})()`;};
        const approve=async()=>{const url=await safeUrl(wc.getURL()),revision=tab!.revision;
          const question=await options.sanitize(`允许小智在 ${new URL(url).hostname} 的“${wc.getTitle().slice(0,100)}”页面执行这次“${input.action}”操作${input.ref?`（控件 ${input.ref}）`:''}${input.text!==undefined?`，输入“${input.text.slice(0,200)}”`:input.value!==undefined?`，选择“${input.value.slice(0,200)}”`:input.key?`，按 ${input.key}`:''}吗？页面可能提交内容。`);
          if(!await context.confirm(question,context.signal))throw new Error('permission_denied');check();if(tab!.revision!==revision||wc.getURL()!==url)throw new Error('attachment_changed');tab!.write={origin:new URL(url).origin,until:Date.now()+10000};};
        if(input.action==='navigate'){activate();await navigate(input.url!);}
        else if(input.action==='show'){activate();}
        else if(input.action==='close'){g.tabs.delete(tab.id);wc.close({waitForBeforeUnload:false});if(!g.tabs.size){await closeGroup(id);}else{showTab(g,g.tabs.values().next().value!);}return {closed:true};}
        else if(input.action==='click'){
          const href=await wc.executeJavaScript(refScript("return el.tagName==='A'?el.href:null;"));check();
          if(typeof href==='string'&&href)await navigate(href);else{await approve();await waitOfficeAbort(wc.executeJavaScript(refScript('el.scrollIntoView({block:"center"});el.click();')),context.signal);}
        }else if(input.action==='type'){
          if(sensitive.test(input.text!)||await options.sanitize(input.text!)!==input.text)throw new Error('permission_denied');
          await approve();await waitOfficeAbort(wc.executeJavaScript(refScript("if(!['INPUT','TEXTAREA'].includes(el.tagName)||['password','file','hidden'].includes(el.type)||el.readOnly||el.disabled)throw new Error('Protected input');el.scrollIntoView({block:'center'});el.focus();if(el.select)el.select();")),context.signal);check();await wc.insertText(input.text!);
        }else if(input.action==='select'){await approve();await waitOfficeAbort(wc.executeJavaScript(refScript(`if(el.tagName!=='SELECT'||el.disabled)throw new Error('Protected select');el.value=${JSON.stringify(input.value)};el.dispatchEvent(new Event('change',{bubbles:true}));`)),context.signal);}
        else if(input.action==='key'){if(input.snapshotId!==tab.snapshotId)throw new Error('attachment_changed');await approve();if(input.snapshotId!==tab.snapshotId)throw new Error('attachment_changed');const key=input.key==='Enter'?'Return':input.key!;wc.sendInputEvent({type:'keyDown',keyCode:key});wc.sendInputEvent({type:'keyUp',keyCode:key});}
        else if(input.action==='scroll'){await waitOfficeAbort(wc.executeJavaScript(`window.scrollBy(0,${(input.direction==='up'?-1:1)*(input.amount||3)*300})`),context.signal);}
        else if(input.action==='screenshot'){
          if(tab.state!=='ready')throw new Error(tab.error||'network');
          const url=await safeUrl(wc.getURL()),revision=tab.revision;
          const samePage=()=>{check();if(wc.isDestroyed()||tab!.state!=='ready'||tab!.revision!==revision||wc.getURL()!==url)throw new Error('attachment_changed');};
          activate();await waitOfficeAbort(wc.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'),AbortSignal.any([context.signal,AbortSignal.timeout(5000)]));samePage();
          const image=await waitOfficeAbort(wc.capturePage(undefined,{stayAwake:true}),context.signal);samePage();if(image.isEmpty())throw new Error('network');
          const bytes=image.toPNG(),size=image.getSize(),capture={schemaVersion:BROWSER_CAPTURE_SCHEMA,id:browserScreenshotFilename({base64:bytes.toString('base64'),mimeType:'image/png'}),sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,width:size.width,height:size.height,title:(await options.sanitize(wc.getTitle())).slice(0,200),url,observedAt:new Date().toISOString()};
          if(!validBrowserCapture(capture))throw new Error('too_large');samePage();
          const relative=path.join(createHash('sha256').update(id).digest('hex'),capture.id),file=approvedFile(options.root,relative);
          await fs.mkdir(path.dirname(file),{recursive:true});samePage();approvedFile(options.root,relative);
          try{await fs.writeFile(file,bytes,{flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;await readBrowserCapture(options.root,id,capture);}
          samePage();return {tabId:tab.id,title:capture.title,url,observedAt:capture.observedAt,untrusted:true,captured:true,capture};
        }
        // Original Hana wait helper only for page stability, never a run timeout.
        if(!['snapshot','show'].includes(input.action)){
          const {waitForBrowserState}=await import('./vendor/hana/browser/browser-wait.cjs');
          await waitOfficeAbort(waitForBrowserState(wc,{state:'stable',timeoutMs:5000}),context.signal);
        }check();return await snapshot(tab,context.signal);
      }finally{if(tab)tab.write=undefined;context.signal.removeEventListener('abort',stop);g.busy=false;}
    },
    cancel(id:string){const g=groups.get(id);if(g){for(const tab of g.tabs.values()){tab.write=undefined;tab.view.webContents.stop();}g.proxy.stopConnections();}},
    async dispose(){disposed=true;await Promise.allSettled([...pending.values()]);await Promise.all([...groups.keys()].map(closeGroup));},
  };
}
