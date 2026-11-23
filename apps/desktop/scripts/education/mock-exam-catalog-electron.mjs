import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(root);
const output=fs.mkdtempSync(path.join(root,'mock-exam-catalog-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),sources=path.join(output,'synthetic-pdfs');
fs.mkdirSync(sources);
const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const sha=filename=>createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const report={ok:false,output,main,mainSha256:sha(main),paidRequests:0,checks:[],errors:[]};
const schemaVersion='xiaozhi.mock-exam-compilation.v1';
const pdfText=process.argv.includes('--pdf-text');
const names={
  primary:'2025上海徐汇区初三数学一模试卷甲卷.pdf',duplicate:'2025上海徐汇区初三数学一模试卷甲卷副本.pdf',
  variant:'2025上海徐汇区初三数学一模试卷乙卷.pdf',answers:'2025上海徐汇区初三数学一模参考答案.pdf',
  conflict:'2025上海嘉定区初三数学二模试卷.'+(pdfText?'pdf':'md'),unlinked:'2025上海浦东新区初三数学二模答案.pdf',
  other:'2024上海徐汇区初三数学一模试卷.pdf',
};
let app,page,sessionId;

function sql(query,args=[]){
  const database=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{database.exec('PRAGMA busy_timeout=5000');return database.prepare(query).all(...args);}
  finally{database.close();}
}
const check=label=>{report.checks.push(label);console.log('PASS '+label);};
async function until(read,timeout=90000){
  const stop=Date.now()+timeout;
  while(Date.now()<stop){
    const result=await read();
    if(result)return result;
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('Mock exam scenario exceeded its wait');
}
async function launch(cold=false){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-shanghai-mock-paper-catalog',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  await app.evaluate(({net,dialog,shell},{cold,files})=>{
    const wire=globalThis.mockExamWire={calls:[],errors:[],located:[],cold};
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});
    shell.showItemInFolder=value=>wire.located.push(value);
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')
        return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),
          {headers:{'content-type':'application/json'}});
      try{
        if(cold||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')throw Error('Network disabled in synthetic catalogue scenario');
        const body=JSON.parse(init.body),count=wire.calls.length;
        const name='education_build_mock_exam_catalog';
        if(!body.tools?.some(tool=>tool.function.name===name))throw Error('Production catalogue tool missing');
        if(count>1)throw Error('Unexpected third model request');
        if(count){
          const content=body.messages.findLast(item=>item.role==='tool')?.content;
          const text=typeof content==='string'?content:content?.map(part=>part.text||'').join('\n');
          wire.result=JSON.parse(text.split('\n')[0]);
          if(!wire.result.success||wire.result.state!=='draft')throw Error('No durable draft '+JSON.stringify(wire.result));
        }
        wire.calls.push(count);
        const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'mock-annual-catalog',object:'chat.completion.chunk',
          created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
        const update=count?{content:'已整理本地目录，等待老师核对。'}:{tool_calls:[{index:0,id:'mock-annual-catalog-create',type:'function',
          function:{name,arguments:JSON.stringify({year:2025,subject:'数学',grade:'九年级'})}}]};
        return new Response(chunk({role:'assistant',content:''})+chunk(update)+chunk({},count?'stop':'tool_calls')+'data: [DONE]\n\n',
          {headers:{'content-type':'text/event-stream'}});
      }catch(error){wire.errors.push(String(error));throw error;}
    };
  },{cold,files:Object.values(names).map(file=>path.join(sources,file))});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
}
async function fixture(){
  const titles={
    primary:'2025年上海徐汇区九年级数学一模试卷。 计算 7+5。',
    variant:'2025年上海徐汇区九年级数学一模试卷。 计算 15+4。',
    answers:'2025年上海徐汇区九年级数学一模参考答案。 第1题 12。',
    conflict:'2025年上海闵行区九年级数学二模试卷。 第1题 12+6。',
    unlinked:'2025年上海浦东新区九年级数学二模答案。 第1题 6。',
    other:'2024年上海徐汇区九年级数学一模试卷。 计算 1+9。',
  };
  for(const [key,text] of Object.entries(titles)){
    if (key==='conflict'&&!pdfText) {
      fs.writeFileSync(path.join(sources,names[key]),`# ${text}\n`,'utf8');
      continue;
    }
    const base64=await app.evaluate(async({BrowserWindow},body)=>{
      const window=new BrowserWindow({show:false,width:800,height:900,webPreferences:{sandbox:true}});
      try{
        await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html lang="zh"><p style="font:22px Microsoft YaHei">'+body+'</p></html>'));
        return (await window.webContents.printToPDF({pageSize:'A4'})).toString('base64');
      }finally{window.destroy();}
    },text);
    fs.writeFileSync(path.join(sources,names[key]),Buffer.from(base64,'base64'));
  }
  fs.copyFileSync(path.join(sources,names.primary),path.join(sources,names.duplicate));
}
const card=()=>page.getByTestId('pi-mock-exam-catalog').last();
const review=()=>page.getByTestId('mock-exam-review').last();
const row=name=>review().getByTestId('mock-exam-row').filter({has:page.getByText(name,{exact:true})});
const apiView=()=>page.evaluate(({schemaVersion,sessionId,id})=>window.omniEdu.reviewMockExamCatalog({schemaVersion,sessionId,id}),
  {schemaVersion,sessionId,id:report.catalogId});
