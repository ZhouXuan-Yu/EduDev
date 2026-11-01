import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

// Pure component behavior only; no Electron, provider, app build or HMR listener.
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','NodeFilter','SVGElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);
globalThis.cancelAnimationFrame=clearTimeout;
// This pinned Vite still creates a middleware WS transport when only HMR is off.
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false}});
assert.equal(server.config.server.ws,false,'Pure component tests must not open a WS listener');
let root,passed=0;
const check=(value,message)=>{assert(value,message);passed++;};
const button=id=>document.querySelector(`[data-testid="${id}"] button`);
const press=async(id,key)=>{const target=button(id);assert(target,'Missing '+id);await act(async()=>{if(key){target.focus();target.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true}));target.dispatchEvent(new window.KeyboardEvent('keyup',{key,bubbles:true}));}else target.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));});};
try{
 const {createRoot}=await import('react-dom/client');
 const {ClassroomOutlineSceneCard,ClassroomOutlineReferenceCard}=await server.ssrLoadModule('/src/renderer/components/product/ClassroomOutlineCards.tsx');
 const documentValue={schemaVersion:'xiaozhi.classroom-plan.v1',title:'浮力课堂',objectives:['比较浮力与重力'],totalMinutes:40,scenes:[{sceneId:'intro',type:'slide',title:'观察示数',activity:'观察空气与水中的测力计示数',durationMinutes:15},{sceneId:'check',type:'quiz',title:'理解检查',activity:'选择并说明物体是否一定上浮',durationMinutes:25}]};
 const plan={id:'plan-local',document:documentValue,context:{materials:[]},checkpoints:[{sceneId:'intro'}]};
 const changes=[];
 root=createRoot(document.getElementById('root'));
 const render=async(readOnly=false)=>act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(ClassroomOutlineSceneCard,{plan,document:documentValue,readOnly,onChange:(...args)=>changes.push(args)}),React.createElement(ClassroomOutlineReferenceCard,{plan}))));
 await render();
 check(document.querySelectorAll('.card').length===4,'Existing shared DisclosureCards group scenes and reference details');
 check(document.querySelectorAll('details,summary').length===0,'No native black disclosure triangles');
 check(button('classroom-plan-scene-toggle-intro').getAttribute('aria-expanded')==='true','First scene starts expanded');
 check(button('classroom-plan-scene-toggle-check').getAttribute('aria-expanded')==='false','Other scene forms start collapsed');
 check(button('classroom-plan-scene-toggle-check').textContent.includes('25 分钟'),'Collapsed scene retains teaching duration');
 check(button('classroom-plan-scene-toggle-intro').textContent.includes('已保存'),'Checkpoint remains visible in compact summary');
 check(document.querySelectorAll('[data-slot="disclosure-indicator"]').length===4,'Official Chevron indicators on all disclosures');
 const triggers=[...document.querySelectorAll('[data-slot="disclosure-trigger"]')];
 check(triggers.length===4&&triggers.every(element=>!element.querySelector('button,a,input,textarea')),'Disclosure titles contain no nested interactive controls');
 const secondPageActivity=document.querySelector('textarea[aria-label="第2页活动"]');
 await press('classroom-plan-scene-toggle-check','Enter');
 check(button('classroom-plan-scene-toggle-check').getAttribute('aria-expanded')==='true','Enter expands a scene');
 check(button('classroom-plan-scene-toggle-intro').getAttribute('aria-expanded')==='true','Multiple scenes can stay expanded');
 await press('classroom-plan-scene-toggle-check',' ');
 check(button('classroom-plan-scene-toggle-check').getAttribute('aria-expanded')==='false','Space collapses a scene');
 check(secondPageActivity&&document.querySelector('textarea[aria-label="第2页活动"]')===secondPageActivity,'Collapsed content stays mounted without discarding scene form state');
 check(button('classroom-plan-sources-toggle').getAttribute('aria-expanded')==='false','Source explanations start collapsed');
 await press('classroom-plan-sources-toggle');
 check(document.querySelector('[data-testid="classroom-sources"]')?.textContent.includes('不能视为教材原文'),'Original source explanation remains reachable');
 await press('classroom-plan-scope-toggle');
 check(document.body.textContent.includes('预演作答不会写入成绩'),'Safety scope remains reachable');
 check(button('classroom-plan-sources-toggle').getAttribute('aria-expanded')==='true','Source and scope can both remain open');
 await render(true);
 const fields=[...document.querySelectorAll('input,textarea')];
 check(fields.length>0&&fields.every(element=>element.disabled),'Generating/rejected readOnly propagates to official form controls');
 check(changes.length===0,'Disclosure actions do not edit or approve the outline');
 console.log(JSON.stringify({passed,scope:'U6 real React/HeroUI component DOM behavior; no Electron/layout/provider acceptance'}));
}finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close();}
