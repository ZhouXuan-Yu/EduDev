import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {build} from 'esbuild';
const output=await fs.mkdtemp(path.resolve('test-results/rerank-host-')),file=path.join(output,'host.cjs');
await build({entryPoints:['src/main/retrieval/vector-host.ts'],outfile:file,bundle:true,platform:'node',format:'cjs',external:['electron'],logLevel:'silent'});
const {VectorHost}=createRequire(import.meta.url)(file),host=new VectorHost(()=>output),checks=[];let sent=0,release;
host.start=()=>new Promise(r=>release=r);host.send=async()=>{sent++;return{scores:[],elapsedMs:0};};
const began=performance.now();await assert.rejects(host.rerank('query',[],30),/reranker_timeout/);assert(performance.now()-began<1000);release();await new Promise(r=>setImmediate(r));assert.equal(sent,0);checks.push('Host startup waiting is included in the caller deadline; late startup completion never dispatches a stale rerank');
host.start=async()=>{};host.send=async(op,body)=>{sent++;assert.equal(op,'rerank');assert(body.deadlineAt>Date.now()&&body.deadlineAt<=Date.now()+1000);return{scores:[],elapsedMs:0};};await host.rerank('query',[],1000);assert.equal(sent,1);checks.push('Host forwards an absolute deadline so IPC transit does not reset the remaining budget');
for(const value of [0,-1,15001,1.5,NaN])await assert.rejects(host.rerank('query',[],value),/invalid_input/);assert.equal(sent,1);checks.push('Malformed deadlines are rejected without touching the worker');
console.log(JSON.stringify({success:true,checks:checks.length,output,scope:'Bundled actual VectorHost methods with controlled startup/send; no Electron/native latency claim',names:checks}));
