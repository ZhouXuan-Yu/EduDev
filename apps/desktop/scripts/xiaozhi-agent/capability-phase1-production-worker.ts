import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {NATIVE_STAT_PROVIDER_IDS,NATIVE_STAT_CAPABILITY} from '../../src/main/xiaozhi-agent/capabilities/native-stat';
import type {CapabilityRequirement} from '../../src/main/xiaozhi-agent/capabilities/types';

const output = process.argv[2];
const dataRoot = path.join(output,'data');
const workspace = path.join(output,'workspace');
fs.mkdirSync(workspace);
fs.writeFileSync(path.join(workspace,'资料.txt'),'synthetic local fixture');
const checks: {name: string; pass: boolean}[] = [];
const report: {success: boolean; checks: typeof checks; error?: string; boundary: string} = {success:false,checks,boundary:'Actual Electron main-process host, OmniEduStore transaction/migration, existing workspace authority, active Run Native calls and locked Pi completion over synthetic loopback SSE. Real model calls 0. Scope is Phase1 main-process acceptance.'};
process.env.DEEPSEEK_API_KEY='synthetic-capability-loopback';
process.env.DEEPSEEK_MODEL='deepseek-flash';
let modelCalls=0;
const fixture=http.createServer((request,response)=>{
  request.resume();
  if(request.url==='/v1/models'){
    response.writeHead(200,{'content-type':'application/json'});
    response.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'low'}}]}));return;
  }
  if(request.url!=='/v1/chat/completions'){response.writeHead(404);response.end();return;}
  modelCalls++;
  response.writeHead(200,{'content-type':'text/event-stream'});
  const base={id:'synthetic-capability',object:'chat.completion.chunk',created:1,model:'deepseek-flash'};
  response.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{role:'assistant',content:'合成连接验收已完成。'},finish_reason:null}]})+'\n\n');
  response.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:30,completion_tokens:10,total_tokens:40}})+'\n\n');
  response.end('data: [DONE]\n\n');
});
const originalFetch=net.fetch;
let store = new OmniEduStore(dataRoot);
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
const check = (name: string) => { checks.push({name,pass:true}); console.log('PASS '+name); };
const requirement: CapabilityRequirement = {capabilityId:NATIVE_STAT_CAPABILITY.id,contractVersion:'1.0.0',required:[],optional:[],conditions:[],localOnly:true,platform:process.platform,budget:{latencyMs:30000,resourceUnits:1}};
try {
  await new Promise<void>(resolve=>fixture.listen(0,'127.0.0.1',resolve));
  const address=fixture.address();assert(address&&typeof address!=='string');
  net.fetch=async(input,init)=>{
    const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    assert.equal(target.origin,'https://api.deepseek.com');
    return globalThis.fetch(`http://127.0.0.1:${address.port}${target.pathname}`,init);
  };
  await store.init();
  const initial = await store.xiaozhiState.capabilities.snapshot();
  assert.equal(initial.definitions.length,1);
  assert.deepEqual(initial.providers.map(item => item.id),[...NATIVE_STAT_PROVIDER_IDS]);
  assert.equal((await store.xiaozhiState.sql.all('SELECT count(*) AS n FROM xiaozhi_capability_registry_v1'))[0].n,1);
  check('Production store init migrates and registers both real Native providers');

  const sessionId = (await store.createAiConversationSession({title:'合成能力协议验收',folderId:null})).session.id;
  await store.xiaozhiState.setWorkspace(sessionId,workspace,'合成授权目录');
  let hold=false;
  let activeRunId='';
  let entered:()=>void=()=>{};
  let release:()=>void=()=>{};
  const held=new Promise<void>(resolve=>{release=resolve;});
  const hookEntered=new Promise<void>(resolve=>{entered=resolve;});
  let positiveCalls=0;
  host = createXiaozhiProductionHost({store,dataRoot,emit:() => {},enabled:true,beforeModelDelivery:async()=>{
    const row=(await store.xiaozhiState.sql.all("SELECT id FROM ai_agent_runs WHERE session_id=? AND status='running' ORDER BY created_at DESC LIMIT 1",[sessionId]))[0];
    assert(row);activeRunId=String(row.id);
    if(hold){entered();await held;return;}
    for(const providerId of NATIVE_STAT_PROVIDER_IDS){
      const inspected=await host!.capabilities.execute({sessionId,runId:activeRunId,callId:randomUUID(),signal:new AbortController().signal},providerId,requirement,{path:'资料.txt'});
      assert(['completed','partial'].includes(inspected.status),JSON.stringify(inspected));
      assert.equal(inspected.data?.size,fs.statSync(path.join(workspace,'资料.txt')).size);positiveCalls++;
    }
  }});
  const lease = await host.resolveFileWorkspace(sessionId);
  assert.equal(lease.path,fs.realpathSync(workspace));
  const result = await host.capabilities.resolve(sessionId,requirement);
  assert.equal(result.selectedProviders.length+result.alternatives.length,2);
  check('Main production capability resolver uses the existing workspace authority');

  const denied = await host.capabilities.execute({sessionId,runId:'forged-run',callId:randomUUID(),signal:new AbortController().signal},NATIVE_STAT_PROVIDER_IDS[0],requirement,{path:'资料.txt'});
  assert.equal(denied.status,'failed');
  assert.equal(denied.error?.code,'permission_denied');
  check('Production active-run fencing rejects a fabricated caller context');

  const started=await host.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'请简短回复收到。'});
  assert(started.ok);await host.waitForRun(sessionId,started.runId);
  assert.equal(positiveCalls,2);assert.equal(activeRunId,started.runId);
  check('Actual host.start active owner successfully calls both real Native adapters');
  assert.equal(modelCalls,1);assert.equal((await store.getAiAgentRun(started.runId))?.status,'succeeded');
  check('Actual Pi stream completes through the isolated loopback SSE transport');

  hold=true;
  const stopping=await host.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'请等待本地停止验收。'});
  assert(stopping.ok);
  await Promise.race([hookEntered,new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('fixture_hook_timeout')),20000))]);
  await host.stop(sessionId);release();
  const oldContext={sessionId,runId:stopping.runId,callId:randomUUID(),signal:new AbortController().signal};
  const stopped=await host.capabilities.execute(oldContext,NATIVE_STAT_PROVIDER_IDS[0],requirement,{path:'资料.txt'});
  assert.equal(stopped.error?.code,'permission_denied');
  check('Stopped production Run loses Native capability execution authority');

  await store.archiveAiConversationSession(sessionId);
  const archived = await host.capabilities.resolve(sessionId,requirement);
  assert.equal(archived.status,'blocked_permission');
  assert.equal(archived.selectedProviders.length,0);
  check('Archived session is excluded by current main-process authorization');

  await store.xiaozhiState.capabilities.revokeProvider(NATIVE_STAT_PROVIDER_IDS[0]);
  const revoked = await store.xiaozhiState.capabilities.snapshot();
  await host.close();host=undefined;await store.close();
  store = new OmniEduStore(dataRoot);await store.init();
  assert.deepEqual(await store.xiaozhiState.capabilities.snapshot(),revoked);
  host=createXiaozhiProductionHost({store,dataRoot,emit:()=>{},enabled:false});
  assert.equal((await host.capabilities.execute({...oldContext,callId:randomUUID()},NATIVE_STAT_PROVIDER_IDS[1],requirement,{path:'资料.txt'})).error?.code,'permission_denied');
  check('Actual production cold init preserves revision and revoked provider tombstone');
  report.success=true;
} catch(error) {
  report.error=String(error instanceof Error ? error.stack : error);
  process.exitCode=1;
} finally {
  await host?.close().catch(() => {});
  await store.close().catch(() => {});
  net.fetch=originalFetch;
  fixture.closeAllConnections();await new Promise<void>(resolve=>fixture.close(()=>resolve()));
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,passed:checks.length,output,error:report.error}));
}
