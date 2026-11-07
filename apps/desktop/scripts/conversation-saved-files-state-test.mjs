/** Controlled read transport, actual production hook and React lifecycle. */
import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost'});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','getComputedStyle','MutationObserver'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client'),{act}=React;
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:{port:0}}});
const reads=[],checks=[];let current;
window.omniEdu={listDocumentArtifacts:()=>new Promise((resolve,reject)=>reads.push({resolve,reject}))};
const root=createRoot(document.getElementById('root'));
try{
  const {useConversationSavedFiles}=await server.ssrLoadModule('/src/renderer/components/office/ConversationSavedFiles.tsx');
  function Harness({session,revision}){current=useConversationSavedFiles(session,revision);return null;}
  const render=(session,revision='1')=>act(async()=>root.render(React.createElement(Harness,{session,revision})));
  const saved=(id,sessionId,extra={})=>({id,sessionId,status:'exported',fileName:id+'.pdf',type:'pdf',...extra});
  await render('A');assert.equal(reads.length,1);assert.equal(current.loading,true);checks.push('ACTUAL_HOOK_USES_READ_ONLY_CATALOGUE');
  await render('B');assert.deepEqual(current.rows,[]);assert.equal(current.sessionId,'B');
  await act(async()=>reads[0].resolve([saved('old-A','A')]));assert.deepEqual(current.rows,[]);checks.push('LATE_OTHER_SESSION_CANNOT_POPULATE_NEW_SESSION');
  await act(async()=>reads[1].resolve([saved('current','B'),saved('foreign','A'),saved('failed','B',{status:'failed'}),saved('old-version','B',{officeVersion:{currentArtifactId:'new-version'}})]));
  assert.deepEqual(current.rows.map(r=>r.id),['current']);checks.push('ONLY_SAME_SESSION_SAVED_CURRENT_VERSIONS_VISIBLE');
  const boundRow=current.rows[0];await render('B','2');assert.equal(current.rows[0],boundRow);assert.equal(current.loading,true);checks.push('REFRESH_RETAINS_OPEN_READER_BINDING_WHILE_WAITING');
  await act(async()=>reads[2].reject(Error('controlled catalogue outage')));assert.equal(current.rows[0],boundRow);assert(current.error);checks.push('READ_FAILURE_RETAINS_BINDING_AND_SHOWS_ERROR');
  await act(async()=>current.refresh());assert.equal(reads.length,4);await render('B','3');assert.equal(reads.length,5);
  await act(async()=>reads[4].resolve([saved('newest','B')]));await act(async()=>reads[3].resolve([saved('late','B')]));
  assert.deepEqual(current.rows.map(r=>r.id),['newest']);checks.push('OLDER_SAME_SESSION_REFRESH_CANNOT_REPLACE_NEWER_RECEIPT');
  await render('C');assert.deepEqual(current.rows,[]);await act(async()=>root.unmount());await act(async()=>reads[5].resolve([saved('late-C','C')]));checks.push('UNMOUNT_INVALIDATES_PENDING_READ');
  console.log(JSON.stringify({success:true,checks,scope:'Actual hook/React lifecycle with controlled read responses; no Electron or filesystem claim'}));
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
