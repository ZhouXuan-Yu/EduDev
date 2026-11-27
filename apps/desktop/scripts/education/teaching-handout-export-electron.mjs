import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {physicsHandout,physicsNotation} from './live-physics-handout-fixture.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT,fixture=process.env.OMNI_EDU_HANDOUT_FIXTURE;
assert(root&&fixture,'Use the fixed acceptance directory and a confirmed synthetic handout fixture');
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
const {bookId,sessionId}=baseline;
assert(baseline.ok&&bookId&&sessionId);
const title=baseline.title??'等式变形分层学案';
const physics=title===physicsHandout.title;
const filePrefix=physics?'浮力与物体浮沉':'等式变形学案';
const generatedFixture=process.argv.includes('--generated-fixture');
const liveExport=process.argv.includes('--live-export');
const apiKey=liveExport?process.env.DEEPSEEK_API_KEY:'synthetic-teaching-handout-export';
assert(apiKey,'A configured test model is required');
const output=fs.mkdtempSync(path.join(root,'handout-export-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const oldData=path.join(fixture,'data'),wal=path.join(oldData,'app.db-wal');
assert(!fs.existsSync(wal)||fs.statSync(wal).size===0);
fs.cpSync(oldData,data,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,output,bookId,sessionId,main,sha256:sha(main),paidRequests:0,checks:[],errors:[]};
const lanes={
  bundle:{user:`把已确认的《${title}》导出为学生版和教师版 Word 文件，两个文件一次确认保存。`,outputs:[
    {audience:'student',path:`${filePrefix}-学生版.docx`},{audience:'teacher',path:`${filePrefix}-教师版.docx`}]},
  single:{user:`把已确认的《${title}》单独导出为学生版 Word 并确认保存。`,outputs:[{audience:'student',path:'独立学生版.docx'}]},
  changed:{user:`再次导出已确认的《${title}》为教师版 Word，先等我确认保存。`,outputs:[{audience:'teacher',path:'过期来源不应保存.docx'}]},
};
let app,page;

function sql(query,args=[],changes=false){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:!changes});
  try{
    db.exec('PRAGMA busy_timeout=5000');
    return changes?db.prepare(query).run(...args):db.prepare(query).all(...args);
  }finally{db.close();}
}
function check(name,details={}){report.checks.push({name,...details});console.log('PASS '+name);}
async function until(read,timeout=75000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const value=await read();
    if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  throw Error('Timed out while waiting for Electron or SQLite');
}
async function launch(cold=false){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_API_KEY:apiKey,DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  await app.evaluate(({net},{cold,liveExport,title})=>{
    globalThis.handoutExportTest={cold,requests:[],errors:[]};
    const remote=net.fetch.bind(net);
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models'){
        return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),
          {headers:{'content-type':'application/json'}});
      }
      const state=globalThis.handoutExportTest;
      try{
        if(cold||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')throw Error('Unexpected external dispatch');
        const {phase,lane}=state,body=JSON.parse(init.body),index=state.index++;
        if(liveExport){
          if(state.requests.length>=10)throw Error('Live handout export exceeds the synthetic fixture limit');
          const request={phase,index,status:0};
          state.requests.push(request);
          const response=await remote(input,init);
          request.status=response.status;
          return response;
        }
        const raw=body.messages.findLast(message=>message.role==='tool')?.content;
        const text=typeof raw==='string'?raw:raw?.map(part=>part.text||'').join('\n');
        let previous={};
        if(index>0&&text){
          const json=text.split('\n').find(line=>line.startsWith('{'));
          try{previous=JSON.parse(json??'');}catch{previous={unparsed:text};}
        }
        const system=body.messages.filter(message=>message.role==='system').map(message=>message.content).join('\n');
        const active=system.split('\n').findLast(line=>line.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
        const task=active?JSON.parse(active):{requirementsVersion:Number([...system.matchAll(/"requirementsVersion":(\d+)/gu)].at(-1)?.[1]||1),revision:0};
        let call,content;
        if(index===0)call={name:'education_read_teaching_handout',args:{title}};
        else if(index===1){
          if(!previous.success||!previous.teacherConfirmed)throw Error('Confirmed handout was unavailable: '+JSON.stringify(previous));
          state.ref={bookId:previous.bookId,versionId:previous.versionId,digest:previous.digest};
          const grouped=lane.outputs.length===2;
          call={name:'update_task_plan',args:{schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,
            expectedRevision:task.revision,reason:'按本次实读确认版本输出讲义',steps:[{id:'deliver',text:'保存老师指定受众的讲义',
              dependsOn:[],reported:'pending',kind:grouped?'saved_bundle':'saved_office',target:grouped?'current':lane.outputs[0].path},
            {id:'review',text:'教师核对讲义与受众',dependsOn:['deliver'],reported:'pending',kind:'human'}]}};
        }else if(index===2&&phase!=='changed'){
          const outputs=phase==='bundle'
            ?lane.outputs.map((file,index)=>({...file,path:lane.outputs[1-index].path}))
            :lane.outputs.map(file=>({...file,audience:'teacher'}));
          call={name:'education_export_teaching_handout',args:{...state.ref,outputs,taskStepId:'deliver'}};
        }else if(index===(phase==='changed'?2:3)){
          if(phase!=='changed'){
            const expected=phase==='bundle'?'task_handout_audience_filename_conflict':'task_handout_audience_mismatch';
            if(previous.reason!==expected||previous.delivery!=='not_delivered')
              throw Error('Unexpected handout audience result: '+JSON.stringify(previous));
          }
          call={name:'education_export_teaching_handout',args:{...state.ref,outputs:lane.outputs,taskStepId:'deliver'}};
        }else content=previous.success?'已保存对应的 Word 讲义。':'没有生成新文件，需重新核对讲义来源。';
        if(call&&!body.tools?.some(tool=>tool.function.name===call.name))throw Error('Tool not exposed: '+call.name);
        state.requests.push({phase,index,tool:call?.name,previous});
        const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'handout-export',object:'chat.completion.chunk',
          created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
        const update=call?{tool_calls:[{index:0,id:'handout-export-'+phase+'-'+index,type:'function',
          function:{name:call.name,arguments:JSON.stringify(call.args)}}]}:{content};
        return new Response(chunk({role:'assistant',content:''})+chunk(update)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',
          {headers:{'content-type':'text/event-stream'}});
      }catch(error){state.errors.push(String(error));throw error;}
    };
  },{cold,liveExport,title});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
  await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
