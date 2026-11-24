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
const targetFiles=['components/office/PiModelSettings.tsx'];
const server=await createServer({configFile:false,root:desktop,appType:'custom',optimizeDeps:{noDiscovery:true},css:{postcss:{plugins:[]}},server:{middlewareMode:true,hmr:false,ws:false,watch:null},
  plugins:baseline?[{name:'read-error-before-evidence',enforce:'pre',load(id){const file=targetFiles.find(f=>id.replaceAll('\\','/').endsWith('/src/renderer/'+f));if(file)return execFileSync('git',['show','5d45c38:apps/desktop/src/renderer/'+file],{cwd:desktop,encoding:'utf8'});}}]:[]});
const report={success:false,layer:'component',baseline,source:baseline?'5d45c38':'working tree',checks:[],boundary:'Mounted production components with rejected/deferred read fixtures. Not a domain, provider, Electron or persistence acceptance.'};
let root;
const act=async fn=>React.act(async()=>{await fn();await new Promise(r=>setTimeout(r,20));});
const find=id=>document.querySelector(`[data-testid="${id}"]`);
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);};
const reject=async()=>{throw Error('fixture_read_unavailable');};
async function mount(file,name,props,api){
  if(root)await act(()=>root.unmount());
  window.omniEdu=new Proxy(api,{get:(target,key)=>key in target?target[key]:String(key).startsWith('on')?()=>()=>{}:async()=>undefined});
  root=createRoot(document.getElementById('root'));
  console.log('Loading production model form');const mod=await Promise.race([server.ssrLoadModule('/src/renderer/'+file),new Promise((_,reject)=>setTimeout(()=>reject(Error('Component module load timed out')),30000))]);console.log('Mounting production model form');
  await act(()=>root.render(React.createElement(mod[name],props)));console.log('Mounted production model form');
}
try{
  const view={schemaVersion:'xiaozhi.settings.v1',version:1,provider:'deepseek',configured:true,maskedApiKey:'***fixture',defaultModel:'deepseek-flash',locked:false,models:[{id:'deepseek-flash',name:'Fixture',contextWindow:1000,maxOutputTokens:100}],catalogue:'cache'};
  let outcome='failure',calls=0;
  await mount(targetFiles[0],'PiModelSettings',{onBack:()=>{},embedded:true},{
    getXiaozhiSettings:async()=>({ok:true,value:view}),
    saveXiaozhiSettings:async()=>{calls++;if(outcome==='throw')throw Error('fixture_storage_unavailable');return outcome==='success'?{ok:true,value:{...view,version:2}}:{ok:false,error:'storage_unavailable'};},
  });
  const fill=async value=>act(()=>{const el=find('pi-settings-key');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new window.Event('input',{bubbles:true}));});
  const submit=async()=>act(()=>find('pi-settings-save').closest('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  const secret='fixture-only-not-a-credential';await fill(secret);await submit();
  check('host rejection retains the unsaved password locally, failure feedback and retry',()=>{assert.equal(calls,1);assert.equal(find('pi-settings-key').value,secret);assert(find('pi-settings-feedback').textContent.includes('没有保存'));assert(find('pi-settings-unsaved'));assert(!find('pi-settings-save').disabled);assert.equal(find('pi-settings-key').type,'password');assert.equal(localStorage.length,0);});
  outcome='throw';await submit();check('transport rejection also retains the input without browser persistence',()=>{assert.equal(calls,2);assert.equal(find('pi-settings-key').value,secret);assert(!find('pi-settings-save').disabled);assert.equal(localStorage.length,0);});
  outcome='success';await submit();check('only an actual successful host response clears the submitted password',()=>{assert.equal(calls,3);assert.equal(find('pi-settings-key').value,'');assert(!find('pi-settings-unsaved'));assert(find('pi-settings-feedback').textContent.includes('已保存'));});
  await fill(secret);await act(()=>find('pi-settings-discard').click());check('explicit discard clears the local password and dirty guard',()=>{assert.equal(find('pi-settings-key').value,'');assert(!find('pi-settings-unsaved'));});
  report.success=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;console.error(report.failure);}
finally{
  if(root)await act(()=>root.unmount());await server.close();dom.window.close();
  const evidence=path.resolve(desktop,'../../acceptance/ui-ux-r1-20261124/evidence');fs.writeFileSync(path.join(evidence,baseline?'model-buffer-before.json':'model-buffer-after.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
