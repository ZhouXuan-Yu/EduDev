import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','Element','Node','Event','MouseEvent','KeyboardEvent','SVGElement','getComputedStyle','localStorage','MutationObserver']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame = clearTimeout;
globalThis.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
globalThis.matchMedia = dom.window.matchMedia = () => ({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
dom.window.HTMLElement.prototype.scrollTo = function(options){this.scrollTop=options.top??this.scrollTop;};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { act } = React;
const server = await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
const runtimeErrors=[];
dom.window.addEventListener('error', event=>runtimeErrors.push(String(event.error)));
let passed=0;
const check=(label, fn)=>{fn();passed++;console.log('PASS '+label);};
let root;
try {
 const { isHomeConversation, PiHomeSuggestions }=await server.ssrLoadModule('/src/renderer/components/office/PiHomeLayout.tsx');
 const { WorkbenchHome }=await server.ssrLoadModule('/src/renderer/components/product/WorkbenchHome.tsx');
 const prefs=await server.ssrLoadModule('/src/renderer/components/office/workspace-preferences.ts');
 const empty={threadId:'u2-test',turns:[],hasMoreHistory:false,needsHydration:false};
 check('loading and partial history never become home',()=>{
  assert.equal(isHomeConversation(),false);assert.equal(isHomeConversation(empty),true);
  assert.equal(isHomeConversation({...empty,needsHydration:true}),false);
  assert.equal(isHomeConversation({...empty,hasMoreHistory:true}),false);
  assert.equal(isHomeConversation({...empty,turns:[{id:'run'}]}),false);
 });
 check('new profile starts with right panel closed',()=>{localStorage.clear();assert.deepEqual(prefs.readWorkspacePreferences(),{sidebar:true,aside:false,files:false});});
 check('old open preferences do not occupy blank chat or erase stored choice',()=>{
  prefs.writeWorkspacePreferences({sidebar:true,aside:true,files:true});
  assert.deepEqual(prefs.initialWorkspacePreferences(true),{sidebar:true,aside:false,files:false});
  assert.equal(prefs.initialWorkspacePreferences(false).files,true);
  assert.equal(prefs.readWorkspacePreferences().aside,true);
 });
 check('corrupt preference fails closed',()=>{localStorage.setItem(prefs.WORKSPACE_PREFERENCES_KEY,'broken');assert.equal(prefs.readWorkspacePreferences().aside,false);});
 check('heading mode leaves suggestions below the real composer',()=>{
  const heading=renderToStaticMarkup(React.createElement(WorkbenchHome,{headingOnly:true}));
  assert(heading.includes('今天想完成什么教学任务'));assert(!heading.includes('home-task-'));
  const full=renderToStaticMarkup(React.createElement(WorkbenchHome,{onSuggest(){}}));
  assert.equal((full.match(/data-testid="home-task-/g)||[]).length,3);
  assert.equal((full.match(/data-testid="home-suggestion-/g)||[]).length,2);
 });
 const {workspaceNotifications,focusWorkspacePending}=await server.ssrLoadModule('/src/renderer/components/office/workspace-notifications.ts');
 const notificationFixture={projection:{...empty,turns:[{id:'run'}]},workspace:{label:'默认工作目录'},
  approvals:[{id:'copy',runId:'run',state:'pending'},{id:'old-copy',runId:'old-run',state:'pending'}],
  controls:[{id:'question',runId:'run',kind:'question',state:'pending'},{id:'plan',runId:'run',kind:'plan',state:'pending'}],
  changes:[{id:'change',runId:'run',state:'pending',path:'new.md'},{id:'bundled',runId:'run',state:'pending',path:'bundle.md'}],
  officeArtifacts:[{id:'office',runId:'run',state:'pending',path:'new.docx'}],
  deliveries:[{id:'delivery',runId:'run',state:'pending',files:[{draftId:'bundled',carried:false,path:'bundle.md'}]}]};
 check('all real pending types covered, plan/old runs excluded and bundle drafts deduplicated',()=>{
  assert.deepEqual(workspaceNotifications(notificationFixture).pending.map(item=>item.kind),['copy','question','change','office','delivery']);
 });
 check('default workspace and unsaved drafts never announce viewable files',()=>{
  assert.equal(workspaceNotifications({projection:empty,workspace:{label:'默认'}}).hasFiles,false);
  assert.equal(workspaceNotifications(notificationFixture).hasFiles,false);
  assert.equal(workspaceNotifications({...notificationFixture,changes:[{state:'applied',path:'saved.md'}]}).hasFiles,true);
  assert.equal(workspaceNotifications({...notificationFixture,officeArtifacts:[{state:'saved',path:'saved.docx'}]}).hasFiles,true);
  assert.equal(workspaceNotifications({...notificationFixture,changes:[],officeArtifacts:[],deliveries:[{files:[{artifact:{state:'saved'}}]}]}).hasFiles,true);
 });
 const pendingFixture=document.createElement('div');document.body.append(pendingFixture);
 const targetAttributes={copy:['pi-copy-approval','data-approval-id'],question:['pi-teacher-question','data-control-id'],change:['pi-text-change','data-change-id'],office:['pi-office-artifact','data-office-id'],delivery:['pi-delivery-bundle','data-bundle-id']};
 let actionClicks=0,scrolled=0;
 for(const item of workspaceNotifications(notificationFixture).pending){
  const [testId,attribute]=targetAttributes[item.kind];
  const card=document.createElement('section');card.setAttribute('data-testid',testId);card.setAttribute(attribute,item.id);
  card.scrollIntoView=()=>scrolled++;
  const trigger=document.createElement('button');trigger.setAttribute('data-slot','chat-tool-trigger');trigger.setAttribute('aria-expanded','false');
  const input=document.createElement('textarea');input.hidden=true;
  trigger.onclick=()=>{trigger.setAttribute('aria-expanded','true');if(item.kind==='question')input.hidden=false;};
  const action=document.createElement('button');action.onclick=()=>actionClicks++;
  card.append(trigger,input,action);pendingFixture.append(card);
  assert.equal(focusWorkspacePending(pendingFixture,item),true);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(document.activeElement,item.kind==='question'?input:trigger);assert.equal(trigger.getAttribute('aria-expanded'),'true');
 }
 check('pending questions focus their answer; other cards skip hidden editors and focus review without approving',()=>{assert.equal(actionClicks,0);assert.equal(scrolled,5);});
 check('missing or hidden-session target cannot focus another card',()=>assert.equal(focusWorkspacePending(document.createElement('div'),{kind:'copy',id:'copy',label:'确认'}),false));
 pendingFixture.remove();
 const { OfficeComposerState }=await server.ssrLoadModule('/src/renderer/components/office/OfficeComposerState.tsx');
 const {OfficeConversation}=await server.ssrLoadModule('/src/renderer/components/office/OfficeConversation.tsx');
 const { OfficeComposer }=await server.ssrLoadModule('/src/renderer/components/office/OfficeComposer.tsx');
 let setEmpty;
 let sends=0;
 function Harness(){
  const [home,change]=React.useState(true);setEmpty=change;
  return React.createElement(OfficeComposerState,{sessionId:'u2-test'},React.createElement('section',{'data-empty':home},
   React.createElement('div',{className:'ai-conversation-frame'},React.createElement(OfficeConversation,{homeHeadingOnly:true,projection:home?empty:{...empty,turns:[{id:'run',status:'completed',items:[{id:'user',role:'user',text:'测试任务'}]}]},onSuggest(){}})),
   React.createElement(OfficeComposer,{nativeAppearance:true,sessionId:'u2-test',model:'test',models:[{id:'test',label:'test'}],permissionLabel:'资料只读',onSubmit:()=>{sends++;},onStop:async()=>{},attachments:React.createElement('span',{'data-testid':'attachment-fixture'},'附件')}),
   React.createElement(PiHomeSuggestions,{visible:home})));
 }
 root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(React.createElement(Harness)));
 const input=document.querySelector('[data-testid="office-prompt-input"]');
 assert(input,'real composer textarea');
 await act(async()=>document.querySelector('[data-testid="home-task-notebook"]').click());
 check('shortcut prepares real composer draft without send',()=>{assert(input.value.includes('学科'));assert.equal(sends,0);});
 const draft=input.value;
 await act(async()=>document.querySelector('[data-testid="home-task-paper"]').click());
 check('shortcut cannot overwrite an existing draft',()=>{assert.equal(input.value,draft);assert(document.body.textContent.includes('已有草稿'));});
 input.focus();const attachment=document.querySelector('[data-testid="attachment-fixture"]');
 await act(async()=>setEmpty(false));
 check('home to conversation retains composer DOM, draft, attachment and focus',()=>{
  assert.equal(document.querySelector('[data-testid="office-prompt-input"]'),input);
  assert.equal(document.querySelector('[data-testid="attachment-fixture"]'),attachment);
  assert.equal(input.value,draft);assert.equal(document.activeElement,input);
  assert(document.querySelector('.wb-start-below').hidden);
 });
 await act(async()=>setEmpty(true));
 check('last turn to empty retains actual conversation sibling composer, attachment and focus',()=>{assert.equal(document.querySelector('[data-testid="office-prompt-input"]'),input);assert.equal(input.value,draft);assert.equal(document.querySelector('[data-testid="attachment-fixture"]'),attachment);assert.equal(document.activeElement,input);assert(!document.querySelector('.wb-start-below').hidden);});
 check('no DOM event runtime errors',()=>assert.deepEqual(runtimeErrors,[]));
 console.log(JSON.stringify({success:true,passed,scope:'U2 component state; not Electron/CSS/layout/IME acceptance'}));
} finally {
 if(root)await act(async()=>root.unmount());
 await server.close();dom.window.close();
}
