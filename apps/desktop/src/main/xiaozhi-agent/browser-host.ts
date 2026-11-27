import {createBrowserLayout,type BrowserLayout} from './browser-surface';
import type {BaseWindow,BrowserWindow,Rectangle,WebContentsView,Session} from 'electron';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {officeWebUrl,waitOfficeAbort,type OfficeDnsMode} from '../office-agent/office-network';
import {createPublicBrowserProxy} from './browser-proxy';
import {uniqueBrowserRef,waitForBrowserText} from './browser-dom-observation';
import {SNAPSHOT_SCRIPT} from './vendor/hana/browser/snapshot';
import {validBrowserInput,type XiaozhiBrowserInput,type XiaozhiBrowserReceipt} from '../../shared/xiaozhi-browser';
import {BROWSER_CAPTURE_SCHEMA,validBrowserCapture} from '../../shared/xiaozhi-browser-capture';
import {browserScreenshotFilename} from './vendor/hana/browser/screenshot-filename';
import {approvedFile} from './workspace-authority';
import {readBrowserCapture} from './browser-capture-reader';
import {browserExtractScript} from './browser-extract-script';

type NavigationProof = {runId:string; callId:string; revision:number; url:string};
type Tab={requestedOrigin?:string;profileOrigin?:string;navigation?:NavigationProof;id:string;view:WebContentsView;session:Session;state:'loading'|'ready'|'failed';error?:string;snapshotId?:string;refs:Map<number,string>;write?:{origin:string;until:number};revision:number};
type Group={layout:BrowserLayout;needsObservation?:boolean;owner:'teacher'|'agent';control:AbortController;window:BaseWindow;status:WebContentsView;tabs:Map<string,Tab>;active:string;proxy:Awaited<ReturnType<typeof createPublicBrowserProxy>>;profileChange?:Promise<void>;busy:boolean;closing:boolean};
const denyDownload=(event:{preventDefault():void})=>event.preventDefault();
const sensitive=/sk-[\w-]{20,}|(?:api[-_]?key|token|secret|password|authorization)=/i;
let nativeRuntime:typeof import('electron')|undefined;
async function electronRuntime(){if(!nativeRuntime){const loaded=await import('electron');nativeRuntime=loaded.default||loaded;}return nativeRuntime;}

