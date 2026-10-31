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
const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
const el=id=>document.querySelector(`[data-testid="${id}"]`);
const click=async id=>{assert(el(id),id);await act(async()=>el(id).click());await flush();};
try {
 const {MaterialBodyPanel}=await server.ssrLoadModule('/src/renderer/components/product/MaterialBodyPanel.tsx');
 const resource={id:'resource_00000000-0000-0000-0000-000000000001',title:'校对测试',originalFileName:'test.pdf',contentHash:'a'.repeat(64),parseStatus:'ready',chunkCount:0,fileSize:100};
 const batch={id:'batch-one',status:'running',start:1,count:2,model:'test',units:[{ordinal:1,pageSource:true},{ordinal:2,pageSource:true}],complete:2,review:0,failed:0,unknown:0,pending:0,questions:0,calls:4,maxCalls:4};
 let rows=Array.from({length:10},(_,i)=>({...batch,id:i?'batch-'+i:batch.id})),reads=0,pauses=0;
 window.omniEdu={
  getMaterialBody:async()=>({resource,chunks:[],total:0}),
  getMaterialBookPair:async()=>({revision:0}),
  getMaterialAiSettings:async()=>({configured:false,model:'test',revision:0}),
  getMaterialAiBatches:async()=>rows,
  controlMaterialAiBatch:async()=>{pauses++;},
  getMaterialAiPage:async({ordinal})=>{reads++;return {resource,source:{schemaVersion:'page',page:ordinal},status:'complete',text:'已还原正文',ocrText:''};},
  getMaterialPagePreview:async({page})=>({ok:true,page,total:2,width:100,height:100,sha256:'f'.repeat(64),dataUrl:'data:image/png;base64,AA=='}),
  cancelMaterialPagePreview:async()=>({ok:true}),
  getMaterialPageLayout:async()=>({ok:true,cached:false,layout:{width:100,height:100,rasterSha256:'f'.repeat(64),lines:[{id:'line-1',text:'选出的原文',quad:[[0,0],[10,0],[10,10],[0,10]]}]}}),
  cancelMaterialPageLayout:async()=>({ok:true})
 };
 const reports=[];
 const report=value=>reports.push(value);
 root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(React.createElement('section',{'data-testid':'materials-workspace'},React.createElement(MaterialBodyPanel,{resource,busy:false,revision:0,locate(){},retry(){},onStudyDirty:report}))));
 await flush();await click('materials-section-questions');
 await click('material-ai-page-open');
 await act(async()=>el('material-ai-page-panel').querySelector('[data-testid="materials-original-open"]').click());await flush();await click('materials-layout-start');
 const nativeSet=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
 // Select a real OCR line through the production component, then edit its draft.
 await act(async()=>document.querySelector('[data-testid="materials-layout-overlay"] polygon').dispatchEvent(new MouseEvent('click',{bubbles:true})));
 await flush();
 const draft=el('materials-layout-draft');assert(draft);
 await act(async()=>{nativeSet.call(draft,'教师临时修正文字');draft.dispatchEvent(new Event('input',{bubbles:true}));});
 check('temporary OCR selection propagates through AI page/batch/body to top-level dirty',()=>{assert.equal(reports.at(-1),true);assert(el('materials-unsaved-ai'));});
 check('AI item select, refresh and collapse cannot discard dirty text',()=>{
  assert.equal(el('material-ai-page-select').disabled,true);assert.equal(el('material-ai-page-refresh').disabled,true);assert.equal(el('material-ai-page-open').disabled,true);
  assert(el('material-ai-page-unsaved').textContent.includes('清除'));
 });
 check('original page navigation, refresh and close are blocked with explanation',()=>{
  for(const id of ['materials-original-next','materials-original-page-jump','materials-original-refresh','materials-original-close'])assert.equal(el(id).disabled,true,id);
 });
 check('batch pagination blocked while draft exists',()=>{const next=[...document.querySelectorAll('button')].find(b=>b.textContent==='后10个批次');assert(next.disabled);});
 const priorReads=reads;
 await click('material-ai-page-refresh');await click('material-ai-page-open');
 check('blocked actions do not re-fetch or remount the editor',()=>{assert.equal(reads,priorReads);assert.equal(el('materials-layout-draft'),draft);assert.equal(draft.value,'教师临时修正文字');});
 await click('materials-section-content');
 check('visited questions tab remains mounted while hidden',()=>{assert.equal(el('materials-question-detail').hidden,true);assert.equal(el('materials-layout-draft'),draft);assert.equal(reports.at(-1),true);});
 await click('materials-section-questions');
 const outside=document.createElement('button');outside.textContent='离开资料';document.body.append(outside);
 const away=new MouseEvent('click',{bubbles:true,cancelable:true});outside.dispatchEvent(away);
 check('navigation outside materials blocked while unsaved and explanation remains visible',()=>{assert.equal(away.defaultPrevented,true);assert(el('materials-unsaved-ai'));});outside.remove();
 // A poll that would replace the list must not evict the edited batch.
 rows=[];
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1550));});
 check('background batch refresh cannot evict a dirty editor',()=>{assert.equal(el('materials-layout-draft'),draft);assert.equal(draft.value,'教师临时修正文字');});
 const pause=[...document.querySelectorAll('button')].find(b=>b.textContent==='暂停此批次');
 await act(async()=>pause.click());await flush();
 check('pause stays available without discarding draft',()=>{assert.equal(pauses,1);assert.equal(el('materials-layout-draft'),draft);});
 await click('materials-layout-clear');
 check('explicit clear releases dirty up the entire callback chain',()=>{assert.equal(reports.at(-1),false);assert.equal(el('material-ai-page-select').disabled,false);assert.equal(el('materials-original-next').disabled,false);});
 await act(async()=>{const select=el('material-ai-page-select');select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}));});await flush();
 check('AI item navigation resumes after explicit clear',()=>{assert(reads>priorReads);assert.equal(el('material-ai-page-select').value,'2');});
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));
 const {AI_TEXT_SOURCE}=await server.ssrLoadModule('/src/shared/material-ai-text.ts');
 const source={schemaVersion:AI_TEXT_SOURCE,resourceId:resource.id,version:resource.contentHash,offset:0,chunkId:'chunk_00000000-0000-0000-0000-000000000001',bodyVersion:'b'.repeat(64),batchId:'aibatch_00000000-0000-0000-0000-000000000001',ordinal:1,page:1,finalSha:'c'.repeat(64)};
 window.omniEdu.getMaterialSource=async()=>({body:{resource,chunks:[],total:0},restored:{resource,source:{schemaVersion:'page',page:1},status:'complete',text:'AI来源正文',ocrText:''}});
 reports.length=0;
 await act(async()=>root.render(React.createElement('section',{'data-testid':'materials-workspace'},React.createElement(MaterialBodyPanel,{resource,sourceView:{source,body:{resource,chunks:[]}},busy:false,revision:0,locate(){},retry(){},onStudyDirty:report}))));await flush();
 await click('materials-original-open');await click('materials-layout-start');
 await act(async()=>document.querySelector('[data-testid="materials-layout-overlay"] polygon').dispatchEvent(new MouseEvent('click',{bubbles:true})));await flush();
 check('AI source deep link also reports selected draft to top-level dirty',()=>{assert.equal(reports.at(-1),true);assert(el('material-ai-page-unsaved'));assert(el('material-ai-page-open').disabled);});
 await click('materials-layout-clear');
 check('deep-link explicit clear releases dirty guard',()=>assert.equal(reports.at(-1),false));
 check('no DOM runtime errors',()=>assert.deepEqual(runtimeErrors,[]));
 console.log(JSON.stringify({success:true,passed,scope:'focused renderer state with stubbed typed IPC; no backend/Electron validation'}));
}finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close();}
