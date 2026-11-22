import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain} from '../acceptance/build-root.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(root,'Set OMNI_EDU_ACCEPTANCE_ROOT to a synthetic acceptance directory');
const output=fs.mkdtempSync(path.join(root,'context-electron-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const main=testMain(process.cwd());
const checks=[],requests=[],rendererErrors=[];
const marker='独立课题-'+randomUUID().slice(0,8);
const historicalFact='卡片编号-'+randomUUID().slice(0,8);
const automatic=process.argv.includes('--auto');
const planOnly=process.argv.includes('--plan');
const live=process.argv.includes('--live');
assert(!live||(!automatic&&!planOnly),'Live mode only supports the bounded manual context scenario');
const liveKey=live&&(process.env.DEEPSEEK_API_KEY||fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*([^\r\n]+)/m)?.[1].trim().replace(/^["']|["']$/g,''));
assert(!live||liveKey,'A configured DeepSeek key is required for explicit --live mode');
let liveRequests=0;
const capabilityPlan={schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:0,requirementsVersion:1,reason:'合成教学资料依赖验证',
  steps:[{id:'review',text:'教师核对合成任务',dependsOn:[],reported:'pending',kind:'human'}],
  capabilityRequirements:[
    {capabilityId:'edu.workspace.file.stat',contractVersion:'1.0.0',required:[],optional:[],conditions:[],dependsOn:['edu.synthetic.not-installed']},
    {capabilityId:'edu.synthetic.not-installed',contractVersion:'1.0.0',required:[],optional:[],conditions:[]},
  ]};
let rejectCompaction=false;
let recoverHistory=false;
let toolRequested=false;
const fixture=http.createServer(async(request,response)=>{
  if(request.url==='/v1/models'){
    response.writeHead(200,{'content-type':'application/json'});
    return response.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,
      input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'low'}}]}));
  }
  assert.equal(request.url,'/v1/chat/completions');
  assert.equal(request.headers.authorization,'Bearer synthetic-d2-context');
  let json='';for await (const part of request)json+=part;
  const body=JSON.parse(json);
  const messages=JSON.stringify(body.messages);
  const markerPresent=messages.includes(marker);
  const isSummary=messages.includes('<conversation>')&&messages.includes('</conversation>');
  const kind=isSummary ? (rejectCompaction?'failure':'compaction') : 'reply';
  const toolReceipt=body.messages.some(message=>message.role==='tool'&&String(message.content).includes(historicalFact)
    &&String(message.content).includes('sourceVersion'));
  const toolCall=!live&&!toolRequested&&!isSummary&&(planOnly?{name:'update_task_plan',input:capabilityPlan}
    :recoverHistory?{name:'read_teacher_request',input:{query:'橙色卡片',limit:4000}}:null);
  if(toolCall)toolRequested=true;
  requests.push({kind,bytes:Buffer.byteLength(json),messages:body.messages.length,markerPresent,toolReceipt,
    ...(toolCall?{requestedTool:toolCall.name}:{})});
  if(kind==='failure'){
    response.writeHead(400,{'content-type':'application/json'});return response.end('{"error":{"message":"Synthetic rejection"}}');
  }
  if(live){
    if(liveRequests>=10){response.writeHead(429);return response.end('Acceptance request budget exhausted');}
    liveRequests++;
    try{
      const abort=new AbortController();
      response.once('close',()=>abort.abort());
      const upstream=await fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',redirect:'error',body:json,
        headers:{authorization:`Bearer ${liveKey}`,'content-type':'application/json'},
        signal:AbortSignal.any([abort.signal,AbortSignal.timeout(55_000)])});
      response.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json'});
      if(upstream.body)await pipeline(Readable.fromWeb(upstream.body),response);
      else response.end();
    }catch{
      if(!response.headersSent)response.writeHead(502);
      response.end();
    }
    return;
  }
  response.writeHead(200,{'content-type':'text/event-stream'});
  const chunk={id:'d2-context-local',object:'chat.completion.chunk',model:'deepseek-flash',created:1};
  const stream=(delta,finish_reason=null,usage)=>'data: '+JSON.stringify({...chunk,
    choices:[{index:0,delta,finish_reason}],...(usage?{usage}:{})})+'\n\n';
  const reference=markerPresent?marker:'未找到原始标记';
  const text=kind==='compaction'?`合成摘要。保留独立课堂任务标记 ${reference}。`:`已核对课堂文本。${reference}。${toolReceipt?historicalFact:''}`;
  const usage={prompt_tokens:320,completion_tokens:12,total_tokens:332,prompt_cache_hit_tokens:192,prompt_cache_miss_tokens:128};
  response.write(stream({role:'assistant'}));
  response.write(stream(toolCall?{tool_calls:[{index:0,id:'d2-'+toolCall.name,type:'function',
    function:{name:toolCall.name,arguments:JSON.stringify(toolCall.input)}}]}:{content:text}));
  response.end(stream({},toolCall?'tool_calls':'stop',usage)+'data: [DONE]\n\n');
});
fixture.listen(0,'127.0.0.1');await once(fixture,'listening');
const bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`const {app,net}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
const tracePath=${JSON.stringify(path.join(output,'lifecycle.jsonl'))};
require('node:diagnostics_channel').channel('omni-edu.xiaozhi.lifecycle.v1').subscribe(row=>{
require('node:fs').appendFileSync(tracePath,JSON.stringify({operation:row.operation,outcome:row.outcome,durationMs:row.durationMs})+'\\n');});
net.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
if(url.origin!=='https://api.deepseek.com'||!['/v1/models','/v1/chat/completions'].includes(url.pathname))throw Error('fixture_network_blocked');
return globalThis.fetch('http://127.0.0.1:${fixture.address().port}'+url.pathname,{...init,redirect:'error'});};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)})).catch(error=>{
require('node:fs').writeFileSync(tracePath+'.startup-error',String(error.stack));app.exit(1);});`);
const env={...process.env};
for(const key of Object.keys(env))if(/(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)$/i.test(key)||key.startsWith('OMNI_EDU_E2E_'))delete env[key];
for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_VISIBLE:'0',
  OMNI_EDU_D2_RESOLVER:'shadow',
  OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_PI_AUTO_COMPACTION:automatic?'1':'0',
  ...(automatic?{OMNI_EDU_E2E_PI_CONTEXT_WINDOW:'655360'}:{}),
  DEEPSEEK_API_KEY:'synthetic-d2-context',DEEPSEEK_MODEL:'deepseek-flash'});
