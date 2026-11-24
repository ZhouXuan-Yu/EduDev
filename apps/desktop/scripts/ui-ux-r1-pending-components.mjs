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
dom.window.HTMLElement.prototype.getAnimations=()=>[];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');

const desktop=path.resolve(import.meta.dirname,'..'),before=process.argv.includes('--before');
const server=await createServer({configFile:false,root:desktop,appType:'custom',optimizeDeps:{noDiscovery:true},css:{postcss:{plugins:[]}},server:{middlewareMode:true,hmr:false,ws:false,watch:null},plugins:[{name:'unused-classroom-preview-fixture',resolveId(id){if(id==='virtual:classroom-preview')return id;},load(id){if(id==='virtual:classroom-preview')return 'export const classroomPreviewScript="";export const classroomPreviewCss="";';}},...(before?[{name:'original-card',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/components/office/PiOfficeArtifactCard.tsx'))return execFileSync('git',['show','6cfa15e:apps/desktop/src/renderer/components/office/PiOfficeArtifactCard.tsx'],{cwd:desktop,encoding:'utf8'});}}]:[])]});

const report={success:false,checks:[],boundary:'Mounted original pending panel and original shared composer draft provider, controlled synthetic question metadata/callback failures only. No Electron, provider or persistence claim.'};
const root=createRoot(document.getElementById('root'));
const act=fn=>React.act(async()=>{await fn();await new Promise(r=>setTimeout(r,25));});
const find=id=>document.querySelector(`[data-testid="${id}"]`);
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const fill=(el,text)=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(el,text);el.dispatchEvent(new window.Event('input',{bubbles:true}));};
try{
 const {OfficeComposerState}=await server.ssrLoadModule('/src/renderer/components/office/OfficeComposerState.tsx');
 const {PiComposerPendingPanel}=await server.ssrLoadModule('/src/renderer/components/office/PiComposerPendingPanel.tsx');
 const items=['甲','乙'].map((name,i)=>({kind:'question',id:'fixture-question-'+i,label:'待补充'+name,item:{id:'fixture-question-'+i,kind:'question',state:'pending',text:'请补充测试项'+name,options:[]}}));
 let show;
 function Harness(){const [rows,setRows]=React.useState([]);show=()=>setRows(items);return React.createElement(React.Fragment,null,React.createElement(PiComposerPendingPanel,{items:rows,sessionId:'fixture-session',onAnswer:async()=>{throw Error('fixture_failure');},onDecision:async()=>{},onRefresh:async()=>{},onOpen:()=>{}}),React.createElement('textarea',{'data-testid':'original-composer',defaultValue:'原有对话草稿'}));}
 await act(()=>root.render(React.createElement(OfficeComposerState,{sessionId:'fixture-session'},React.createElement(Harness))));
 find('original-composer').focus();await act(()=>show());assert.equal(document.activeElement,find('original-composer'));assert.equal(document.querySelectorAll('[data-testid="pi-composer-pending-panel"]').length,1);check('Entering two pending items keeps one panel and does not steal composer focus');
 const select=document.querySelector('select[aria-label="选择待处理事项"]');assert(select);assert.equal(select.parentElement.tagName,'HEADER');assert.equal(select.dataset.nativeIndicator,'chevron');assert.equal(select.options.length,2);check('Protected multi-item control retains its direct native DOM, name and choices');
 const choose=async value=>act(()=>{select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));});
 await act(()=>fill(find('pi-question-answer'),'第一项尚未提交的内容'));await choose(items[1].id);assert.equal(find('pi-question-answer').value,'');await act(()=>fill(find('pi-question-answer'),'第二项草稿'));
 await act(()=>find('pi-composer-pending-toggle').click());assert.equal(find('pi-composer-pending-toggle').getAttribute('aria-expanded'),'false');await act(()=>find('pi-composer-pending-toggle').click());assert.equal(find('pi-question-answer').value,'第二项草稿');
 await choose(items[0].id);assert.equal(find('pi-question-answer').value,'第一项尚未提交的内容');assert.equal(find('original-composer').value,'原有对话草稿');check('Switching, collapsing and restoring pending items preserves both independent answers and the composer draft');
 await act(()=>find('pi-question-submit').click());assert(document.querySelector('[role="alert"]'));assert.equal(find('pi-question-answer').value,'第一项尚未提交的内容');assert.equal(find('pi-question-submit').disabled,false);check('Failed callback retains the answer, exposes a retryable error and releases busy state');report.success=true;
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}
finally{await act(()=>root.unmount());await server.close();dom.window.close();fs.writeFileSync(path.resolve(desktop,'../../acceptance/ui-ux-r1-20261124/evidence/pending-panel-components.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
