import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {createServer} from 'vite';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost'});
for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','Element','Node','Event','MouseEvent','KeyboardEvent','SVGElement','getComputedStyle','localStorage','MutationObserver'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame=fn=>setTimeout(fn,0);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.matchMedia=dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const {act}=React,server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
const errors=[];dom.window.addEventListener('error',event=>errors.push(String(event.error)));
let root,passed=0,nativeCommand,nav,setDirty,setOtherDirty,delivered=0;
const check=(label,verify)=>{verify();passed++;console.log('PASS '+label);};
const run=fn=>act(async()=>{fn();await new Promise(resolve=>setTimeout(resolve,5));});
try{
 const {DesktopFrame,useDesktopNavigation,useDesktopCommands,useDesktopNavigationGuard}=await server.ssrLoadModule('/src/renderer/components/desktop/DesktopFrame.tsx');
 const {useMaterialDraftGuard}=await server.ssrLoadModule('/src/renderer/components/product/useMaterialDraftGuard.ts');
 window.omniEdu={getDesktopChrome:async()=>({enabled:false}),onDesktopCommand:handler=>{nativeCommand=handler;return()=>{nativeCommand=undefined;};}};
 function Owner(){
  nav=useDesktopNavigation();const [dirty,updateDirty]=React.useState(false),[otherDirty,updateOtherDirty]=React.useState(false);
  setDirty=updateDirty;setOtherDirty=updateOtherDirty;
  useMaterialDraftGuard(dirty);useDesktopNavigationGuard(otherDirty,'试卷草稿尚未保存');
  useDesktopCommands(command=>{delivered++;nav.navigate({view:command==='settings'?'settings':'ai'});return true;});
  return React.createElement('section',{'data-testid':'materials-workspace'},React.createElement('textarea',{'data-testid':'draft',defaultValue:'不能丢失的校对文字'}));
 }
 root=createRoot(document.getElementById('root'));
 await run(()=>root.render(React.createElement(DesktopFrame,null,React.createElement(Owner))));
 await run(()=>assert.equal(nav.navigate({view:'knowledge'}),true));
 const draft=document.querySelector('[data-testid="draft"]');
 await run(()=>setDirty(true));
 for(const command of ['settings','new-chat','files','sidebar']){
  await run(()=>nativeCommand(command));
  check('dirty native '+command+' blocked before command handler',()=>{assert.equal(nav.target.view,'knowledge');assert.equal(delivered,0);assert.strictEqual(document.querySelector('[data-testid="draft"]'),draft);assert.equal(draft.value,'不能丢失的校对文字');});
 }
 check('visible explanation even without custom desktop chrome',()=>assert(document.querySelector('[data-testid="desktop-navigation-notice"]').textContent.includes('未保存')));
 await run(()=>nativeCommand('back'));
 check('native back cannot move history while dirty',()=>{assert.equal(nav.target.view,'knowledge');assert.equal(nav.canBack,true);});
 await run(()=>assert.equal(nav.navigate({view:'settings'}),false));
 check('direct navigation returns false without committing',()=>assert.equal(nav.target.view,'knowledge'));
 await run(()=>setDirty(false));await run(()=>nav.flush());
 check('blocked commands are consumed, never replayed after save/clear',()=>{assert.equal(nav.target.view,'knowledge');assert.equal(delivered,0);});
 await run(()=>nativeCommand('settings'));
 check('native settings works after draft is released',()=>{assert.equal(nav.target.view,'settings');assert.equal(delivered,1);});
 await run(()=>nativeCommand('back'));await run(()=>nativeCommand('back'));
 check('back works after release',()=>{assert.equal(nav.target.view,'ai');assert(nav.canForward);});
 await run(()=>setDirty(true));await run(()=>nativeCommand('forward'));
 check('native forward guarded too',()=>assert.equal(nav.target.view,'ai'));
 await run(()=>setDirty(false));await run(()=>nativeCommand('forward'));
 check('forward resumes without changing original history',()=>assert.equal(nav.target.view,'knowledge'));
 await run(()=>setOtherDirty(true));await run(()=>nativeCommand('settings'));
 check('independent paper owner can reuse same guard registry',()=>{assert.equal(nav.target.view,'knowledge');assert(document.querySelector('[data-testid="desktop-navigation-notice"]').textContent.includes('试卷'));});
 await run(()=>setOtherDirty(false));
 const app=fs.readFileSync(new URL('../src/renderer/App.tsx',import.meta.url),'utf8');
 const seam=app.slice(app.indexOf('function setActiveView(view:ViewKey)'),app.indexOf('  useEffect(()=>{',app.indexOf('function setActiveView(view:ViewKey)')));
 check('App checks navigation result before updating active view',()=>{assert(seam.includes('if(!desktopNavigation.navigate({view:target}))return;'));assert(seam.indexOf('desktopNavigation.navigate')<seam.indexOf('updateActiveView'));});
 check('MaterialBody includes reading notes as well as original and AI drafts',()=>assert(fs.readFileSync(new URL('../src/renderer/components/product/MaterialBodyPanel.tsx',import.meta.url),'utf8').includes('useMaterialDraftGuard(originalDirty||aiDirty||studyDirty)')));
 check('no DOM runtime errors',()=>assert.deepEqual(errors,[]));
 console.log(JSON.stringify({success:true,passed,scope:'real renderer navigation/context with native IPC callback fixture; no Electron/build execution'}));
}finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close();}
