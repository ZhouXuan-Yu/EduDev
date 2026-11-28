import {confirmTeachingTarget} from '../acceptance/confirm-teaching-target.mjs';
import {captureTeacherAction,sizeTeacherJourney} from '../acceptance/teacher-journey-viewport.mjs';
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
const partialEdit=process.argv.includes('--partial-then-edit');
const sameSession=process.argv.includes('--two-class-tasks');
const sameTitle=sameSession&&process.argv.includes('--same-title');
const classSwitch=sameSession||process.argv.includes('--switch-before-export');
const alternateRule='青杉复核先圈后算';
if(classSwitch)assert(liveExport && baseline.authority?.confirmedVersion && baseline.authority.taskScope.classRef==='B');
if(partialEdit)assert(baseline.authority?.confirmedVersion,'This lane requires the confirmed teacher-edited fixture');
const apiKey=liveExport||partialEdit?process.env.DEEPSEEK_API_KEY:'synthetic-teaching-handout-export';
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
async function launch(cold=false,settleOnOriginal=true){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_API_KEY:apiKey,DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  await app.evaluate(({net},{cold,liveExport,title,partialPath,classSwitch,protectedTerms,alternateRule})=>{
    globalThis.handoutExportTest={cold,requests:[],errors:[]};
    if(partialPath&&!cold){
      const disk=process.getBuiltinModule('node:fs'),link=disk.linkSync;
      disk.linkSync=(temporary,target)=>{
        if(!globalThis.handoutExportTest.collision&&String(target).endsWith(partialPath)){
          disk.writeFileSync(target,'合成目标占用文件',{flag:'wx'});
          globalThis.handoutExportTest.collision=true;
        }
        return link(temporary,target);
      };
    }
    const remote=net.fetch.bind(net);
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models'){
        if(classSwitch&&!cold)return remote(input,init);
        return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),
          {headers:{'content-type':'application/json'}});
      }
      const state=globalThis.handoutExportTest;
      try{
        if((cold&&!state.liveEdit)||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')throw Error('Unexpected external dispatch');
        const {phase,lane}=state,body=JSON.parse(init.body),index=state.index++;
        if(liveExport||state.liveEdit){
          if(state.requests.length>=10)throw Error('Live handout export exceeds the synthetic fixture limit');
          const request={phase,index,status:0,model:body.model,effort:body.reasoning_effort,maxTokens:body.max_tokens};
          if(classSwitch && (phase==='alternate'||phase==='class-a-document')){
            const messages=JSON.stringify(body.messages);
            request.containsOriginal=protectedTerms.some(term=>messages.includes(term));
            if(request.containsOriginal)request.priorSourceMatches=body.messages.flatMap((message,index)=>{
              const text=JSON.stringify(message.content);
              return protectedTerms.flatMap((term,termIndex)=>{
                const offset=text.indexOf(term);
                return offset<0?[]:[{index,role:message.role,termIndex,excerpt:text.slice(Math.max(0,offset-55),offset+term.length+25)}];
              });
            });
            request.containsAlternate=messages.includes(alternateRule);
          }
          state.requests.push(request);
          const started=Date.now();
          const response=await remote(input,init);
          request.status=response.status;
          request.responseHeadersMs=Date.now()-started;
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
          if(previous.category!=='artifact_reference')throw Error('Confirmed handout did not identify its version authority');
          state.artifactCategory=previous.category;
          state.ref={bookId:previous.bookId,versionId:previous.versionId,digest:previous.digest};
          const grouped=lane.outputs.length===2;
          call={name:'update_task_plan',args:{schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,
            expectedRevision:task.revision,reason:'按本次实读确认版本输出讲义',steps:[{id:'deliver',text:'保存老师指定受众的讲义',
              dependsOn:[],reported:'pending',kind:grouped?'saved_bundle':'saved_office',target:grouped?'current':lane.outputs[0].path},
            {id:'review',text:'教师核对讲义与受众',dependsOn:['deliver'],reported:'pending',kind:'human'}]}};
        }else if(index===2&&phase!=='changed'){
          if(!previous.adopted||previous.requirementsCategory!=='task_requirement'||previous.requirementsVersion!==task.requirementsVersion)
            throw Error('The adopted task plan did not return the current requirements version');
          state.requirements={category:previous.requirementsCategory,version:previous.requirementsVersion,taskId:previous.taskId};
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
  },{cold,liveExport,title,classSwitch,alternateRule,protectedTerms:classSwitch?[...(sameTitle?[]:[title]),baseline.authority.sourceRef,...baseline.authority.selectedIds,...baseline.authority.fileExpectations.required]:[],partialPath:partialEdit?lanes.bundle.outputs[1].path:null});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
  if(settleOnOriginal)await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
  else await page.getByTestId('office-prompt-input').waitFor();
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

async function verifyPartialEdit(version){
  const bundles=()=>sql('SELECT value_json FROM xiaozhi_delivery_bundles WHERE session_id=? ORDER BY rowid',[sessionId]).map(row=>JSON.parse(row.value_json));
  const partial=await until(()=>bundles().find(row=>row.state==='partial'));
  const initial=await settle();
  assert(initial.collision);
  const [saved]=facts();assert.equal(facts().length,1);
  const savedAt=fs.statSync(saved.file_path).mtimeMs;
  assert.equal(sha(saved.file_path),saved.content_hash);
  const oldVersion=baseline.authority;
  assert.equal(version.id,oldVersion.confirmedVersion);
  const savedText=docx(saved.file_path).text;
  for(const expected of oldVersion.fileExpectations.required)assert(savedText.includes(expected));
  for(const old of oldVersion.fileExpectations.excluded)assert(!savedText.includes(old));
  const effects=()=>sql('SELECT effect_id,revision,state FROM xiaozhi_effects_v1 WHERE run_id=? ORDER BY effect_id',[partial.runId]);
  const exportEffects=effects();assert(exportEffects.length>0);
  const active=(await snapshot()).task;
  assert.equal(partial.taskVersion,active.id+':'+active.requirementsVersion);
  const occupied=path.join(path.dirname(saved.file_path),lanes.bundle.outputs[1].path);
  assert.equal(fs.readFileSync(occupied,'utf8'),'合成目标占用文件');
  check('The second destination collision preserves a real partial bundle; its one saved DOCX contains the confirmed manual revision',{version:version.id,task:active.id,bundle:partial.id,digest:saved.content_hash});
  await app.close();app=undefined;await launch(true);
  assert.deepEqual(facts(),[saved]);
  const task=(await snapshot()).task;
  assert.equal(task.id,active.id);
  const content=()=>page.evaluate(id=>window.omniEdu.getTeachingBook(id),bookId);
  const before=await content();
  const third=before.blocks.find(b=>b.metadata.handoutRole==='exercise'&&b.title.startsWith('练习 3'));
  assert(third);
  const newStem='在数轴上标出负三与正三，写出它们到原点的距离。';
  assert(!JSON.stringify(before.blocks).includes(newStem));
  await app.evaluate(()=>Object.assign(globalThis.handoutExportTest,{liveEdit:true,phase:'edit',index:0}));
  await page.getByTestId('office-prompt-input').fill('继续当前任务，只把《'+title+'》第3题的题干改为「'+newStem+'」。保持难度、答案、解析和其他块原样。已保存的文件保留原样，这次无需导出。请给我修改预览。');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const card=page.getByTestId('pi-handout-edit').last(),approve=card.getByTestId('pi-handout-edit-approve');
  await readyApproval(approve);
  await approve.click();
  const edited=await until(async()=>{const value=await content();return value.blocks.some(b=>b.id===third.id&&b.payload.text.includes(newStem))?value:null;});
  const wire=await settle();
  report.paidRequests=wire.requests.length;
  assert(wire.requests.length&&wire.requests.every(request=>request.status===200));
  assert.deepEqual(edited.blocks.filter(b=>b.id!==third.id),before.blocks.filter(b=>b.id!==third.id));
  assert.equal(edited.blocks.find(b=>b.id===third.id).title,third.title);
  assert.equal((await snapshot()).task.id,active.id);
  assert.deepEqual(facts(),[saved]);assert.equal(sha(saved.file_path),saved.content_hash);assert.equal(fs.statSync(saved.file_path).mtimeMs,savedAt);
  assert.equal(fs.readFileSync(occupied,'utf8'),'合成目标占用文件');
  assert.deepEqual(bundles(),[partial]);
  assert.deepEqual(effects(),exportEffects);
  const latest=sql('SELECT id FROM ai_agent_runs WHERE session_id=? ORDER BY rowid DESC LIMIT 1',[sessionId])[0].id;
  const actions=sql('SELECT tool FROM xiaozhi_tool_receipts WHERE run_id=?',[latest]).map(row=>row.tool);
  assert(actions.includes('education_propose_handout_edit'));
  assert(actions.every(tool=>!['education_export_teaching_handout','office_deliver_files','office_create_document'].includes(tool)));
  report.exportEffects=exportEffects;
  check('A cold continuation applies the named third-question edit in the same Task without modifying the earlier DOCX or pending delivery',{task:active.id,unchangedBlocks:before.blocks.length-1,digest:saved.content_hash});
}

async function switchClassAndReopen(version){
  const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
  await page.getByTestId('pi-new-session').click();
  const alternate=await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==sessionId?id:null;});
  const target=await confirmTeachingTarget(until,app,page,alternate,{...baseline.authority.taskScope,classRef:'A'});
  assert.notEqual(target.folder,baseline.authority.teachingTarget.folderId);
  await app.evaluate(()=>Object.assign(globalThis.handoutExportTest,{phase:'alternate',index:0}));
  const alternatePrompt='给 A 班写两句课前口算热身提示。直接在聊天里给出，不创建文件。'+(sameSession?'我们班的口算约定是“'+alternateRule+'”。':'');
  await page.getByTestId('office-prompt-input').fill(alternatePrompt);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const alternative=await until(async()=>{
    const state=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),alternate);
    const turn=state.projection.turns.at(-1);
    if(!turn||state.running)return;
    assert.equal(turn.status,'completed',turn.error);
    return state;
  });
  const wire=await app.evaluate(()=>globalThis.handoutExportTest.requests);
  assert(alternative.task?.id && alternative.memoryScope.selections.length===0);
  assert(wire.length && wire.every(call=>call.status===200 && call.containsOriginal===false));
  assert.equal(sql('SELECT COUNT(*) AS n FROM document_artifacts WHERE session_id=?',[alternate])[0].n,0);
  await app.close();app=undefined;
  await launch(false,false);
  if(await session()!==sessionId){
    const original=page.getByTestId('workbench-session-'+sessionId).filter({visible:true}).first();
    if(!await original.isVisible()){
      const folderName=await page.evaluate(async id=>(await window.omniEdu.listAiConversations()).folders.find(f=>f.id===id)?.name,
        baseline.authority.teachingTarget.folderId);
      assert(folderName);
      await page.getByRole('button',{name:folderName,exact:true}).click();
    }
    await original.click();
  }
  await until(async()=>await session()===sessionId);
  const current=await snapshot();
  assert.deepEqual(current.memoryScope.selections.map(ref=>ref.id).sort(),[...baseline.authority.selectedIds].sort());
  assert.equal(version.id,baseline.authority.confirmedVersion);
  const alternateMessage=sql("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",[alternate,alternatePrompt])[0];
  assert(alternateMessage);
  report.classSwitch={alternateSession:alternate,alternateMessage:alternateMessage.id,alternateTask:alternative.task.id,originalSession:sessionId,
    originalTask:current.task?.id,version:version.id,sourceCount:current.memoryScope.selections.length,alternateRequests:wire};
  check('An independent A-class task received no protected B material; cold return restores the original selected sources and version');
}

