import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {registerAcquisitionIpc} from './src/main/xiaozhi-agent/capabilities/acquisition/api';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {registerAcquisitionIpc}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const handlers=new Map(),event={},sessionId='aisession_12345678-1234-1234-1234-123456789012';
let allowed=true,effects=0,release,started;
const choose=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve);
registerAcquisitionIpc({ipcMain:{handle:(channel,handler)=>handlers.set(channel,handler)},allowed:sender=>sender===event&&allowed,
 view:async()=>({}),search:async()=>({}),mutate:async()=>({}),
 importExtension:async(_id,isCurrent)=>{
  started();await choose;
  if(isCurrent&&!isCurrent())throw Error('permission_denied');
  effects++;return {candidates:[],operations:[],artifacts:[],schemaVersion:'xiaozhi.acquisition.v1'};
 }});
const pending=handlers.get('xiaozhi:acquisition-mutate')(event,{action:'extension_import',sessionId});
await entered;allowed=false;release();const reply=await pending;
console.log(JSON.stringify({reply,effects,boundary:'Actual acquisition IPC adapter with an injected chooser/effect port; no domain engine or production authorization is replaced.'}));
assert.equal(reply.ok,false,'Revoked chooser request must not be accepted');assert.equal(reply.error,'permission_denied');assert.equal(effects,0);
console.log(JSON.stringify({passed:1,revokedImportEffects:effects}));
