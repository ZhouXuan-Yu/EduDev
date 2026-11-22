import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance,'Use an owned acceptance directory');
const output=fs.mkdtempSync(path.join(acceptance,'paper-edit-sync-'));
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const data=path.join(output,'data'),profile=path.join(output,'profile');
const report={ok:false,output,main,checks:[],errors:[],paidRequests:0};
const blueprint={title:'等式课堂练习卷',subject:'数学',grade:'初二',durationMinutes:20,totalPoints:5,mode:'source_only',
  sections:[{id:'one',label:'一元一次方程',questionType:'解答题',count:1,points:5}]};
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
  await app.evaluate(({net},{blueprint,cold})=>{
    globalThis.paperEditRequests=[];
    net.fetch=async(raw,init)=>{
      const url=new URL(typeof raw==='string'?raw:raw.url);
      if(url.origin!=='https://api.deepseek.com')throw Error('External request blocked');
      if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}]}),{headers:{'content-type':'application/json'}});
      if(cold||url.pathname!=='/v1/chat/completions')throw Error('Unexpected model dispatch');
      const index=globalThis.paperEditRequests.length;
      const tools=JSON.parse(init.body).tools?.map(tool=>tool.function.name);
      const offer=index===0?{name:'find_education_tools',args:{query:'education_propose_paper 按蓝图题库组卷'}}:index===1?{name:'education_propose_paper',args:blueprint}:undefined;
      globalThis.paperEditRequests.push(offer?.name??'reply');
      if(index>2||(offer&&!tools?.includes(offer.name)))throw Error(`Unexpected paper route: ${offer?.name??index}`);
      const chunk=(delta,finish_reason=null)=>`data: ${JSON.stringify({id:'owned-paper-edit',object:'chat.completion.chunk',created:0,model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})}\n\n`;
      const delta=offer?{tool_calls:[{index:0,id:`owned-paper-${index}`,type:'function',function:{name:offer.name,arguments:JSON.stringify(offer.args)}}]}:{content:'试卷已按教师确认保存在本机。'};
      return new Response(chunk({role:'assistant'})+chunk(delta)+chunk({},offer?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
    };
  },{blueprint,cold});
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
    stem:'解方程 3x + 7 = 25，并写出等式两边同时减 7 的步骤。',answer:'x = 6',analysis:'两边减 7 后得到 3x = 18，再除以 3。',sourceKind:'teacher_resource'});
  const questions=query('SELECT * FROM question_bank_items');
  const prompt='请实际调用 education_propose_paper 按下面蓝图做纯题库组卷，等待我预览确认，不要导出。蓝图：'+JSON.stringify(blueprint);
  await page.getByTestId('office-prompt-input').fill(prompt);
  await page.getByTestId('office-prompt-input').press('Enter');
  const source=await until(()=>query("SELECT * FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' AND status='pending'")[0]);
  report.sourceId=source.id;report.sessionId=sessionId;
  const card=()=>page.locator(`[data-testid="pi-paper-review"][data-paper-id="${source.id}"]`);
  await openCard(card());
  await page.getByTestId('pi-paper-dialog').getByTestId('paper-confirm').click();
  await page.getByTestId('paper-confirmed').waitFor();
  await closeReview();await until(async()=>!(await snapshot()).running);
  const original=candidate(source.id);
  assert.equal(original.status,'confirmed');
  assert.deepEqual(await app.evaluate(()=>globalThis.paperEditRequests),['find_education_tools','education_propose_paper','reply']);
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
  await card().getByTestId('pi-paper-versions').locator('summary').click();
  await card().getByTestId('pi-paper-history-open').click();
  await dialog.getByTestId('paper-review-historical').waitFor();
  assert.equal(await dialog.getAttribute('data-paper-id'),source.id);
  assert.match(await dialog.getByTestId('paper-summary').innerText(),/5\s*\/\s*5 分/);
  assert.equal(await dialog.getByTestId('paper-edit-whole').count(),0);
  await closeReview();
  check('Returning to the original conversation opens the exact edited paper and the independent read-only original');

  await app.close();app=undefined;await launch(true);
  assert((await snapshot()).paperReviews.some(paper=>paper.id===sameSession.value.id));
  await page.getByTestId('pi-aside-toggle').click();
  const aside=page.getByTestId('pi-context-paper');await aside.waitFor();
  assert.equal(await aside.getAttribute('data-paper-id'),edited);
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
    await aside.getByTestId('pi-context-paper-preview').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,`paper-edit-context-${width}x${height}.png`),animations:'disabled'});
  }
  await aside.getByTestId('pi-context-paper-preview').click();
  const coldDialog=page.getByTestId('pi-paper-dialog');
  await coldDialog.waitFor();assert.equal(await coldDialog.getAttribute('data-paper-id'),edited);
  assert.deepEqual(await app.evaluate(()=>globalThis.paperEditRequests),[]);
  assert.deepEqual(report.errors,[]);
  check('Cold task context follows the actual edit lineage despite a later unrelated confirmed paper and without replay');
  report.ok=true;
}catch(error){report.error=String(error.stack);console.error(report.error);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
