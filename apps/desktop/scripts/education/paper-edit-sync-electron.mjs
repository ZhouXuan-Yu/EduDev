import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {exportSelectedPaper} from './paper-selected-export-scenario.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance,'Use an owned acceptance directory');
const output=fs.mkdtempSync(path.join(acceptance,'paper-edit-sync-'));
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const data=path.join(output,'data'),profile=path.join(output,'profile');
const restoreMode=process.argv.includes('--restore');
const exportMode=process.argv.includes('--export-selected');
const requirementsMode=process.argv.includes('--requirements');
assert(!requirementsMode||!exportMode);
const destination=path.join(output,'delivered');
if(exportMode)fs.mkdirSync(destination);
const report={ok:false,output,main,checks:[],errors:[],paidRequests:0};
const blueprint={title:'等式课堂练习卷',subject:'数学',grade:'初二',durationMinutes:20,totalPoints:5,mode:'source_only',
  sections:[{id:'one',label:'一元一次方程',questionType:'解答题',count:1,points:5,
    ...(requirementsMode?{difficulty:'medium',knowledgePoint:'一元一次方程'}:{})}]};
let app,page,sessionId;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
async function until(read,timeout=90000){
  const end=Date.now()+timeout;
  while(Date.now()<end){const value=await read();if(value)return value;await new Promise(resolve=>setTimeout(resolve,150));}
  throw Error('Paper edit readback timed out');
}
const query=(sql,params=[])=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(sql).all(...params);}finally{db.close();}
};
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
const call=(name,input)=>page.evaluate(({name,input})=>window.omniEdu[name](input),{name,input});
const candidate=id=>query('SELECT * FROM ai_confirmation_items WHERE id=?',[id])[0];

async function launch(cold=false){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-paper-edit-only',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,cwd:desktop,timeout:60000});
  await app.evaluate(({net,dialog},{blueprint,cold,exportMode,requirementsMode,destination})=>{
    if(exportMode)dialog.showOpenDialog=async()=>({canceled:false,filePaths:[destination]});
    globalThis.paperEditRequests=[];
    net.fetch=async(raw,init)=>{
      const url=new URL(typeof raw==='string'?raw:raw.url);
      if(url.origin!=='https://api.deepseek.com')throw Error('External request blocked');
      if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}]}),{headers:{'content-type':'application/json'}});
      if(cold||url.pathname!=='/v1/chat/completions')throw Error('Unexpected model dispatch');
      const index=globalThis.paperEditRequests.length;
      const body=JSON.parse(init.body),tools=body.tools?.map(tool=>tool.function.name);
      let offer=index===0?{name:'find_education_tools',args:{query:'education_propose_paper 按蓝图题库组卷'}}:index===1?{name:'education_propose_paper',args:blueprint}:undefined;
      if(requirementsMode&&index===1)offer.args={...blueprint,totalPoints:8,sections:[{...blueprint.sections[0],points:8}]};
      if(requirementsMode&&index===2){
        if(!JSON.stringify(body.messages.at(-1)).includes('task_paper_requirements_points'))throw Error('Missing recoverable task admission reason');
        offer={name:'education_propose_paper',args:blueprint};
      }
      if(index===(requirementsMode?3:2)){
        const previous=body.messages.filter(message=>message.role==='tool').at(-1);
        const content=typeof previous?.content==='string'?previous.content:previous?.content?.map(part=>part.text||'').join('\n');
        const confirmed=JSON.parse(content.split('\n')[0]);
        if(!confirmed.success||!/^xipaper_[a-f0-9-]{36}$/.test(confirmed.paperId)||!/^[a-f0-9]{64}$/.test(confirmed.digest))throw Error('Confirmation omitted the stable paper reference');
        globalThis.paperConfirmedReference={paperId:confirmed.paperId,digest:confirmed.digest};
      }
      if(exportMode&&index>=3){
        const step=(index-3)%4,audience=index<7?'teacher':'student',file=`${blueprint.title}-${audience}.docx`;
        if(step===0)offer={name:'find_education_tools',args:{query:'education_export_paper 导出确认试卷'}};
        if(step===1){
          const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
          const line=system.split('\n').findLast(l=>l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
          const task=line?JSON.parse(line):{requirementsVersion:1,revision:0};
          offer={name:'update_task_plan',args:{schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:task.revision,requirementsVersion:task.requirementsVersion,reason:'导出教师点选的试卷版本',
            steps:[{id:'save',text:'保存点选的试卷',dependsOn:[],reported:'pending',kind:'saved_office',target:file},
              {id:'review',text:'教师核对文件',dependsOn:['save'],reported:'pending',kind:'human'}]}};
        }
        if(step===2)offer={name:'education_export_paper',args:{taskStepId:'save',format:'docx',audience,path:file}};
      }
      globalThis.paperEditRequests.push(offer?.name??'reply');
      if(index>(exportMode?10:requirementsMode?3:2)||(offer&&!tools?.includes(offer.name)))throw Error(`Unexpected paper route: ${offer?.name??index}`);
      const chunk=(delta,finish_reason=null)=>`data: ${JSON.stringify({id:'owned-paper-edit',object:'chat.completion.chunk',created:0,model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})}\n\n`;
      const delta=offer?{tool_calls:[{index:0,id:`owned-paper-${index}`,type:'function',function:{name:offer.name,arguments:JSON.stringify(offer.args)}}]}:{content:'试卷已按教师确认保存在本机。'};
      return new Response(chunk({role:'assistant'})+chunk(delta)+chunk({},offer?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
    };
  },{blueprint,cold,exportMode,requirementsMode,destination});
  page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
  await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
  await assertIsolatedPiMain(app,main,profile);
  const active=await page.locator('.office-composer-container').getAttribute('data-session-id');
  assert(!sessionId||active===sessionId);sessionId=active;
}

