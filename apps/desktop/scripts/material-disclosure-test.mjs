/** Focused component checks, no Electron/browser server/provider/DB. */
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
const {act}=React,server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false}});
const root=createRoot(document.getElementById('root'));
let passed=0,pairReads=0,pairChanges=0;
const check=(label,fn)=>{fn();passed++;console.log('PASS '+label);};
const render=async(Component,props)=>act(async()=>root.render(React.createElement(Component,props)));
const click=async element=>{assert(element);await act(async()=>element.click());};
const trigger=element=>element.querySelector('button[aria-expanded][aria-controls]');
try{
 const files=fs.readdirSync('src/renderer/components/product').filter(f=>/^Material.*\.tsx$/.test(f));
 check('No native disclosure remains in Material renderer ownership',()=>{for(const file of files)assert.doesNotMatch(fs.readFileSync('src/renderer/components/product/'+file,'utf8'),/<\/?(?:details|summary)\b/);});
 const {MaterialBookAnswers}=await server.ssrLoadModule('/src/renderer/components/product/MaterialBookAnswers.tsx');
 const page={schemaVersion:'xiaozhi.material-book-answer-page.v1',policy:'section-number-two-pass.v2',status:'compared',pageUncertain:false,firstOnly:[],entries:[{section:'浮力单元',sectionKey:'浮力单元',number:'1',start:0,end:12,answer:'C',analysis:'受浮力不一定上浮',quote:'第二遍原文',first:{answer:'C',analysis:'受浮力不一定上浮',quote:'第一遍原文'},agrees:true,issues:[]}]};
 await render(MaterialBookAnswers,{page});
 const group=document.querySelector('[data-testid="material-book-answer-section"]'),entry=document.querySelector('[data-testid="material-book-answer-entry"]');
 check('Answer grouping retains initial expanded state, count, source key and answer',()=>{
  assert.equal(trigger(group).getAttribute('aria-expanded'),'true');assert.match(trigger(group).textContent,/浮力单元.*1 条/);
  assert.equal(entry.dataset.section,'浮力单元');assert.equal(entry.dataset.number,'1');assert.equal(entry.querySelector('[data-testid="material-book-answer-value"]').textContent,'C');
 });
 const evidence=trigger(entry);check('Two-pass evidence starts collapsed and both saved quotes stay mounted',()=>{assert.equal(evidence.getAttribute('aria-expanded'),'false');assert.match(entry.textContent,/第二遍原文/);assert.match(entry.textContent,/第一遍原文/);});
 await click(evidence);await click(trigger(group));await click(trigger(group));
 check('Nested evidence and entry identity survive outer collapse/reopen',()=>{assert.strictEqual(document.querySelector('[data-testid="material-book-answer-entry"]'),entry);assert.strictEqual(trigger(entry),evidence);assert.equal(evidence.getAttribute('aria-expanded'),'true');});
 const {MaterialBookPanel}=await server.ssrLoadModule('/src/renderer/components/product/MaterialBookPanel.tsx');
 window.omniEdu={getMaterialBookPair:async()=>{pairReads++;return{revision:1,current:true};}};
 const resource={id:'material',contentHash:'a'.repeat(64),originalFileName:'浮力资料.pdf'};
 const onChange=()=>pairChanges++;
 await render(MaterialBookPanel,{resource,onChange});
 const panel=document.querySelector('[data-testid="material-book-panel"]');await click(trigger(panel));
 const input=panel.querySelector('[data-testid="material-book-query"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'浮力答案');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await click(trigger(panel));await click(trigger(panel));
 check('Answer-book search state remains mounted with no repeated source reads',()=>{assert.strictEqual(panel.querySelector('[data-testid="material-book-query"]'),input);assert.equal(input.value,'浮力答案');assert.equal(pairReads,1);assert.equal(pairChanges,1);});
 const {MaterialWordBlocks}=await server.ssrLoadModule('/src/renderer/components/product/MaterialWordBlocks.tsx');
 await render(MaterialWordBlocks,{resource:{...resource,originalFileName:'浮力.docx'},assets:[],blocks:[{id:'b1',kind:'paragraph',anchor:{part:'word/header1.xml',path:'p[1]'},inlines:[{kind:'text',text:'测力计示数 3N 与 2N'}]}]});
 const source=document.querySelector('[data-word-part="word/header1.xml"]');
 check('Word origin keeps exact part/path and real filename/position in labelled fields',()=>{assert.equal(source.getAttribute('data-word-path'),'p[1]');assert.equal(trigger(source).getAttribute('aria-expanded'),'false');assert.match(source.textContent,/浮力.docx/);assert.match(source.textContent,/页眉/);assert(document.querySelector('dt'));});
 assert.equal(document.querySelectorAll('details,summary').length,0);
 console.log(JSON.stringify({pass:true,checks:passed,scope:'Focused component/logic only; no live acceptance'}));
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
