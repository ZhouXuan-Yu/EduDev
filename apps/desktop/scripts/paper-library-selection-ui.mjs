import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap,continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop=path.resolve(import.meta.dirname,'..');
assert.equal(process.argv.length,4);
assert.equal(process.argv[2],'--run-ui');
assert(process.argv[3].startsWith('--pins='));
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const pinFile=fs.realpathSync(path.resolve(desktop,process.argv[3].slice(7)));
assert(pinFile.startsWith(owned+path.sep));
const pins=JSON.parse(fs.readFileSync(pinFile));
assert(fs.realpathSync(pins.buildRoot).startsWith(owned+path.sep));
const output=fs.mkdtempSync(path.join(owned,'paper-library-selection-'));
const report={success:false,output,pins,checks:[],screens:[],errors:[],launches:[],scenarios:[],
  scope:'Actual isolated Electron. Teacher inputs and first selection use formal UI and original host. Source-change scenario uses a real typed-preload edit as a labelled concurrent writer. Lost-response seams call the original real handler before dropping exactly one transport reply. No mock success, fake OCR/AI or provider sends.'};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push(name);save();};
const verify=()=>{
  assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);
};
const env={...process.env};
for(const name of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name)||name.startsWith('OMNI_EDU_')||
  ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name))delete env[name];
