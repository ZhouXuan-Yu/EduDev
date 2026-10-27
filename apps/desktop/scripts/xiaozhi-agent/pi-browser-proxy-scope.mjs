import '../office-agent/register-source.mjs';import assert from 'node:assert/strict';import http from 'node:http';import {createRequire,syncBuiltinESMExports} from 'node:module';
const dns=createRequire(import.meta.url)('node:dns/promises'),original=dns.lookup;let lookups=0,proxy;
try{
 dns.lookup=async()=>{lookups++;throw Error('DNS must not run for an unapproved origin');};syncBuiltinESMExports();
 const {createPublicBrowserProxy}=await import('../../src/main/xiaozhi-agent/browser-proxy.ts');proxy=await createPublicBrowserProxy('system',url=>new URL(url).origin==='https://approved.invalid');
 const request=method=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:proxy.port,method,path:method==='CONNECT'?'unapproved.invalid:443':'http://unapproved.invalid/send?q=question',headers:{'Proxy-Authorization':'Basic '+Buffer.from(proxy.username+':'+proxy.password).toString('base64')}},res=>{res.resume();resolve(res.statusCode);});req.on('connect',res=>resolve(res.statusCode));req.on('error',reject);req.setTimeout(3000,()=>req.destroy(Error('timeout')));req.end();});
 assert.equal(await request('GET'),403);assert.equal(lookups,0);assert.equal(await request('CONNECT'),403);assert.equal(lookups,0);console.log(JSON.stringify({passed:2,scope:'Real authenticated local proxy HTTP/CONNECT denied before process-mocked DNS; no remote request or OS changes'}));
}finally{dns.lookup=original;syncBuiltinESMExports();await proxy?.close();}
