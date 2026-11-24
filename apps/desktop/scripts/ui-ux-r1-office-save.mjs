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
const server=await createServer({configFile:false,root:desktop,appType:'custom',optimizeDeps:{noDiscovery:true},css:{postcss:{plugins:[]}},server:{middlewareMode:true,hmr:false,ws:false,watch:null},plugins:[{name:'unused-classroom-preview-fixture',resolveId(id){if(id==='virtual:classroom-preview')return id;},load(id){if(id==='virtual:classroom-preview')return 'export const classroomPreviewScript="";export const classroomPreviewCss="";';}},...(before?[{name:'original-card',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/components/office/PiOfficeArtifactCard.tsx'))return execFileSync('git',['show','HEAD:apps/desktop/src/renderer/components/office/PiOfficeArtifactCard.tsx'],{cwd:desktop,encoding:'utf8'});}}]:[])]});
const result={before,success:false,boundary:'Mounted real Office card with deferred host fixtures and real shared draft provider; not a provider or persistence test.'};
const root=createRoot(document.getElementById('root'));
try{
 const {flushSync}=await import('react-dom');
 const {OfficeComposerState,useOfficeControlState}=await server.ssrLoadModule('/src/renderer/components/office/OfficeComposerState.tsx');
 const {PiOfficeArtifactCard}=await server.ssrLoadModule('/src/renderer/components/office/PiOfficeArtifactCard.tsx');
 const draft={schemaVersion:'xiaozhi.presentation-draft.v1',title:'教师修改后的标题',sections:[{pageId:'intro',heading:'课堂引入',paragraphs:['解方程'],speakerNotes:[{kind:'script',text:'请学生观察等式。'}]}]};
 let revision=1,remount,startEdit;
 window.omniEdu=new Proxy({reviewXiaozhiOffice:async()=>({ok:true,value:{id:'fixture-office',revision,draft,images:[],sources:[]}}),reviseXiaozhiOffice:async()=>({ok:true,value:{revision:++revision}})},{get:(obj,key)=>obj[key]||(()=>Promise.resolve(undefined))});
 function Probe(){const {draft:state,update}=useOfficeControlState('office-artifact:fixture-office');startEdit=()=>update({officeDraft:draft,officeRevision:1,editing:true});return React.createElement('output',{'data-testid':'shared-busy'},String(state.busy));}
 function Harness(){const [key,setKey]=React.useState(0);remount=()=>flushSync(()=>setKey(k=>k+1));return React.createElement(React.Fragment,null,React.createElement(Probe),React.createElement(PiOfficeArtifactCard,{key,artifact:{id:'fixture-office',revision,state:'pending',format:'pptx',path:'test.pptx'},sessionId:'fixture-session',running:true,onRefresh:async()=>remount(),onOpen:()=>{}}));}
 await React.act(async()=>{root.render(React.createElement(OfficeComposerState,{sessionId:'fixture-session'},React.createElement(Harness)));await new Promise(r=>setTimeout(r,100));});
 for(let i=0;i<20&&!document.querySelector('[data-testid="pi-office-save-draft"]');i++)await React.act(()=>new Promise(r=>setTimeout(r,20)));
 await React.act(async()=>{startEdit();await new Promise(r=>setTimeout(r,30));});
 // The editor tab owns the save action. Select it through the real tab interaction.
 await React.act(async()=>{[...document.querySelectorAll('[role="tab"]')].find(el=>el.textContent.includes('修改拟内容')).click();await new Promise(r=>setTimeout(r,30));});
 await React.act(async()=>{document.querySelector('[data-testid="pi-office-save-draft"]').click();await new Promise(r=>setTimeout(r,100));});
 result.busy=document.querySelector('[data-testid="shared-busy"]').textContent;
 assert.equal(revision,2);assert.equal(result.busy,'false','Completed host save must release shared busy even when refresh reparents its card');result.success=true;
}catch(error){result.error=String(error.stack||error);process.exitCode=1;}
finally{await React.act(()=>root.unmount());await server.close();dom.window.close();fs.writeFileSync(path.resolve(desktop,'../../acceptance/ui-ux-r1-20261124/evidence/office-save-'+(before?'before':'after')+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
