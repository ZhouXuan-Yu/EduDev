import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','Element','Node','Event','MouseEvent','KeyboardEvent','SVGElement','getComputedStyle','localStorage','MutationObserver'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame=fn=>setTimeout(fn,0);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame=clearTimeout;
globalThis.matchMedia=dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const {flushSync}=await import('react-dom');
const base=path.resolve('src/renderer'),cache=new Map();
const real=new Set(['components/office/PiEducationWorkspace.tsx','components/office/pi-session-navigation.ts','components/office/pi-snapshot-hydrator.ts','components/office/PiWorkbenchBridge.tsx','components/desktop/DesktopFrame.tsx','ui-system/WorkbenchState.tsx','ui-system/WorkbenchNavigation.tsx','ui-system/workbench-preferences.ts'].map(p=>path.join(base,p)));
const pass=({children})=>children??null,empty=()=>null;
// Only presentation is inert: dialog visibility/close, run(), history callbacks, bridge,
// selection lifetime, hydration, navigation and guards all execute production code.
const element=tag=>({children,...props})=>React.createElement(tag,props,children);
const Modal={Backdrop:pass,Container:pass,Dialog:element('section'),Header:pass,Heading:element('h2'),Body:pass,Footer:pass};
const Button=({children,onPress,variant,isDisabled,...props})=>React.createElement('button',{...props,disabled:props.disabled||isDisabled,onClick:onPress},children);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const tick=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};
const snapshot=id=>({projection:{threadId:id,turns:[],sourceSequence:0},running:false});
const stubs={
 './usePiAttachments':{usePiAttachments:()=>({selections:[],cards:null})},
 './permissionModes':{readPiPermissionMode:()=> 'request',writePiPermissionMode(){}},
 './PiHomeLayout':{isHomeConversation:()=>true,PiHomeSuggestions:empty},
 './workspace-notifications':{workspaceNotifications:()=>[]},
 './pi-text-view-buffer':{createPiTextViewBuffer:()=>({clear(){},flush(){},canReplace:()=>true,acknowledge(){}}),mergePiViewSnapshot:(_old,current)=>current},
 '../../../shared/xiaozhi-event-receiver':{createEventReceiver:()=>({reset(){},cursors:()=>[],seed(){},synchronization:()=> 'ready'})},
 './page-contracts':{PAGE_CONTRACTS:[]},
 '../AiConversationSidebar':{AiConversationSidebar:props=>React.createElement('div',null,
 React.createElement('button',{'data-testid':'history-select-A',onClick:()=>void props.onOpenSession('A')},'Select A'),
 React.createElement('button',{'data-testid':'history-new',onClick:()=>void props.onNewSession(null)},'New'))},
};
function load(file){
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const source=fs.readFileSync(file,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{
  if(id==='react')return React;if(id==='react-dom')return {flushSync};if(id==='react/jsx-runtime')return require(id);
  if(id==='@heroui/react')return {Button,Modal};if(id==='lucide-react')return new Proxy({}, {get:()=>empty});
  if(id.endsWith('.css'))return {};
  for(const ext of ['.tsx','.ts']){const next=path.resolve(path.dirname(file),id+ext);if(real.has(next))return load(next);}
  if(stubs[id])return stubs[id];
  return new Proxy({}, {get:(_t,key)=>key==='__esModule'?true:(['OfficeComposerState','OfficeSynchronization','PiWorkspaceShell'].includes(key)?pass:empty)});
 },window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,crypto:globalThis.crypto,Promise,Error,Symbol,Set,Map,setInterval,clearInterval},{filename:file});
 return module.exports;
}
const {DesktopFrame,useDesktopNavigation,useDesktopNavigationGuard}=load(path.join(base,'components/desktop/DesktopFrame.tsx'));
const {WorkbenchProvider,useWorkbenchState}=load(path.join(base,'ui-system/WorkbenchState.tsx'));
const {WorkbenchNavigation}=load(path.join(base,'ui-system/WorkbenchNavigation.tsx'));
const {PiEducationWorkspace}=load(path.join(base,'components/office/PiEducationWorkspace.tsx'));
let nav,data,setDirty,root,passed=0;
const act=fn=>React.act(async()=>{fn?.();await tick();});
const query=id=>document.querySelector(`[data-testid="${id}"]`);
const click=async id=>{const node=query(id);assert(node,'missing '+id);assert(!node.disabled,'disabled '+id);await act(()=>node.click());};
const dialog=kind=>!!query(`workbench-${kind}-dialog`);
async function mounted(run){
 localStorage.clear();const reads=[],creates=[],saved=[];let listReads=0,refresh;
 const sessions=['old','A','B'].map(id=>({id,title:id,updatedAt:'2026-11-02T00:00:00Z'}));
 const list=()=>({folders:[],sessions:[...sessions,...saved],archivedFolders:[],archivedSessions:[]});
 window.omniEdu={getDesktopChrome:async()=>({enabled:false}),onDesktopCommand:()=>()=>{},listAiConversations:async()=>{listReads++;return refresh?refresh.promise:list();},getXiaozhiSnapshot:id=>{const d=deferred();reads.push({id,...d});if(id==='old')d.resolve(snapshot(id));return d.promise;},getXiaozhiSettings:async()=>({ok:false}),onXiaozhiEvent:()=>()=>{},createAiConversationSession:()=>{const d=deferred();creates.push(d);return d.promise;}};
 function Host(){nav=useDesktopNavigation();const state=useWorkbenchState();data=state.data;const [dirty,update]=React.useState(false);setDirty=update;useDesktopNavigationGuard(dirty,'教师草稿尚未保存');return React.createElement(React.Fragment,null,React.createElement(WorkbenchNavigation,{view:nav.target.view}),React.createElement(PiEducationWorkspace,{visible:nav.target.view==='ai',onLeave(){},onSettings(){}}));}
 root=createRoot(document.getElementById('root'));
 try{await act(()=>root.render(React.createElement(DesktopFrame,null,React.createElement(WorkbenchProvider,null,React.createElement(Host)))));await act();assert(data&&!data.blocked,'workspace ready');await run({reads,creates,get listReads(){return listReads;},create:async(id='N',index=0)=>{saved.push({id,title:id,updatedAt:'2026-11-02T00:00:00Z'});await act(()=>creates[index].resolve({session:{id}}));},finish:async id=>{const read=reads.find(r=>r.id===id);assert(read,'read '+id);await act(()=>read.resolve(snapshot(id)));},pauseRefresh:()=>{refresh=deferred();},resumeRefresh:async()=>{await act(()=>refresh.resolve(list()));refresh=undefined;}});}
 finally{await act(()=>root.unmount());root=undefined;}
}
async function test(name,fn){await mounted(fn);passed++;console.log('PASS '+name);}
try{
 await test('search normal completion closes actual dialog',async f=>{await click('workbench-search');await click('workbench-session-A');assert(dialog('search'));await f.finish('A');assert(!dialog('search'));});
 await test('search rejected by real draft guard stays open',async f=>{await click('workbench-search');await act(()=>setDirty(true));await click('workbench-session-A');assert(dialog('search'));assert.equal(nav.target.sessionId,'old');assert.equal(f.reads.filter(r=>r.id==='A').length,0);assert(query('desktop-navigation-notice').textContent.includes('教师草稿'));});
 await test('search superseded by teaching while read pending stays open',async f=>{await click('workbench-search');await click('workbench-session-A');await click('nav-teaching');await f.finish('A');assert(dialog('search'));assert.equal(nav.target.view,'teaching');});
 await test('search superseded by B while read pending stays open',async f=>{await click('workbench-search');await click('workbench-session-A');await act(()=>nav.navigate({view:'ai',sessionId:'B'}));await f.finish('B');await f.finish('A');assert(dialog('search'));assert.equal(nav.target.sessionId,'B');});
 await test('search read failure retains actual dialog',async f=>{await click('workbench-search');await click('workbench-session-A');await act(()=>f.reads.find(r=>r.id==='A').reject(Error('disk_failed')));assert(dialog('search'));});
 for(const mode of ['normal','guard','superseded']){
  await test('history onSelected '+mode,async f=>{await click('workbench-manage-history');if(mode==='guard')await act(()=>setDirty(true));await click('history-select-A');if(mode==='superseded')await click('nav-teaching');if(mode!=='guard')await f.finish('A');assert.equal(dialog('history'),mode!=='normal');});
  await test('history new onSelected '+mode,async f=>{await click('workbench-manage-history');await click('history-new');if(mode==='guard')await act(()=>setDirty(true));if(mode==='superseded')await click('nav-teaching');await f.create();if(mode==='normal')await f.finish('N');assert.equal(dialog('history'),mode!=='normal');assert.equal(f.creates.length,1);assert(f.listReads>=2);assert(data.sessions.some(s=>s.id==='N'));});
 }
 for(const mode of ['normal','guard','superseded','read-superseded','refresh-superseded']){
  await test('new dialog activation '+mode,async f=>{await click('workbench-new-session');await act(()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));if(mode==='guard')await act(()=>setDirty(true));if(mode==='superseded')await click('nav-teaching');await f.create();if(mode==='refresh-superseded')f.pauseRefresh();if(mode==='read-superseded')await click('nav-teaching');if(['normal','read-superseded','refresh-superseded'].includes(mode))await f.finish('N');if(mode==='refresh-superseded'){await click('nav-teaching');await f.resumeRefresh();}assert.equal(dialog('new'),mode!=='normal');assert.equal(f.creates.length,1);assert(data.sessions.some(s=>s.id==='N'));});
 }
 await test('history creation B invalidates A close eligibility while A refresh is pending',async f=>{
  await click('workbench-manage-history');
  await click('history-new');
  await f.create('N');
  f.pauseRefresh();
  const beforeRefresh=f.listReads;
  await f.finish('N');
  assert.equal(f.listReads,beforeRefresh+1,'A is awaiting its real list refresh');
  assert(dialog('history'));
  await click('history-new');
  assert.equal(f.creates.length,2,'B create intent has started but its IPC is still pending');
  await f.resumeRefresh();
  assert(dialog('history'),'A must not call onSelected after B creation begins');
  assert.equal(nav.target.sessionId,'N');
  assert(data.sessions.some(s=>s.id==='N'),'A remains saved and listed');
  await f.create('M',1);
  await f.finish('M');
  assert(!dialog('history'),'B alone closes history after effective activation');
  assert.equal(nav.target.sessionId,'M');
  for(const id of ['N','M']){
   assert(data.sessions.some(s=>s.id===id),'saved session remains discoverable: '+id);
   assert.equal(f.reads.filter(r=>r.id===id).length,1,'one hydration for '+id);
  }
 });
 await test('legacy void callers still close search and new dialogs',async()=>{await click('workbench-search');data.onOpenSession=async()=>{};await click('workbench-session-A');assert(!dialog('search'));await click('workbench-new-session');data.onNewSession=async()=>{};await act(()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert(!dialog('new'));});
 console.log(JSON.stringify({success:true,passed,scope:'new selection-close regression only; real mounted DesktopFrame guard, WorkbenchState/Bridge/Navigation, Workspace/helper/hydrator; inert presentation and deferred IPC; original 29 unchanged'}));
}finally{dom.window.close();}
