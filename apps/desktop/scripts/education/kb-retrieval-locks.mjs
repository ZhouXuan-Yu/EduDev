import '../office-agent/register-source.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const {acquireWriterLock}=await import('../../src/main/retrieval/writer-lock.ts');
if(process.argv[2]==='--child'){
 try{const owner=await acquireWriterLock(process.argv[3]);console.log(JSON.stringify({ready:true,pid:process.pid}));process.stdin.resume();process.stdin.on('data',()=>{if(owner.fd<0)process.exit(2);});}catch(e){console.log(JSON.stringify({ready:false,code:e.message}));process.exit(0);}
}else{
 const root=await fs.mkdtemp(path.join(tmpdir(),'omni-edu-os-index-lock-')),script=fileURLToPath(import.meta.url),children=[];
 const start=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script,'--child',root],{windowsHide:true,stdio:['pipe','pipe','pipe']});children.push(child);let buffer='';child.stderr.on('data',()=>{});child.on('error',reject);child.stdout.on('data',b=>{buffer+=b;const i=buffer.indexOf('\n');if(i>=0){const value=JSON.parse(buffer.slice(0,i));resolve({child,value});}});});
 const stop=child=>new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null){resolve();return;}child.once('exit',resolve);child.kill();});
 try{const first=await Promise.all([start(),start()]);assert.equal(first.filter(r=>r.value.ready).length,1);const owner=first.find(r=>r.value.ready);await assert.rejects(fs.unlink(path.join(root,'.writer.lock')),e=>['EACCES','EPERM','EBUSY'].includes(e.code));await stop(owner.child);assert((await fs.stat(path.join(root,'.writer.lock'))).isFile());const reclaim=await Promise.all([start(),start()]);assert.equal(reclaim.filter(r=>r.value.ready).length,1);console.log(JSON.stringify({success:true,checks:3,root,uv:process.versions.uv,scope:'Actual concurrent Windows child processes: one owner, live lock cannot be unlinked, persisted file reacquired exclusively after force-killed owner exits'}));}
 finally{await Promise.all(children.map(stop));}
}
