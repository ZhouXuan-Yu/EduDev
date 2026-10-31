import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

// Mounted production components with a deferred preload fixture. No Electron,
// model calls, database writes or full renderer suite.
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','Element','Node','Event','MouseEvent','PointerEvent','KeyboardEvent','SVGElement','getComputedStyle','localStorage','MutationObserver'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame=fn=>setTimeout(fn,0);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.matchMedia=dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const {act}=React;
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,watch:null}});
let root,passed=0;
const run=fn=>act(async()=>{fn();await new Promise(resolve=>setTimeout(resolve,5));});
const find=id=>document.querySelector(`[data-testid="${id}"]`);
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const press=async element=>{
 assert(element,'press target missing');
 await run(()=>{
  for(const type of ['pointerdown','pointerup'])element.dispatchEvent(new window.PointerEvent(type,{pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerdown'?1:0,bubbles:true,cancelable:true}));
  element.dispatchEvent(new window.MouseEvent('click',{button:0,detail:1,bubbles:true,cancelable:true}));
 });
};
const edit=async value=>run(()=>{
 const input=find('paper-title');
 Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);
 input.dispatchEvent(new window.Event('input',{bubbles:true}));
});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
try{
 const load=path=>server.ssrLoadModule('/src/'+path);
 const {defaultPaperBlueprint}=await load('shared/paper-blueprint.ts');
 const {PaperReviewPanel}=await load('renderer/components/PaperReviewPanel.tsx');
 const {PaperBlueprintWorkspace}=await load('renderer/components/PaperBlueprintWorkspace.tsx');
 const {DesktopFrame,useDesktopNavigation,useDesktopCommands}=await load('renderer/components/desktop/DesktopFrame.tsx');
 const snapshot=id=>({id,sessionId:'session-fixture',title:id,state:'pending',count:0,totalPoints:100,revision:1,blueprint:{...defaultPaperBlueprint(),title:id},complete:true,sourceCurrent:true,exportCurrent:true,answerVerified:false,selection:{items:[],shortages:[],scanned:0,scanComplete:true,excluded:{unsupported:0,missing_answer:0,source_unavailable:0},duplicateRecords:0}});
 root=createRoot(document.getElementById('root'));
 for(const oldOutcome of ['success','failure']){
  const requests=[],changed=[],a=deferred(),b=deferred();
  window.omniEdu={decidePaper:input=>{requests.push(input.id);return input.id==='A'?a.promise:b.promise;}};
  const render=id=>root.render(React.createElement(PaperReviewPanel,{view:snapshot(id),onChanged:view=>changed.push(view.id)}));
  await run(()=>render('A'));await press(find('paper-confirm'));
  check('A pending decision is busy '+oldOutcome,()=>assert.equal(find('paper-confirm').disabled,true));
  await run(()=>render('B'));
  check('B starts independently while A awaits '+oldOutcome,()=>{assert.equal(find('paper-confirm').disabled,false);assert(!find('paper-decision-error'));});
  await press(find('paper-confirm'));
  await run(()=>oldOutcome==='success'?a.resolve({ok:true,value:{...snapshot('A'),state:'confirmed'}}):a.reject(new Error('old A failure')));
  check('late A cannot clear B busy or leak state '+oldOutcome,()=>{assert.equal(find('paper-confirm').disabled,true);assert.deepEqual(changed,[]);assert(!find('paper-decision-error'));assert.deepEqual(requests,['A','B']);});
  await run(()=>b.resolve({ok:true,value:{...snapshot('B'),state:'confirmed'}}));
  check('B alone commits and releases busy '+oldOutcome,()=>{assert.deepEqual(changed,['B']);assert.equal(find('paper-confirm').disabled,false);});
  await run(()=>root.render(null));
 }
 let nav,nativeCommand;
 const saved={...snapshot('saved'),state:'confirmed'};
 window.omniEdu={listPapers:async()=>({ok:true,value:[saved]}),reviewPaper:async()=>({ok:true,value:saved}),getDesktopChrome:async()=>({enabled:false}),onDesktopCommand:handler=>{nativeCommand=handler;return()=>{};}};
 function Host(){
  nav=useDesktopNavigation();
  useDesktopCommands(command=>{if(command==='settings'){nav.navigate({view:'settings'});return true;}return false;});
  return nav.target.view==='paper'?React.createElement(PaperBlueprintWorkspace):React.createElement('p',null,nav.target.view);
 }
 await run(()=>root.render(React.createElement(DesktopFrame,null,React.createElement(Host))));
 await run(()=>nav.navigate({view:'paper'}));
 for(const owner of ['new','saved']){
  if(owner==='saved')await press(find('paper-saved'));
  if(owner==='saved')await press(find('paper-step-blueprint'));
  const baseline=find('paper-title').value;
  await edit('不能丢失的'+owner+'蓝图');
  check(owner+' draft marked after real input',()=>assert(find('paper-discard-edits')));
  for(const target of ['knowledge','notebook']){
   await run(()=>assert.equal(nav.navigate({view:target}),false));
   check(owner+' draft blocks '+target+' navigation',()=>{assert.equal(nav.target.view,'paper');assert.equal(find('paper-title').value,'不能丢失的'+owner+'蓝图');});
  }
  for(const command of ['back','settings']){
   await run(()=>nativeCommand(command));
   check(owner+' draft blocks native '+command,()=>{assert.equal(nav.target.view,'paper');assert.equal(find('paper-title').value,'不能丢失的'+owner+'蓝图');assert(find('desktop-navigation-notice').textContent.includes('蓝图'));});
  }
  await press(find('paper-discard-edits'));
  await press([...document.querySelectorAll('button')].find(button=>button.textContent==='继续编辑'));
  check(owner+' cancel retains edits and guard',()=>{assert.equal(find('paper-title').value,'不能丢失的'+owner+'蓝图');assert(find('paper-discard-edits'));});
  await press(find('paper-discard-edits'));await press(find('paper-discard-continue'));
  check(owner+' explicit discard restores original snapshot without deleting confirmation',()=>{assert.equal(find('paper-title').value,baseline);assert(!find('paper-discard-edits'));if(owner==='saved')assert(find('paper-confirmed'));});
  await run(()=>assert.equal(nav.navigate({view:'knowledge'}),true));
  check(owner+' only confirmed discard releases navigation',()=>assert.equal(nav.target.view,'knowledge'));
  await run(()=>nav.navigate({view:'paper'}));
 }
 console.log(JSON.stringify({success:true,passed,scope:'mounted U4 components; preload fixtures only; no build/Electron/model'}));
}finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close();}
