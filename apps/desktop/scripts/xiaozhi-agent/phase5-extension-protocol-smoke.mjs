import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-extension-protocol-'));
await build({stdin: {contents: `export {createExtensionRpc} from './src/main/xiaozhi-agent/extensions/rpc.ts';
export {boundedJson, validManifest, validView} from './src/main/xiaozhi-agent/extensions/validation.ts';`,
  resolveDir: process.cwd(), loader: 'ts'}, outfile: path.join(root, 'protocol.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node24'});
const {createExtensionRpc, boundedJson, validManifest, validView} = await import(pathToFileURL(path.join(root, 'protocol.mjs')).href);
const checks = [];
const report = {success: false, root, checks, paidCalls: 0};
function fixture(respond = true) {
  const listeners = new Set(); const errors = new Set(); const closes = new Set(); const sent = [];
  let closed = 0;
  const emit = message => {for(const listener of listeners) listener(message);};
  const transport = {onMessage(listener) {listeners.add(listener);return()=>listeners.delete(listener);},
    onError(listener) {errors.add(listener);return()=>errors.delete(listener);},onClose(listener) {closes.add(listener);return()=>closes.delete(listener);},
    async start() {},async send(message) {sent.push(message); if(respond && message.method?.startsWith('extensions/')) emit({jsonrpc:'2.0',id:message.id,result:{ok:true}});},
    async close() {closed++;for(const listener of closes)listener();}};
  const controller = new AbortController();
  const rpc = createExtensionRpc(transport, {signal:controller.signal,timeoutMs:100,assert:async()=>controller.signal.throwIfAborted()});
  return {rpc,emit,sent,controller,closed:()=>closed};
}
async function check(name,action) {await action();checks.push({name,pass:true});console.log('PASS '+name);}
try {
  await check('Bounded JSON rejects cycles, deep nesting, nonfinite numbers and prototype-control keys',async()=>{
    const cyclic={};cyclic.self=cyclic;assert.equal(boundedJson(cyclic),false);assert.equal(boundedJson(Infinity),false);
    assert.equal(boundedJson(JSON.parse('{"__proto__":1}')),false);let deep={};for(let i=0;i<20;i++)deep={deep};assert.equal(boundedJson(deep),false);
    assert.equal(boundedJson({text:'合成🙂',rows:[1,true,null]}),true);
  });
  await check('Manifest rejects unknown hooks, credentials, fragments and extra fields',async()=>{
    const manifest={schemaVersion:1,extensionId:'owned.extension',version:'1.0.0',source:'https://example.invalid/repository',sourceHash:'a'.repeat(64),
      license:'Apache-2.0 AND MIT',licenseHash:'b'.repeat(64),artifactId:'c'.repeat(64),hooks:['context.transform']};
    assert.equal(validManifest(manifest),true);for(const change of [{hooks:['tool.register']},{source:'https://user:secret@example.invalid'},
      {source:'https://example.invalid/#fragment'},{secretValue:'synthetic'}]) assert.equal(validManifest({...manifest,...change}),false);
    assert.equal(validView({schemaVersion:1,extensionId:'owned.extension',revision:0,enabled:true,activeVersion:null,versions:[]}),false);
  });
  await check('Request IDs are unique and normal completion does not close a healthy session',async()=>{
    const f=fixture();await f.rpc.start();assert.deepEqual(await f.rpc.request('extensions/health',{schemaVersion:1}),{ok:true});
    await f.rpc.request('extensions/hook',{schemaVersion:1});assert.notEqual(f.sent[0].id,f.sent[1].id);assert.equal(f.closed(),0);await f.rpc.close();assert.equal(f.closed(),1);
  });
  await check('Concurrent admission remains bounded after asynchronous authority checks',async()=>{
    const f=fixture(false);await f.rpc.start();const pending=Array.from({length:8},()=>f.rpc.request('extensions/hook',{schemaVersion:1}));
    const observed=Promise.allSettled(pending);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.sent.length,4);await f.rpc.close();
    const result=await observed;assert.equal(result.filter(row=>row.status==='rejected'&&/extension_busy/.test(row.reason.message)).length,4);
  });
  await check('Caller rate limit rejects excess requests while preserving existing session',async()=>{
    const f=fixture();await f.rpc.start();for(let i=0;i<32;i++)await f.rpc.request('extensions/health',{schemaVersion:1});
    await assert.rejects(f.rpc.request('extensions/health',{schemaVersion:1}),/extension_rate_limit/);assert.equal(f.closed(),0);await f.rpc.close();
  });
  for(const [name,message] of [
    ['unexpected response ID',{jsonrpc:'2.0',id:'unknown',result:{}}],
    ['extra response fields',{jsonrpc:'2.0',id:'pending',result:{},extra:true}],
    ['mixed result and error',{jsonrpc:'2.0',id:'pending',result:{},error:{code:-1,message:'synthetic'}}],
    ['invalid error schema',{jsonrpc:'2.0',id:'pending',error:{code:'wrong',message:'synthetic'}}],
    ['unsupported notification',{jsonrpc:'2.0',method:'host.ipc',params:{}}],
    ['unbounded log text',{jsonrpc:'2.0',method:'extensions/log',params:{schemaVersion:1,level:'info',code:'synthetic-secret'}}],
    ['oversize response',{jsonrpc:'2.0',id:'pending',result:'x'.repeat(70000)}],
  ]) await check('Fail closed on '+name,async()=>{
    const f=fixture(false);await f.rpc.start();const pending=f.rpc.request('extensions/health',{schemaVersion:1});const rejection=assert.rejects(pending,/extension_/);
    await new Promise(resolve=>setImmediate(resolve));const value={...message};if(value.id==='pending')value.id=f.sent[0].id;f.emit(value);await rejection;await f.rpc.close();assert.equal(f.closed(),1);
  });
  await check('Guest error data is reduced to a fixed main-owned code',async()=>{
    const f=fixture(false);await f.rpc.start();const pending=f.rpc.request('extensions/health',{schemaVersion:1});const rejection=assert.rejects(pending,/^Error: extension_guest_error$/);
    await new Promise(resolve=>setImmediate(resolve));f.emit({jsonrpc:'2.0',id:f.sent[0].id,error:{code:-1,message:'synthetic-private-error'}});await rejection;await f.rpc.close();
  });
  await check('Unsupported host request gets fixed unsupported result and cannot invoke main code',async()=>{
    const f=fixture();await f.rpc.start();f.emit({jsonrpc:'2.0',id:'guest_1',method:'host.process.exec',params:{command:'synthetic'}});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(f.sent[0].error.message,'unsupported_host_method');assert.equal(f.closed(),0);await f.rpc.close();
  });
  await check('Logs retain a bounded ring and contain fixed codes only',async()=>{
    const f=fixture();await f.rpc.start();for(let i=0;i<64;i++)f.emit({jsonrpc:'2.0',method:'extensions/log',params:{schemaVersion:1,level:'info',code:'started'}});
    assert.equal(f.rpc.logs().length,64);const copy=f.rpc.logs();copy[0].code='mutated';assert.equal(f.rpc.logs()[0].code,'started');await f.rpc.close();
  });
  await check('Pre-aborted request returns stable cancellation and closes the guest session',async()=>{
    const f=fixture();await f.rpc.start();const cancel=new AbortController();cancel.abort('synthetic-private-reason');
    await assert.rejects(f.rpc.request('extensions/health',{schemaVersion:1},cancel.signal),/^Error: extension_cancelled$/);assert.equal(f.closed(),1);
  });
  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:checks.length,root}));}
