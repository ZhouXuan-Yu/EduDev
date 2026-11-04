/** B03: real pinned packages over owned local HTTP, real workers, no provider. */
import '../office-agent/register-source.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {createManagedTools} from '../../src/main/managed-tools/service.ts';
import {JAVASCRIPT_COMPONENT as current,JAVASCRIPT_PREVIOUS as previous} from '../../src/main/managed-tools/manifest.ts';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'xiaozhi-foundation-b03-tools-')),checks=[],services=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={ok:false,root,checks,paidRequests:0,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scriptSha256:sha(await fs.readFile(import.meta.filename)),boundary:'Actual reviewed packages, installer and isolated QuickJS children over local HTTP; synthetic data only. Pi/file/typed-preload journey recorded separately.'};
let server,mode='good';const packages=new Map(),requests=[];
const check=(id,detail)=>{checks.push({id,detail});console.log('PASS '+detail);};
const until=async fn=>{const end=Date.now()+15000;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,15));}throw Error('Owned B03 queue deadline');};
const settled=p=>p.then(value=>({value}),error=>({error:String(error)}));
try{
 for(const recipe of [previous,current]){const response=await fetch(recipe.sourceUrl,{redirect:'error',signal:AbortSignal.timeout(30000)});assert(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,recipe.archiveBytes);assert.equal(sha(bytes),recipe.archiveSha256);packages.set(recipe.version,bytes);await fs.writeFile(path.join(root,recipe.version+'.tgz'),bytes);}
 server=http.createServer((req,res)=>{const version=req.url.slice(1),bytes=packages.get(version);assert(bytes);requests.push({version,mode});res.writeHead(200,{'content-type':'application/octet-stream','content-length':bytes.length});if(mode==='bad'){const bad=Buffer.from(bytes);bad[10]^=1;res.end(bad);}else if(mode==='cut'){res.write(bytes.subarray(0,512));setTimeout(()=>res.destroy(),30);}else res.end(bytes);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const create=name=>{const manager=createManagedTools({root:path.join(root,name),bundledWasm:null,fetch:async(url,init)=>{const recipe=[previous,current].find(r=>r.sourceUrl===url);assert(recipe);return fetch(base+'/'+recipe.version,init);}});services.push(manager);return manager;};
 const manager=create('versions');await manager.activate('javascript',previous.version);const pointer=path.join(root,'versions/javascript/active.json'),original=await fs.readFile(pointer),old=await manager.freeze();
 for(const failure of ['bad','cut']){mode=failure;await assert.rejects(()=>manager.upgrade('javascript'),failure==='bad'?/checksum_mismatch/:/network_error/);assert.deepEqual(await fs.readFile(pointer),original);assert.equal((await manager.view()).version,previous.version);const result=await manager.compute('return 6*7;',null);assert.equal(result.value,42);assert.equal(result.runtime,previous.version);assert(!(await fs.readdir(path.join(root,'versions'))).some(n=>n.startsWith('.prepare-')));}
 check('FAT-B03-02','Bad hash and interrupted actual HTTP preserve exact old pointer, callable healthy binary and no staging debris');
 mode='good';const concurrent=create('concurrent'),before=requests.length;const [a,b]=await Promise.all([concurrent.prepare('javascript'),concurrent.prepare('javascript')]);assert.equal(a,b);assert.equal(requests.length-before,1);assert.equal(sha(await fs.readFile(a)),current.sha256);assert.equal((await concurrent.compute('return 42;',null)).value,42);assert.equal(requests.length-before,1);
 check('FAT-B03-02','Two concurrent preparation requests install one pinned package once; actual health and later computation use verified binary');
 await manager.upgrade('javascript');const oldResult=await old.compute('return 30;',null),newResult=await manager.compute('return 30;',null);assert.equal(oldResult.runtime,previous.version);assert.equal(newResult.runtime,current.version);await assert.rejects(()=>manager.removeVersion('javascript',previous.version),/busy/);old.release();report.versions={oldResult,newResult};
 check('FAT-B03-04','Frozen run retains actual3.6.1 through upgrade; next computation uses3.6.2; old pin blocks removal');
 const runningAbort=new AbortController(),queuedAbort=new AbortController();const pendingA=settled(concurrent.compute('while(true){}',null,runningAbort.signal)),pendingB=settled(concurrent.compute('while(true){}',null,runningAbort.signal));
 await until(async()=>(await concurrent.view()).running===2);const pendingC=settled(concurrent.compute('return 7;',null,queuedAbort.signal)),pendingD=settled(concurrent.compute('return 30;',null));
 await until(async()=>(await concurrent.view()).queued===2);report.queueBefore=await concurrent.view();queuedAbort.abort();assert.match((await pendingC).error,/cancelled/);runningAbort.abort();const [ra,rb,rd]=await Promise.all([pendingA,pendingB,pendingD]);assert.match(ra.error,/cancelled/);assert.match(rb.error,/cancelled/);assert.equal(rd.value.value,30);const after=await until(async()=>{const v=await concurrent.view();return !v.running&&!v.queued&&!v.inUse?v:undefined;});report.queueAfter=after;
 assert.equal((await concurrent.compute('return 42;',null)).value,42);
 check('FAT-B03-04','Running and queued long calculations cancel, children/leases drain and next short computation succeeds');
 report.packages=[previous,current].map(({version,archiveSha256,sha256,license})=>({version,archiveSha256,wasmSha256:sha256,license}));report.httpRequests=requests;report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{await Promise.allSettled(services.map(s=>s.dispose()));if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,root,checks:checks.length,error:report.error}));}
