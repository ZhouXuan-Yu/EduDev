import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {_electron as electron} from 'playwright';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/browser-control-'));
const module=path.join(output,'host.mjs');
await build({entryPoints:['src/main/xiaozhi-agent/browser-host.ts'],outfile:module,bundle:true,platform:'node',target:'node24',format:'esm',packages:'external'});
const bootstrap=path.join(output,'boot.cjs');
fs.writeFileSync(bootstrap,"globalThis.loadBrowserHost=()=>import("+JSON.stringify(pathToFileURL(module).href)+");require('electron').app.whenReady();");
const env={...process.env};
delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;
const url='https://fixture.invalid';
const statusFile=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','renderer/browser-status.html');
const rounds=[];
for(const phase of ['save','reuse','offlineClear','cleared']){
  const app=await electron.launch({args:[bootstrap,'--user-data-dir='+path.join(output,'profile')],env});
  try{
    rounds.push(await app.evaluate(async (_electron,{phase,root,statusFile,url})=>{
      const {createXiaozhiBrowserHost}=await globalThis.loadBrowserHost();
      let guest;
      const host=createXiaozhiBrowserHost({root,statusFile,sanitize:async t=>t,afterTabCreated:async (wc,session)=>{
        guest=wc;
        await session.protocol.handle('https',()=>phase==='offlineClear'?Response.error():new Response('<title>教学筛选</title><button onclick="setTimeout(()=>document.querySelector(\'p\').textContent=String(++window.n),100)">筛选</button><p></p><script>window.n=0</script>',{headers:{'content-type':'text/html;charset=utf-8'}}));
      }});
      const id='aisession_'+crypto.randomUUID();
      const ctx={signal:new AbortController().signal,dnsMode:'auto',current:()=>true,confirm:async()=>true};
      const call=input=>host.execute(id,input,ctx);
      try{
        if(phase==='offlineClear'){
          let failed=false;
          try{await call({action:'navigate',url});}catch{failed=true;}
          if(!failed)throw Error('Expected an offline page');
          await host.teacher(id,'teacher');
          const status=await host.status(id);
          if(status.siteOrigin!==url||status.remembered||status.tabs.length)throw Error('Missing offline login control');
          await host.teacher(id,'forget');return {phase,saved:null};
        }
        let receipt=await call({action:'navigate',url});
        const times={separate:[],combined:[]};
        if(phase==='save'){
          for(let index=0;index<40;index++){
            const ref=Number(receipt.text.match(/\[(\d+)\][^\n]*筛选/)?.[1]);
            if(!ref)throw Error('Missing filter reference');
            const combined=index%2===1;
            const text='结果'+(index+1);
            // Both paths use the same actual button and deferred DOM mutation.
            if(index===0)await guest.executeJavaScript("document.querySelector('button').onclick=()=>setTimeout(()=>document.querySelector('p').textContent='结果'+(++window.n),100);void 0");
            const start=performance.now();
            receipt=await call({action:'click',tabId:receipt.tabId,snapshotId:receipt.snapshotId,ref,...combined&&{expectText:text}});
            if(!combined)receipt=await call({action:'wait',tabId:receipt.tabId,snapshotId:receipt.snapshotId,text});
            if(!receipt.text.includes(text))throw Error('Result not observed');
            times[combined?'combined':'separate'].push(Math.round(performance.now()-start));
          }
        }
        await host.teacher(id,'teacher');
        const cookie={url,name:'local_acceptance'};
        if((await guest.session.cookies.get(cookie)).length)throw Error('Temporary session inherited login');
        await host.teacher(id,'remember');
        const saved=(await guest.session.cookies.get(cookie)).length;
        if(phase==='save')await guest.session.cookies.set({...cookie,value:'synthetic',expirationDate:Date.now()/1000+3600});
        return {phase,saved,...phase==='save'&&{times}};
      }finally{await host.dispose();}
    },{phase,root:path.join(output,'captures'),statusFile,url}));
  }finally{await app.close();}
}
assert.deepEqual(rounds.map(r=>r.saved),[0,1,null,0]);
const stats=samples=>{const sorted=[...samples].sort((a,b)=>a-b);return {n:sorted.length,p50:sorted[9],p95:sorted[18]};};
const report={success:true,rounds,ms:Object.fromEntries(Object.entries(rounds[0].times).map(([key,samples])=>[key,stats(samples)])),scope:'Local Chromium, 100 ms page update, automatic fixture approval, no model/network latency'};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({output,ms:report.ms,cookies:rounds.map(r=>r.saved)}));
