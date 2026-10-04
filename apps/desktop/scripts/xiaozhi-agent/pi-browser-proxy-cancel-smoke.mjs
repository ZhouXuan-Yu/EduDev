import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire,syncBuiltinESMExports} from 'node:module';
const dns=createRequire(import.meta.url)('node:dns/promises'),original=dns.lookup,pending=[];
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-browser-proxy-cancel-')),checks=[];
const until=async(fn)=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Owned proxy condition timed out');};
const check=name=>{checks.push({name,pass:true});console.log('PASS '+name);};
let proxy,success=false,error;
try{
 // Own-process builtin DNS mock; no OS DNS, proxy, endpoint or production seam changed.
 dns.lookup=(host,options)=>host==='www.example.com'?new Promise((_resolve,reject)=>pending.push(reject)):original(host,options);syncBuiltinESMExports();
 const {createPublicBrowserProxy}=await import('../../src/main/xiaozhi-agent/browser-proxy.ts');proxy=await createPublicBrowserProxy('system');
 const request=()=>new Promise(resolve=>{const req=http.get({hostname:'127.0.0.1',port:proxy.port,path:'http://www.example.com/',headers:{'Proxy-Authorization':'Basic '+Buffer.from(proxy.username+':'+proxy.password).toString('base64')}},res=>{res.resume();resolve({status:res.statusCode});});req.on('error',error=>resolve({error:error.code}));req.setTimeout(3000,()=>req.destroy());});
 const old=request();await until(()=>pending.length===1);proxy.stopConnections();assert((await old).error);check('Actual waiting proxy TCP request closes on stop');
 const current=request();await until(()=>pending.length===2);pending[1](new Error('dns_blocked'));assert.equal((await current).status,403);assert.equal(proxy.failureFor('http://www.example.com/'),'dns_blocked');check('Current DNS denial keeps precise owned proxy failure');
 pending[0](new Error('network'));await new Promise(r=>setTimeout(r,30));assert.equal(proxy.failureFor('http://www.example.com/'),'dns_blocked');check('Late cancelled lookup cannot overwrite newer failure or connect');
 assert(proxy.setDnsMode('auto'));assert.equal(proxy.failureFor('http://www.example.com/'),undefined);assert.equal(proxy.setDnsMode('auto'),false);check('New mode clears stale failure and repeated mode stays stable');
 success=true;
}catch(caught){error=String(caught.stack);process.exitCode=1;}finally{dns.lookup=original;syncBuiltinESMExports();await proxy?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({success,checks,error,boundary:'Real owned ephemeral HTTP proxy/TCP with own-process mocked waiting DNS; no third-party transport or OS changes'},null,2));console.log(JSON.stringify({success,checks:checks.length,error,output}));}
