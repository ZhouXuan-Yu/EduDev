import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import path from 'node:path';

const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','Event','MouseEvent','SVGElement','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const server=await createServer({configFile:false,root:path.resolve(import.meta.dirname,'..'),appType:'custom',optimizeDeps:{noDiscovery:true},css:{postcss:{plugins:[]}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
const root=createRoot(document.getElementById('root'));
const act=fn=>React.act(async()=>{await fn();});
let initialized=0,disposed=0;
function Draft(){React.useEffect(()=>{initialized++;return()=>{disposed++;};},[]);return React.createElement('input',{'data-testid':'protected-draft',defaultValue:'未保存内容'});}
try{
 const {MaterialLibraryLayout}=await server.ssrLoadModule('/src/renderer/components/product/material-library-ui/MaterialLibraryLayout.tsx');
 const {MaterialLibraryDisclosure}=await server.ssrLoadModule('/src/renderer/components/product/material-library-ui/MaterialLibraryActivity.tsx');
 await act(()=>root.render(React.createElement(MaterialLibraryLayout,{actions:null,navigation:null,mode:'catalog',modeDisabled:false,changeMode:()=>{},queueSummary:'处理队列',controls:null,feedback:null,activity:React.createElement(MaterialLibraryDisclosure,{title:'恢复',testId:'nested'},React.createElement(Draft))})));
 assert.equal(initialized,0);assert.equal(document.querySelector('[data-testid=nested]'),null);
 await act(()=>document.querySelector('[data-testid=materials-queue-toggle]').click());
 assert(document.querySelector('[data-testid=nested]'));assert.equal(initialized,0);
 await act(()=>document.querySelector('[data-testid=nested] button').click());
 assert.equal(initialized,1);assert.equal(disposed,0);
 const draft=document.querySelector('[data-testid=protected-draft]');draft.value='教师继续填写的草稿';
 for(let i=0;i<4;i++)await act(()=>document.querySelector('[data-testid=nested] button').click());
 for(let i=0;i<4;i++)await act(()=>document.querySelector('[data-testid=materials-queue-toggle]').click());
 assert.equal(document.querySelector('[data-testid=protected-draft]'),draft);
 assert.equal(draft.value,'教师继续填写的草稿');assert.equal(initialized,1);assert.equal(disposed,0);
 console.log(JSON.stringify({success:true,checks:['unopened activity has no initialized subtree','nested diagnostics wait for first open','first open initializes exactly once','repeated folding preserves exact input node and draft','no effect disposal on folding'],layer:'Mounted production React components; not IPC or provider acceptance'}));
}finally{await act(()=>root.unmount());await server.close();dom.window.close();}