async function openCard(card){
  const trigger=card.locator('[data-slot="chat-tool-trigger"]');
  await trigger.waitFor();
  const button=card.getByTestId('pi-paper-preview');
  if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
  await button.click();
}
const closeReview=()=>page.getByTestId('pi-paper-dialog').getByRole('button',{name:'关闭',exact:true}).click();

try{
  await launch();
  await call('createQuestionBankItem',{subject:'数学',grade:'初二',knowledgePoint:'一元一次方程',questionType:'解答题',
    stem:'解方程 3x + 7 = 25，并写出等式两边同时减 7 的步骤。',answer:'x = 6',analysis:'两边减 7 后得到 3x = 18，再除以 3。',sourceKind:'teacher_resource',
    ...(requirementsMode?{difficulty:'medium'}:{})});
  const questions=query('SELECT * FROM question_bank_items');
  const prompt=requirementsMode
    ?'请从题库组卷，做一份初二数学练习卷。共1题，总分五分，限时20分钟，必选知识点：一元一次方程，难度比例易:中:难=0:1:0。等待我预览确认。'
    :'请实际调用 education_propose_paper 按下面蓝图做纯题库组卷，等待我预览确认，不要导出。蓝图：'+JSON.stringify(blueprint);
  await page.getByTestId('office-prompt-input').fill(prompt);
  await page.getByTestId('office-prompt-input').press('Enter');
  const source=await until(()=>query("SELECT * FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' AND status='pending'")[0]);
  report.sourceId=source.id;report.sessionId=sessionId;
  const card=()=>page.locator(`[data-testid="pi-paper-review"][data-paper-id="${source.id}"]`);
  await openCard(card());
  if(requirementsMode){
    const details=page.getByTestId('paper-fulfillment-details');
    await details.getByRole('button',{name:'蓝图配额与实际选题'}).click();
    assert.match(await details.getByTestId('paper-fulfillment-difficulty').innerText(),/中等 1 题/);
    assert.match(await details.getByTestId('paper-fulfillment-section').innerText(),/解答题 1 \/ 1.*中等 1 \/ 1/);
    assert.equal(query("SELECT COUNT(*) AS count FROM ai_confirmation_items WHERE action_type='pi_paper_candidate'")[0].count,1);
    for(const [width,height] of [[1366,768],[1920,1080]]){
      await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
      await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
      await details.getByTestId('paper-fulfillment-difficulty').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`paper-requirements-${width}x${height}.png`),animations:'disabled'});
    }
    check('Typed five-point teacher intent blocks the eight-point model attempt and displays the corrected paper checks');
  }
  await page.getByTestId('pi-paper-dialog').getByTestId('paper-confirm').click();
  await page.getByTestId('paper-confirmed').waitFor();
  await closeReview();await until(async()=>!(await snapshot()).running);
  const original=candidate(source.id);
  assert.equal(original.status,'confirmed');
  assert.deepEqual(await app.evaluate(()=>globalThis.paperConfirmedReference),{paperId:source.id,digest:JSON.parse(original.result_json).digest});
  assert.deepEqual(await app.evaluate(()=>globalThis.paperEditRequests),['find_education_tools','education_propose_paper',...(requirementsMode?['education_propose_paper']:[]),'reply']);
  check('Original Pi task and explicit teacher approval save the five-point source paper');

  const schemaVersion='xiaozhi.paper-basket.v2';
  const stale=await call('importPaperToBasketV2',{schemaVersion,sessionId,paperId:source.id,paperRevision:1,requestId:randomUUID()});
  assert(stale.ok,JSON.stringify(stale));
  await openCard(card());await page.getByTestId('paper-edit-whole').click();
  await page.getByTestId('paper-basket-organizer').waitFor();
  await page.getByTestId('paper-entry-points').fill('7');
  await page.getByTestId('paper-entry-points-save').click();
  await until(()=>query("SELECT data_json FROM paper_baskets WHERE session_id=? ORDER BY rowid DESC LIMIT 1",[sessionId])
    .some(row=>JSON.parse(row.data_json).blueprint.totalPoints===7));
  await until(async()=>!await page.getByTestId('paper-basket-stage-preview').isDisabled());
  await page.getByTestId('paper-basket-stage-preview').click();
  await page.getByTestId('paper-basket-confirm-all').click();
  const returnAction=page.getByTestId('paper-basket-source-chat');await returnAction.waitFor();
  const edited=await until(()=>query("SELECT paper_id FROM paper_basket_operations WHERE operation_kind='domain:confirm-paper' ORDER BY rowid DESC LIMIT 1")[0]?.paper_id);
  report.editedId=edited;
  assert.notEqual(edited,source.id);
  const raced=await call('confirmPaperBasketV2',{schemaVersion,sessionId,basketId:stale.value.id,expectedRevision:stale.value.revision,requestId:randomUUID()});
  assert.deepEqual(raced,{ok:false,error:'conflict'});
  assert.deepEqual(candidate(source.id),original);
  assert.deepEqual(query('SELECT * FROM question_bank_items'),questions);
  check('A seven-point edit is confirmed via the existing editor, and a competing draft cannot overwrite the source or edited paper');

  await returnAction.click();
  await until(async()=>await card().getAttribute('data-current-paper-id')===edited);
  const sameSession=await call('createPaper',{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId,requestId:randomUUID(),blueprint:{...blueprint,title:'同会话无关卷'}});
  assert(sameSession.ok,JSON.stringify(sameSession));
  const unrelated=await call('decidePaper',{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId,id:sameSession.value.id,revision:1,action:'confirm'});
  assert(unrelated.ok,JSON.stringify(unrelated));
  await openCard(card());
  const dialog=page.getByTestId('pi-paper-dialog');
  await dialog.waitFor();assert.equal(await dialog.getAttribute('data-paper-id'),edited);
  assert.match(await dialog.getByTestId('paper-summary').innerText(),/7\s*\/\s*7 分/);
  await closeReview();
  await card().getByTestId('pi-paper-versions').getByRole('button',{name:'试卷版本',exact:true}).click();
  await card().getByTestId('pi-paper-history-open').click();
  await dialog.getByTestId('paper-review-historical').waitFor();
  assert.equal(await dialog.getAttribute('data-paper-id'),source.id);
  assert.match(await dialog.getByTestId('paper-summary').innerText(),/5\s*\/\s*5 分/);
  assert.equal(await dialog.getByTestId('paper-edit-whole').count(),0);
  check('Returning to the original conversation opens the exact edited paper and the independent read-only original');
  let currentId=edited;
  if(restoreMode){
    const confirmed=()=>query("SELECT * FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' AND status='confirmed' ORDER BY rowid");
    const before=confirmed();
    await dialog.getByTestId('paper-restore-draft').click();
    await page.getByTestId('paper-basket-organizer').waitFor();
    await page.getByTestId('paper-basket-stage-preview').click();
    await page.getByTestId('paper-basket-restore-note').waitFor();
    assert.deepEqual(confirmed(),before);
    await page.getByTestId('paper-basket-confirm-all').click();
    await page.getByTestId('paper-basket-source-chat').waitFor();
    const restored=await until(()=>confirmed().length===before.length+1&&confirmed().at(-1));
    currentId=restored.id;report.restoredId=currentId;
    assert.equal(JSON.parse(restored.payload_json).input.blueprint.totalPoints,5);
    assert.deepEqual(confirmed().slice(0,-1),before);
    await page.getByTestId('paper-basket-source-chat').click();
    await until(async()=>await card().getAttribute('data-current-paper-id')===currentId);
    assert.equal((await snapshot()).paperReviews.find(paper=>paper.id===currentId)?.restoredFrom,source.id);
    await openCard(card());
    await dialog.waitFor();assert.equal(await dialog.getAttribute('data-paper-id'),currentId);
    assert.match(await dialog.getByTestId('paper-summary').innerText(),/5\s*\/\s*5 分/);
    await closeReview();
    const versions=card().getByTestId('pi-paper-versions');
    if(!await versions.getByTestId('pi-paper-restored').isVisible())await versions.locator('summary').click();
    assert.match(await versions.getByTestId('pi-paper-restored').innerText(),/原版/);
    await versions.locator(`[data-paper-id="${edited}"]`).click();
    await dialog.getByTestId('paper-review-historical').waitFor();
    assert.match(await dialog.getByTestId('paper-summary').innerText(),/7\s*\/\s*7 分/);
    check('A historical paper returns as a teacher-confirmed new version; both earlier papers stay unchanged and readable');
  }
  await closeReview();

  if(exportMode){
    assert(!restoreMode);
    report.files=await exportSelectedPaper({page,app,open:()=>openCard(card()),edited,sessionId,snapshot,query,until,check,destination,output});
  }

  await app.close();app=undefined;await launch(true);
  assert((await snapshot()).paperReviews.some(paper=>paper.id===sameSession.value.id));
  if(exportMode){
    const persisted=query("SELECT file_name,file_size,file_path FROM document_artifacts WHERE status='exported' ORDER BY file_name");
    const catalog=Object.fromEntries(persisted.map(row=>[row.file_name,{size:row.file_size,path:row.file_path}]));
    assert.deepEqual(catalog,Object.fromEntries(report.files.map(file=>[file.name,{size:file.size,path:path.join(destination,file.name)}])));
    assert.deepEqual(await app.evaluate(()=>globalThis.paperEditRequests),[]);
    assert.deepEqual(report.errors,[]);
    check('Both exact exports remain in the artifact catalog after cold restart without model replay');
  }else{
  await page.getByTestId('pi-aside-toggle').click();
  const aside=page.getByTestId('pi-context-paper');await aside.waitFor();
  assert.equal(await aside.getAttribute('data-paper-id'),currentId);
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
    await aside.getByTestId('pi-context-paper-preview').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,`paper-edit-context-${width}x${height}.png`),animations:'disabled'});
  }
  await aside.getByTestId('pi-context-paper-preview').click();
  const coldDialog=page.getByTestId('pi-paper-dialog');
  await coldDialog.waitFor();assert.equal(await coldDialog.getAttribute('data-paper-id'),currentId);
  assert.deepEqual(await app.evaluate(()=>globalThis.paperEditRequests),[]);
  assert.deepEqual(report.errors,[]);
  check('Cold task context follows the actual edit lineage despite a later unrelated confirmed paper and without replay');
  }
  report.ok=true;
}catch(error){report.error=String(error.stack);console.error(report.error);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
