import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT,fixture=process.env.OMNI_EDU_MOCK_EXAM_FIXTURE;
assert(root&&fixture);
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert(baseline.ok&&baseline.paidRequests===0&&baseline.catalogId&&baseline.sessionId);
const {catalogId,sessionId,taskId}=baseline;
const oldData=path.resolve(fixture,'data'),output=fs.mkdtempSync(path.join(root,'mock-exam-edit-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const wal=path.join(oldData,'app.db-wal');
assert(!fs.existsSync(wal)||!fs.statSync(wal).size);
fs.cpSync(oldData,data,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const schemaVersion='xiaozhi.mock-exam-edit.v1',catalogSchema='xiaozhi.mock-exam-compilation.v1';
const readTool='education_read_mock_exam_for_edit',editTool='education_propose_mock_exam_edit';
const names={conflict:'2025上海嘉定区初三数学二模试卷.pdf',variant:'2025上海徐汇区初三数学一模试卷乙卷.pdf'};
const title='2025 年上海模考 · 九年级 · 数学 · 汇编';
const report={ok:false,output,catalogId,sessionId,taskId,main,mainSha256:sha(main),paidRequests:0,checks:[],errors:[]};
let app,page;

function sql(query,args=[],write=false){
  const database=new DatabaseSync(path.join(data,'app.db'),{readOnly:!write});
  try{database.exec('PRAGMA busy_timeout=5000');return write?database.prepare(query).run(...args):database.prepare(query).all(...args);}
  finally{database.close();}
}
for(const row of sql('SELECT id,local_path,content_hash FROM teacher_resources')){
  const relative=path.relative(oldData,row.local_path),local=path.resolve(data,relative);
  assert(relative.startsWith('teacher_resources'+path.sep)&&sha(local)===row.content_hash);
  sql('UPDATE teacher_resources SET local_path=? WHERE id=?',[local,row.id],true);
}
const check=label=>{report.checks.push(label);console.log('PASS '+label);};
async function until(read,timeout=65_000){
  const limit=Date.now()+timeout;
  while(Date.now()<limit){
    const result=await read();if(result)return result;
    await new Promise(resolve=>setTimeout(resolve,140));
  }
  throw Error('Mock exam edit scenario timed out');
}

async function launch(){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    DEEPSEEK_API_KEY:'synthetic-mock-exam-edit',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60_000});
  await app.evaluate(({net},{names,title,readTool,editTool,catalogId})=>{
    const wire=globalThis.mockExamEdit={requests:[],errors:[]};
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',
        data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
      try{
        if(!wire.mode||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')throw Error('Unexpected network request');
        const body=JSON.parse(init.body),index=wire.index++;
        const build='education_build_mock_exam_catalog';
        if(wire.mode!=='generate'&&body.tools.some(tool=>tool.function.name===build))throw Error('Modification must not create another catalogue');
        const raw=body.messages.findLast(message=>message.role==='tool')?.content;
        const text=typeof raw==='string'?raw:raw?.map(part=>part.text||'').join('\n');
        let previous;
        if(index){
          if(wire.mode==='permission'&&/^Validation/u.test(text||''))previous={success:false,error:'invalid_input'};
          else previous=JSON.parse(text.split('\n')[0]);
        }
        let call,content;
        if(wire.mode==='generate'){
          if(index===0)call={name:build,args:{year:2025,subject:'数学',grade:'九年级'}};
          else {if(!previous?.success)throw Error('Failed to create second catalogue');content='已准备另一份目录，等待核对。';}
        }else if(index===0)call={name:readTool,args:wire.mode==='ambiguous'?{title}:{catalogId}};
        else if(wire.mode==='ambiguous'){
          if(previous?.success||previous?.error!=='ambiguous'||previous?.choices?.length!==2)throw Error('Did not report duplicate same-title catalogues');
          content='找到两份同名目录，请先指定一份。';
        }else if(index===1){
          if(!previous?.success||previous.catalogId!==catalogId)throw Error('Did not read exact catalogue: '+JSON.stringify(previous));
          const {revision,digest}=previous;
          const row=previous.entries.find(item=>item.title===(wire.mode==='restricted'?names.variant:names.conflict));
          if(!row)throw Error('Missing exact entry');
          let change;
          if(wire.mode==='restricted')change={resourceId:row.resourceId,include:true};
          else if(wire.mode==='permission')change={resourceId:row.resourceId,permission:'local_only'};
          else change={resourceId:row.resourceId,district:row.district==='闵行区'?'嘉定区':'闵行区'};
          call={name:editTool,args:{catalogId,revision,digest,changes:[change]}};
        }else if(wire.mode==='stop'&&index===2){
          if(!previous?.success||previous?.state!=='pending')throw Error('No proposal to stop');
          wire.requests.push({mode:wire.mode,index,stalled:true});
          return new Response(new ReadableStream({start(controller){
            init.signal?.addEventListener('abort',()=>controller.error(new Error('cancelled')),{once:true});
          }}),{headers:{'content-type':'text/event-stream'}});
        }else{
          const rejected={restricted:'permission_denied',permission:'invalid_input'}[wire.mode];
          if(rejected?previous?.success||previous?.error!==rejected:!previous?.success||previous?.state!=='pending')
            throw Error('Unexpected proposal receipt: '+JSON.stringify(previous));
          content=rejected?'这次修改无法提交。':'修改建议已提交，请在本轮核对。';
        }
        if(call&&!body.tools.some(tool=>tool.function.name===call.name))throw Error('Missing tool '+call.name);
        wire.requests.push({mode:wire.mode,index,tool:call?.name,error:previous?.error});
        const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'mock-exam-edit',object:'chat.completion.chunk',
          created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
        const update=call?{tool_calls:[{index:0,id:`mock-edit-${wire.mode}-${index}`,type:'function',
          function:{name:call.name,arguments:JSON.stringify(call.args)}}]}:{content};
        return new Response(chunk({role:'assistant',content:''})+chunk(update)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',
          {headers:{'content-type':'text/event-stream'}});
      }catch(error){wire.errors.push(String(error));throw error;}
    };
  },{names,title,readTool,editTool,catalogId});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
  await page.getByTestId('workbench-session-'+sessionId).click();
  await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
}

const ledger=()=>sql('SELECT id,task_id,run_id,fingerprint,state,applied_revision FROM mock_exam_edit_reviews ORDER BY rowid');
const versionLog=()=>sql('SELECT revision,state,digest FROM mock_exam_compilation_versions WHERE catalog_id=? ORDER BY revision',[catalogId]);
const catalog=async()=>{
  const result=await page.evaluate(input=>window.omniEdu.reviewMockExamCatalog(input),{schemaVersion:catalogSchema,sessionId,id:catalogId});
  assert(result.ok,JSON.stringify(result));return result.value;
};
const card=()=>page.getByTestId('pi-mock-exam-edit').last();
const review=()=>card().getByTestId('mock-exam-edit-review');
async function send(mode,prompt,{settle=true}={}){
  const [previous]=sql('SELECT id FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1');
  await app.evaluate((_,value)=>Object.assign(globalThis.mockExamEdit,{mode:value,index:0}),mode);
  await page.getByTestId('office-prompt-input').fill(prompt);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  if(settle)await until(async()=>{
    const [next]=sql('SELECT id,status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1');
    if(!next||next.id===previous?.id||next.status==='running')return;
    assert.equal(next.status,'succeeded',next.error_message);
    const wire=await app.evaluate(()=>globalThis.mockExamEdit);
    assert.deepEqual(wire.errors,[]);
    return next;
  });
}

try{
  await launch();
  const before=await catalog(),versions=versionLog();
  assert.equal(before.summary.revision,4);
  assert.equal(ledger().length,0);
  const amend='只改这份模考汇编，嘉定文件名的二模试卷登记为嘉定区，其他照旧。';
  await send('apply',amend);
  const pending=ledger().at(-1);
  assert.equal(pending.task_id,taskId);
  assert.equal(pending.state,'pending');
  assert.deepEqual(versionLog(),versions);
  await page.setViewportSize({width:1366,height:768});
  await review().getByText('修改前 闵行区',{exact:true}).waitFor();
  await review().getByText('修改后 嘉定区',{exact:true}).waitFor();
  await review().getByTestId('mock-exam-edit-approve').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'pending-1366.png'),animations:'disabled'});
  check('Natural-language revision retains the original task, reads the exact source and displays the single unopened-for-write diff');

  await app.close();app=undefined;
  const pendingData=path.join(output,'pending-data');
  fs.cpSync(data,pendingData,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
  report.pendingData=pendingData;
  report.pendingId=pending.id;
  await launch();
  await page.setViewportSize({width:1920,height:1080});
  await review().getByTestId('mock-exam-edit-approve').click();
  await until(()=>ledger().at(-1)?.state==='applied');
  await review().getByText(/已保存第 5 版/u).waitFor();
  const after=await catalog();
  assert.equal(after.summary.revision,5);
  assert.equal(after.summary.state,'draft');
  assert.equal(after.entries.find(item=>item.title===names.conflict).metadata.district,'嘉定区');
  assert.deepEqual(after.entries.filter(item=>item.title!==names.conflict),before.entries.filter(item=>item.title!==names.conflict));
  assert.deepEqual(versionLog().slice(0,versions.length),versions);
  const repeat=await page.evaluate(input=>window.omniEdu.decideMockExamEdit(input),{schemaVersion,sessionId,id:pending.id,fingerprint:pending.fingerprint,action:'approve'});
  assert(repeat.ok&&repeat.value.appliedRevision===5&&versionLog().length===versions.length+1);
  assert.equal((await app.evaluate(()=>globalThis.mockExamEdit.requests)).length,0);
  const recovered=sql("SELECT event_json FROM xiaozhi_event_journal WHERE json_extract(event_json,'$.kind')='recovery'")
    .flatMap(row=>JSON.parse(row.event_json).recovery?.receipts||[]);
  assert(recovered.some(item=>item.callId==='mock-edit-apply-1'&&item.disposition==='recorded'));
  check('Cold pending approval applies one draft, preserves previous versions and untouched entries, and does not replay the model');

  const revise='只修改这份模考汇编，把这份二模试卷的区改回闵行区。';
  await send('reject',revise);
  await review().getByTestId('mock-exam-edit-reject').click();
  await until(()=>ledger().at(-1)?.state==='rejected');
  assert.equal((await catalog()).summary.revision,5);
  await send('restricted','只修改这份模考汇编，重新收录禁止使用的徐汇乙卷。');
  await send('permission','只修改这份模考汇编，把嘉定二模的使用许可改为允许。');
  assert.equal(ledger().length,2);
  check('Rejecting a proposal creates no version, and model tools cannot grant permission or re-include restricted material');

  await send('source',revise);
  const [document]=sql('SELECT local_path FROM teacher_resources WHERE original_file_name=?',[names.conflict]);
  assert(path.resolve(document.local_path).startsWith(data+path.sep));
  const bytes=fs.readFileSync(document.local_path);
  try{
    fs.appendFileSync(document.local_path,Buffer.from('\n% test version changed\n'));
    await review().getByTestId('mock-exam-edit-approve').click();
    await until(()=>ledger().at(-1)?.state==='conflict');
    assert.equal((await catalog()).summary.revision,5);
  }finally{fs.writeFileSync(document.local_path,bytes);}
  await send('version',revise);
  const current=await catalog();
  const confirmed=await page.evaluate(input=>window.omniEdu.confirmMockExamCatalog(input),{schemaVersion:catalogSchema,sessionId,id:catalogId,
    revision:current.summary.revision,digest:current.summary.digest,
    changes:current.entries.map(({resourceId,metadata,include,permission})=>({resourceId,metadata,include,permission}))});
  assert(confirmed.ok&&confirmed.value.summary.revision===6);
  await review().getByTestId('mock-exam-edit-approve').click();
  await until(()=>ledger().at(-1)?.state==='conflict');
  assert.equal((await catalog()).summary.revision,6);
  check('Source drift and a concurrent confirmation both settle as conflicts without changing the latest catalogue');

  await send('stop',revise,{settle:false});
  await until(async()=>await app.evaluate(()=>globalThis.mockExamEdit.requests.some(item=>item.stalled)));
  await page.getByRole('button',{name:/^停止/u}).click();
  await until(()=>ledger().at(-1)?.state==='interrupted');
  await until(()=>sql('SELECT status FROM ai_agent_runs WHERE id=?',[ledger().at(-1).run_id])[0]?.status==='blocked');
  await page.getByRole('button',{name:'发送消息',exact:true}).waitFor();
  assert.equal((await catalog()).summary.revision,6);
  check('Stop interrupts an already stored review from the cancelled run');

  await send('generate','新建另一份 2025 年上海各区初三数学模考试卷年度目录。');
  await send('ambiguous','修改《2025 年上海模考 · 九年级 · 数学 · 汇编》中的二模试卷。');
  assert.deepEqual(ledger().map(row=>row.state),['applied','rejected','conflict','conflict','interrupted']);
  assert.equal((await catalog()).summary.revision,6);
  assert.deepEqual(report.errors,[]);
  check('Two same-title catalogues require explicit selection without a new proposal');
  report.ok=true;
}catch(error){
  report.errors.push(String(error?.stack||error));process.exitCode=1;console.error(error);
  if(app)report.wire=await app.evaluate(()=>globalThis.mockExamEdit).catch(()=>undefined);
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(output);
}
