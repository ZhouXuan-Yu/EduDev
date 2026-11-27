import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs';
import ts from 'typescript';
const bundled=await build({stdin:{contents:`export {createSettingsIpcBridge} from './src/main/settings-window/ipc-bridge';export {SETTINGS_API_PREFIX,SETTINGS_ROUTES} from './src/shared/settings-window';export {createDesktopIpcLifetime} from './src/main/desktop-ipc-lifetime';export {BackupPublicationBarrier} from './src/main/backup/publication-barrier';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {createSettingsIpcBridge,SETTINGS_API_PREFIX,SETTINGS_ROUTES,createDesktopIpcLifetime,BackupPublicationBarrier}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const checks=[];
async function test(name,fn){try{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){checks.push({name,status:'FAIL',error:String(error)});console.error('FAIL '+name+' '+error);}}
function setup(){
 const handlers=new Map(),main={sender:{}},child={sender:{}},other={sender:{}},barrier=new BackupPublicationBarrier();
 const ipc={handle:(channel,fn)=>{assert(!handlers.has(channel),'duplicate '+channel);handlers.set(channel,fn);}};
 const lifetime=createDesktopIpcLifetime(ipc,barrier);
 let scope={schemaVersion:'settings.scope.v1',epoch:1,sessionId:'a',revision:'r1'},alive=true,changes=0;
 const trusted=event=>event===child&&alive;
 const bridge=createSettingsIpcBridge({ipc:lifetime.ipcMain,trusted,trustedMain:event=>event===main,scope:()=>scope,assertScope:async(event,request,id)=>{
  if(!trusted(event))throw Error('permission_denied');
  if(JSON.stringify(scope)!==JSON.stringify(request)||(id!==undefined&&id!==scope.sessionId))throw Error('scope_changed');
 },canReadArchive:async id=>id==='archived',changed:()=>changes++});
 bridge.track(child.sender);
 return {handlers,main,child,other,bridge,lifetime,barrier,changes:()=>changes,scope:()=>scope,revoke:()=>alive=false,switch:()=>scope={...scope,epoch:2,sessionId:'b',revision:'r2'},
  request:args=>({schemaVersion:'settings.request.v1',scope:{...scope},args}),call:(method,event,input)=>handlers.get(SETTINGS_API_PREFIX+SETTINGS_ROUTES[method].channel)(event,input)};
}
await test('allowlist channels and forwarded argument counts match the current typed production preload',async()=>{
 const source=ts.createSourceFile('preload.ts',fs.readFileSync('src/preload/index.ts','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const definitions=new Map();
 function visit(node){
  if(ts.isPropertyAssignment(node)&&ts.isIdentifier(node.name)&&ts.isArrowFunction(node.initializer)){
   let body=node.initializer.body;while(ts.isAsExpression(body)||ts.isParenthesizedExpression(body))body=body.expression;
   if(ts.isCallExpression(body)&&ts.isPropertyAccessExpression(body.expression)&&body.expression.name.text==='invoke'&&ts.isStringLiteral(body.arguments[0]))definitions.set(node.name.text,{channel:body.arguments[0].text,args:body.arguments.length-1});
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
 for(const [method,route] of Object.entries(SETTINGS_ROUTES)){
  const original=definitions.get(method);assert(original,'missing original '+method);assert.equal(route.channel,original.channel,method);assert(original.args>=route.arity[0]&&original.args<=route.arity[1],method+' arity');
 }
});
await test('only reviewed fixed endpoints exist; no terminal, file or agent launch endpoint',async()=>{
 const t=setup();t.bridge.register();assert.equal(t.handlers.size,Object.keys(SETTINGS_ROUTES).length);
 assert(!Object.keys(SETTINGS_ROUTES).some(key=>/terminal|exec|readfile|writefile|startxiaozhi|stopxiaozhi/i.test(key)));
 assert.equal(new Set(Object.values(SETTINGS_ROUTES).map(route=>route.channel)).size,Object.keys(SETTINGS_ROUTES).length);
});
await test('trusted settings delegates to original schema and main authorization remains unchanged',async()=>{
 const t=setup();let count=0;t.bridge.ipcMain.handle('xiaozhi:permission-mode',(event,input)=>{
  if(event!==t.main&&!t.bridge.allows(event))throw Error('permission_denied');
  if(input.mode!=='ask')throw Error('domain_schema_rejected');count++;return {ok:true};
 });t.bridge.register();
 await t.handlers.get('xiaozhi:permission-mode')(t.main,{mode:'ask'});
 await t.call('setXiaozhiPermissionMode',t.child,t.request([{sessionId:'a',mode:'ask'}]));
 await assert.rejects(t.call('setXiaozhiPermissionMode',t.child,t.request([{sessionId:'a',mode:'invented'}])),/domain_schema_rejected/);
 assert.equal(count,2);assert.equal(t.changes(),1);assert.equal(t.bridge.allows(t.child),false);
});
await test('direct original channels are denied even when their legacy handler has no guard',async()=>{
 const t=setup();t.bridge.ipcMain.handle('app:getDataRoot',()=>'/private');t.bridge.register();
 await assert.rejects(t.handlers.get('app:getDataRoot')(t.child),/permission_denied/);
 await assert.rejects(t.handlers.get('app:getDataRoot')(t.other),/permission_denied/);
 assert.equal(await t.handlers.get('app:getDataRoot')(t.main),'/private');
});
await test('untrusted sender, revoked frame and forged scope cannot reach the domain service',async()=>{
 const t=setup();let calls=0;t.bridge.ipcMain.handle('app:getDataRoot',()=>++calls);t.bridge.register();
 await assert.rejects(t.call('getDataRoot',t.other,t.request([])),/permission_denied/);
 for(const patch of [{epoch:0},{sessionId:'forged'},{revision:'old'}]){
  const request=t.request([]);Object.assign(request.scope,patch);await assert.rejects(t.call('getDataRoot',t.child,request),/scope_changed/);
 }
 t.revoke();await assert.rejects(t.call('getDataRoot',t.child,t.request([])),/permission_denied/);assert.equal(calls,0);
});
await test('envelope version, extra keys, arity and cross-session input are rejected',async()=>{
 const t=setup();t.bridge.ipcMain.handle('xiaozhi:permission-view',()=>({}));t.bridge.register();
 for(const bad of [{...t.request(['a']),schemaVersion:'old'},{...t.request(['a']),channel:'terminal:exec'},t.request([]),t.request(['a','b'])])await assert.rejects(t.call('getXiaozhiPermissions',t.child,bad),/invalid_input/);
 await assert.rejects(t.call('getXiaozhiPermissions',t.child,t.request(['b'])),/scope_changed/);
});
await test('optional session selectors reject falsy non-string values',async()=>{
 const t=setup();t.bridge.ipcMain.handle('xiaozhi:acquisition',()=>({ok:true}));t.bridge.register();
 for(const bad of [0,false,null])await assert.rejects(t.call('getXiaozhiAcquisition',t.child,t.request([bad])),/invalid_input/);
});
await test('global MCP inputs match the real host contract without fabricated session fields',async()=>{
 const t=setup();let received;t.bridge.ipcMain.handle('xiaozhi:mcp-add',(_event,input)=>{received=input;return {ok:true};});t.bridge.register();
 const input={name:'test',transport:'http',url:'https://example.test/mcp'};
 await t.call('addXiaozhiMcp',t.child,t.request([input]));assert.deepEqual(received,input);
});
await test('archived snapshot exception is read-only and requires host archive eligibility',async()=>{
 const t=setup();t.bridge.ipcMain.handle('xiaozhi:snapshot',(_event,id)=>id);t.bridge.register();
 assert.equal(await t.call('getXiaozhiSnapshot',t.child,t.request(['archived'])),'archived');
 await assert.rejects(t.call('getXiaozhiSnapshot',t.child,t.request(['other-live'])),/permission_denied/);
});
await test('scope switch suppresses late results; failed domain writes do not broadcast success',async()=>{
 const t=setup();let finish;t.bridge.ipcMain.handle('xiaozhi:web-settings',()=>new Promise(resolve=>finish=resolve));t.bridge.register();
 const pending=t.call('saveXiaozhiWebSettings',t.child,t.request([{}]));await new Promise(resolve=>setImmediate(resolve));t.switch();finish({ok:true});await assert.rejects(pending,/scope_changed/);assert.equal(t.changes(),0);
 const u=setup();u.bridge.ipcMain.handle('xiaozhi:web-settings',()=>({ok:false,error:'conflict'}));u.bridge.register();await u.call('saveXiaozhiWebSettings',u.child,u.request([{}]));assert.equal(u.changes(),0);
});
await test('prefixed backup export keeps original snapshot classification and does not deadlock itself',async()=>{
 const t=setup();t.bridge.ipcMain.handle('app:exportDataRoot',()=>t.barrier.snapshot(async()=>({ok:true}),AbortSignal.timeout(120)));t.bridge.register();
 assert.deepEqual(await t.call('exportDataRoot',t.child,t.request([])),{ok:true});await t.lifetime.close();
});
await test('ordinary settings writes remain blocked during a backup and drain before shutdown',async()=>{
 const t=setup();let release;t.bridge.ipcMain.handle('xiaozhi:web-settings',()=>({ok:true}));t.bridge.register();
 const snapshot=t.barrier.snapshot(()=>new Promise(resolve=>release=resolve));await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(t.call('saveXiaozhiWebSettings',t.child,t.request([{}])),/backup_busy/);release();await snapshot;await t.lifetime.close();
 assert.throws(()=>t.call('saveXiaozhiWebSettings',t.child,t.request([{}])),/application_closing/);
});
console.log(JSON.stringify({passed:checks.filter(x=>x.status==='PASS').length,failed:checks.filter(x=>x.status==='FAIL').length,checks,boundary:'Real bridge and publication-barrier contracts. Production-window end-to-end checks remain required.'}));
if(checks.some(x=>x.status==='FAIL'))process.exitCode=1;
