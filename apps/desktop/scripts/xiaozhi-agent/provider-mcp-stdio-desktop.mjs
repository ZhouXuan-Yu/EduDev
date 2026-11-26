import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {runNativeHostSmoke} from './native-host-smoke-runner.mjs';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const build=process.argv[2];
assert(path.isAbsolute(build??''),'Pass the actual Electron build root');
const ownerCycles=process.argv[3]==='--owner-cycles';
assert(!process.argv[3]||ownerCycles,'Unknown fixture argument');
const main=fs.realpathSync(path.join(build,'main/index.js'));
const report={success:false,mainHash:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),paidCalls:0,checks:[],timeline:[],cycles:[]};
const mark=(name,details={})=>report.timeline.push({name,at:performance.now(),...details});
const service=await startMcpFixture();
let app, root;

async function until(action,label,timeout=30_000) {
  const end=performance.now()+timeout;
  do {const value=await action();if(value)return value;await delay(25);}while(performance.now()<end);
  throw Error('Timed out waiting for '+label);
}
function gone(pid) {
  try {process.kill(pid,0);return false;}
  catch(error){if(error.code==='ESRCH')return true;throw error;}
}
try {
  process.env.OMNI_EDU_PROVIDER_HEALTHY_MCP_URL=service.url;
  if(ownerCycles)process.env.OMNI_EDU_PROVIDER_MCP_OWNER_CYCLES='1';
  const seeded=await runNativeHostSmoke({prefix:'provider-mcp-stdio-desktop-',workerFile:'scripts/xiaozhi-agent/provider-mcp-stdio-seed.ts',checkCount:1});
  root=seeded.output;
  assert(seeded.success,JSON.stringify(seeded));
  const seed=JSON.parse(fs.readFileSync(path.join(root,'REPORT.json'),'utf8'));
  report.state=seed;
  assert(seed.independentTool);
  const database=path.join(seed.dataRoot,'app.db');
  const query='合成摩擦力标记';
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
  Object.assign(env,{OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:seed.dataRoot,
    OMNI_EDU_REPO_ROOT:path.resolve(import.meta.dirname,'../../../..'),DEEPSEEK_API_KEY:'synthetic-native-mcp-isolation',DEEPSEEK_MODEL:'deepseek-flash'});
  app=await electron.launch({args:[main,'--user-data-dir='+path.join(root,'desktop-profile')],env,timeout:60_000});
  await app.evaluate(({net},{tool,independentTool,query,requestLimit})=>{
    const traces=globalThis.providerNativeMcpFrames=[];
    const childProcess=process.getBuiltinModule('node:child_process');
    const nativeSpawn=childProcess.spawn;
    childProcess.spawn=function(executable,args,...options){
      const child=nativeSpawn.call(this,executable,args,...options);
      if(!args?.includes('--protocol-stdio'))return child;
      let pending='',lateOwner=false,cancellation;
      const write=child.stdin.write.bind(child.stdin);
      child.stdin.write=(input,...args)=>{
        if(lateOwner){
          let control;
          try{control=JSON.parse(input.toString());}catch{/* Keep raw helper input. */}
          if(control?.type==='cancel'){
            // Let the owned fixture complete native EOF; its old output must still be rejected.
            cancellation??=setTimeout(()=>{if(!child.stdin.destroyed)write(input,...args);},1_500);
            return true;
          }
        }
        return write(input,...args);
      };
      const readFrame=bytes=>{
        pending+=bytes.toString('utf8');
        const lines=pending.split('\n');
        pending=lines.pop();
        for(const line of lines){
          let frame;
          try{frame=JSON.parse(line);}catch{continue;}
          const {type,pid,executionId,stream,data,state,exitCode}=frame;
          if(type==='started')traces.push({type,executionId,pid,helperPid:child.pid});
          if(type==='result')traces.push({type,executionId,state,exitCode});
          if(type!=='output'||typeof data!=='string')continue;
          const text=Buffer.from(data,'base64').toString('utf8');
          const match=/NATIVE-PROVIDER-FIXTURE (native-exit|native-late) (\d+)/u.exec(text);
          if(match&&stream==='stderr'){
            lateOwner=match[1]==='native-late';
            traces.push({type:'physical_call',executionId,mode:match[1],pid:Number(match[2])});
          }
          if(stream==='stdout'&&text.includes('NATIVE-LATE-701-MUST-NOT-PUBLISH'))traces.push({type:'late_stdout',executionId});
        }
      };
      child.stdout?.on('data',readFrame);
      child.once('close',code=>{
        clearTimeout(cancellation);
        child.stdout?.off('data',readFrame);
        setImmediate(()=>traces.push({type:'helper_close',helperPid:child.pid,code,
          stdoutListeners:child.stdout?.listenerCount('data')??0,stderrListeners:child.stderr?.listenerCount('data')??0}));
      });
      return child;
    };
    process.getBuiltinModule('node:module').syncBuiltinESMExports();
    const requests=globalThis.providerNativeMcpRequests=[];
    net.fetch=async (input,init)=>{
      const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
      if(url.origin!=='https://api.deepseek.com')throw Error('Synthetic fixture prevents external network');
      if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,
        max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
      if(url.pathname!=='/v1/chat/completions'||requests.length>=requestLimit)throw Error('Unexpected synthetic model request');
      const body=JSON.parse(init.body),lastUser=body.messages.findLastIndex(item=>item.role==='user');
      const scenario=/NATIVECASE-(exit|late|new|local) CASE-ID-([a-f0-9-]+) /u.exec(JSON.stringify(body.messages[lastUser]));
      if(!scenario)throw Error('Missing owned synthetic scenario for original session');
      const [,mode,caseId]=scenario;
      const receipts=body.messages.slice(lastUser+1).filter(item=>item.role==='tool');
      const steps=mode==='local'?[
        ['education_search_questions',{query,subject:'物理',limit:3}],
        ['find_education_tools',{query:'Independent synthetic lesson provider 查询公开课程'}],
        [independentTool,{topic:'合成独立服务课程'}]
      ]:[['find_education_tools',{query:'Owned Windows MCP isolation echo'}],[tool,{text:'native-'+mode}]];
      const next=steps[receipts.length];
      requests.push({mode,caseId,count:receipts.length,lastTool:receipts.at(-1)?.content});
      const id='native_case_'+caseId+'_'+receipts.length;
      const delta=next?{role:'assistant',tool_calls:[{index:0,id,type:'function',function:{name:next[0],arguments:JSON.stringify(next[1])}}]}:
        {role:'assistant',content:'以本地处理与实际工具结果为准。'};
      const chunk=(value,reason)=>'data: '+JSON.stringify({id,object:'chat.completion.chunk',created:1,model:body.model,
        choices:[{index:0,delta:value,finish_reason:reason}]})+'\n\n';
      return new Response(chunk(delta,null)+chunk({},next?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
    };
  },{tool:seed.tool,independentTool:seed.independentTool,query,requestLimit:ownerCycles?96:24});
  const page=await app.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor();
  const call=(method,input)=>page.evaluate(({method,input})=>window.omniEdu[method](input),{method,input});
  const mcpCatalog=async()=>{const result=await call('getXiaozhiMcpCatalog');assert(result.ok,JSON.stringify(result));return result.value;};
  function sql(statement,...values) {
    const db=new DatabaseSync(database,{readOnly:true});
    try{return db.prepare(statement).all(...values);}finally{db.close();}
  }
  const audit=(kind,run)=>sql('SELECT reference,metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind=? AND json_extract(metadata_json,\'$.owner.runId\')=? ORDER BY rowid',kind,run)
    .map(row=>({executionId:row.reference,...JSON.parse(row.metadata_json)}));
  function permissionTerminal(run) {
    const intent=audit('execution_intent',run).find(row=>row.callId==='mcp_lease_'+seed.serverId);
    assert(intent,'Read back the original native service permission lease');
    return sql("SELECT kind FROM xiaozhi_permission_audit_v1 WHERE reference=? AND kind IN ('execution_completed','execution_failed')",intent.executionId)
      .map(row=>row.kind);
  }
  const receipts=run=>sql('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND tool=?',run,seed.tool);
  async function start(sessionId,mode,request) {
    const result=await call('startXiaozhi',{sessionId,commandId:'xicmd_'+randomUUID(),prompt:'NATIVECASE-'+mode+' CASE-ID-'+randomUUID()+' '+request});
    assert(result.ok,JSON.stringify(result));
    return result.runId;
  }
  async function finished(session,runId) {
    return until(async()=>{
      const state=await call('getXiaozhiSnapshot',session);
      return !state.running&&state.projection.turns.find(turn=>turn.id===runId&&turn.status!=='running');
    },'original turn '+runId);
  }
  async function dispatch(run,mode) {
    return until(async()=>{
      const intent=audit('mcp_service_intent',run).find(item=>item.serverId===seed.serverId);
      if(!intent)return;
      const frames=await app.evaluate(()=>globalThis.providerNativeMcpFrames);
      const started=frames.find(frame=>frame.type==='started'&&frame.executionId===intent.executionId);
      const event=frames.find(frame=>frame.type==='physical_call'&&frame.executionId===intent.executionId&&frame.mode==='native-'+mode);
      if(!event)return;
      assert.equal(event.pid,started?.pid);
      assert(Number.isInteger(event.pid)&&!gone(event.pid));
      mark(mode+'-physical-dispatch',{run,pid:event.pid,executionId:intent.executionId});
      return {intent,pid:event.pid,helperPid:started.helperPid};
    },'native physical dispatch '+mode);
  }
  async function ended(run,owned,code) {
    const terminal=await until(()=>audit('mcp_service_terminal',run).find(item=>item.serverId===seed.serverId),'Job close '+run);
    assert.equal(terminal.result.exitCode,code,JSON.stringify(terminal.result));
    assert.equal(terminal.result.executionId,owned.intent.executionId);
    assert.deepEqual(terminal.result.cleanup,{jobActiveProcesses:0,profileRemoved:true,remainingOwnedAces:0});
    await until(()=>gone(owned.pid)&&gone(owned.helperPid)&&!fs.existsSync(owned.intent.projectionRoot),'processes and projection actually gone');
    mark('physical-cleanup',{run,pid:owned.pid,executionId:terminal.result.executionId,code});
    return terminal;
  }
  const question=stem=>({subject:'物理',grade:'初二',knowledgePoint:'摩擦力',questionType:'解答题',difficulty:'medium',stem,
    answer:'与相对运动方向相反',analysis:'结合接触面的相对运动方向判断。',sourceTitle:'自动验收合成题',tags:[]});
  const originalQuestion=await call('createQuestionBankItem',question(query+'的方向是什么？'));
  const run=await start(seed.fault,'exit','执行合成课程工具，记录异常退出。');
  const owned=await dispatch(run,'exit');
  const localRun=await start(seed.local,'local','查找'+query+'，随后读合成公开课程。');
  await until(async()=> (await app.evaluate(()=>globalThis.providerNativeMcpRequests)).some(row=>row.mode==='local'&&row.count===1&&
    JSON.stringify(row.lastTool).includes(query)),'independent Pi native question search');
  const saved=await call('createQuestionBankItem',question('子进程待退出时保存的合成练习题。'));
  mark('question-saved',{id:saved.id,localRun});
  assert(!gone(owned.pid));
  assert.equal(sql('SELECT stem FROM question_bank_items WHERE id=?',saved.id)[0].stem,saved.stem);
  assert.equal(sql('SELECT stem FROM question_bank_items WHERE id=?',originalQuestion.id)[0].stem,originalQuestion.stem);
  await until(()=>service.state.calls===1,'actual independently authorized HTTP tool');
  mark('independent-http-delivered',{calls:service.state.calls});
  assert(!gone(owned.pid));
  report.exit=await ended(run,owned,23);
  report.originalTurn=await finished(seed.fault,run);
  report.localTurn=await finished(seed.local,localRun);
  assert.equal(receipts(run).length,1);
  assert.equal(receipts(run)[0].success,0);
  assert.equal(sql('SELECT success FROM xiaozhi_tool_receipts WHERE run_id=? AND tool=?',localRun,seed.independentTool)[0].success,1);
  report.checks.push('A real Windows AppContainer MCP exits abnormally after an independent session searches and saves via typed IPC and another MCP delivers');

  const faultCatalog=await mcpCatalog();
  const same=faultCatalog.servers.find(row=>row.id===seed.serverId);
  assert.equal(same.trustedSchemaHash,seed.schemaHash);
  const lateRun=await start(seed.fault,'late','执行合成课程工具，校验超时窗和迟到输出。');
  const late=await dispatch(lateRun,'late');
  report.late=await ended(lateRun,late,31);
  report.frames=await app.evaluate(()=>globalThis.providerNativeMcpFrames);
  assert(report.frames.some(frame=>frame.type==='late_stdout'&&frame.executionId===late.intent.executionId),'Observe the actual late response on the old native pipe');
  await finished(seed.fault,lateRun);
  assert.equal(receipts(lateRun).length,1);
  assert.equal(receipts(lateRun)[0].success,0);
  const newRun=await start(seed.fault,'new','使用当前新连接读取合成课程。');
  report.newTurn=await finished(seed.fault,newRun);
  const final=await mcpCatalog();
  assert.equal(final.servers.find(row=>row.id===seed.serverId).trustedSchemaHash,seed.schemaHash);
  assert.equal(receipts(newRun).length,1);
  assert.equal(receipts(newRun)[0].success,1);
  report.requests=await app.evaluate(()=>globalThis.providerNativeMcpRequests);
  assert(!JSON.stringify(report.requests).includes('NATIVE-LATE-701-MUST-NOT-PUBLISH'));
  assert(report.requests.some(row=>row.mode==='new'&&JSON.stringify(row.lastTool??null).includes('NATIVE-HEALTHY')));
  report.checks.push('A real child writes the old reply after EOF, its owned Job and projection are cleaned, and the next connection returns only its own success');
  report.permissionTerminals={exit:permissionTerminal(run),late:permissionTerminal(lateRun),healthy:permissionTerminal(newRun)};
  assert.deepEqual(report.permissionTerminals,{exit:['execution_failed'],late:['execution_failed'],healthy:['execution_completed']},
    'A physically cleaned child with a nonzero exit code must not settle its service authority as successful');
  report.checks.push('Permission audit distinguishes an orderly release of native resources from success of the owned MCP service');
  async function saveOwnerCycle(physical,terminal){
    const close=await until(async()=>{
      const frames=await app.evaluate(()=>globalThis.providerNativeMcpFrames);
      return frames.find(frame=>frame.type==='helper_close'&&frame.helperPid===physical.helperPid);
    },'original helper close event');
    assert.equal(close.stdoutListeners,0,'No pipe listener remains after actual close');
    assert.equal(close.stderrListeners,0,'No diagnostic pipe listener remains after actual close');
    assert(!report.cycles.some(cycle=>cycle.executionId===terminal.executionId||cycle.projection===physical.intent.projectionRoot));
    report.cycles.push({executionId:terminal.executionId,owner:terminal.owner,pid:physical.pid,helperPid:physical.helperPid,
      projection:physical.intent.projectionRoot,terminal:terminal.result,close});
  }
  if(ownerCycles){
    await saveOwnerCycle(owned,report.exit);
    await saveOwnerCycle(late,report.late);
    for(let ordinal=3;ordinal<=10;ordinal++){
      // Rotate test conversations without rotating the application, trusted server or permission owner service.
      const session=ordinal<=5?seed.fault:seed.secondFault;
      assert(session);
      const broken=await start(session,'exit','记录第 '+ordinal+' 个真实进程退出。');
      const failingOwner=await dispatch(broken,'exit');
      const terminal=await ended(broken,failingOwner,23);
      await finished(session,broken);
      assert.equal(receipts(broken).length,1);
      assert.equal(receipts(broken)[0].success,0);
      assert.deepEqual(permissionTerminal(broken),['execution_failed']);
      await saveOwnerCycle(failingOwner,terminal);
      const recovering=await start(session,'new','使用新连接读取测试课程 '+ordinal+'。');
      await finished(session,recovering);
      assert.equal(receipts(recovering).length,1);
      assert.equal(receipts(recovering)[0].success,1);
      assert.deepEqual(permissionTerminal(recovering),['execution_completed']);
      assert.equal((await mcpCatalog()).servers.find(row=>row.id===seed.serverId).trustedSchemaHash,seed.schemaHash);
      report.cycles.at(-1).recoveryRun=recovering;
    }
    report.checks.push('Ten independent native fault owners close their Job, projection and pipe listener without losing original trust');
  }
  report.success=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  await app?.close().catch(()=>undefined);
  await service.close();
  if(root)fs.writeFileSync(path.join(root,'desktop-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({root,success:report.success,checks:report.checks.length,error:report.error}));
}
