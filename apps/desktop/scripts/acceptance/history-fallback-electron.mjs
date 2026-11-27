import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
assert(process.env.OMNI_EDU_ACCEPTANCE_ROOT&&process.argv[2]);
const original=path.join(fs.realpathSync(process.argv[2]),'data');
const wal=path.join(original,'app.db-wal');
assert(!fs.existsSync(wal)||fs.statSync(wal).size===0);
const output=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'history-fallback-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
fs.cpSync(original,data,{recursive:true,filter:f=>!/[.]db-(?:shm|wal)$/u.test(f)});
const dbRead=(query,...args)=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(query).all(...args);}finally{db.close();}
};
const indexed=dbRead("SELECT a.record_id FROM memory_source_access a JOIN memory_index_catalog c ON a.source_id=c.source_id WHERE a.memory_state='active' AND c.status='ready'");
const forgotten=dbRead("SELECT record_id FROM memory_source_access WHERE memory_state='forgotten'");
assert(indexed.length&&forgotten.length,'The old real engine fixture must include ready and revoked documents');
const source=dbRead('SELECT content FROM ai_conversation_messages WHERE id=?',indexed[0].record_id)[0].content;
const denied=dbRead('SELECT content FROM ai_conversation_messages WHERE id=?',forgotten[0].record_id)[0].content;
const events=[];
let mode='429';
const fault=http.createServer((request,response)=>{
  events.push({mode,method:request.method,path:new URL(request.url,'http://localhost').pathname});
  if(mode==='429'){response.writeHead(429,{'content-type':'application/json'});response.end('{"error":"rate limited"}');}
  if(mode==='offline')request.socket.destroy();
});
await new Promise((ok,fail)=>fault.once('error',fail).listen(0,'127.0.0.1',ok));
const report={ok:false,output,build:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),cases:[],
  errors:[],paidRequests:0,historyService:'official client with loopback transport faults',model:'controlled transport'};
let app;
try{
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_MODEL:'deepseek-flash',
    DEEPSEEK_API_KEY:'synthetic-fallback',OMNI_EDU_HISTORY_LOOPBACK:'http://127.0.0.1:'+fault.address().port,OMNI_EDU_HISTORY_TOKEN:randomUUID()};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop});
  await app.evaluate(({net},{source,denied})=>{
    globalThis.fallbackWire=[];
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin!=='https://api.deepseek.com')throw Error('Unexpected remote origin');
      if(url.pathname==='/v1/models')return Response.json({data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]});
      if(url.pathname!=='/v1/chat/completions')throw Error('Unexpected remote path');
      const body=JSON.parse(init.body),projected=JSON.stringify(body.messages);
      const user=body.messages.findLast(m=>m.role==='user')?.content;
      const text=typeof user==='string'?user:user?.map(p=>p.text||'').join('');
      globalThis.fallbackWire.push({preference:text?.includes('先给提示，再给答案'),rawAllowed:projected.includes(source),rawDenied:projected.includes(denied)});
      const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'teaching-task',object:'chat.completion.chunk',
        created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
      return new Response(chunk({role:'assistant',content:'先想一想物态改变时，温度一定改变吗？'})+chunk({},'stop')+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    };
  },{source,denied});
  const page=await app.firstWindow();await assertIsolatedPiMain(app,main,profile);
  const input=page.getByTestId('office-prompt-input'),composer=page.locator('.office-composer-container');
  await input.waitFor();
  async function fresh(){
    const old=await composer.getAttribute('data-session-id');
    await page.getByTestId('pi-new-session').click();
    await page.waitForFunction(old=>{const id=document.querySelector('.office-composer-container')?.getAttribute('data-session-id');return id&&id!==old;},old);
    return composer.getAttribute('data-session-id');
  }
  async function send(id,text){
    const {last}=dbRead('SELECT coalesce(max(rowid),0) last FROM ai_agent_runs')[0];
    await input.fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const end=Date.now()+30000;
    while(Date.now()<end){
      const row=dbRead('SELECT id,status,error_message FROM ai_agent_runs WHERE session_id=? AND rowid>? ORDER BY rowid LIMIT 1',id,last)[0];
      if(row&&['failed','blocked'].includes(row.status))throw Error(row.error_message);
      if(row?.status==='succeeded'){
        const s=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
        if(!s.running&&s.projection.turns.find(t=>t.id===row.id)?.status==='completed')return row.id;
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error('No matching committed teacher turn');
  }
  const pref=await fresh();await send(pref,'以后讲解详细些，分步骤，先给提示再给答案。');
  const id=await fresh();
  const scope=()=>page.evaluate(async id=>(await window.omniEdu.getXiaozhiSnapshot(id)).memoryScope,id);
  const initial=await scope();assert(!initial.enabled&&!initial.selections.length);
  for(const faultMode of ['429','timeout','offline']){
    mode=faultMode;
    for(const known of [true,false]){
      const query=known?'冰水共存 温度平台':'zxqv314159zqx';
      await input.fill(query);await page.getByTestId('history-lookup-open').click();
      const start=performance.now(),initialCount=events.length;
      await page.getByTestId('history-lookup-search').click();
      const lookup=page.getByTestId('history-lookup');
      await lookup.getByText('历史索引暂不可用，当前使用本机关键词查找。',{exact:true}).waitFor({timeout:10000});
      const measured={faultMode,known,elapsedMs:Math.ceil(performance.now()-start),requests:events.slice(initialCount),
        hits:await lookup.locator('[data-testid^="history-candidate-"]').count(),unknownShown:await lookup.getByText('没有找到相符的历史。',{exact:true}).isVisible()};
      report.cases.push(measured);
      assert.equal(await lookup.getAttribute('data-mode'),'local');
      assert(measured.elapsedMs<10000&&measured.requests.length===1,'Unexpected foreground timeout or retry count');
      for(const ref of forgotten)assert.equal(await lookup.getByTestId('history-candidate-'+ref.record_id).count(),0);
      if(known){
        await lookup.getByTestId('history-candidate-'+indexed[0].record_id).click();
        await lookup.getByTestId('history-lookup-preview').getByText(source,{exact:true}).waitFor();
      }else{
        assert.equal(measured.hits,0);
        if(!measured.unknownShown)report.errors.push(faultMode+': missing empty-result message');
      }
      await lookup.getByRole('button',{name:'不再查找'}).click();
      const current=await scope();assert.equal(current.version,initial.version);assert.equal(current.enabled,false);assert.deepEqual(current.selections,[]);
    }
  }
  report.runId=await send(id,'继续备课，为什么冰水共存时温度可以不变？');
  const wire=await app.evaluate(()=>globalThis.fallbackWire);assert(wire.at(-1)?.preference,'Expected the actual saved preference in the task request');
  assert(wire.every(r=>!r.rawAllowed&&!r.rawDenied));report.wire=wire;
  report.ok=report.errors.length===0;if(!report.ok)process.exitCode=1;
}catch(error){report.errors.push(String(error?.stack||error));process.exitCode=1;}
finally{
  if(app)await app.close().catch(()=>{});
  fault.closeAllConnections();await new Promise(resolve=>fault.close(resolve));
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,output,checks:report.cases.length,errors:report.errors}));
}
