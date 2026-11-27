import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import fs from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const fixture=fs.realpathSync(process.argv[2]||'missing');
const previous=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert.equal(previous.lane,'B');
assert.equal(previous.variant,'rebuild');
assert(previous.checks.length>=9,'Use only the successful synthetic R1 rebuild fixture');
assert(process.env.OMNI_EDU_ACCEPTANCE_ROOT&&process.env.DEEPSEEK_API_KEY);
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'history-sdk-unavailable-'));
const data=path.join(root,'data'),profile=path.join(root,'profile'),main=testMain(desktop);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const original=path.join(fixture,'data','app.db'),sourceHash=sha(original);
fs.cpSync(path.join(fixture,'data'),data,{recursive:true,errorOnExist:true,force:false});

function read(query,...args){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(query).all(...args);}
  finally{db.close();}
}
const allowed=read(`SELECT a.record_id,m.content FROM memory_source_access a
  JOIN memory_index_catalog c USING(source_id) JOIN ai_conversation_messages m ON m.id=a.record_id
  WHERE a.index_allowed=1 AND a.discover_allowed=1 AND c.status='ready'`);
const forgotten=read("SELECT record_id FROM memory_source_access WHERE memory_state='forgotten'");
assert.equal(allowed.length,1);
assert(forgotten.length>0);
const report={ok:false,buildSha256:sha(main),previousBuildSha256:previous.sha256,sourceHash,checks:[],outage:[],model:[]};
const server=createServer((request,response)=>{
  report.outage.push({method:request.method,path:new URL(request.url,'http://localhost').pathname,status:503});
  request.resume();
  response.writeHead(503,{'content-type':'application/json'});
  response.end(JSON.stringify({message:'Controlled acceptance service outage'}));
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
let app,page;
function pass(name){report.checks.push(name);console.log('PASS '+name);}
async function until(fn,maxMs=60000){
  const end=Date.now()+maxMs;
  while(Date.now()<end){
    const result=await fn();
    if(result)return result;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('History outage journey did not reach the expected durable state');
}

try{
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:'deepseek-flash',
    OMNI_EDU_HISTORY_LOOPBACK:'http://127.0.0.1:'+server.address().port,OMNI_EDU_HISTORY_TOKEN:'owned-outage-fixture'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  await app.evaluate(({net},literal)=>{
    const originalFetch=net.fetch.bind(net);
    globalThis.historyOutageModel=[];
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin!=='https://api.deepseek.com'||!url.pathname.endsWith('/chat/completions'))return originalFetch(input,init);
      if(globalThis.historyOutageModel.length>=4)throw Error('Frozen outage journey request cap reached');
      const payload=JSON.parse(init.body);
      const observation={status:0,model:payload.model,includesUnselectedSource:JSON.stringify(payload.messages).includes(literal)};
      globalThis.historyOutageModel.push(observation);
      const response=await originalFetch(input,init);
      observation.status=response.status;
      return response;
    };
  },allowed[0].content);
  page=await app.firstWindow();
  await assertIsolatedPiMain(app,main,profile);
  const composer=page.getByTestId('office-prompt-input');
  await composer.waitFor();
  const previousSession=await page.locator('.office-composer-container').getAttribute('data-session-id');
  await page.getByTestId('pi-new-session').click();
  const sessionId=await until(async()=>{
    const current=await page.locator('.office-composer-container').getAttribute('data-session-id');
    return current?.startsWith('aisession_')&&current!==previousSession?current:null;
  });
  const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
  assert.deepEqual((await snapshot()).memoryScope.selections,[]);
  const query='请查找冰水共存及冰融化实验的温度平台观察要求。';
  await composer.fill(query);
  await page.getByTestId('history-lookup-open').click();
  const before=report.outage.length,started=performance.now();
  await page.getByTestId('history-lookup-search').click();
  const lookup=page.getByTestId('history-lookup');
  const candidate=lookup.getByTestId('history-candidate-'+allowed[0].record_id);
  await candidate.waitFor({timeout:5000});
  report.responseMs=Math.round(performance.now()-started);
  assert.equal(await lookup.getAttribute('data-mode'),'local');
  await lookup.getByText('历史索引暂不可用，当前使用本机关键词查找。',{exact:true}).waitFor();
  assert(report.outage.slice(before).some(item=>item.status===503));
  for(const row of forgotten)assert.equal(await lookup.getByTestId('history-candidate-'+row.record_id).count(),0);
  assert.deepEqual((await snapshot()).memoryScope.selections,[]);
  pass('Actual SDK outage falls back to authorized local original and never exposes forgotten candidates');
  await candidate.click();
  await lookup.getByTestId('history-lookup-preview').getByText(allowed[0].content,{exact:true}).waitFor();
  assert.equal((await app.evaluate(()=>globalThis.historyOutageModel)).length,0);
  await lookup.getByRole('button',{name:'不再查找',exact:true}).click();
  assert.equal(await composer.inputValue(),query);
  await composer.fill('请用两句话解释冰融化时出现温度平台的原因。只在聊天里回答。');
  const last=(await snapshot()).projection.turns.at(-1)?.id;
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const turn=await until(async()=>{
    const state=await snapshot(),current=state.projection.turns.at(-1);
    return !state.running&&current?.id!==last&&['completed','failed','interrupted'].includes(current?.status)?current:null;
  });
  assert.equal(turn.status,'completed',turn.error);
  report.model=await app.evaluate(()=>globalThis.historyOutageModel);
  assert(report.model.some(item=>item.status===200));
  assert(report.model.every(item=>!item.includesUnselectedSource));
  assert.deepEqual((await snapshot()).memoryScope.selections,[]);
  assert.equal(sha(original),sourceHash);
  pass('Normal task succeeds with real model while the merely discovered original stays local and unselected');
  report.ok=true;
} catch(error){
  report.error=String(error.stack||error).slice(0,4000);
  process.exitCode=1;
  await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
} finally {
  await app?.close().catch(()=>{});
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(root);
}
