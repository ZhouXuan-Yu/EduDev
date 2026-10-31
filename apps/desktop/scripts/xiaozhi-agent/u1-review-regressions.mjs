import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
const dom=new JSDOM('<!doctype html><html><body><textarea id="composer"></textarea><div id="root"></div></body></html>',{url:'http://localhost',pretendToBeVisual:true});
for(const name of ['window','document','Node','Element','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','MutationObserver','SVGElement','Event','MouseEvent','KeyboardEvent'])globalThis[name]=name==='window'?dom.window:name==='document'?dom.window.document:dom.window[name];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.getComputedStyle=dom.window.getComputedStyle;
globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(Date.now()),0);
globalThis.cancelAnimationFrame=clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
globalThis.ResizeObserver=dom.window.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const domErrors=[];dom.window.addEventListener('error',event=>domErrors.push(String(event.error)));
const {createRoot}=await import('react-dom/client');
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,watch:null}});
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
try{
 const {applyXiaozhiEvent}=await server.ssrLoadModule('/src/shared/xiaozhi-projection.ts');
 const {createPiTextViewBuffer,piTextViewEvent}=await server.ssrLoadModule('/src/renderer/components/office/pi-text-view-buffer.ts');
 const {AgentProcess}=await server.ssrLoadModule('/src/renderer/components/office/AgentProcess.tsx');
 const base=()=>({id:'run',status:'running',items:[]});
 await check('untagged prose is not a timed public execution activity',()=>{
   let turn=base();for(const event of [{kind:'assistant_start',segment:1},{kind:'text_delta',delta:'普通正文',capturedAt:1000},{kind:'assistant_end',segment:1,final:true,since:5000}])turn=applyXiaozhiEvent(turn,event);
   assert.equal(turn.presentation.processStartedAt,undefined);assert.equal(turn.presentation.processElapsedMs,undefined);
 });
 await check('production view buffer preserves first nonempty commentary capture across coalescing',()=>{
   let turn=base(),time=0;const timers=[];
   const buffer=createPiTextViewBuffer({now:()=>time,schedule:callback=>{timers.push(callback);return()=>{};},text:view=>{turn=applyXiaozhiEvent(turn,piTextViewEvent(view));},immediate:event=>{turn=applyXiaozhiEvent(turn,event);}});
   const emit=(sequence,event)=>buffer.accept({sessionId:'s',runId:'run',sequence,...event});
   emit(1,{kind:'assistant_start',segment:1});emit(2,{kind:'assistant_phase',segment:1,phase:'commentary',since:900});
   emit(3,{kind:'text_delta',delta:' ',capturedAt:1000});emit(4,{kind:'text_delta',delta:'\n',capturedAt:1100});emit(5,{kind:'text_delta',delta:'先核对资料',capturedAt:1200});emit(6,{kind:'text_delta',delta:'再回答',capturedAt:1300});
   time=10000;buffer.flush();assert.equal(turn.presentation.processStartedAt,1200);
   emit(7,{kind:'status',status:'failed',finishedAt:2200});
   assert.equal(turn.presentation.processEndedAt,2200);assert.equal(turn.presentation.processElapsedMs,1000);
 });
 for(const status of ['failed','interrupted'])await check('host '+status+' finishedAt freezes tool process without fabricated delta timestamps',()=>{
   let turn=applyXiaozhiEvent(base(),{kind:'tool_start',tool:'office_read_attachment',callId:'read',capturedAt:1000});
   turn=applyXiaozhiEvent(turn,{kind:'status',status,finishedAt:4000});assert.equal(turn.presentation.processElapsedMs,3000);
 });
 const active={id:'focus',status:'running',presentation:{version:1,phase:'process'},items:[{id:'read',kind:'tool',toolName:'office_read_attachment',status:'completed',label:'读取资料',resultSummary:{version:1,scope:'read',text:'已读取合成资料'},sources:[{title:'合成公开来源',url:'https://example.invalid/source',kind:'read'}]}]};
 for(const focus of ['summary','link','composer'])await check('real AgentProcess two-commit final handoff preserves '+focus+' focus safely',async()=>{
   const host=document.getElementById('root'),root=createRoot(host);let commits=0;
   const render=turn=>React.act(async()=>root.render(React.createElement(React.Profiler,{id:'process',onRender:()=>commits++},React.createElement(AgentProcess,{turn,sessionId:'s'}))));
   try{
     await render(active);
     const details=host.querySelector('details');await React.act(async()=>{details.open=true;details.dispatchEvent(new Event('toggle'));});
     const summary=host.querySelector('summary'),link=host.querySelector('details a');assert(link,'real public source link exists');
     await React.act(async()=>summary.focus());
     if(focus==='link')await React.act(async()=>link.focus());
     if(focus==='composer')await React.act(async()=>document.getElementById('composer').focus());
     const before=commits;
     await render({...active,presentation:{version:1,phase:'answer'}});
     assert(commits-before>=2,'exercise actual handoff render and state-fold render');
     const trigger=host.querySelector('[data-testid="agent-trace-toggle"]');assert.equal(trigger.getAttribute('aria-expanded'),'false');
     assert.equal(document.activeElement,focus==='composer'?document.getElementById('composer'):trigger);
   }finally{await React.act(async()=>root.unmount());}
 });
 for(const status of ['failed','interrupted'])await check('real '+status+' process remains expanded and stops streaming',async()=>{
   const host=document.getElementById('root'),root=createRoot(host);
   const render=turn=>React.act(async()=>root.render(React.createElement(AgentProcess,{turn,sessionId:'s'})));
   try{await render(active);await render({...active,status});const trigger=host.querySelector('[data-testid="agent-trace-toggle"]');assert.equal(trigger.getAttribute('aria-expanded'),'true');assert.equal(host.querySelector('[data-testid="agent-trace"]').getAttribute('data-thinking'),'settled');assert(host.querySelector('[data-testid="agent-trace-timeline"]'));}
   finally{await React.act(async()=>root.unmount());}
 });
 assert.deepEqual(domErrors,[],'actual component interaction must produce no DOM errors');
 console.log(JSON.stringify({suite:'u1-review-regressions',passed}));
}finally{await server.close();dom.window.close();}
