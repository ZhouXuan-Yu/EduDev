import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {registerSkillManagementIpc} from './src/main/xiaozhi-agent/skill-management-api';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {registerSkillManagementIpc}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const handlers=new Map(),event={};let allowed=true,effects=0,release,started;
const choosing=new Promise(resolve=>started=resolve),picked=new Promise(resolve=>release=resolve);
registerSkillManagementIpc({ipcMain:{handle:(channel,handler)=>handlers.set(channel,handler)},allowed:sender=>sender===event&&allowed,
 choose:async()=>{started();await picked;return 'owned-synthetic-skill';},host:{skillManagementBusy:()=>false,skillCatalog:async()=>({revision:1,skills:[]}),
  importSkill:async(_revision,choose)=>{await choose();effects++;return {revision:2,skills:[]};}}});
const pending=handlers.get('xiaozhi:skill-mutate')(event,{action:'import',revision:1});
await choosing;allowed=false;release();const reply=await pending;
console.log(JSON.stringify({reply,effects,boundary:'Actual skill IPC adapter with controlled chooser/effect ports; no filesystem import or authorization override.'}));
assert.equal(reply.ok,false);assert.equal(reply.error,'permission_denied');assert.equal(effects,0);
console.log(JSON.stringify({passed:1,revokedImportEffects:effects}));