const ledger=()=>sql("SELECT relative_path,state,draft_json,result_path,artifact_id FROM xiaozhi_pi_office_drafts WHERE format='docx'");
const facts=()=>sql('SELECT id,file_path,content_hash FROM document_artifacts WHERE session_id=?',[sessionId]);
async function readyApproval(button){
  await until(async()=>{
    const [run]=sql('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1');
    assert.notEqual(run?.status,'failed',run?.error_message);
    return await button.isVisible()&&!await button.isDisabled();
  },90000);
}
async function send(phase){
  await until(async()=>!(await snapshot()).running&&!await page.getByTestId('office-prompt-input').isDisabled());
  const lane=lanes[phase];
  await app.evaluate((_electron,params)=>Object.assign(globalThis.handoutExportTest,{...params,index:0}),{phase,lane});
  await page.getByTestId('office-prompt-input').fill(lane.user);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
}
async function settle(){
  await until(async()=>!(await snapshot()).running);
  const wire=await app.evaluate(()=>globalThis.handoutExportTest);
  assert.deepEqual(wire.errors,[]);
  return wire;
}
function docx(file){
  const result=spawnSync('python',['-c',`
import json,sys,zipfile,xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
 r=ET.fromstring(z.read('word/document.xml'))
 w={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
 print(json.dumps({'text':'\\n'.join(t.text or '' for t in r.findall('.//w:t',w)),'formulas':[p.get('descr') for p in r.findall('.//wp:docPr',w)],'page':list(r.find('.//w:pgSz',w).attrib.values())},ensure_ascii=True))
`,file],{encoding:'utf8'});
  assert.equal(result.status,0,result.error?.message||result.stderr);
  return JSON.parse(result.stdout);
}