function settleImport(){
  return until(()=>{
    const rows=sql('SELECT id,original_file_name,content_hash,parse_status,local_path FROM teacher_resources ORDER BY rowid');
    const busy=['pending','queued','parsing','processing','indexing'];
    if(rows.length!==Object.keys(names).length||rows.some(row=>!row.content_hash||busy.includes(row.parse_status)))return;
    return rows;
  },180000);
}
try{
  await launch();
  await fixture();
  if(await page.getByTestId('ai-return-workspace').isVisible())await page.getByTestId('ai-return-workspace').click();
  await page.getByTestId('nav-knowledge').click();
  await page.getByTestId('materials-import').click();
  const materials=await settleImport();
  const source=key=>materials.find(row=>row.original_file_name===names[key]);
  assert.equal(source('primary').content_hash,source('duplicate').content_hash);
  assert.notEqual(source('primary').content_hash,source('variant').content_hash);
  await until(()=>sql("SELECT id FROM resource_chunks WHERE resource_id=? AND instr(content_md,'闵行')>0",[source('conflict').id])[0],90000);
  const pair=await page.evaluate(({paper,answers})=>window.omniEdu.setMaterialBookPair({
    schemaVersion:'xiaozhi.material-book-pair.v1',action:'link',resourceId:paper.id,version:paper.content_hash,
    revision:0,answerId:answers.id,answerVersion:answers.content_hash,
  }),{paper:source('primary'),answers:source('answers')});
  assert(pair.current&&pair.role.kind==='questions');
  await page.getByTestId('desktop-back').click();
  await until(async()=>{sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');return /^aisession_/.test(sessionId||'');});
  report.sessionId=sessionId;
  await page.setViewportSize({width:1366,height:768});
  await page.getByTestId('office-prompt-input').fill('请把本地资料库中 2025 年上海各区的初三数学模考试卷整理成年度目录。');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await until(async()=>{
    const [run]=sql('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1');
    assert.notEqual(run?.status,'failed',run?.error_message);
    return await card().isVisible();
  });
  await card().getByRole('button',{name:/年度|汇编/u}).click();
  await review().getByTestId('mock-exam-row').first().waitFor();
  const wire=await app.evaluate(()=>globalThis.mockExamWire);
  assert.deepEqual(wire.errors,[]);
  report.catalogId=sql('SELECT id FROM mock_exam_compilations')[0].id;
  const draft=await apiView();
  assert(draft.ok&&draft.value.summary.state==='draft'&&draft.value.summary.revision===1);
  assert.equal(draft.value.unlinkedAnswers,1);
  assert.equal(draft.value.entries.length,3);
  const primary=draft.value.entries.find(item=>item.title===names.primary);
  assert(primary.copies===2&&primary.answer.state==='linked'&&primary.answer.resourceId===source('answers').id);
  const uncertain=draft.value.entries.find(item=>item.title===names.conflict);
  assert(uncertain.metadata.district===null&&uncertain.conflicts.includes('district')&&uncertain.answer.state==='missing');
  if(pdfText)assert.notEqual(uncertain.structure.state,'unavailable','Parsed PDF metadata still marked as unavailable');
  await row(names.primary).getByTestId('mock-exam-original').click();
  await until(async()=>await app.evaluate(()=>globalThis.mockExamWire.located.length)===1);
  assert.equal(path.resolve((await app.evaluate(()=>globalThis.mockExamWire.located))[0]),path.resolve(source('primary').local_path));
  check('Imported real PDFs produce a task-bound draft with exact deduplication, original navigation, answer pair and explicit missing answer');

  await row(names.conflict).getByTestId('mock-exam-row-edit').click();
  await row(names.conflict).getByTestId('mock-exam-field-district').selectOption('闵行区');
  const approve=review().getByTestId('mock-exam-confirm');
  await approve.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'candidate-1366.png')});
  await approve.click();
  await until(async()=>/同一区/u.test(await review().getByTestId('mock-exam-error').innerText()));
  assert.equal(sql('SELECT COUNT(*) AS n FROM mock_exam_compilation_versions')[0].n,1);
  await row(names.variant).getByTestId('mock-exam-row-edit').click();
  await row(names.variant).getByTestId('mock-exam-include').uncheck();
  await row(names.primary).getByTestId('mock-exam-row-edit').click();
  await row(names.primary).getByTestId('mock-exam-permission').selectOption('local_only');
  await approve.click();
  await until(async()=>await review().getAttribute('data-state')==='confirmed');
  const confirmed=await apiView();
  assert(confirmed.ok&&confirmed.value.summary.revision===2&&confirmed.value.summary.count===2);
  assert(confirmed.value.entries.find(item=>item.title===names.conflict).metadata.district==='闵行区');
  assert.equal(confirmed.value.entries.find(item=>item.title===names.primary).permission,'local_only');
  assert.equal(confirmed.value.entries.find(item=>item.title===names.conflict).permission,'unknown');
  assert.equal(confirmed.value.entries.find(item=>item.title===names.variant).include,false);
  const stored=sql('SELECT revision,state,digest FROM mock_exam_compilation_versions ORDER BY revision');
  assert.deepEqual(stored.map(row=>row.state),['draft','confirmed']);
  assert.equal(stored[0].digest,draft.value.summary.digest);
  report.taskId=confirmed.value.summary.taskId;
  check('Teacher resolves conflicting metadata and duplicate editions, confirms local-use permission separately and preserves the draft version');

  const otherSession=await page.evaluate(()=>window.omniEdu.createAiConversationSession({title:'另一会话的访问校验'}));
  const denied=await page.evaluate(({schemaVersion,sessionId,id})=>window.omniEdu.reviewMockExamCatalog({schemaVersion,sessionId,id}),
    {schemaVersion,sessionId:otherSession.session.id,id:report.catalogId});
  assert(!denied.ok&&denied.error==='permission_denied');
  await page.setViewportSize({width:1920,height:1080});
  await review().getByTestId('mock-exam-revise').click();
  const paperPath=source('primary').local_path;
  assert(path.resolve(paperPath).startsWith(path.resolve(data)+path.sep));
  const original=fs.readFileSync(paperPath);
  try{
    fs.appendFileSync(paperPath,Buffer.from('\n% acceptance source changed\n'));
    await review().getByTestId('mock-exam-confirm').click();
    await until(async()=>/原件.*发生变化/u.test(await review().getByTestId('mock-exam-error').innerText()));
    assert.deepEqual(sql('SELECT revision,state,digest FROM mock_exam_compilation_versions ORDER BY revision'),stored);
  }finally{fs.writeFileSync(paperPath,original);}
  assert.equal(sha(paperPath),source('primary').content_hash);
  check('Cross-session access is denied and a changed original cannot confirm or overwrite a catalogue revision');

  const states=sql("SELECT event_json FROM xiaozhi_event_journal WHERE json_extract(event_json,'$.kind') IN ('mock_exam_catalog','recovery')");
  const parsed=states.map(row=>JSON.parse(row.event_json));
  assert(parsed.some(item=>item.kind==='mock_exam_catalog'&&item.catalog.id===report.catalogId));
  assert(parsed.flatMap(item=>item.recovery?.receipts||[]).some(item=>item.callId==='mock-annual-catalog-create'&&item.disposition==='recorded'));
  await app.close();app=undefined;
  await launch(true);
  const conversation=page.getByTestId('ai-conversation-session-'+sessionId);
  if(await conversation.isVisible())await conversation.click();
  await page.setViewportSize({width:1920,height:1080});
  await card().getByRole('button',{name:/汇编/u}).click();
  await until(async()=>await review().getAttribute('data-state')==='confirmed');
  await row(names.primary).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'confirmed-1920.png'),animations:'disabled'});
  assert.deepEqual(sql('SELECT revision,state,digest FROM mock_exam_compilation_versions ORDER BY revision'),stored);
  assert.deepEqual((await app.evaluate(()=>globalThis.mockExamWire)).calls,[]);
  assert.deepEqual(report.errors,[]);
  report.materials=materials.map(({id,original_file_name,content_hash,parse_status})=>({id,original_file_name,content_hash,parse_status}));
  check('Cold Electron reads the model-written directory, teacher revision and persisted receipt without replay');

  await review().getByTestId('mock-exam-open-workbench').click();
  const workbench=page.getByTestId('mock-exam-workspace'),detail=page.getByTestId('mock-exam-detail');
  await detail.waitFor();
  assert.equal(await detail.getAttribute('data-catalog-id'),report.catalogId);
  const titleRow=workbench.getByTestId('mock-exam-result-'+report.catalogId);
  await titleRow.waitFor();
  const search=workbench.getByTestId('mock-exam-workspace-search');
  await search.fill('2099');
  await workbench.getByText('没有匹配的汇编',{exact:true}).waitFor();
  await search.fill('2025 数学');
  await titleRow.waitFor();
  await detail.getByTestId('artifact-task-relations').locator('summary').click();
  const taskLink=detail.getByTestId('artifact-related-task');
  await taskLink.waitFor();
  assert.equal(await taskLink.getAttribute('data-task-id'),report.taskId);
  await taskLink.click();
  const taskWorkspace=page.getByTestId('my-tasks-workspace');
  await taskWorkspace.getByTestId('task-artifact-relations').locator('summary').click();
  const artifactLink=taskWorkspace.getByTestId('task-related-artifact').filter({hasText:'上海模考'});
  await artifactLink.waitFor();
  assert.equal(await artifactLink.getAttribute('data-artifact-id'),report.catalogId);
  await artifactLink.click();
  await detail.waitFor();
  await detail.getByTestId('mock-exam-origin-conversation').click();
  await page.locator('#catalog-'+report.catalogId).getByTestId('mock-exam-review').waitFor();
  const panel=page.getByTestId('xiaozhi-pi-inspector');
  if(!await panel.isVisible())await page.getByTestId('pi-aside-toggle').click();
  const panelTask=panel.getByTestId('pi-context-task');
  await panelTask.waitFor();
  assert.equal(await panelTask.getAttribute('data-task-id'),report.taskId);
  const panelCatalog=panel.getByTestId('pi-mock-exam-catalog');
  await panelCatalog.getByRole('button',{name:/汇编/u}).click();
  await panelCatalog.getByText('答案册　'+names.answers+' · 许可待核对',{exact:true}).waitFor();
  await page.getByTestId('workbench-panel-close').click();
  await page.locator('#catalog-'+report.catalogId).getByTestId('mock-exam-open-workbench').click();
  await detail.waitFor();
  check('Independent workspace search and task, catalogue and exact originating conversation navigation all preserve identity');

  const benchReview=detail.getByTestId('mock-exam-review');
  const benchRow=name=>benchReview.getByTestId('mock-exam-row').filter({has:page.getByText(name,{exact:true})});
  await benchReview.getByTestId('mock-exam-revise').click();
  await benchRow(names.conflict).getByTestId('mock-exam-row-edit').click();
  await benchRow(names.conflict).getByTestId('mock-exam-field-district').selectOption('嘉定区');
  await detail.getByTestId('mock-exam-origin-conversation').click();
  assert(await detail.isVisible());
  await benchRow(names.variant).getByTestId('mock-exam-row-edit').click();
  await benchRow(names.variant).getByTestId('mock-exam-permission').selectOption('excluded');
  await benchReview.getByTestId('mock-exam-confirm').click();
  const latest=await until(async()=>{const result=await apiView(); return result.ok&&result.value.summary.revision===3&&result.value;});
  await page.getByTestId('desktop-navigation-notice').waitFor({state:'hidden'});
  const history=benchReview.getByTestId('mock-exam-versions');
  await history.locator('summary').click();
  await history.getByTestId('mock-exam-view-version-2').click();
  const preview=history.getByTestId('mock-exam-history-preview');
  await preview.getByText(/闵行区/).waitFor();
  assert.equal(await preview.locator('select, input').count(),0);
  await page.setViewportSize({width:1366,height:768});
  const restore=preview.getByTestId('mock-exam-restore-version');
  await restore.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'history-1366.png'),animations:'disabled'});
  try{
    fs.appendFileSync(paperPath,Buffer.from('\n% acceptance history source changed\n'));
    await restore.click();
    await history.getByRole('alert').getByText(/原件.*发生变化/u).waitFor();
    assert.equal((await apiView()).value.summary.revision,3);
  }finally{fs.writeFileSync(paperPath,original);}
  await restore.click();
  const recovered=await until(async()=>{const result=await apiView();return result.ok&&result.value.summary.revision===4&&result.value;});
  assert(recovered.restoredFrom===2&&recovered.summary.state==='draft');
  assert.equal(recovered.entries.find(item=>item.title===names.conflict).metadata.district,'闵行区');
  const restricted=recovered.entries.find(item=>item.title===names.variant);
  assert.equal(restricted.permission,'excluded');
  assert.equal(restricted.include,false);
  const restoreInput={schemaVersion,sessionId,id:report.catalogId,revision:3,digest:latest.summary.digest,
    sourceRevision:2,sourceDigest:confirmed.value.summary.digest};
  const replay=await page.evaluate(input=>window.omniEdu.restoreMockExamVersion(input),restoreInput);
  assert(!replay.ok&&replay.error==='version_conflict');
  const forbidden=await page.evaluate(input=>window.omniEdu.listMockExamHistory(input),
    {schemaVersion,id:report.catalogId,sessionId:otherSession.session.id});
  assert(!forbidden.ok&&forbidden.error==='permission_denied');
  const finalHistory=sql('SELECT revision,state,digest FROM mock_exam_compilation_versions ORDER BY revision');
  assert.deepEqual(finalHistory.slice(0,2),stored);
  assert.deepEqual(finalHistory.map(item=>item.state),['draft','confirmed','confirmed','draft']);
  check('Version preview is read-only and restore creates a new pending revision, preserves use restrictions, and refuses stale or foreign requests');

  await app.close();app=undefined;
  await launch(true);
  await page.setViewportSize({width:1920,height:1080});
  await page.getByTestId('nav-teaching').click();
  await page.getByTestId('hub-entry-artifacts').click();
  await page.getByTestId('teaching-mock-exams-tab').click();
  await page.getByTestId('mock-exam-result-'+report.catalogId).getByRole('button').click();
  await page.getByTestId('mock-exam-detail').getByText('当前内容恢复自第 2 版。').waitFor();
  await page.screenshot({path:path.join(output,'workbench-1920.png'),animations:'disabled'});
  assert.deepEqual(sql('SELECT revision,state,digest FROM mock_exam_compilation_versions ORDER BY revision'),finalHistory);
  assert.deepEqual((await app.evaluate(()=>globalThis.mockExamWire)).calls,[]);
  assert.deepEqual(report.errors,[]);
  check('Teacher enters the teaching workbench from navigation after restart and reads the restored version with no model replay');
  report.ok=true;
}catch(error){
  report.errors.push(String(error?.stack||error));
  if(app)report.wire=await app.evaluate(()=>globalThis.mockExamWire).catch(()=>null);
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
  console.error(error);
  process.exitCode=1;
}finally{
  if(app)await app.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(output);
}
