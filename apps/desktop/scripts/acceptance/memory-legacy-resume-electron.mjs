import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const source=fs.realpathSync(process.argv[2]);
assert(process.env.OMNI_EDU_ACCEPTANCE_ROOT);
const sourceReport=process.argv[3]??path.join(source,'report.json');
assert(fs.existsSync(sourceReport),'Identify the original synthetic acceptance report');
const oldData=path.join(source,'data');
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'legacy-resume-'));
const data=path.join(root,'data'),profile=path.join(root,'profile'),main=testMain(desktop);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const wal=path.join(oldData,'app.db-wal');
assert(!fs.existsSync(wal)||fs.statSync(wal).size===0,'Use a stopped acceptance fixture');
const sourceDbHash=sha(fs.readFileSync(path.join(oldData,'app.db')));
fs.cpSync(oldData,data,{recursive:true,filter:f=>!/[.]db-(?:wal|shm)$/u.test(f)});
const sql=(query,...args)=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(query).all(...args);}finally{db.close();}
};
const scopes=()=>sql('SELECT conversation_id,schema_version,version,payload_json FROM xiaozhi_pi_memory_scopes ORDER BY conversation_id');
const ledger=()=>sql('SELECT to_version FROM xiaozhi_schema_migrations ORDER BY to_version').map(r=>r.to_version);
const before=scopes(),beforeLedger=ledger(),saved=before.find(row=>JSON.parse(row.payload_json).selections.length>0);
assert(saved);
const sessionId=saved.conversation_id,permission=JSON.parse(saved.payload_json);
const getBinding=()=>sql('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',sessionId)[0]?.session_file;
const binding=getBinding();
const originalBytes=binding?fs.readFileSync(path.join(oldData,'xiaozhi-pi',binding)):Buffer.alloc(0);
const olderJournals=fs.readdirSync(path.join(oldData,'xiaozhi-pi'),{recursive:true})
  .filter(file=>file.endsWith('.jsonl')).map(file=>({file,bytes:fs.readFileSync(path.join(oldData,'xiaozhi-pi',file))}));
assert(olderJournals.length,'A legacy native session fixture is required');
const report={ok:false,source:path.basename(source),root,build:sha(fs.readFileSync(main)),
  sourceReportSha256:sha(fs.readFileSync(sourceReport)),savedScopeSchema:saved.schema_version,savedScopeVersion:saved.version,sourceDbHash,
  previouslyBound:!!binding,nativePrefixSha256:binding?sha(originalBytes):null,beforeLedger,paidRequests:0,checks:[]};
