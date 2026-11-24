import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { assertIsolatedPiMain, testMain } from '../acceptance/build-root.mjs';
import { productEntry } from '../product-navigation.mjs';
import { lessonCard, openLessonFromChat } from './teaching-lesson-task-journey.mjs';
import { lessonDocument, quote, standardA, standardB } from './teaching-lesson-fixture.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance);
const live=process.argv.includes('--live');
const apiKey=live?process.env.DEEPSEEK_API_KEY:'local-fixture-only';
assert(apiKey);
const root=fs.mkdtempSync(path.join(acceptance,'named-lesson-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const aName='观察记录A.txt',bName='补充阅读B.txt',duplicate='同名备课.txt';
const bQuote='比较两种观点并给依据';
const fixtures=[[aName,standardA],[bName,standardB],[duplicate,'备用甲'],[duplicate,'备用乙']].map(([name,text],i)=>{
  const folder=path.join(root,'fixtures',String(i));
  fs.mkdirSync(folder,{recursive:true});
  const file=path.join(folder,name);
  fs.writeFileSync(file,text);
  return file;
});
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,live,paidRequests:0,main,mainSha256:hash(main),checks:[],errors:[],root};
const prompt=`请依据资料库里的《${aName}》与《${bName}》，编写一份40分钟的五年级语文教案。主题是区分观察事实和推断。请让学生引用原文解释证据的边界。`;
let app,page;
const pass=text=>{report.checks.push(text);console.log('PASS '+text);};
function rows(sql,...args){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:5000});
  try{return db.prepare(sql).all(...args);}finally{db.close();}
}
const plans=()=>rows("SELECT * FROM ai_confirmation_items WHERE action_type='pi_classroom_plan' ORDER BY created_at,id");
async function until(get,label,ms=120000){
  const end=Date.now()+ms;
  while(Date.now()<end){
    const result=await get();
    if(result)return result;
    await new Promise(resolve=>setTimeout(resolve,180));
  }
  throw Error('Timed out: '+label);
}
async function launch(cold=false){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_MODEL:'deepseek-flash',DEEPSEEK_API_KEY:apiKey};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({dialog,net},input)=>{
    globalThis.namedBasisWire={requests:[],errors:[],paidRequests:0};
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:input.fixtures});
    const remote=net.fetch.bind(net);
    net.fetch=async(address,options)=>{
      const url=new URL(typeof address==='string'?address:address.url);
      const wire=globalThis.namedBasisWire;
      if(url.hostname==='api.deepseek.com'&&url.pathname.endsWith('/models'))
        return Response.json({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}]});
      try{
        if(input.cold||url.hostname!=='api.deepseek.com'||!url.pathname.endsWith('/chat/completions'))throw Error('Unexpected external call');
        const request=JSON.parse(options.body),stage=wire.requests.length,choice=request.tool_choice?.function?.name??request.tool_choice;
        const tools=['office_read_material','office_read_material','office_read_material','education_propose_natural_lesson','education_propose_natural_lesson','none'];
        const last=request.messages.filter(m=>m.role==='tool').at(-1)?.content;
        let receipt;
        try{receipt=JSON.parse(last?.split('\n')[0]);}catch{}
        const exposed=request.tools.map(item=>item.function?.name);
        wire.requests.push({choice,last,exposed});
        if(stage===0&&choice!=='office_read_material')throw Error('Missing source-first requirement');
        if(choice!=='none'&&(exposed.length!==1||exposed[0]!==choice))throw Error('Named lesson exposed unrelated tools during a required step');
        if(input.live){
          if(stage>=7)throw Error('Live test request ceiling');
          wire.paidRequests++;
          return remote(address,options);
        }
        if(choice!==tools[stage])throw Error('Unexpected tool choice '+choice+' for stage '+stage);
        const {sourceIds}=wire;
        let call,content='';
        if(stage===0)call={resourceId:sourceIds[0],offset:999};
        if(stage===1){
          if(receipt?.success||!last?.includes('当前任务已失效'))throw Error('Wrong anchor read was not rejected');
          call={resourceId:sourceIds[0],offset:0};
        }
        if(stage===2){
          if(receipt?.curriculum?.entry?.metadata.edition!=='A版'||!receipt.text.includes(input.quote))throw Error('Actual A excerpt required');
          call={resourceId:sourceIds[1],offset:0};
        }
        if(stage===3){
          if(receipt?.curriculum?.entry?.metadata.edition!=='B版'||!receipt.text.includes(input.bQuote))throw Error('Actual B excerpt required');
          call=structuredClone(input.draft);
          call.mappings[1].quote='这段话未在资料中出现';
        }
        if(stage===4){
          if(receipt?.success!==false||receipt.error!=='source_changed')throw Error('Invented quote was not rejected');
          call=input.draft;
        }
        if(stage===5){
          if(!receipt?.success||receipt.teacherConfirmed!==false||receipt.adopted?.length!==2)throw Error('Missing actual draft receipt');
          content='教案草稿已保存，包含两份所选资料的原文依据。请核对第三项目标和确认草稿。';
        }
        const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'basis-'+stage,object:'chat.completion.chunk',model:request.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
        const delta=call?{tool_calls:[{index:0,id:'basis-'+stage,type:'function',function:{name:choice,arguments:JSON.stringify(call)}}]}:{content};
        return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
      }catch(error){wire.errors.push(String(error));throw error;}
    };
  },{cold,live,fixtures,quote,bQuote,draft:{
    title:lessonDocument.title,totalMinutes:40,
    objectives:lessonDocument.objectives.map((goal,index)=>({goal,criterion:lessonDocument.lesson.goalCriteria[index]})),
    preparation:lessonDocument.lesson.preparation,details:lessonDocument.lesson.details,
    scenes:lessonDocument.scenes.map(({title,activity,durationMinutes},index)=>{
      const {kind,objectiveIndices,teacherPrompt,checks}=lessonDocument.lesson.phases[index];
      return {title,activity,durationMinutes,kind,objectiveIndices,teacherPrompt,checks};
    }),
    mappings:[
      {objectiveIndex:0,curriculumIndex:0,quote,explanation:'用原文观察事实解释记录中的理由。'},
      {objectiveIndex:1,curriculumIndex:1,quote:bQuote,explanation:'比较解释并引用事实支持判断。'},
    ],
  }});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  page.setDefaultTimeout(30000);
  await page.getByTestId('office-prompt-input').waitFor();
  await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled(),'chat ready after launch');
}
async function register(id,edition){
  await page.getByTestId('material-'+id).click();
  const disclosure=page.getByTestId('material-curriculum-disclosure');
  const button=disclosure.locator('button[aria-expanded]').first();
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
  await until(async()=>!await page.getByTestId('curriculum-kind').isDisabled(),'curriculum form ready');
  await page.getByTestId('curriculum-kind').selectOption('standard');
  for(const [key,value]of Object.entries({subject:'语文',stage:'小学',grade:'五年级',publisher:'合成样本',edition,region:'',unit:'阅读'}))
    await page.getByTestId('curriculum-'+key).fill(value);
  await page.getByTestId('curriculum-qualification').selectOption('synthetic');
  await page.getByTestId('curriculum-save').click();
  await until(async()=>(await page.getByTestId('curriculum-current').textContent())?.includes(edition),'saved registration');
}
const wire=()=>app.evaluate(()=>globalThis.namedBasisWire);
const input=()=>page.getByTestId('office-prompt-input');
async function send(text){
  await input().fill(text);
  await page.locator('[data-testid=office-composer] [data-slot="prompt-input-send"]').click();
}
try{
  await launch();
  await productEntry(page,'materials').click();
  await page.getByTestId('materials-import').click();
  const sources=await until(()=>{
    const list=rows('SELECT id,original_file_name,local_path,parse_status FROM teacher_resources');
    return list.length===4&&list.every(item=>item.parse_status==='ready')?list:null;
  },'four parsed text sources');
  const originals=sources.map(source=>({path:source.local_path,sha256:hash(source.local_path)}));
  const [a,b]=[aName,bName].map(name=>sources.find(source=>source.original_file_name===name));
  await page.getByTestId('materials-refresh').click();
  await register(a.id,'A版');
  await register(b.id,'B版');
  await app.evaluate((_,sourceIds)=>{globalThis.namedBasisWire.sourceIds=sourceIds;},[a.id,b.id]);
  const adopted=rows('SELECT id,resource_id FROM material_curriculum_entries');
  await productEntry(page,'ask').click();
  const ambiguous=`请依据资料库里的《${duplicate}》，编写五年级语文教案。`;
  await send(ambiguous);
  await page.getByText('本轮无法确定唯一的备课资料版本。',{exact:false}).waitFor();
  assert.equal(await input().inputValue(),ambiguous);
  await send('请依据资料库里的《未导入的资料》，编写五年级语文教案。');
  await page.getByText('本轮指定的备课依据不可用。',{exact:false}).waitFor();
  await send(`请依据资料库里的《${aName}》，编写六年级语文教案。`);
  await page.getByText('本轮指定的备课依据不可用。',{exact:false}).waitFor();
  assert.equal((await wire()).requests.length,0);
  assert.equal(plans().length,0);
  pass('Same-name, missing and wrong-grade sources show actionable feedback without requesting the model or saving a draft');

  await send(prompt);
  const row=await until(()=>{
    const plan=plans()[0];
    if(plan)return plan;
    const run=rows('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0];
    if(run&&run.status!=='running')throw Error('Run ended without saving a draft: '+run.status+' '+run.error_message);
  },'one named-source draft',180000);
  await until(async()=>!await input().isDisabled(),'Pi final state');
  const payload=JSON.parse(row.payload_json);
  assert.equal(plans().length,1);
  assert.deepEqual(payload.context.adopted.map(entry=>entry.id),[a,b].map(source=>adopted.find(entry=>entry.resource_id===source.id).id));
  assert.deepEqual(payload.context.materials.map(item=>item.source.resourceId).sort(),[a.id,b.id].sort());
  assert.deepEqual(new Set(payload.document.lesson.mappings.map(item=>item.curriculumIndex)),new Set([0,1]));
  for(const mapping of payload.document.lesson.mappings)assert([standardA,standardB][mapping.curriculumIndex].includes(mapping.quote));
  assert.equal(payload.document.totalMinutes,40);
  assert.equal(payload.document.scenes.reduce((total,scene)=>total+scene.durationMinutes,0),40);
  if(!live)assert.deepEqual(payload.document.lesson.missingSources,['目标 3 尚无直接对应的资料依据，请教师复核。']);
  report.wire=await wire();
  report.paidRequests=report.wire.paidRequests;
  assert.deepEqual(report.wire.errors,[]);
  pass('Pi reads the two current registered excerpts before proposing the editable draft, with verbatim quotation matches');

  await openLessonFromChat(page,row.id,row.id);
  const detail=page.getByTestId('classroom-plan-detail');
  assert.equal(await detail.getAttribute('data-status'),'draft');
  const section=page.getByTestId('lesson-mappings-toggle');
  const toggle=section.locator('button[aria-expanded]').first();
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  assert.match(await section.innerText(),/A版/);
  assert.match(await section.innerText(),/B版/);
  const openSource=section.getByTestId('pi-material-source-open').first();
  await openSource.click();
  await page.getByTestId('materials-chunk-'+payload.context.adopted[0].source.chunkId).waitFor();
  await productEntry(page,'ask').click();
  await openLessonFromChat(page,row.id,row.id);
  await page.getByTestId('classroom-plan-confirm').click();
  await until(async()=>await detail.getAttribute('data-status')==='confirmed','teacher confirmation');
  const before=plans();
  assert.equal(before.length,1);
  report.lesson={id:row.id,sessionId:row.session_id,runId:row.run_id};
  pass('Source link reaches the exact saved anchor and only the teacher can confirm the original draft');

  await app.close();
  app=undefined;
  await launch(true);
  await lessonCard(page,row.id).waitFor();
  await openLessonFromChat(page,row.id,row.id);
  assert.equal(await page.getByTestId('classroom-plan-detail').getAttribute('data-status'),'confirmed');
  for(const size of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},[width,height])=>BrowserWindow.getAllWindows()[0].setContentSize(width,height),size);
    await page.waitForFunction(([width,height])=>innerWidth===width&&innerHeight===height,size);
    await page.screenshot({path:path.join(root,`lesson-${size[0]}.png`)});
  }
  assert.deepEqual(plans(),before);
  for(const original of originals)assert.equal(hash(original.path),original.sha256);
  assert.deepEqual((await wire()).requests,[]);
  assert.deepEqual(report.errors,[]);
  pass('Cold restart preserves both current evidence snapshots and original file bytes with zero model replay');
  report.ok=true;
}catch(error){
  report.error=String(error.stack);
  if(app)report.failureWire=await wire().catch(()=>null);
  report.paidRequests=Math.max(report.paidRequests,report.failureWire?.paidRequests??0);
  if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
  process.exitCode=1;
}finally{
  if(app)await app.close();
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({root,ok:report.ok,checks:report.checks.length,error:report.error}));
}