/** Hana's Electron view + original DOM/ref snapshot; authority and safe transport stay in main. */
export function createXiaozhiBrowserHost(options:{root:string;sanitize:(text:string)=>Promise<string>;
  /** Main-only path for isolated acceptance builds. No renderer or tool parameter. */
  statusFile?:string;requestDock?:(id:string)=>void;
  /** Main-only isolated native acceptance fixture, never installed by production. */
  afterTabCreated?:(contents:WebContentsView['webContents'],partition:Session)=>Promise<void>}) {
  const groups=new Map<string,Group>(),pending=new Map<string,Promise<Group>>();let disposed=false;
  const profileOwners=new Map<string,string>();
  const profileName=(origin:string)=>'persist:xiaozhi-site-'+createHash('sha256').update(path.resolve(options.root)+'\0'+origin).digest('hex');
  async function clearLogin(storage:Session){
    await storage.closeAllConnections();
    await storage.clearStorageData();
    await storage.clearCache();
    await storage.cookies.flushStore();
  }
  function siteOrigin(tab?:Tab){
    if(!tab)return;
    if(tab.profileOrigin)return tab.profileOrigin;
    try {
      const raw=tab.state==='ready'?tab.view.webContents?.getURL():tab.requestedOrigin;
      const url=raw&&new URL(raw);
      if(url&&url.protocol==='https:')return url.origin;
    }catch{/* Opaque and blocked pages have no reusable login. */}
  }
  function setOwner(g:Group, owner:Group['owner']) {
    if (g.owner===owner || (owner==='agent' && g.profileChange)) return;
    g.owner=owner;g.needsObservation=true;
    g.control.abort();
    g.control=new AbortController();
    for(const tab of g.tabs.values()) {tab.refs.clear();tab.snapshotId=undefined;tab.write=undefined;}
  }
  function beginProfileChange(g:Group) {
    let settle!:()=>void;
    g.busy=true;g.profileChange=new Promise<void>(resolve=>{settle=resolve;});
    return ()=>{g.busy=false;g.profileChange=undefined;settle();};
  }
  function stopPage(tab?:Tab){
    const wc=tab?.view.webContents;
    if(wc&&!wc.isDestroyed())wc.stop();
  }
  function releaseTab(g:Group, tab:Tab) {
    g.tabs.delete(tab.id);
    if(tab.profileOrigin && profileOwners.get(tab.profileOrigin)===tab.id) profileOwners.delete(tab.profileOrigin);
    g.layout.remove(tab.view);
    if(tab.view.webContents && !tab.view.webContents.isDestroyed())tab.view.webContents.close({waitForBeforeUnload:false});
  }
  const networkScopes=new Map<string,(url:string)=>boolean>();
  const checkScope=(id:string,url:string)=>{if(networkScopes.has(id)&&!networkScopes.get(id)!(url))throw new Error('permission_denied');};
  const safeUrl=async(raw:string)=>{const url=officeWebUrl(raw).href;let decoded:string;try{decoded=decodeURIComponent(url);}catch{throw new Error('permission_denied');}if(sensitive.test(decoded)||(await options.sanitize(decoded))!==decoded)throw new Error('permission_denied');return url;};
  function showStatus(g:Group,state:string){if(g.closing||g.status.webContents.isDestroyed())return;g.status.setVisible(true);g.layout.raiseStatus();void g.status.webContents.executeJavaScript(`location.hash=${JSON.stringify(state)}`).catch(()=>{});g.window.setTitle('小智 · 浏览器');}
  function showTab(g:Group,tab:Tab){for(const t of g.tabs.values())t.view.setVisible(t===tab);g.active=tab.id;if(tab.state==='ready')g.status.setVisible(false);else showStatus(g,tab.error||'loading');}
  async function closeGroup(id:string){const group=groups.get(id);if(!group)return;
    group.closing=true;group.control.abort();
    if(group.profileChange){
      for(const tab of group.tabs.values())stopPage(tab);
      await group.profileChange;
    }
    if(groups.get(id)!==group)return;
    groups.delete(id);for(const tab of group.tabs.values())releaseTab(group,tab);group.layout.remove(group.status);if(!group.status.webContents.isDestroyed())group.status.webContents.close({waitForBeforeUnload:false});if(!group.window.isDestroyed())group.window.destroy();await group.proxy.close();}
  async function group(id:string,dnsMode:OfficeDnsMode){
    if(disposed||!/^aisession_[a-f0-9-]{36}$/i.test(id))throw new Error('permission_denied');
    const existing=groups.get(id);if(existing){if(existing.closing)throw new Error('cancelled');if(!existing.busy&&existing.proxy.setDnsMode(dnsMode))await Promise.all([...existing.tabs.values()].map(t=>t.session.closeAllConnections()));return existing;}const started=pending.get(id);if(started)return started;
    const job=(async()=>{const proxy=await createPublicBrowserProxy(dnsMode,url=>{checkScope(id,url);return true;});if(disposed){await proxy.close();throw new Error('cancelled');}
      const electron=await electronRuntime();const window=new electron.BaseWindow({width:1100,height:760,title:'小智 · 浏览器',show:false,backgroundColor:'#ffffff'});window.setMenu(null);
      const status=new electron.WebContentsView({webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
      status.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      // Only this main-owned local status view may close its own browser group.
      // It exposes no preload or general navigation/IPC authority to web pages.
      status.webContents.on('will-navigate',(event,url)=>{event.preventDefault();if(url==='xiaozhi-browser:close')void closeGroup(id);});
      const value:Group={layout:createBrowserLayout(window,status),owner:'agent',control:new AbortController(),window,status,tabs:new Map(),active:'',proxy,busy:false,closing:false};
      try{if(process.env.ELECTRON_RENDERER_URL&&!options.statusFile){const url=new URL('browser-status.html',process.env.ELECTRON_RENDERER_URL+'/');url.hash='loading';await status.webContents.loadURL(url.href);}else await status.webContents.loadFile(options.statusFile||path.resolve(import.meta.dirname,'../renderer/browser-status.html'),{hash:'loading'});}catch(error){status.webContents.close();window.destroy();await proxy.close();throw error;}
      if(disposed){status.webContents.close();window.destroy();await proxy.close();throw new Error('cancelled');}
      groups.set(id,value);
      window.setMenu(electron.Menu.buildFromTemplate([{label:'浏览器控制',submenu:[
        {label:'放回对话',click:()=>options.requestDock?.(id)},
        {label:'我来操作',click:()=>setOwner(value,'teacher')},
        {label:'交还小智',click:()=>setOwner(value,'agent')},
      ]}]));
      window.on('close',event=>{if(!value.closing && value.layout.wasDocked && options.requestDock){event.preventDefault();value.layout.park();options.requestDock(id);}});
      window.on('closed',()=>{void closeGroup(id);});
      if(options.requestDock){
        options.requestDock(id);
        const fallback=setTimeout(()=>{if(!value.closing && value.layout.presentation==='initial')value.layout.float();},1800);
        fallback.unref();
      }
      return value;})();pending.set(id,job);try{return await job;}finally{pending.delete(id);}
  }
  async function createTab(id:string,g:Group,profileOrigin?:string){
    const electron=await electronRuntime();
    if(profileOrigin && profileOwners.has(profileOrigin))throw new Error('busy');
    const tabId='pibrowser_'+randomUUID();
    // The same local profile and origin share credentials only on explicit teacher selection.
    const partition=electron.session.fromPartition(profileOrigin
      ? profileName(profileOrigin)
      : 'xiaozhi-browser-'+randomUUID(),{cache:false});
    let created:WebContentsView|undefined;
    const control=g.control;
    if(profileOrigin)profileOwners.set(profileOrigin,tabId);
    try {
    partition.setPermissionRequestHandler((_wc,_permission,done)=>done(false));partition.setPermissionCheckHandler(()=>false);
    partition.removeListener('will-download',denyDownload);
    partition.on('will-download',denyDownload);
    await partition.setProxy({mode:'fixed_servers',proxyRules:`http://127.0.0.1:${g.proxy.port}`,proxyBypassRules:'<-loopback>'});
    await partition.closeAllConnections();
    if(disposed||g.closing)throw new Error('cancelled');
    const view=new electron.WebContentsView({webPreferences:{session:partition,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,devTools:false,spellcheck:false}});
    created=view;
    const tab:Tab={profileOrigin,id:tabId,view,session:partition,refs:new Map(),revision:0,state:'loading'};
    const wc=view.webContents;wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');wc.setWindowOpenHandler(()=>({action:'deny'}));
    wc.on('will-attach-webview',event=>event.preventDefault());
    wc.on('login',(event,details,authInfo,callback)=>{event.preventDefault();if(authInfo.isProxy&&authInfo.host==='127.0.0.1'&&authInfo.port===g.proxy.port)callback(g.proxy.username,g.proxy.password);else callback();});
    wc.on('did-start-navigation',()=>{tab.revision++;tab.snapshotId=undefined;tab.refs.clear();tab.write=undefined;});
    wc.on('did-start-loading',()=>{tab.state='loading';tab.error=undefined;if(g.active===tab.id)showStatus(g,'loading');});
    wc.on('did-finish-load',()=>{if(tab.error)return;const error=g.proxy.failureFor(wc.getURL());if(error){tab.state='failed';tab.error=error;if(g.active===tab.id)showStatus(g,error);return;}tab.state='ready';if(g.active===tab.id)showTab(g,tab);});
    wc.on('did-fail-load',(_event,code,_description,url,isMainFrame)=>{if(!isMainFrame||code===-3&&tab.error)return;tab.state='failed';tab.error=g.proxy.failureFor(url)||(code===-3?'cancelled':code===-7?'timeout':'network');if(g.active===tab.id)showStatus(g,tab.error);});
    wc.on('page-title-updated',()=>{if(!g.window.isDestroyed()&&g.active===tab.id)g.window.setTitle('小智 · 浏览器 · '+wc.getTitle().slice(0,150));});
    partition.webRequest.onBeforeRequest((request,done)=>{void(async()=>{try{
      const owner=g.owner,control=g.control;
      const current=()=>{if(disposed||g.closing||wc.isDestroyed()||control.signal.aborted||
        profileOrigin && (profileOwners.get(profileOrigin)!==tab.id || new URL(request.url).origin!==profileOrigin))
        throw new Error('permission_denied');checkScope(id,request.url);};
      current();await safeUrl(request.url);current();
      if(!['GET','HEAD'].includes(request.method)){
        if(owner==='teacher' && request.webContentsId===wc.id && new URL(request.url).origin===new URL(wc.getURL()).origin){done({cancel:false});return;}
        const permission=tab.write;if(!permission||permission.until<Date.now()||new URL(request.url).origin!==permission.origin||request.webContentsId!==wc.id)throw new Error('permission_denied');
      }done({cancel:false});
    }catch{done({cancel:true});}})();});
    await options.afterTabCreated?.(wc,partition);
    if(g.closing || disposed || control.signal.aborted)throw new Error('cancelled');
    g.tabs.set(tab.id,tab);g.active=tab.id;g.layout.add(view);showTab(g,tab);return tab;
    } catch(error) {if(created && !created.webContents.isDestroyed())created.webContents.close({waitForBeforeUnload:false});if(profileOrigin&&profileOwners.get(profileOrigin)===tabId)profileOwners.delete(profileOrigin);throw error;}
  }
  async function snapshot(tab:Tab,signal:AbortSignal):Promise<XiaozhiBrowserReceipt>{
    signal=AbortSignal.any([signal,AbortSignal.timeout(15000)]);
    signal.throwIfAborted();if(tab.state!=='ready')throw new Error(tab.error||'network');const wc=tab.view.webContents,revision=tab.revision;await safeUrl(wc.getURL());
    // Generate the observation and capture identities in one renderer task.
    const {result,refs}=await waitOfficeAbort(wc.executeJavaScriptInIsolatedWorld(1005,[{code:`(() => {
      const result=${SNAPSHOT_SCRIPT};
      const nodes = new Map(); globalThis.__xiaozhiObservedNodes = nodes;
      const values = []; let scanned=0; let remaining = 1024*1024;
      for (const el of document.querySelectorAll('[data-hana-ref]')) {
        if (++scanned > 2048 || remaining<=0) break;
        const ref = Number(el.getAttribute('data-hana-ref'));
        const html = el.outerHTML;
        if (nodes.has(ref)) nodes.set(ref,null); else nodes.set(ref,el);
        if (html.length<=16384 && html.length<=remaining){values.push([ref, html]);remaining-=html.length;}
      }
      return {result,refs:values};
    })()`}]),signal) as {result:{title:string;currentUrl:string;text:string};refs:[number,string][]};
    const receipt={tabId:tab.id,title:(await options.sanitize(result.title)).slice(0,200),url:await safeUrl(result.currentUrl),observedAt:new Date().toISOString(),snapshotId:'pisnapshot_'+randomUUID(),text:(await options.sanitize(result.text)).slice(0,30000),untrusted:true as const};
    signal.throwIfAborted();if(tab.revision!==revision||wc.isDestroyed())throw new Error('attachment_changed');tab.refs=new Map(refs.filter(([_ref,html])=>!!html));tab.snapshotId=receipt.snapshotId;return receipt;
  }
  return {
    hasLiveNavigation(sessionId:string, runId:string, callId:string) {
      const group = groups.get(sessionId);
      if (!group || group.closing) return false;
      for (const tab of group.tabs.values()) {
        const proof = tab.navigation;
        if (proof?.runId === runId && proof.callId === callId && proof.revision === tab.revision &&
            tab.state === 'ready' && !tab.view.webContents.isDestroyed() &&
            tab.view.webContents.getURL() === proof.url) return true;
      }
      return false;
    },
    async teacher(id:string,operation:string, parent?:BrowserWindow, rect?:Rectangle){
      const g=groups.get(id);
      if(disposed||!g||g.closing)throw new Error('permission_denied');
      if(operation==='teacher'||operation==='agent'){if(operation==='agent'&&g.profileChange)throw new Error('busy');setOwner(g,operation);return;}
      if(operation==='dock' && parent && rect){
        const [w,h]=parent.getContentSize();
        if(![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||rect.x<0||rect.y<0||rect.width<1||rect.height<1||rect.x+rect.width>w+1||rect.y+rect.height>h+1)throw new Error('invalid_input');
        g.layout.dock(parent,rect);return;
      }
      if(operation==='float'){g.layout.float();return;}
      if(operation==='cover'){if(g.layout.docked||g.layout.presentation==='initial')g.layout.park();return;}
      if(operation==='leave'){setOwner(g,'teacher');g.layout.park();return;}
      const current=g.tabs.get(g.active);
      if(!current || g.owner!=='teacher' || g.busy)throw new Error('permission_denied');
      const origin=siteOrigin(current);if(!origin)throw new Error('permission_denied');
      const url=new URL(await safeUrl(origin));
      if(disposed||g.closing||url.protocol!=='https:'||groups.get(id)!==g||g.active!==current.id||g.owner!=='teacher'||g.busy)throw new Error('permission_denied');
      if(operation==='forget' && !current.profileOrigin){
        if(profileOwners.has(origin))throw new Error('busy');
        const lock=randomUUID();
        profileOwners.set(origin,lock);const finish=beginProfileChange(g);
        try{
          const electron=await electronRuntime();
          await clearLogin(electron.session.fromPartition(profileName(origin),{cache:false}));
        }finally{if(profileOwners.get(origin)===lock)profileOwners.delete(origin);finish();}
        return;
      }
      if(operation==='remember' && !current.profileOrigin){
        const finish=beginProfileChange(g);
        try { const tab=await createTab(id,g,url.origin);
          try {if(g.owner!=='teacher'||g.closing)throw new Error('cancelled');await tab.view.webContents.loadURL(url.origin);}
          catch(error){releaseTab(g,tab);if(!g.closing)showTab(g,current);throw error;}
          releaseTab(g,current);
        } finally {finish();}
        return;
      }
      if(operation==='forget' && current.profileOrigin){
        const finish=beginProfileChange(g);
        try {
          const storage=current.session; const origin=current.profileOrigin;
          const temp=await createTab(id,g);
          g.layout.remove(current.view);
          // Close the credentialed page before removing its storage.
          const credentialed=current.view.webContents;
          if(credentialed&&!credentialed.isDestroyed())credentialed.close({waitForBeforeUnload:false});
          try {
            await clearLogin(storage);
          } finally {
            releaseTab(g,current);
            if(!g.closing){temp.requestedOrigin=origin;await temp.view.webContents.loadURL(origin).catch(()=>{if(!g.closing)showStatus(g,temp.error||'network');});}
          }
        } finally {finish();}
        return;
      }
      throw new Error('invalid_input');
    },
    async status(id:string){const g=groups.get(id);if(!g||g.closing)return {open:false};const tabs=[];for(const tab of g.tabs.values()){if(tab.state!=='ready'||!tab.view.webContents||tab.view.webContents.isDestroyed())continue;try{tabs.push({tabId:tab.id,title:g.owner==='teacher'?'老师操作中':(await options.sanitize(tab.view.webContents.getTitle())).slice(0,200),url:g.owner==='teacher'?new URL(tab.view.webContents.getURL()).origin:await safeUrl(tab.view.webContents.getURL()),active:tab.id===g.active});}catch{/* Blank/blocked pages are not a source. */}}return {open:true,tabs,owner:g.owner,siteOrigin:siteOrigin(g.tabs.get(g.active)),remembered:!!g.tabs.get(g.active)?.profileOrigin};},
    show(id:string){const g=groups.get(id);if(!g||g.closing||g.window.isDestroyed())throw new Error('permission_denied');g.layout.float();g.window.focus();},
    setNetworkScope(id:string,scope:(url:string)=>boolean,resetConnections=false){if(networkScopes.get(id)===scope&&!resetConnections)return;networkScopes.set(id,scope);groups.get(id)?.proxy.stopConnections();},
    async execute(id:string,input:XiaozhiBrowserInput,context:{invocation?:{runId:string;callId:string};signal:AbortSignal;dnsMode:OfficeDnsMode;current:()=>boolean;confirm:(question:string,signal:AbortSignal)=>Promise<boolean>}):Promise<XiaozhiBrowserReceipt|{tabs:{tabId:string;title:string;url:string;active:boolean}[]}|{closed:true}> {
      if(!validBrowserInput(input)||disposed)throw new Error('invalid_input');const check=()=>{context.signal.throwIfAborted();if(!context.current())throw new Error('cancelled');};check();
      const before=groups.get(id);
      if(before?.owner==='teacher')throw new Error('teacher_control');
      if(before?.needsObservation && input.action!=='snapshot' && input.action!=='tabs')throw new Error('observation_required');
      if(input.action==='close'&&!input.tabId){if(before?.busy||pending.has(id))throw new Error('busy');await closeGroup(id);return {closed:true};}
      const g=await group(id,context.dnsMode);check();if(g.owner==='teacher')throw new Error('teacher_control');if(g.needsObservation && !['snapshot','tabs'].includes(input.action))throw new Error('observation_required');if(g.busy)throw new Error('busy');g.busy=true;
      context={...context,signal:AbortSignal.any([context.signal,g.control.signal])};
      let tab:Tab|undefined;
      const stop=()=>{stopPage(tab);g.proxy.stopConnections();if(tab){tab.write=undefined;if(tab.state==='loading'){tab.state='failed';tab.error='cancelled';showStatus(g,'cancelled');}}};context.signal.addEventListener('abort',stop,{once:true});
      try{
        if(input.action==='tabs'){const tabs=await Promise.all([...g.tabs.values()].filter(t=>t.state==='ready').map(async t=>({tabId:t.id,title:(await options.sanitize(t.view.webContents.getTitle())).slice(0,200),url:await safeUrl(t.view.webContents.getURL()),active:t.id===g.active})));check();return {tabs};}
        tab=input.tabId?g.tabs.get(input.tabId):g.tabs.get(g.active);if(input.tabId&&!tab)throw new Error('permission_denied');
        if(input.action==='navigate'&&(input.newTab||!tab))tab=await createTab(id,g);if(!tab||tab.view.webContents.isDestroyed())throw new Error('permission_denied');check();
        const wc=tab.view.webContents;
        if ((input.action === 'snapshot' && input.name) || (input.action === 'wait' && input.text)) {
          const revision = tab.revision;
          const url = wc.getURL();
          const checkPage = () => {
            check();
            if (wc.isDestroyed() || tab!.revision !== revision || tab!.state !== 'ready' || wc.getURL() !== url)
              throw new Error('attachment_changed');
          };
          checkPage();
          if (input.snapshotId !== tab.snapshotId) throw new Error('attachment_changed');
          if (input.action === 'wait') await waitForBrowserText(wc, input.text!, context.signal, checkPage);
          const receipt = await snapshot(tab, context.signal);
          checkPage();
          if (input.action === 'snapshot') {
            const signal = AbortSignal.any([context.signal, AbortSignal.timeout(8000)]);
            const ref = await uniqueBrowserRef(wc, input.role!, input.name!.trim(), signal);
            checkPage();
            if (!tab.refs.has(ref)) throw new Error('attachment_changed');
            receipt.matchedRef = ref;g.needsObservation=false;
          }
          return receipt;
        }
        const activate=()=>{showTab(g,tab!);if(g.layout.presentation==='floating'||(!options.requestDock&&g.layout.presentation==='initial'))g.layout.float();};
        const navigate=async(raw:string)=>{const signal=AbortSignal.any([context.signal,AbortSignal.timeout(30000)]);let url:string|undefined;try{url=await safeUrl(raw);checkScope(id,url);check();tab!.requestedOrigin=new URL(url).origin;tab!.state='loading';tab!.error=undefined;showStatus(g,'loading');await waitOfficeAbort(wc.loadURL(url),signal);check();const failure=g.proxy.failureFor(wc.getURL());if(failure)throw new Error(failure);tab!.state='ready';showTab(g,tab!);}catch(error){wc.stop();g.proxy.stopConnections();const code=(error as Error).message;const reason=context.signal.aborted?'cancelled':signal.aborted?'timeout':url&&g.proxy.failureFor(url)||(['permission_denied','dns_blocked','cancelled','timeout'].includes(code)?code:'network');tab!.state='failed';tab!.error=reason;tab!.snapshotId=undefined;tab!.refs.clear();showStatus(g,reason);throw new Error(reason);}};
        const withRef = async (body: string) => {
          if (input.snapshotId !== tab!.snapshotId) throw new Error('attachment_changed');
          const expected = tab!.refs.get(input.ref!);
          if (!expected) throw new Error('attachment_changed');
          const code = `(() => {
            const nodes = document.querySelectorAll('[data-hana-ref="${input.ref}"]');
            const el = nodes[0];
            if (nodes.length !== 1 || globalThis.__xiaozhiObservedNodes?.get(${input.ref}) !== el || el.outerHTML !== ${JSON.stringify(expected)}) return {error:'attachment_changed'};
            el.scrollIntoView({block:'center', inline:'nearest'});
            const box = el.getBoundingClientRect();
            const x = (Math.max(box.left,0) + Math.min(box.right,innerWidth)) / 2;
            const y = (Math.max(box.top,0) + Math.min(box.bottom,innerHeight)) / 2;
            if (el.matches(':disabled') || el.closest('[inert],[aria-disabled="true"]') ||
                !el.contains(document.elementFromPoint(x,y))) return {error:'target_unavailable'};
            return {value:(() => {${body}})()};
          })()`;
          const result = await waitOfficeAbort(wc.executeJavaScriptInIsolatedWorld(1005, [{code}]), context.signal);
          check();
          if (result.error) throw new Error(result.error);
          return result.value;
        };
        const conditionRevision=tab.revision;
        const checkConditionPage=()=>{check();if(wc.isDestroyed()||tab!.revision!==conditionRevision||tab!.state!=='ready')throw new Error('attachment_changed');};
        const ensureNewResult=async()=>{
          if(!input.expectText)return;
          checkConditionPage();
          const exists=await waitOfficeAbort(wc.executeJavaScriptInIsolatedWorld(1005,[{code:`document.body?.innerText.includes(${JSON.stringify(input.expectText)})`}]),context.signal);
          checkConditionPage();if(exists)throw new Error('result_already_visible');
        };
        const approve=async()=>{const url=await safeUrl(wc.getURL()),revision=tab!.revision;
          checkScope(id,url);
          const question=await options.sanitize(`允许小智在 ${new URL(url).hostname} 的“${wc.getTitle().slice(0,100)}”页面执行这次“${input.action}”操作${input.ref?`（控件 ${input.ref}）`:''}${input.text!==undefined?`，输入“${input.text.slice(0,200)}”`:input.value!==undefined?`，选择“${input.value.slice(0,200)}”`:input.key?`，按 ${input.key}`:''}吗？页面可能提交内容。`);
          if(!await context.confirm(question,context.signal))throw new Error('permission_denied');check();checkScope(id,url);if(tab!.revision!==revision||wc.getURL()!==url)throw new Error('attachment_changed');await ensureNewResult();check();tab!.write={origin:new URL(url).origin,until:Date.now()+10000};};
        if(input.action==='extract'){
          if(tab.state!=='ready')throw new Error(tab.error||'network');
          const url=await safeUrl(wc.getURL()),revision=tab.revision,signal=AbortSignal.any([context.signal,AbortSignal.timeout(15000)]);
          const samePage=()=>{check();signal.throwIfAborted();if(wc.isDestroyed()||tab!.state!=='ready'||tab!.revision!==revision||wc.getURL()!==url)throw new Error('attachment_changed');};
          if (input.snapshotId !== undefined && input.snapshotId !== tab.snapshotId) throw new Error('attachment_changed');
          let scope:Parameters<typeof browserExtractScript>[0];if(input.ref!==undefined){const expectedHtml=tab.refs.get(input.ref);if(!expectedHtml)throw new Error('attachment_changed');scope={ref:input.ref,expectedHtml};}
          samePage();
          const result=await waitOfficeAbort(wc.executeJavaScriptInIsolatedWorld(1005,[{code:browserExtractScript(scope)}]),signal) as {method:'readability'|'dom_region';text:string;sourceChars:number;truncated:boolean;lossy:boolean;figures:number;canvas:number;formulas:number;accessHint:'none'|'login_or_challenge'};
          samePage();let text=await options.sanitize(result.text),truncated=result.truncated;
          if(text.length>24000||Buffer.byteLength(text)>48000){truncated=true;text=text.slice(0,24000);while(Buffer.byteLength(text)>48000)text=text.slice(0,-256);if(/[\uD800-\uDBFF]/.test(text.at(-1)||''))text=text.slice(0,-1);}
          const title=(await options.sanitize(wc.getTitle())).slice(0,200);samePage();
          return {tabId:tab.id,title,url,observedAt:new Date().toISOString(),untrusted:true,text,extraction:{engine:'mozilla-readability-0.6.0',method:result.method,sourceChars:result.sourceChars,truncated,lossy:result.lossy,figures:result.figures,canvas:result.canvas,formulas:result.formulas,accessHint:result.accessHint,contentSha:createHash('sha256').update(text).digest('hex')}};
        }
        if(input.action==='navigate'){activate();await navigate(input.url!);}
        else if(input.action==='show'){activate();}
        else if(input.action==='close'){releaseTab(g,tab);if(!g.tabs.size){await closeGroup(id);}else{showTab(g,g.tabs.values().next().value!);}return {closed:true};}
        else if(input.action==='click'){
          const href=await withRef("return el.tagName==='A'?el.href:null;");check();
          if(typeof href==='string'&&href){if(input.expectText)throw new Error('invalid_input');await navigate(href);}else{await approve();await withRef('el.click();');}
        }else if(input.action==='type'){
          if(sensitive.test(input.text!)||await options.sanitize(input.text!)!==input.text)throw new Error('permission_denied');
          const writable="['INPUT','TEXTAREA'].includes(el.tagName)&&!['password','file','hidden'].includes(el.type)&&!/(?:password|one-time-code|cc-)/i.test(el.autocomplete)&&!el.readOnly&&!el.disabled";
          if(!await withRef('return '+writable))throw new Error('permission_denied');
          await approve();
          const typed=await withRef(`if(!(${writable}))return false;el.focus();if(document.activeElement!==el||!el.isConnected)return false;el.select();if(document.activeElement!==el||!el.isConnected)return false;return document.execCommand('insertText',false,${JSON.stringify(input.text)});`);
          if(!typed)throw new Error('target_unavailable');
        }else if(input.action==='select'){await approve();const selected=await withRef(`if(el.tagName!=='SELECT'||el.disabled)throw new Error('Protected select');const choice=Array.from(el.options).find(option=>option.value===${JSON.stringify(input.value)} && !option.disabled && !option.closest('optgroup:disabled'));if(!choice)return 'missing';el.value=choice.value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));`);if(selected==='missing')throw new Error('target_unavailable');}
        else if(input.action==='key'){if(input.snapshotId!==tab.snapshotId)throw new Error('attachment_changed');
          const focusCheck=async(remember:boolean)=>waitOfficeAbort(wc.executeJavaScriptInIsolatedWorld(1005,[{code:`(() => {
            const el=document.activeElement;if(!el || el.matches('input[type=password],input[type=file]') || /password|one-time-code|cc-/i.test(el.getAttribute('autocomplete')||''))return false;
            if(${remember})globalThis.__xiaozhiKeyFocus=el;return globalThis.__xiaozhiKeyFocus===el;
          })()`}]),context.signal);
          if(!await focusCheck(true))throw new Error('permission_denied');
          await approve();if(input.snapshotId!==tab.snapshotId||!await focusCheck(false))throw new Error('attachment_changed');check();const key=input.key==='Enter'?'Return':input.key!;wc.sendInputEvent({type:'keyDown',keyCode:key});wc.sendInputEvent({type:'keyUp',keyCode:key});}
        else if(input.action==='scroll'){await waitOfficeAbort(wc.executeJavaScript(`window.scrollBy(0,${(input.direction==='up'?-1:1)*(input.amount||3)*300})`),context.signal);}
        else if(input.action==='screenshot'){
          if(tab.state!=='ready')throw new Error(tab.error||'network');
          const url=await safeUrl(wc.getURL()),revision=tab.revision;
          const samePage=()=>{check();if(wc.isDestroyed()||tab!.state!=='ready'||tab!.revision!==revision||wc.getURL()!==url)throw new Error('attachment_changed');};
          // Native capture makes the page visible and keeps the system awake.
          // Do not wait on a renderer RAF that can suspend while occluded.
          activate();samePage();
          const signal=AbortSignal.any([context.signal,AbortSignal.timeout(15000)]);
          // Chromium can briefly lack a compositor frame after a completed navigation.
          let image;
          for (let attempt=0; ; attempt++) {
            samePage();
            try {
              image=await waitOfficeAbort(wc.capturePage(undefined,{stayAwake:true}),signal);
              break;
            } catch (error) {
              samePage();
              if (attempt >= 2 || !(error instanceof Error) || !error.message.includes('UnknownVizError')) throw error;
              await delay(150 * (attempt+1),undefined,{signal});
            }
          }
          samePage();if(image.isEmpty())throw new Error('network');
          const bytes=image.toPNG(),size=image.getSize(),capture={schemaVersion:BROWSER_CAPTURE_SCHEMA,id:browserScreenshotFilename({base64:bytes.toString('base64'),mimeType:'image/png'}),sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,width:size.width,height:size.height,title:(await options.sanitize(wc.getTitle())).slice(0,200),url,observedAt:new Date().toISOString()};
          if(!validBrowserCapture(capture))throw new Error('too_large');samePage();
          const relative=path.join(createHash('sha256').update(id).digest('hex'),capture.id),file=approvedFile(options.root,relative);
          await fs.mkdir(path.dirname(file),{recursive:true});samePage();approvedFile(options.root,relative);
          try{await fs.writeFile(file,bytes,{flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;await readBrowserCapture(options.root,id,capture);}
          samePage();return {tabId:tab.id,title:capture.title,url,observedAt:capture.observedAt,untrusted:true,captured:true,capture};
        }
        // Original Hana wait helper only for page stability, never a run timeout.
        if(input.expectText){await waitForBrowserText(wc,input.expectText,context.signal,checkConditionPage);checkConditionPage();}
        else if(!['snapshot','show'].includes(input.action)){
          const {waitForBrowserState}=await import('./vendor/hana/browser/browser-wait.cjs');
          await waitOfficeAbort(waitForBrowserState(wc,{state:'stable',timeoutMs:5000}),context.signal);
        }
        check();
        const receipt = await snapshot(tab,context.signal);
        check();if(input.action==='snapshot')g.needsObservation=false;
        if (input.action === 'navigate' && context.invocation && wc.getURL() === receipt.url && tab.state === 'ready')
          tab.navigation = {...context.invocation, revision:tab.revision, url:receipt.url};
        return receipt;
      }finally{if(tab)tab.write=undefined;context.signal.removeEventListener('abort',stop);g.busy=false;}
    },
    cancel(id:string){const g=groups.get(id);if(g&&g.owner==='agent'){for(const tab of g.tabs.values()){tab.write=undefined;stopPage(tab);}g.proxy.stopConnections();}},
    async dispose(){disposed=true;await Promise.allSettled([...pending.values()]);await Promise.all([...groups.keys()].map(closeGroup));},
  };
}
