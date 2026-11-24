import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(root);
const output=fs.mkdtempSync(path.join(root,'scoped-catalogue-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),sources=path.join(output,'synthetic-pdfs');
fs.mkdirSync(sources);
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const live=process.argv.includes('--live');
const stableSource=process.argv.includes('--stable-source');
const apiKey=live?process.env.DEEPSEEK_API_KEY:'synthetic-catalogue-scope';
assert(apiKey);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,output,main,mainSha256:sha(main),paidRequests:0,checks:[]};
const schemaVersion='xiaozhi.mock-exam-compilation.v1';
const prompt='请把本地资料库中 2025 年上海徐汇和杨浦的初三数学一模试卷整理成目录，不要收录二模。';
const scope={year:2025,subject:'数学',grade:'九年级',districts:['徐汇区','杨浦区'],rounds:['一模']};
const items={
  held:['2025上海杨浦区初三数学一模待核卷','2025年上海闵行区九年级数学二模试卷。 第1题 计算3+5。','md'],
  uncertain:['2025上海徐汇区初三数学模拟未标轮次甲','2025年上海徐汇区九年级数学模拟试卷。 第1题 计算5+10。','md'],
  xu:['2025上海徐汇区初三数学一模甲卷','2025年上海徐汇区九年级数学一模试卷。 第1题 计算7+5。'],
  paired:['2025上海徐汇区初三数学一模参考答案','2025年上海徐汇区九年级数学一模参考答案。 第1题 12。'],
  district:['2025上海虹口区初三数学一模区外卷','2025年上海虹口区九年级数学一模试卷。 第1题 计算20+2。'],
  round:['2025上海徐汇区初三数学二模轮外卷','2025年上海徐汇区九年级数学二模试卷。 第1题 计算2+7。'],
  year:['2024上海杨浦区初三数学一模年外卷','2024年上海杨浦区九年级数学一模试卷。 第1题 计算5+3。'],
};
const filename=key=>items[key][0]+'.'+(items[key][2]??'pdf');
const files=Object.keys(items).map(key=>path.join(sources,filename(key)));
let app,page,sessionId;

function sql(query,args=[]){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:5000});
  try{return db.prepare(query).all(...args);}finally{db.close();}
}
function check(label){report.checks.push(label);console.log('PASS '+label);}
async function until(label,get,ms=90000){
  const deadline=Date.now()+ms;
  while(Date.now()<deadline){
    const value=await get();if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error('Timed out: '+label);
}
const wire=()=>app.evaluate(()=>globalThis.catalogScope);
async function launch(cold=false){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_MODEL:'deepseek-flash',DEEPSEEK_API_KEY:apiKey};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60_000});
  await app.evaluate(({net,dialog},{cold,files,live})=>{
    const state=globalThis.catalogScope={requests:[],errors:[],cold};
    const remote=net.fetch.bind(net);
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      try {
        if(url.origin!=='https://api.deepseek.com')throw Error('Unexpected external dispatch');
        if(url.pathname==='/v1/models')return Response.json({object:'list',
          data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]});
        if(cold||url.pathname!=='/v1/chat/completions'||state.requests.length>=6)throw Error('Unexpected model dispatch');
        const body=JSON.parse(init.body),index=state.requests.length,name='education_build_mock_exam_catalog';
        state.requests.push(index);
        const schema=body.tools?.find(tool=>tool.function.name===name)?.function.parameters;
        if(!schema?.properties.districts||!schema.properties.rounds)throw Error('Tool cannot represent district and round filters');
        if(live)return await remote(input,init);
        const raw=body.messages.findLast(message=>message.role==='tool')?.content;
        const text=typeof raw==='string'?raw:raw?.map(part=>part.text||'').join('\n');
        const line=text?.split('\n').find(line=>line.startsWith('{'));
        const prior=line&&JSON.parse(line);
        if(index===1&&!(prior.reason==='task_mock_exam_scope_mismatch'&&prior.delivery==='not_delivered'))
          throw Error('Wrong year was not blocked: '+JSON.stringify(prior));
        if(index===2&&!(prior.reason==='task_mock_exam_scope_mismatch'&&prior.delivery==='not_delivered'))
          throw Error('Wrong district was not blocked: '+JSON.stringify(prior));
        if(index===3&&!(prior.success&&prior.state==='draft'))throw Error('No scoped catalogue: '+JSON.stringify(prior));
        const args=[{year:2024},{year:2025,districts:['虹口区']},{year:2025}][index];
        const part=args?{tool_calls:[{index:0,id:'scope-'+index,type:'function',
          function:{name,arguments:JSON.stringify(args)}}]}:{content:'已保存指定范围的目录，等待老师核对。'};
        const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'catalog-scope',object:'chat.completion.chunk',
          created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
        return new Response(chunk({role:'assistant',content:''})+chunk(part)+chunk({},args?'tool_calls':'stop')+'data: [DONE]\n\n',
          {headers:{'content-type':'text/event-stream'}});
      }catch(error){state.errors.push(String(error));throw error;}
    };
  },{cold,files,live});
  await assertIsolatedPiMain(app,main,profile);
  page=await app.firstWindow();
  page.setDefaultTimeout(25000);
}
async function createFixtures(){
  for(const [key,[,text,ext]] of Object.entries(items)){
    if(ext==='md'){
      fs.writeFileSync(path.join(sources,filename(key)),'# '+text+'\n','utf8');
      continue;
    }
    const bytes=await app.evaluate(async({BrowserWindow},body)=>{
      const child=new BrowserWindow({show:false,webPreferences:{sandbox:true}});
      try{
        await child.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<p style="font:22px Microsoft YaHei">'+body+'</p>'));
        return (await child.webContents.printToPDF({pageSize:'A4'})).toString('base64');
      }finally{child.destroy();}
    },text);
    fs.writeFileSync(path.join(sources,filename(key)),Buffer.from(bytes,'base64'));
  }
}
const card=()=>page.getByTestId('pi-mock-exam-catalog').last();
const review=()=>card().getByTestId('mock-exam-review');
const row=key=>review().getByTestId('mock-exam-row').filter({has:page.getByText(filename(key),{exact:true})});
const read=()=>page.evaluate(input=>window.omniEdu.reviewMockExamCatalog(input),{schemaVersion,sessionId,id:report.catalogId});
try{
  await launch();await createFixtures();
  if(await page.getByTestId('ai-return-workspace').isVisible())await page.getByTestId('ai-return-workspace').click();
  await page.getByTestId('nav-knowledge').click();
  await page.getByTestId('materials-import').click();
  const materials=await until('import all paper and answer files',()=>{
    const rows=sql('SELECT id,original_file_name,content_hash,parse_status,local_path FROM teacher_resources');
    return rows.length===files.length&&rows.every(row=>row.content_hash&&!['pending','queued','parsing','processing','indexing'].includes(row.parse_status))&&rows;
  },180000);
  const material=key=>materials.find(row=>row.original_file_name===filename(key));
  if(stableSource){
    await until('included PDF and paired answer fully parsed',()=>{
      const rows=sql('SELECT parse_status FROM teacher_resources WHERE id IN (?,?)',[material('xu').id,material('paired').id]);
      return rows.length===2&&rows.every(row=>['ready','parsed','chunked','indexed'].includes(row.parse_status));
    },360000);
    // Stop the unrelated fixture files through the same control available to a teacher.
    await page.evaluate(()=>window.omniEdu.cancelMaterialImport());
    await until('PDF parsing queue finishes cancellation',()=>!sql(
      "SELECT 1 FROM ai_tasks WHERE task_type='resource_parse' AND status IN ('pending','running') LIMIT 1").length);
    report.stableSource=true;
  }
  await until('conflicting source header parsed',()=>sql(
    "SELECT id FROM resource_chunks WHERE resource_id=? AND instr(content_md,'闵行')>0",[material('held').id])[0]);
  const pair=await page.evaluate(({paper,answer})=>window.omniEdu.setMaterialBookPair({
    schemaVersion:'xiaozhi.material-book-pair.v1',action:'link',resourceId:paper.id,version:paper.content_hash,
    revision:0,answerId:answer.id,answerVersion:answer.content_hash,
  }),{paper:material('xu'),answer:material('paired')});
  assert(pair.current);
  await page.getByTestId('desktop-back').click();
  await until('original chat',async()=>{
    sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
    return /^aisession_/u.test(sessionId||'');
  });
  report.sessionId=sessionId;
  await page.setViewportSize({width:1366,height:768});
  await page.getByTestId('office-prompt-input').fill(prompt);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await until('scoped catalogue',async()=>{
    const response=await wire();
    if(response.errors.length)throw Error(response.errors.join('\n'));
    return await card().isVisible();
  });
  await card().getByRole('button',{name:/汇编/u}).click();
  const [head]=sql('SELECT id,run_id FROM mock_exam_compilations');
  report.catalogId=head.id;
  const draft=await read();
  assert(draft.ok&&draft.value.summary.state==='draft');
  assert.deepEqual(draft.value.scope,scope);
  assert.equal(draft.value.summary.count,1);
  assert.deepEqual(draft.value.entries.map(entry=>entry.title).sort(),['xu','held','uncertain'].map(filename).sort());
  assert.equal(draft.value.entries.find(entry=>entry.title===filename('xu')).answer.resourceId,material('paired').id);
  assert.equal(draft.value.entries.find(entry=>entry.title===filename('held')).include,false);
  assert.equal(draft.value.entries.find(entry=>entry.title===filename('uncertain')).include,false);
  if(!live){
    const attempts=sql("SELECT admitted FROM xiaozhi_tool_receipts WHERE run_id=? AND tool='education_build_mock_exam_catalog' ORDER BY start_sequence",[head.run_id]);
    assert.deepEqual(attempts.map(row=>row.admitted),[0,0,1]);
    assert.equal(sql('SELECT id FROM mock_exam_compilations').length,1);
    check('Wrong year and district proposals are not dispatched; omitted fields are filled from the teacher request');
  }
  check('Versioned district and round filters retain the verified pair, exclude unrelated originals and hold ambiguous entries');
  await review().getByTestId('mock-exam-scope-review').waitFor();
  await page.screenshot({path:path.join(output,'review-1366.png'),animations:'disabled'});
  const held=row('held'),approve=review().getByTestId('mock-exam-confirm');
  await held.getByTestId('mock-exam-row-edit').click();
  await held.getByTestId('mock-exam-field-district').selectOption('闵行区');
  await held.getByTestId('mock-exam-field-round').selectOption('一模');
  await held.getByTestId('mock-exam-include').check();
  await held.getByTestId('mock-exam-outside-scope').waitFor();
  for(const field of ['district','round']){
    if(field==='round'){
      await held.getByTestId('mock-exam-field-district').selectOption('杨浦区');
      await held.getByTestId('mock-exam-field-round').selectOption('二模');
    }
    const before=sql('SELECT count(*) AS n FROM mock_exam_compilation_versions')[0].n;
    await approve.click();
    await review().getByTestId('mock-exam-error').getByText(/超出当前目录范围/u).waitFor();
    assert.equal(sql('SELECT count(*) AS n FROM mock_exam_compilation_versions')[0].n,before);
  }
  await held.getByTestId('mock-exam-field-round').selectOption('一模');
  await approve.click();
  await until('teacher confirmation',async()=>(await review().getAttribute('data-state'))==='confirmed');
  const confirmed=await read();
  assert(confirmed.ok&&confirmed.value.summary.count===2&&confirmed.value.summary.revision===2);
  assert.deepEqual(confirmed.value.scope,scope);
  assert.equal(confirmed.value.entries.find(entry=>entry.title===filename('held')).answer.state,'missing');
  assert.equal(confirmed.value.entries.find(entry=>entry.title===filename('uncertain')).include,false);
  for(const source of materials)assert.equal(sha(source.local_path),source.content_hash);
  report.scope=scope;
  report.excludedTitles=['district','round','year','uncertain'].map(filename);
  check('Teacher can correct the uncertain metadata, while out-of-scope district or round is rejected without a new revision');
  await until('completed run',()=>sql("SELECT id FROM ai_agent_runs WHERE id=? AND status='succeeded'",[head.run_id])[0]);
  const result=await wire();
  assert.deepEqual(result.errors,[]);
  if(live)report.paidRequests=result.requests.length;
  await app.close();app=undefined;

  await launch(true);
  const conversation=page.getByTestId('ai-conversation-session-'+sessionId);
  if(await conversation.isVisible())await conversation.click();
  await card().getByRole('button',{name:/汇编/u}).click();
  await until('cold read',async()=>(await review().getAttribute('data-state'))==='confirmed');
  assert.deepEqual(await read(),confirmed);
  assert.deepEqual((await wire()).requests,[]);
  await page.setViewportSize({width:1920,height:1080});
  await page.screenshot({path:path.join(output,'confirmed-1920.png'),animations:'disabled'});
  check('Cold restart restores the confirmed filter scope and answer status without model replay');
  report.ok=true;
}catch(error){
  report.error=String(error.stack);
  if(app)report.wire=await wire().catch(()=>null);
  if(live&&report.wire&&!report.wire.cold)report.paidRequests=report.wire.requests.length;
  await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>undefined);
  console.error(error);process.exitCode=1;
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(output);
}