let app,page,sessionId;
const check=(name)=>{checks.push(name);console.log('PASS '+name);};
async function launch(){
  app=await electron.launch({args:[bootstrap],cwd:process.cwd(),env,timeout:60000});
  page=await app.firstWindow({timeout:60000});
  page.on('pageerror',error=>rendererErrors.push(error.message));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:45000});
  await page.waitForFunction(()=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')?.startsWith('aisession_'));
  await page.getByTestId('office-prompt-input').waitFor({state:'visible'});
}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function waitForTurn(previous){
  const deadline=Date.now()+70000;
  while(Date.now()<deadline){
    const snap=await snapshot();
    const turn=snap.projection.turns.at(-1);
    if(snap.projection.turns.length>previous&&!snap.running&&['completed','failed','interrupted'].includes(turn?.status))return turn;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('D2 terminal turn did not settle');
}
async function send(text){
  const before=(await snapshot()).projection.turns.length;
  const input=page.getByTestId('office-prompt-input');
  await input.fill(text);
  await input.press('Enter');
  return waitForTurn(before);
}
async function compact(){
  const before=(await snapshot()).projection.turns.length;
  await page.getByTestId('pi-command-picker').click();
  await page.getByTestId('pi-command-compact').click();
  return waitForTurn(before);
}
function history(){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{
    const binding=db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(sessionId);
    const raw=fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file),'utf8');
    return {raw,entries:raw.trim().split('\n').map(JSON.parse)};
  }finally{db.close();}
}
const longText='合成课堂资料。知识点为分数通分，先写等值分数，保留教师提供的例题条件。'.repeat(125);
let failure;
try{
  await launch();
  sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
  if(planOnly){
    const turn=await send('制定教学文件检查计划，先准备前置能力，再核对文件版本。只登记计划，等教师复核，不写文件。');
    assert.equal(turn.status,'completed',turn.error);
    const actual=(await snapshot()).task?.planning;
    assert.deepEqual(actual?.capabilityRequirements,capabilityPlan.capabilityRequirements.map(({dependsOn:_,...requirement})=>requirement));
    assert.equal(actual.preflight.checks.dependencies.state,'blocked');
    assert(actual.preflight.checks.dependencies.references.includes('capability:edu.synthetic.not-installed->edu.workspace.file.stat'));
    assert.deepEqual(rendererErrors,[]);
    fs.writeFileSync(path.join(output,'planning.json'),JSON.stringify(actual,null,2));
    check('桌面任务实际保存能力依赖图，缺失前置能力明确阻塞预检');
  }else if(automatic){
    let summary,original;
    for(let i=0;i<16&&!summary;i++){
      const turn=await send(`第${i+1}轮 ${marker} ${longText}`);
      assert.equal(turn.status,'completed',turn.error);
      const current=history();
      if(original)assert(current.raw.startsWith(original));
      summary=current.entries.find(entry=>entry.type==='compaction');
      original=current.raw;
    }
    assert(summary,'Expected native automatic compaction after long conversation grows');
    assert(['before_request','threshold','overflow'].includes(summary.details.xiaozhiContext.reason));
    assert(requests.some(request=>request.kind==='compaction'));
    assert.deepEqual(rendererErrors,[]);
    fs.writeFileSync(path.join(output,'comparison.json'),JSON.stringify({summaryId:summary.id,reason:summary.details.xiaozhiContext.reason,
      transactionMs:summary.details.xiaozhiContext.elapsedMs,nativeTokensBefore:summary.tokensBefore},null,2));
    check('长对话自动整理只追加原生摘要，后续模型回复正常完成');
  }else{
  for(let i=0;i<3;i++)assert.equal((await send(`第${i+1}轮 ${marker} ${longText}${i===0?'橙色卡片 '+historicalFact:''}\n仅回复已阅读。`)).status,'completed');
  const before=history();
  assert(before.raw.includes(marker));
  const receipts=before.entries.filter(entry=>entry.customType==='xiaozhi.d2.model-cache.v1');
  assert(receipts.some(entry=>entry.data.requestType==='reply'&&(live?entry.data.inputTokens>0
    &&entry.data.cacheHitTokens+entry.data.cacheMissTokens===entry.data.inputTokens:entry.data.cacheHitTokens===192&&entry.data.cacheMissTokens===128)));
  check('真实 Electron 与 Pi 保留原始对话，SSE 用量落入模型缓存记录');
  const compaction=await compact();
  assert.equal(compaction.status,'completed',compaction.errorCode||compaction.error);
  const after=history();
  const summary=after.entries.filter(entry=>entry.type==='compaction').at(-1);
  assert(after.raw.startsWith(before.raw));
  assert.equal(summary.details.xiaozhiContext.engine,'pi-native@1.0.2');
  if(!live)assert(!summary.summary.includes(historicalFact));
  assert(summary.details.xiaozhiContext.authority.p0.some(item=>item.startsWith('checkpoint:')));
  assert(after.entries.some(entry=>entry.customType==='xiaozhi.d2.model-cache.v1'&&entry.data.requestType==='compaction'));
  check('通过真实桌面入口追加一份含检查点引用的原生摘要，历史保持可读');
  assert.equal((await send(`检查压缩后继续任务 ${longText}\n仅回复已阅读。`)).status,'completed');
  assert.equal((await send(`再补充一个合成例题 ${longText}\n仅回复已阅读。`)).status,'completed');
  rejectCompaction=true;
  const checkpoint=history();
  assert.equal((await compact()).status,'failed');
  const failed=history();
  assert(failed.raw.startsWith(checkpoint.raw));
  assert.equal(failed.entries.filter(entry=>entry.type==='compaction').at(-1).id,summary.id);
  check('上游拒绝压缩后保留上一有效摘要和旧消息');
  await app.close();app=undefined;
  await launch();
  if(await page.locator('.office-composer-container').getAttribute('data-session-id')!==sessionId){
    if(!await page.getByTestId('edu-history-panel').isVisible())await page.getByTestId('pi-sidebar-toggle').click();
    await page.getByTestId(`ai-conversation-session-${sessionId}`).click();
    await page.waitForFunction(id=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')===id,sessionId);
  }
  assert((await snapshot()).projection.turns.length>=5);
  assert.equal(history().entries.filter(entry=>entry.type==='compaction').at(-1).id,summary.id);
  rejectCompaction=false;
  recoverHistory=true;
  const resumed=await send('用 read_teacher_request 按“橙色卡片”查询本会话旧讨论，给出原始卡片编号和课堂课题标记。');
  assert.equal(resumed.status,'completed');
  assert(resumed.items.some(item=>item.kind==='message'&&item.role==='assistant'&&item.text.includes(marker)&&item.text.includes(historicalFact)));
  assert(requests.at(-1)?.markerPresent&&requests.at(-1)?.toolReceipt);
  check('冷启动后续聊调用历史检索，从同一会话原文找到带来源版本的卡片编号');
  assert.deepEqual(rendererErrors,[]);
  await page.screenshot({path:path.join(output,'cold-recovery.png')});
  fs.writeFileSync(path.join(output,'comparison.json'),JSON.stringify({beforeEntries:before.entries.length,
    afterEntries:after.entries.length,nativeTokensBefore:summary.tokensBefore,transactionMs:summary.details.xiaozhiContext.elapsedMs,
    compactionItems:compaction.items.filter(item=>item.kind==='compaction'),usageReceipts:receipts.map(entry=>entry.data)},null,2));
  }
}catch(error){failure=error;console.error(error.stack);process.exitCode=1;}
finally{
  await app?.close().catch(()=>undefined);
  fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));
  const report={success:!failure,checks,requests,rendererErrors,output,main,liveRequests,error:failure?.message};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