let app,page;
async function launch(cold=false){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',
    DEEPSEEK_API_KEY:'synthetic-legacy-resume',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const name of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK','OMNI_EDU_HISTORY_TOKEN'])delete env[name];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env});
  await app.evaluate(({net},cold)=>{
    globalThis.legacyWire={calls:0,memory:null};
    globalThis.legacyLifecycle=[];
    const diagnostics=process.getBuiltinModule('node:diagnostics_channel');
    diagnostics.channel('omni-edu.xiaozhi.lifecycle.v1').subscribe(event=>{
      if(globalThis.legacyLifecycle.length<250)globalThis.legacyLifecycle.push({operation:event.operation,outcome:event.outcome});
    });
    net.fetch=async(input,init)=>{
      const u=new URL(typeof input==='string'?input:input.url);
      if(u.origin!=='https://api.deepseek.com')throw Error('Unexpected remote path');
      if(u.pathname==='/v1/models')return Response.json({data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]});
      if(cold||u.pathname!=='/v1/chat/completions')throw Error('Unexpected provider request');
      const body=JSON.parse(init.body),wire=globalThis.legacyWire;
      const first=wire.calls++===0;
      if(first&&!body.tools.some(t=>t.function.name==='read_education_memory'))throw Error('Legacy memory tool missing');
      if(!first){
        const raw=body.messages.findLast(m=>m.role==='tool')?.content;
        const item=typeof raw==='string'?raw:raw?.find(p=>p.type==='text')?.text;
        const result=JSON.parse(item.split('\n')[0]);
        if(!Array.isArray(result.memories))throw Error('Legacy tool returned no validated payload');
        wire.memory=result.memories.map(m=>({layer:m.layer,id:m.history?.sourceId??m.personal?.sourceId,version:m.version}));
      }
      const delta=first?{tool_calls:[{index:0,id:'legacy-read',type:'function',function:{name:'read_education_memory',arguments:'{}'}}]}:
        {content:'请学生画图说明思路。'};
      const chunk=(delta,reason=null)=>'data: '+JSON.stringify({id:'resume',object:'chat.completion.chunk',created:0,model:body.model,
        choices:[{index:0,delta,finish_reason:reason}]})+'\n\n';
      return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},first?'tool_calls':'stop')+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    };
  },cold);
  page=await app.firstWindow();await assertIsolatedPiMain(app,main,profile);
  await page.getByTestId('office-prompt-input').waitFor();
}
async function openSaved(){
  const composer=page.locator('.office-composer-container');
  if(await composer.getAttribute('data-session-id')===sessionId)return;
  await page.getByTestId('workbench-session-'+sessionId).click();
  await page.waitForFunction(id=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')===id,sessionId);
}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
try{
  await launch();await openSaved();
  const initial=await snapshot(),choices=initial.memoryScope.selections;
  assert.equal(initial.memoryScope.enabled,permission.enabled);
  assert.deepEqual(choices.map(q=>[q.layer,q.id,q.version]),permission.selections.map(q=>[q.layer,q.id,q.version]));
  report.checks.push('Original scope visible on the original conversation');
  const {last}=sql('SELECT coalesce(max(rowid),0) last FROM ai_agent_runs')[0];
  await page.getByTestId('office-prompt-input').fill('先核对本会话已选记忆，然后给一句数学教学建议。');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const deadline=Date.now()+45000;
  let turn;
  while(!turn&&Date.now()<deadline){
    const row=sql('SELECT id,status,error_message FROM ai_agent_runs WHERE session_id=? AND rowid>? ORDER BY rowid LIMIT 1',sessionId,last)[0];
    if(row&&['failed','blocked'].includes(row.status))throw Error('Run '+row.status+': '+row.error_message);
    if(row?.status==='succeeded'){
      const state=await snapshot();
      const completed=state.projection.turns.find(t=>t.id===row.id);
      if(!state.running&&completed?.status==='completed')turn=completed;
    }
    if(!turn)await new Promise(resolve=>setTimeout(resolve,150));
  }
  assert(turn,'Expected matching persisted run and terminal UI turn');
  assert.equal(turn.status,'completed',turn.error);
  const wire=await app.evaluate(()=>globalThis.legacyWire);
  assert.equal(wire.calls,2);assert(Array.isArray(wire.memory));
  const eligible=choices.filter(q=>q.state==='ready');
  for(const row of wire.memory)assert(eligible.some(q=>q.layer===row.layer&&q.id===row.id&&q.version===row.version));
  assert.deepEqual(wire.memory.map(row=>row.id).sort(),eligible.map(row=>row.id).sort());
  report.returned=wire.memory;report.choices=choices.map(q=>({layer:q.layer,state:q.state,id:q.id,version:q.version}));
  await app.close();app=undefined;
  const lastBinding=getBinding();
  assert(lastBinding);
  if(binding)assert.equal(lastBinding,binding);
  const continued=fs.readFileSync(path.join(data,'xiaozhi-pi',lastBinding));
  for(const {file,bytes} of olderJournals)assert(fs.readFileSync(path.join(data,'xiaozhi-pi',file)).subarray(0,bytes.length).equals(bytes));
  report.oldJournalHashes=olderJournals.map(({file,bytes})=>({file,sha256:sha(bytes)}));
  assert(continued.length>originalBytes.length&&continued.subarray(0,originalBytes.length).equals(originalBytes));
  assert.deepEqual(scopes(),before);
  assert.deepEqual(ledger().slice(0,beforeLedger.length),beforeLedger);
  report.checks.push('Successful old tool call, current version gate, identical scope and byte-for-byte JSONL prefix');
  await launch(true);await openSaved();
  assert.equal((await snapshot()).projection.turns.find(t=>t.id===turn.id)?.status,'completed');
  assert.equal((await app.evaluate(()=>globalThis.legacyWire)).calls,0);
  for(const {file,bytes} of olderJournals)assert(fs.readFileSync(path.join(oldData,'xiaozhi-pi',file)).equals(bytes));
  assert.equal(sha(fs.readFileSync(path.join(oldData,'app.db'))),sourceDbHash);
  report.afterLedger=ledger();report.turnId=turn.id;report.nativeAfterSha256=sha(continued);
  report.checks.push('Cold restart retains the completed turn without replay and source fixtures remain unchanged');report.ok=true;
}catch(error){
  report.error=String(error?.stack||error);process.exitCode=1;
  if(app){
    report.lifecycle=await app.evaluate(()=>globalThis.legacyLifecycle).catch(()=>[]);
    report.transportCalls=await app.evaluate(()=>globalThis.legacyWire?.calls).catch(()=>0);
  }
  if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
}finally{
  if(app)await app.close().catch(()=>{});
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks:report.checks,error:report.error,root}));
}