async function verifyTwoClassTasks(){
  const {alternateSession,alternateMessage}=report.classSwitch;
  await app.close();app=undefined;await launch();
  const before=(await snapshot()).task;
  assert.equal(before.state,'review_required');
  const relation=async taskId=>{
    const result=await page.evaluate(query=>window.omniEdu.getXiaozhiWorkbenchSummary(query),{schemaVersion:1,kind:'task_artifacts',sessionId,taskId});
    assert(result.ok && !result.value.partial);
    return result.value.items.filter(item=>item.relation==='produced').map(item=>({id:item.artifactId,version:item.version})).sort((x,y)=>x.id.localeCompare(y.id));
  };
  const bFiles=facts(),bRelations=await relation(before.id);
  assert.equal(bFiles.length,2);
  assert.deepEqual(bRelations.map(row=>row.id),bFiles.map(row=>row.id).sort());
  const review=page.getByTestId('pi-task-review').last(),toggle=review.getByTestId('pi-task-review-toggle');
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await review.getByTestId('pi-task-cancel').click();
  await review.getByTestId('pi-task-confirm-cancel').click();
  await until(async()=>(await snapshot()).task?.state==='ended');
  await confirmTeachingTarget(until,app,page,sessionId,{...baseline.authority.taskScope,classRef:'A'});
  const opening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await opening;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  await settings.getByTestId('history-settings-session').selectOption(alternateSession);
  const record=settings.getByTestId('history-settings-source-'+alternateMessage);
  await record.getByRole('button',{name:'查看来源'}).click();
  await record.getByTestId('history-settings-allow').click();
  await settings.getByTestId('history-settings-notice').getByText(/已允许查找/).waitFor();
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
  const request='为 A 班新建一份独立的课堂复核讲义，将我选择的 A 班口算约定逐字写在正文第一行，再给一条例题。请生成 Word《A班课堂复核讲义.docx》，等我确认保存。'+(sameTitle?'文档内部标题必须是《'+title+'》。':'');
  await page.getByTestId('office-prompt-input').fill(request);
  await page.getByTestId('history-lookup-open').click();
  await page.getByTestId('history-lookup-query').fill('口算约定');
  await page.getByTestId('history-lookup-search').click();
  await page.getByTestId('history-candidate-'+alternateMessage).click();
  await page.getByTestId('history-lookup-preview').getByText(new RegExp(alternateRule)).waitFor();
  await page.getByTestId('history-lookup-use').click();
  await page.getByTestId('history-intent-pending').waitFor();
  await app.evaluate(()=>Object.assign(globalThis.handoutExportTest,{phase:'class-a-document',index:0}));
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const approval=page.getByTestId('pi-office-approve').last();
  await readyApproval(approval);
  await approval.click();
  await until(()=>facts().length===3);
  const wire=await settle();
  const item=facts().find(f=>!bFiles.some(b=>b.id===f.id));
  const written=docx(item.file_path);
  assert(written.text.includes(alternateRule));
  if(sameTitle){
    assert(bFiles.some(file=>docx(file.file_path).text.includes(title)));
    assert(written.text.includes(title));
  }
  assert(baseline.authority.fileExpectations.required.every(value=>!written.text.includes(value)));
  const aTask=(await snapshot()).task;
  report.classA={taskId:aTask.id,runId:aTask.origin.runId,requests:wire.requests};
  report.paidRequests+=wire.requests.length;
  assert.notEqual(aTask.id,before.id);
  assert(wire.requests.length && wire.requests.every(call=>call.status===200 && !call.containsOriginal));
  assert(wire.requests.some(call=>call.containsAlternate));
  const aRelations=await relation(aTask.id);
  assert.deepEqual(aRelations.map(row=>row.id),[item.id]);
  const receipts=sql('SELECT run_id,source_id FROM xiaozhi_memory_reference_deliveries WHERE run_id=?',[aTask.origin.runId]);
  const allowed=sql('SELECT source_id FROM memory_source_access WHERE session_id=? AND record_id=?',[alternateSession,alternateMessage]);
  assert.equal(allowed.length,1);
  assert.deepEqual(receipts.map(r=>r.source_id),[allowed[0].source_id]);
  await app.close();app=undefined;await launch(true);
  assert.deepEqual(await relation(before.id),bRelations);
  assert.deepEqual(await relation(aTask.id),aRelations);
  assert.equal((await snapshot()).task.id,aTask.id);
  await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-my_tasks').click();
  const tasks=page.getByTestId('my-tasks-workspace');
  await tasks.getByTestId('pi-task-filter').click();
  await page.getByRole('option',{name:'全部',exact:true}).click();
  const originalTask=tasks.locator('[data-testid="pi-task-overview-row"][data-task-id="'+before.id+'"]');
  await originalTask.getByTestId('task-artifact-relations').getByRole('button',{name:'关联成果',exact:true}).click();
  const linked=originalTask.getByTestId('task-related-artifact');
  await until(async()=>await linked.count()>=bRelations.length);
  const displayedIds=await linked.evaluateAll(links=>links.map(link=>link.getAttribute('data-artifact-id')));
  assert(bRelations.every(link=>displayedIds.includes(link.id)));
  assert(!displayedIds.includes(item.id));
  assert.equal(await originalTask.getByTestId('pi-task-overview-resume').count(),0);
  await page.screenshot({path:path.join(output,'cold-original-task-relations.png')});
  for(const file of [...bFiles,item])assert.equal(sha(file.file_path),file.content_hash);
  assert.deepEqual((await app.evaluate(()=>globalThis.handoutExportTest)).requests,[]);
  report.sameSession={sessionId,sameTitle:sameTitle?title:null,bTask:before.id,aTask:aTask.id,bRelations,aRelations,receipts,requests:wire.requests,
    documents:[...bFiles,item].map(file=>({id:file.id,digest:file.content_hash}))};
  check('Two tasks in one conversation keep their class sources, approved file versions and task relations on cold reopening');
}