try{
  const sources=sql('SELECT id,local_path FROM teacher_resources');
  for(const source of sources){
    const location=path.relative(oldData,source.local_path);
    assert(location&&!location.startsWith('..')&&!path.isAbsolute(location));
    const local=path.join(data,location);
    assert(fs.existsSync(local));
    sql('UPDATE teacher_resources SET local_path=? WHERE id=?',[local,source.id],true);
  }
  const [version]=sql("SELECT id,digest FROM teaching_book_versions WHERE book_id=? AND kind='confirmed' ORDER BY revision DESC LIMIT 1",[bookId]);
  assert(version);
  await launch();
  await page.setViewportSize({width:1366,height:768});
  await send('bundle');
  const bundle=page.getByTestId('pi-delivery-bundle').last(),approve=bundle.getByTestId('pi-delivery-approve');
  await readyApproval(approve);
  assert.equal(await bundle.getByTestId('pi-delivery-file').count(),2);
  assert.equal(await bundle.getByTestId('pi-office-approve').count(),0);
  assert.equal(facts().length,0);
  for(const row of ledger()){
    assert.equal(row.state,'pending');
    const draft=JSON.parse(row.draft_json);
    assert.equal(draft.handoutSource.bookId,bookId);
    assert.equal(draft.handoutSource.versionId,version.id);
    assert.equal(draft.handoutSource.digest,version.digest);
    assert.equal(draft.handoutSource.audience,row.relative_path.includes('学生版')?'student':'teacher');
  }
  assert.equal(ledger().length,2,'The swapped names must not add approval rows.');
  await page.screenshot({path:path.join(output,'pending-1366.png'),animations:'disabled'});
  await approve.click();
  await until(()=>ledger().filter(row=>row.state==='saved').length===2);
  const bundleWire=await settle();
  if(liveExport){
    report.paidRequests=bundleWire.requests.length;
    assert(report.paidRequests>0&&bundleWire.requests.every(request=>request.status===200));
  }
  assert.equal(facts().length,2);
  const files=ledger().map(row=>{
    const saved=facts().find(item=>item.id===row.artifact_id);
    assert.equal(saved.file_path,row.result_path);
    assert.equal(saved.content_hash,sha(saved.file_path));
    return {audience:JSON.parse(row.draft_json).handoutSource.audience,path:saved.file_path,sha256:saved.content_hash,...docx(saved.file_path)};
  });
  const student=files.find(file=>file.audience==='student'),teacher=files.find(file=>file.audience==='teacher');
  for(const item of [student,teacher]){
    assert.match(item.text,/练习 1 · 基础/);
    assert.match(item.text,/练习 2 · 巩固/);
    if(physics)assert(item.formulas.some(Boolean));
    else assert(item.formulas.some(formula=>formula?.replace(/\s+/gu,'')==='5x-2=2x+7'));
    assert(item.page.includes('11906')&&item.page.includes('16838'));
  }
  if(baseline.authority){
    assert.equal(version.id,baseline.authority.confirmedVersion);
    assert.equal(version.digest,baseline.authority.verifiedDigest);
    const {required,excluded}=baseline.authority.fileExpectations;
    for(const file of [student,teacher]){
      for(const value of required)assert(file.text.includes(value),'Missing confirmed content in '+file.audience+' Word file');
      for(const value of excluded)assert(!file.text.includes(value),'Superseded content in '+file.audience+' Word file');
    }
    check('Both approved DOCX files contain the hand-edited V2 and final exercise and exclude the authorized V1 description');
  }
  assert.doesNotMatch(student.text,/答案与解析|参考资料/);
  if(physics){
    const content=file=>[file.text,...file.formulas.filter(Boolean)].map(physicsNotation).join('\n');
    for(const solution of [/(?:^|[^\d.])15(?:N|牛)/u,/(?:^|[^\d.])8(?:N|牛)/u]){
      assert.doesNotMatch(content(student),solution);
      assert.match(content(teacher),solution);
    }
  }else{
    assert(!student.formulas.some(formula=>formula?.replace(/\s+/gu,'')==='x=3'));
    assert(teacher.formulas.some(formula=>formula?.replace(/\s+/gu,'')==='x=3'));
  }
  assert.match(teacher.text,/练习 2 · 答案与解析/);
  if(!generatedFixture&&!physics){
    assert.match(student.text,/并代回/);
    assert.match(teacher.text,/并代回/);
    assert.match(student.text,/先写明使用了哪条等式性质/);
    assert.match(teacher.text,/先写明使用了哪条等式性质/);
    assert.match(teacher.text,/教师补充/);
    assert.doesNotMatch(student.text,/先两边减 3，再除以 2。/);
    assert.match(teacher.text,/先两边减 3，再除以 2。/);
  }
  report.files=files;
  check('One real approval creates two version-bound A4 Word files with editable text, intact equations and independent answer isolation');

  if(!liveExport){
    await page.setViewportSize({width:1920,height:1080});
    await send('single');
    const single=page.getByTestId('pi-office-artifact').filter({hasText:'独立学生版.docx'}).last();
    const singleApprove=single.getByTestId('pi-office-approve');
    await readyApproval(singleApprove);
    assert.equal(await single.getByRole('tab',{name:'修改拟内容'}).count(),0);
    await single.getByRole('tab',{name:'来源'}).click();
    assert.match(await single.getByTestId('pi-handout-office-source').innerText(),/已确认的讲义.*学生版/);
    assert.equal(ledger().length,3,'The unrequested teacher edition must not add an approval row.');
    assert.equal(JSON.parse(ledger().find(row=>row.relative_path==='独立学生版.docx').draft_json).handoutSource.audience,'student');
    await page.screenshot({path:path.join(output,'single-1920.png'),animations:'disabled'});
    await singleApprove.click();
    await until(()=>ledger().some(row=>row.relative_path==='独立学生版.docx'&&row.state==='saved'));
    const verifiedAudience=await settle();
    for(const [phase,reason] of [['bundle','task_handout_audience_filename_conflict'],['single','task_handout_audience_mismatch']]){
      const refused=verifiedAudience.requests.find(item=>item.phase===phase&&item.index===3).previous;
      assert.equal(refused.reason,reason);
      assert.equal(refused.delivery,'not_delivered');
      const [receipt]=sql("SELECT admitted,effect_state FROM xiaozhi_tool_receipts WHERE call_id=?",
        ['handout-export-'+phase+'-2']);
      assert.equal(receipt.admitted,0);
      assert.notEqual(receipt.effect_state,'uncertain');
    }
    check('Swapped names and an unrequested teacher edition are rejected before drafting while the same run can submit the correct files');
    check('A single audience uses the existing Office approval with visible source binding and read-only preview');

    await send('changed');
    const driftCard=page.getByTestId('pi-office-artifact').filter({hasText:'过期来源不应保存.docx'}).last();
    const driftApprove=driftCard.getByTestId('pi-office-approve');
    await readyApproval(driftApprove);
    const [origin]=sql('SELECT material_sources_json FROM teaching_handout_origins WHERE book_id=?',[bookId]);
    const [reference]=JSON.parse(origin.material_sources_json);
    const [source]=sql('SELECT id,content_md FROM resource_chunks WHERE id=?',[reference.chunkId]);
    assert(source);
    assert(sql('UPDATE resource_chunks SET content_md=? WHERE id=?',[source.content_md+'\n确认后发生的合成资料变动。',source.id],true).changes);
    await driftApprove.click();
    await until(()=>ledger().some(row=>row.relative_path==='过期来源不应保存.docx'&&row.state==='conflict'));
    const completed=await settle();
    assert.equal(facts().length,3);
    assert.equal(ledger().find(row=>row.relative_path==='过期来源不应保存.docx').result_path,null);
    assert.equal(completed.requests.find(item=>item.phase==='changed'&&item.index===3).previous.success,false);
    check('A source change after preview stops approval without a fourth file or saved fact');

    report.wire=completed.requests.map(({phase,index,tool,previous})=>({phase,index,tool,
      error:previous.error??previous.reason??null,delivery:previous.delivery??null}));
  }
  const savedBefore=facts();
  await app.close();app=undefined;
  await launch(true);
  assert.deepEqual(facts(),savedBefore);
  for(const row of savedBefore)assert.equal(sha(row.file_path),row.content_hash);
  assert.deepEqual((await app.evaluate(()=>globalThis.handoutExportTest)).requests,[]);
  assert.deepEqual(report.errors,[]);
  check('Cold data readback preserves file identities and the exact bytes without replay');
  report.ok=true;
}catch(error){
  report.errors.push(String(error?.stack||error));
  if(app)report.wire=await app.evaluate(()=>globalThis.handoutExportTest).catch(()=>null);
  if(liveExport)report.paidRequests||=report.wire?.requests.length||0;
  report.ledger=ledger().map(({draft_json,...row})=>row);
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
  console.error(error);
  process.exitCode=1;
}finally{
  if(app)await app.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(output);
}
