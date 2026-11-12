import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
const {createWordOfficeComponent,runWordOfficeProcess,verifyWordOfficeTree,WORD_OFFICE_COMPONENT}=await import('../../src/main/assets/word-office-component.ts');
const root=await fs.mkdtemp(path.join(tmpdir(),'xiaozhi-office-component-test-'));
const signal=new AbortController().signal;
const checks=[];
async function check(name,action){await action();checks.push(name);console.log('PASS '+name);}
const unavailable=async()=>{throw Error('unavailable');};
await check('Cancelled preparation creates no installation and makes no request',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(createWordOfficeComponent({root:path.join(root,'cancel'),fetch:async()=>{calls++;throw Error('unexpected');}}).ensure(controller.signal));
 assert.equal(calls,0);
});
await check('Network failure releases installation ownership and can be retried',async()=>{
 const folder=path.join(root,'network'),states=[];
 const component=createWordOfficeComponent({root:folder,fetch:unavailable,onProgress:state=>states.push(state.phase)});
 await assert.rejects(component.ensure(signal),/unavailable/);await assert.rejects(component.ensure(signal),/unavailable/);
 assert.equal(states.filter(phase=>phase==='failed').length,2);assert(!(await fs.readdir(folder)).some(name=>name.endsWith('.lock')||name.startsWith('.office-')));
});
await check('Short downloads cannot activate or poison a subsequent retry',async()=>{
 const folder=path.join(root,'short'),states=[];
 const component=createWordOfficeComponent({root:folder,fetch:async()=>new Response(new Uint8Array([1,2,3])),onProgress:state=>states.push(state)});
 await assert.rejects(component.ensure(signal),/configuration/);
 assert.equal(states.at(-1).phase,'failed');assert.equal((await fs.readdir(path.join(folder,'downloads'))).length,0);
 await assert.rejects(createWordOfficeComponent({root:folder,fetch:unavailable}).ensure(signal),/unavailable/);
});
await check('Live owners stay protected while a dead owner is recovered under the app single-instance lock',async()=>{
 const folder=path.join(root,'lock');await fs.mkdir(folder);
 const lock=path.join(folder,WORD_OFFICE_COMPONENT.id+'.lock'),live=JSON.stringify({pid:process.pid,nonce:'original'});
 await fs.writeFile(lock,live);const component=createWordOfficeComponent({root:folder,fetch:unavailable});
 await assert.rejects(component.ensure(signal),/busy/);assert.equal(await fs.readFile(lock,'utf8'),live);
 await fs.writeFile(lock,JSON.stringify({pid:2147483647,nonce:'dead'}));
 await assert.rejects(component.ensure(signal),/unavailable/);await assert.rejects(fs.stat(lock),error=>error.code==='ENOENT');
});
await check('A damaged installed tree stays available for diagnosis when repair cannot download',async()=>{
 const folder=path.join(root,'damaged'),target=path.join(folder,WORD_OFFICE_COMPONENT.id+'-'+WORD_OFFICE_COMPONENT.version);
 await fs.mkdir(target,{recursive:true});await fs.writeFile(path.join(target,'evidence'),'original damaged component');
 await assert.rejects(createWordOfficeComponent({root:folder,fetch:unavailable}).ensure(signal),/unavailable/);
 assert.equal(await fs.readFile(path.join(target,'evidence'),'utf8'),'original damaged component');
});
for(const mode of ['cancel','timeout'])await check('Owned process '+mode+' waits for both child and grandchild termination',async()=>{
 const marker=path.join(root,mode+'.json'),controller=new AbortController();
 const code=`const fs=require('node:fs'),{spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'}); fs.writeFileSync(process.argv[1],JSON.stringify({pid:process.pid,child:child.pid})); setInterval(()=>{},1000);`;
 const work=runWordOfficeProcess(process.execPath,['-e',code,marker],{cwd:root,signal:controller.signal,timeout:mode==='timeout'?5000:20000}).then(()=>({message:'unexpected'}),error=>error);
 const deadline=Date.now()+15000;let ids;
 while(Date.now()<deadline){try{ids=JSON.parse(await fs.readFile(marker,'utf8'));break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}
 assert(ids,'Fixture process did not start');if(mode==='cancel')controller.abort();
 assert.equal((await work).message,mode==='cancel'?'cancelled':'timeout');
 for(const pid of Object.values(ids))assert.throws(()=>process.kill(pid,0),error=>error.code==='ESRCH');
});
if(process.argv[2]==='--runtime')await check('Actual pinned LibreOffice tree matches all original files and bytes',async()=>{
 const started=performance.now(),program=await verifyWordOfficeTree(path.resolve(process.argv[3]),signal);
 console.log(JSON.stringify({program,files:WORD_OFFICE_COMPONENT.files,bytes:WORD_OFFICE_COMPONENT.installedBytes,ms:performance.now()-started}));
});
console.log(JSON.stringify({passed:checks.length,checks,temporaryRoot:root,scope:'real filesystem/Windows process boundaries, controlled download errors; complete installation is separate'}));