Object.assign(env,{NODE_ENV:'development',OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1'});
let app,page,context;
const started=Date.now();
const deadline=setTimeout(()=>{
  report.budgetExceeded=true;save();
  if(app)spawn('taskkill.exe',['/PID',String(app.process().pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
},240000);
const read=(sql,args=[])=>{
  const db=new DatabaseSync(path.join(context.data,'app.db'),{readOnly:true});
  try{return db.prepare(sql).all(...args).map(row=>({...row}));}finally{db.close();}
};
const baskets=()=>read('SELECT id,session_id,revision,state,data_json FROM paper_baskets').map(row=>({
  ...JSON.parse(row.data_json),id:row.id,sessionId:row.session_id,revision:row.revision,state:row.state}));
async function launch(name,restart=false){
  assert(report.launches.length<13);
  if(!restart){
    const root=path.join(output,name);fs.mkdirSync(root);
    context={name,root,data:path.join(root,'data'),profile:path.join(root,'profile')};
    fs.mkdirSync(context.data);fs.mkdirSync(context.profile);
    context.bootstrap=path.join(root,'bootstrap.cjs');
    fs.writeFileSync(context.bootstrap,continuationBootstrap({main:path.join(pins.buildRoot,'main/index.js'),profile:context.profile}));
    report.scenarios.push(context);
  }
  app=await electron.launch({args:[context.bootstrap,'--user-data-dir='+context.profile,'--force-device-scale-factor=1'],
    cwd:context.root,env:{...env,OMNI_EDU_DATA_ROOT:context.data},timeout:30000});
  page=await app.firstWindow({timeout:30000});page.setDefaultTimeout(12000);
  page.on('pageerror',failure=>report.errors.push({scenario:name,type:'page',hash:sha256(String(failure))}));
  page.on('console',message=>{if(message.type()==='error')report.errors.push({scenario:name,type:'console',hash:sha256(message.text())});});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'attached'});
  report.launches.push({scenario:name,pid:app.process().pid,
    identity:await assertIsolatedPiMain(app,path.join(pins.buildRoot,'main/index.js'),context.profile)});
  await size(1366,768);
}
async function close(){
  const guard=await app.evaluate(continuationGuardRead,true);
  for(const key of ['networkAttempts','modelAttempts','rendererErrors'])assert.equal(guard[key],0);
  report.launches.at(-1).guard=guard;
  await app.close();app=undefined;
}
async function size(width,height){
  await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].setContentSize(value.width,value.height),{width,height});
  await page.waitForFunction(value=>innerWidth===value.width&&innerHeight===value.height,{width,height});
}
async function paper(){
  await productEntry(page,'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-paper').click();
  await page.getByTestId('paper-basket-stage-select').and(page.locator(':enabled')).waitFor();
}
async function createQuestion({draft=true,count=1,missingGrade=false}={}){
  await productEntry(page,'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-question_notebook').click();
  for(let index=1;index<=count;index++){
  await page.getByTestId('question-notebook-new').click();
  for(const [key,text]of Object.entries({subject:'物理',grade:missingGrade?'':'初三','knowledge-point':'电学',type:'解答题',
    stem:`首选校验 ${index}：电压10伏，电流2安，计算电阻。`,answer:'5欧',analysis:'依照欧姆定律，10 / 2 = 5欧。合成验收文字。'})){
    await page.getByTestId('question-notebook-new-'+key).fill(text);
  }
  await page.getByTestId('question-notebook-create-question').click();
  await page.getByTestId('question-notebook-stem').filter({hasText:`首选校验 ${index}：`}).waitFor();
  }
  const rows=read('SELECT * FROM question_bank_items ORDER BY id');assert.equal(rows.length,count);
  context.questions=rows;context.question=rows.find(row=>row.stem.includes('首选校验 1：'));
  await paper();
  await page.getByTestId('paper-library-query').fill('电阻');
  await add().and(page.locator(':enabled')).waitFor();
  if(draft){
    await page.getByTestId('paper-basket-new').click();await dialog().waitFor();
    await dialog().getByTestId('paper-practice-title').fill('已有教师创建草稿');
    await dialog().getByTestId('paper-practice-subject').fill('物理');
    await dialog().getByTestId('paper-practice-grade').fill('初三');
    await dialog().getByRole('button',{name:'保留输入并关闭',exact:true}).click();await dialog().waitFor({state:'hidden'});
  }
}
const add=()=>page.locator(`[data-testid="paper-library-question"][data-question-id="${context.question.id}"]`).getByTestId('paper-library-add');
const dialog=()=>page.getByTestId('paper-basket-create-dialog');
async function selectQuestion(){
  await add().click();await dialog().waitFor();
  await dialog().getByTestId('paper-library-selection-context').waitFor();
  assert.equal(await dialog().getByTestId('paper-practice-subject').inputValue(),'物理');
  assert.equal(await dialog().getByTestId('paper-practice-grade').inputValue(),'初三');
}
async function saveSelection(){
  await dialog().getByTestId('paper-basket-create').click();
}
async function added(expected=1){
  await page.waitForFunction(count=>document.querySelector('[data-testid="paper-basket-summary"]')?.textContent.startsWith(count+' 题'),expected);
  await page.waitForFunction(id=>document.querySelector(`[data-testid="paper-basket-candidate"][data-question-id="${id}"] [data-testid="paper-basket-add"]`)?.textContent.includes('已加入题篮'),context.question.id);
  await page.getByTestId('paper-library-selection-pending').waitFor({state:'hidden'});
  await page.getByTestId('paper-basket-ui-pending').waitFor({state:'hidden'});
  assert.equal(baskets().length,1);assert.equal(baskets()[0].entries.length,expected);
  assert(baskets()[0].entries.some(entry=>entry.questionId===context.question.id));
}
async function shot(name){
  const file=path.join(context.root,name+'.png');await page.screenshot({path:file});
  report.screens.push({scenario:context.name,file,sha256:sha256(fs.readFileSync(file))});
}
async function loseReply(kind){
  await app.evaluate(({ipcMain},kind)=>{
    const channel=kind==='create'?'education:paper-basket-v2-create':'education:paper-basket-v2-mutate';
    const original=ipcMain._invokeHandlers.get(channel);
    if(typeof original!=='function')throw Error('Original handler missing');
    const fault={channel,original,once:true,requests:[]};globalThis.__firstSelectionFault=fault;
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(...args)=>{
      const input=args[1];const applicable=kind==='create'||input.operation?.type==='add';
      const result=await original(...args);
      if(applicable){fault.requests.push({requestId:input.requestId,basketId:input.basketId,type:input.operation?.type,ok:result.ok});
        if(result.ok&&fault.once){fault.once=false;throw Error('QA_ORIGINAL_COMMIT_REPLY_LOST_ONCE');}}
      return result;
    });
  },kind);
}
async function faultRequests(){
  const rows=await app.evaluate(()=>globalThis.__firstSelectionFault.requests);
  assert.equal(rows.length,2);assert(rows.every(row=>row.ok));assert.equal(rows[0].requestId,rows[1].requestId);
  context.faultRequests=rows;save();
}
async function changeSource(){
  context.externalWriter=await page.evaluate(async id=>{
    const {question,version}=await window.omniEdu.getArchivedQuestionVersion(id);
    const fields=Object.fromEntries(['stem','answer','analysis','subject','grade','knowledgePoint','questionType','difficulty'].map(key=>[key,question[key]]));
    fields.stem+=' 题面已由另一写入者补正。';
    const result=await window.omniEdu.editArchivedQuestion({questionId:id,version,fields,sourceChecked:false});
    return {kind:'Real concurrent typed-preload writer',beforeVersion:version,stem:result.stem};
  },context.question.id);
}
try{
  verify();await launch('normal');await createQuestion();
  context.initialOwnerCount=read('SELECT COUNT(*) AS n FROM ai_conversation_sessions')[0].n;
  assert.equal(baskets().length,0);
  for(const [width,height]of [[1366,768],[1920,1080],[800,768]]){
    await size(width,height);const box=await add().boundingBox();
    assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
    await shot('initial-library-'+width);
  }
  await size(1366,768);
  await add().focus();await page.keyboard.press('Enter');await dialog().waitFor();
  await dialog().getByTestId('paper-practice-title').fill('保留的首次选题练习');
  await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});
  assert.equal(baskets().length,0);assert.equal(read('SELECT COUNT(*) AS n FROM ai_conversation_sessions')[0].n,context.initialOwnerCount);
  await add().and(page.locator(':enabled')).waitFor();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='paper-library-add');
  check('Browsing and keyboard cancellation write no basket or owner and preserve the source choice');
  await selectQuestion();assert.equal(await dialog().getByTestId('paper-practice-title').inputValue(),'保留的首次选题练习');
  for(const [width,height]of [[1366,768],[1920,1080],[800,768]]){
    await size(width,height);const box=await dialog().getByTestId('paper-basket-create').boundingBox();
    assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
    await shot('selection-dialog-'+width);
  }
  await size(1366,768);await saveSelection();await added();
  assert.deepEqual(read('SELECT * FROM question_bank_items'),[context.question]);
  assert.equal(baskets()[0].purpose,'practice');
  assert.equal(baskets()[0].uiState.filters.query,'电阻');
  assert.equal(await page.getByTestId('paper-basket-search').inputValue(),'电阻');
  assert(await page.getByTestId('paper-basket-add').isDisabled());
  context.basketId=baskets()[0].id;await shot('first-selection-saved');
  check('Explicit save adds the viewed source exactly once to a real practice basket and carries its query');
  check('Three sizes keep the original creation dialog action reachable and reopening preserves teacher input');
  await close();await launch('normal',true);await paper();await added();
  assert.equal(baskets()[0].id,context.basketId);
  assert.deepEqual(read('SELECT * FROM question_bank_items'),[context.question]);
  check('Cold restart restores the same basket, member and original source with no model replay');await close();

  await launch('source-change');await createQuestion();await selectQuestion();
  await changeSource();
  await saveSelection();await dialog().waitFor({state:'hidden'});
  await page.getByTestId('paper-library-selection-error').waitFor();
  assert((await page.getByTestId('paper-library-selection-error').textContent()).includes('来源已变化'));
  assert.equal(baskets().length,1);assert.equal(baskets()[0].entries.length,0);
  await shot('changed-source-refused');
  check('A real concurrent source edit after selection is refused and the explicitly saved empty basket remains');
  await page.getByTestId('paper-basket-candidate').filter({hasText:'另一写入者补正'}).getByTestId('paper-basket-add').and(page.locator(':enabled')).waitFor();
  await page.getByTestId('paper-basket-add').click();await added();
  assert.equal(baskets()[0].entries[0].question.stem,context.externalWriter.stem);
  await page.getByTestId('paper-library-selection-error').waitFor({state:'hidden'});
  check('The teacher can reread and explicitly add the updated source through the original candidate action');await close();

  await launch('lost-add');await createQuestion();await selectQuestion();await loseReply('add');await saveSelection();
  await page.getByTestId('paper-basket-error').getByRole('button',{name:'重试同一请求',exact:true}).waitFor();
  assert.equal(baskets().length,1);assert.equal(baskets()[0].entries.length,1);
  const entryId=baskets()[0].entries[0].entryId;
  await page.getByTestId('paper-basket-error').getByRole('button',{name:'重试同一请求',exact:true}).click();await added();
  assert.equal(baskets()[0].entries[0].entryId,entryId);await faultRequests();
  check('Lost Add response retries the original request and reads back one identical member');await close();

  await launch('lost-create');await createQuestion();await selectQuestion();await loseReply('create');await saveSelection();
  await dialog().getByRole('button',{name:'重试同一请求',exact:true}).waitFor();
  assert.equal(baskets().length,1);assert.equal(baskets()[0].entries.length,0);
  await dialog().getByRole('button',{name:'重试同一请求',exact:true}).click();await added();await faultRequests();
  assert.equal(read('SELECT COUNT(*) AS n FROM ai_conversation_sessions')[0].n,1);
  check('Lost Create response recovers the original basket before running its pending selection exactly once');await close();

  await launch('cancel-late-create');await createQuestion();await selectQuestion();await loseReply('create');await saveSelection();
  await dialog().getByRole('button',{name:'重试同一请求',exact:true}).waitFor();
  await dialog().getByRole('button',{name:'保留输入并关闭',exact:true}).click();await dialog().waitFor({state:'hidden'});
  await page.getByTestId('paper-basket-error').getByRole('button',{name:'重试同一请求',exact:true}).click();
  await page.getByTestId('paper-candidate-browser').waitFor();
  await page.getByTestId('paper-basket-add').and(page.locator(':enabled')).waitFor();
  assert.equal(baskets().length,1);assert.equal(baskets()[0].entries.length,0);await faultRequests();
  await shot('canceled-handoff-stays-empty');
  check('Canceling a pending handoff prevents its late successful Create retry from adding any question');await close();

  await launch('delayed-candidate');await createQuestion();await selectQuestion();
  await app.evaluate(({ipcMain})=>{
    const channel='education:paper-basket-v2-candidate';
    const original=ipcMain._invokeHandlers.get(channel);if(typeof original!=='function')throw Error('Original candidate handler missing');
    const gate={once:true,waiting:false};globalThis.__firstSelectionCandidateGate=gate;
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(...args)=>{
      const result=await original(...args);
      if(gate.once){gate.once=false;gate.waiting=true;await new Promise(resolve=>{gate.release=resolve;});}
      return result;
    });
  });
  await saveSelection();await page.getByTestId('paper-library-selection-pending').waitFor();
  assert.equal(baskets().length,1);assert.equal(baskets()[0].entries.length,0);
  context.delayedCandidate=await app.evaluate(()=>globalThis.__firstSelectionCandidateGate.waiting);
  assert.equal(context.delayedCandidate,true);await shot('candidate-read-pending');
  await close();await launch('delayed-candidate',true);await paper();
  await page.getByTestId('paper-basket-add').and(page.locator(':enabled')).waitFor();
  assert.equal(baskets().length,1);assert.equal(baskets()[0].entries.length,0);
  assert.deepEqual(read('SELECT * FROM question_bank_items'),[context.question]);
  check('Closing during a genuinely delayed candidate read keeps the saved basket empty and cold startup does not replay the transient selection');await close();

  await launch('direct-practice');await createQuestion({draft:false,count:3});
  assert.equal(baskets().length,0);
  await add().focus();await page.keyboard.press('Enter');await added();
  assert.equal(await dialog().count(),0);assert.equal(baskets()[0].purpose,'practice');
  assert.equal(baskets()[0].blueprint.title,'物理练习');
  await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='paper-studio-title');
  let expectedCount=1;
  for(const question of context.questions.filter(row=>row.id!==context.question.id)){
    const target=page.locator(`[data-testid="paper-basket-candidate"][data-question-id="${question.id}"]`).getByTestId('paper-basket-add');
    await target.and(page.locator(':enabled')).waitFor();await target.click();
    expectedCount++;
    await page.waitForFunction(n=>document.querySelector('[data-testid="paper-basket-summary"]')?.textContent.startsWith(n+' 题'),expectedCount);
  }
  await added(3);
  assert.deepEqual(read('SELECT * FROM question_bank_items ORDER BY id'),context.questions);
  assert.equal(new Set(baskets()[0].entries.map(entry=>entry.questionId)).size,3);
  await shot('three-questions-direct-practice');
  await page.getByTestId('paper-basket-organize').and(page.locator(':enabled')).waitFor();await page.getByTestId('paper-basket-organize').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="paper-basket-workspace"]')?.dataset.stage==='organize');
  await page.getByTestId('paper-basket-continue-select').click();await added(3);
  assert.equal(await page.getByTestId('paper-basket-search').inputValue(),'电阻');
  check('A ready first question directly creates a practice, restores keyboard context and accepts three real questions without examination input');await close();

  await launch('missing-context');await createQuestion({draft:false,missingGrade:true});
  const ownerCount=read('SELECT COUNT(*) AS n FROM ai_conversation_sessions')[0].n;
  await add().click();await dialog().waitFor();
  assert.equal(await dialog().getByTestId('paper-practice-grade').inputValue(),'');
  assert(await dialog().getByTestId('paper-basket-create').isDisabled());
  await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});
  assert.equal(baskets().length,0);assert.equal(read('SELECT COUNT(*) AS n FROM ai_conversation_sessions')[0].n,ownerCount);
  await page.getByTestId('paper-basket-back-teaching').and(page.locator(':enabled')).waitFor();
  check('Missing real metadata stays blank and requires configuration; canceling automatic defaults leaves no basket or false teacher-draft guard');await close();

  await launch('direct-lost-add');await createQuestion({draft:false});await loseReply('add');
  await add().dblclick();
  await page.getByTestId('paper-basket-error').getByRole('button',{name:'重试同一请求',exact:true}).waitFor();
  assert.equal(baskets().length,1);assert.equal(baskets()[0].entries.length,1);
  await page.getByTestId('paper-basket-error').getByRole('button',{name:'重试同一请求',exact:true}).click();await added();await faultRequests();
  assert.equal(await dialog().count(),0);
  check('Direct repeated Add input and a lost write reply still recover exactly one practice and one member');await close();

  await launch('direct-cancel-create');await createQuestion({draft:false});await loseReply('create');await add().click();
  await page.getByTestId('paper-basket-error').getByTestId('paper-library-cancel-selection').click();
  await page.getByTestId('paper-basket-error').getByRole('button',{name:'重试同一请求',exact:true}).click();
  await page.getByTestId('paper-basket-add').and(page.locator(':enabled')).waitFor();
  assert.equal(baskets().length,1);assert.equal(baskets()[0].entries.length,0);await faultRequests();
  check('A direct unknown creation can cancel its additional selection while the original creation receipt is recovered safely');await close();

  await launch('owner-context');
  context.ownerFixture=await page.evaluate(async()=>{
    await window.omniEdu.createAiConversationSession({title:'受控空题篮会话'});
    const {sessions}=await window.omniEdu.listAiConversations();
    return {kind:'Real host owner fixture',owners:sessions.map(row=>({id:row.id,title:row.title}))};
  });
  await createQuestion();await selectQuestion();await changeSource();await saveSelection();
  await page.getByTestId('paper-library-selection-error').waitFor();
  await page.getByTestId('paper-basket-ui-pending').waitFor({state:'hidden'});
  const originalOwner=baskets()[0].sessionId;
  const otherOwner=context.ownerFixture.owners.find(row=>row.id!==originalOwner);assert(otherOwner);
  await page.getByTestId('paper-basket-configuration-toggle').click();
  await page.getByTestId('paper-basket-owner').click();await page.getByRole('option',{name:otherOwner.title,exact:true}).click();
  await dialog().waitFor();
  await dialog().getByRole('button',{name:'保留输入并关闭',exact:true}).click();await dialog().waitFor({state:'hidden'});
  await page.getByTestId('paper-library-selection-error').waitFor({state:'hidden'});
  assert.equal(await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'),'');
  assert.equal(baskets().length,1);assert.equal(baskets()[0].sessionId,originalOwner);assert.equal(baskets()[0].entries.length,0);
  check('An explicitly selected empty owner does not retain another basket selection error or receive its members');await close();
  assert.deepEqual(report.errors,[]);verify();report.success=true;
}catch(failure){
  report.failure={message:failure.message,stack:String(failure.stack)};
  if(page&&!page.isClosed())await shot('failure').catch(()=>{});
  process.exitCode=1;
}finally{
  clearTimeout(deadline);
  try{await app?.close();report.closed=true;}catch(failure){report.success=false;report.closeFailure=String(failure);process.exitCode=1;}
  report.elapsedMs=Date.now()-started;
  if(report.elapsedMs>240000){report.success=false;report.budgetExceeded=true;process.exitCode=1;}
  save();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,failure:report.failure}));
}