async function runExport(){
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
  if(classSwitch)await switchClassAndReopen(version);
  await page.setViewportSize({width:1366,height:768});
  await sizeTeacherJourney(page);
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
  const size=page.viewportSize();
  await page.screenshot({path:path.join(output,'pending-'+size.width+'.png'),animations:'disabled'});
  await captureTeacherAction(page,approve,output,'confirmed-handout-export',report);
  await approve.click();
  if(partialEdit)return verifyPartialEdit(version);
  await until(()=>ledger().filter(row=>row.state==='saved').length===2);
  const bundleWire=await settle();
  if(!liveExport)report.authorities={artifact:{category:bundleWire.artifactCategory,...bundleWire.ref},task:bundleWire.requirements};
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
}

try{
  await runExport();
  if(sameSession)await verifyTwoClassTasks();
  report.ok=true;
}catch(error){
  report.errors.push(String(error?.stack||error));
  if(app)report.wire=await app.evaluate(()=>globalThis.handoutExportTest).catch(()=>null);
  if(liveExport||report.wire?.liveEdit)report.paidRequests||=report.wire?.requests.length||0;
  report.ledger=ledger().map(({draft_json,...row})=>row);
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
  console.error(error);
  process.exitCode=1;
}finally{
  if(app)await app.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(output);
}
