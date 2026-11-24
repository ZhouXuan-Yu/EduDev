import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

// Component fault injection only. No real data, Electron IPC or provider claim.
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
for(const k of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','HTMLSelectElement','Element','Node','NodeFilter','Event','MouseEvent','PointerEvent','KeyboardEvent','SVGElement','DocumentFragment','getComputedStyle','localStorage','MutationObserver'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame=fn=>setTimeout(fn,0);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=dom.window.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.matchMedia=dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const desktop=path.resolve(import.meta.dirname,'..'),baseline=process.argv.includes('--baseline');
const targetFiles=['components/QuestionNotebookWorkspace.tsx','components/TeachingBookWorkspace.tsx','components/product/MaterialStructurePanel.tsx','components/product/MaterialsWorkspace.tsx'];
const server=await createServer({configFile:false,root:desktop,appType:'custom',optimizeDeps:{noDiscovery:true},css:{postcss:{plugins:[]}},server:{middlewareMode:true,hmr:false,ws:false,watch:null},
  plugins:baseline?[{name:'read-error-before-evidence',enforce:'pre',load(id){const file=targetFiles.find(f=>id.replaceAll('\\','/').endsWith('/src/renderer/'+f));if(file)return execFileSync('git',['show','bacc2c9:apps/desktop/src/renderer/'+file],{cwd:desktop,encoding:'utf8'});}}]:[]});
const report={success:false,layer:'component',baseline,source:baseline?'bacc2c9':'working tree',checks:[],boundary:'Mounted production components with rejected/deferred read fixtures. Not a domain, provider, Electron or persistence acceptance.'};
let root;
const act=async fn=>React.act(async()=>{await fn();await new Promise(r=>setTimeout(r,20));});
const find=id=>document.querySelector(`[data-testid="${id}"]`);
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);};
const reject=async()=>{throw Error('fixture_read_unavailable');};
async function mount(file,name,props,api){
  if(root)await act(()=>root.unmount());
  window.omniEdu=new Proxy(api,{get:(target,key)=>key in target?target[key]:String(key).startsWith('on')?()=>()=>{}:async()=>undefined});
  root=createRoot(document.getElementById('root'));
  const mod=await server.ssrLoadModule('/src/renderer/'+file);
  await act(()=>root.render(React.createElement(mod[name],props)));
}
try{
  let failed=true;
  await mount(targetFiles[0],'QuestionNotebookWorkspace',{setStatus:()=>{}},{
    listQuestionNotebook:async()=>{if(failed)throw Error('fixture_read_unavailable');return {items:[],total:0};},listQuestionNotebookCategories:async()=>[],
  });
  check('question read failure is not an empty library or no-results state',()=>{assert(find('question-notebook-error'));assert(!find('question-notebook-empty'));assert(!find('question-notebook-no-results'));assert(!find('question-notebook-summary').textContent.includes('共 0'));});
  failed=false;
  await act(()=>[...document.querySelectorAll('button')].find(el=>el.textContent==='重新读取题本').click());
  check('successful retry may show a real empty question library',()=>{assert(find('question-notebook-empty'));assert(!find('question-notebook-read-failed'));});
  await mount(targetFiles[1],'TeachingBookWorkspace',{setStatus:()=>{}},{listTeachingBooks:reject});
  check('book read failure is not an empty book library',()=>{assert(find('teaching-book-error'));assert(!find('teaching-book-empty'));assert(!find('teaching-book-filter-empty'));});
  window.omniEdu.listTeachingBooks=async()=>[];
  await act(()=>find('teaching-book-refresh').click());
  check('book retry clears stale failure and presents confirmed empty state',()=>{assert(find('teaching-book-empty'));assert(!find('teaching-book-error'));});
  await mount(targetFiles[2],'MaterialStructurePanel',{resource:{id:'resource_fixture',contentHash:'a'.repeat(64),originalFileName:'UI验收.pdf'}},{getMaterialStructure:reject});
  check('structure read failure is not described as no structure created',()=>{assert(document.querySelector('[role="alert"]'));assert(!find('structure-empty'));});
  await mount(targetFiles[3],'MaterialsWorkspace',{}, {listMaterialCatalog:reject});
  // The real catalog deliberately debounces reads for 150 ms. Wait for its
  // observable error rather than assuming the initial loading render settled.
  for(let i=0;i<50&&!find('materials-error');i++)await act(()=>new Promise(resolve=>setTimeout(resolve,20)));
  check('material read failure is not described as first import or no match',()=>{assert(find('materials-error'));assert(find('materials-read-failed'));assert(!find('materials-count').textContent.includes('0 份资料'));assert(!document.body.textContent.includes('先添加一份资料'));assert(!document.body.textContent.includes('没有匹配的资料'));});
  const settingsFile='components/office/PiSettingsWorkspace.tsx';
  await mount(settingsFile,'PiSettingsWorkspace',{onBack:()=>{}},{listAiConversations:reject,getXiaozhiSettings:async()=>({ok:false}),getDataRoot:async()=>''});
  await act(()=>find('pi-settings-tab-permissions').click());
  check('settings read failure does not claim there are no current conversations',()=>{assert(find('pi-settings-state'));assert(!find('pi-settings-no-session'));});
  await act(()=>find('pi-settings-tab-backup').click());
  await act(()=>find('pi-settings-tab-archives').click());
  check('archive read failure does not claim an empty archive',()=>{assert(find('pi-settings-archive-read-failed'));assert(!find('pi-settings-archive-empty'));});
  report.success=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;console.error(report.failure);}
finally{
  const evidence=path.resolve(desktop,'../../acceptance/ui-ux-r1-20261124/evidence');
  fs.writeFileSync(path.join(evidence,baseline?'read-errors-before.html':'read-errors-after.html'),document.body.innerHTML);
  if(root)await act(()=>root.unmount());
  await server.close();dom.window.close();
  fs.writeFileSync(path.join(evidence,baseline?'read-errors-before.json':'read-errors-after.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
