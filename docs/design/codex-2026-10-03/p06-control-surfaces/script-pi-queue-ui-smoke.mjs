import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(root,'test-results/xiaozhi-agent/pi-queue-ui-')),data=path.join(output,'data');fs.mkdirSync(data);
const cfg=fs.readFileSync(path.join(root,'.env.local'),'utf8'),pick=name=>cfg.match(new RegExp(`^${name}\\s*=\\s*["']?([^\\r\\n"']+)`,'m'))?.[1]?.trim();
const key=pick('DEEPSEEK_API_KEY'),model=pick('DEEPSEEK_MODEL')||'deepseek-flash';assert(key);
const checks=[],report={suite:'pi-queue-formal-ui',success:false,model,checks,boundaries:['Real Electron and DeepSeek; synthetic teacher commands only','Dispatch-gap delay is a main-only E2E seam; kill/restart are actual owned processes','B3a only; education memory scope and full UI remain pending']};
let app,page;
const until=async(fn,ms=120000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,80));}throw new Error('Queue acceptance condition timed out');};
const check=(name,fn)=>{fn();checks.push({name,pass:true});console.log(`PASS ${name}`);};
const id=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const snap=async session=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session||await id());
const card=control=>page.locator(`[data-testid="pi-queued-instruction"][data-control-id="${control}"]`);
async function ready(){await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);}
async function launch(delay=0){const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(root,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_PI_QUEUE_DISPATCH_DELAY_MS:String(delay),DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:model};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[path.join(root,'out/main/index.js'),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:30000});await ready();}
async function fresh(){const previous=await id();await page.getByTestId('ai-conversation-new').click();await page.waitForFunction(value=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')!==value,previous);await ready();}
async function send(text){const session=await id(),n=(await snap()).projection.turns.length;await page.getByTestId('office-prompt-input').fill(text);await page.getByTestId('office-prompt-input').press('Enter');await until(async()=>(await snap(session)).projection.turns.length>n);return session;}
async function terminal(session){await until(async()=>!(await snap(session)).running);return snap(session);}
async function ask(){const session=await send('帮我准备一份分数课导入，请先问我面向哪个年级，给三年级和五年级两个选项，等我回答后再给一句建议，不操作文件。');await page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').waitFor({state:'visible',timeout:90000});return session;}
async function queue(text,mode='steer'){await page.getByTestId(mode==='steer'?'pi-queue-mode-steer':'pi-queue-mode-followup').click();const n=(await snap()).controls.filter(item=>item.kind==='instruction').length;
  await page.getByTestId('office-prompt-input').fill(text);await page.getByTestId('pi-queue-submit').click();await until(async()=>(await snap()).controls.filter(item=>item.kind==='instruction').length>n);return (await snap()).controls.filter(item=>item.kind==='instruction').at(-1);}
function native(session){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{const binding=db.prepare('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session);return fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file),'utf8').trim().split('\n').map(JSON.parse);}finally{db.close();}}
const occurrences=(session,text)=>native(session).filter(entry=>entry.type==='message'&&entry.message.role==='user'&&entry.message.content.some(part=>part.type==='text'&&part.text===text)).length;
const mutate=input=>page.evaluate(input=>window.omniEdu.mutateXiaozhiQueue(input),input);
async function kill(){execFileSync('taskkill',['/PID',String(app.process().pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});app=undefined;}
try{
  await launch();const session=await ask(),same='导入建议须包含纸条比较分数。';
  const first=await queue(same),second=await queue(same),third=await queue('不要送达这个已经撤回的草稿指令。','followUp');
  check('Real composer queues identical text under separate durable IDs',()=>{assert.notEqual(first.id,second.id);assert.equal(first.revision,0);});
  await card(first.id).getByTestId('pi-instruction-edit').click();const edited=`接着只补一行：教师验收码${randomUUID().slice(0,8)}。`;
  await card(first.id).getByTestId('pi-instruction-text').fill(edited);await card(first.id).getByTestId('pi-instruction-mode').selectOption('followUp');
  await page.getByTestId('pi-question-answer').fill('尚未发送的五年级回答');
  await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-file-panel').waitFor({state:'visible'});
  assert.equal(await card(first.id).getByTestId('pi-instruction-text').inputValue(),edited);assert.equal(await card(first.id).getByTestId('pi-instruction-mode').inputValue(),'followUp');
  assert.equal(await page.getByTestId('pi-question-answer').inputValue(),'尚未发送的五年级回答');
  await page.getByTestId('pi-files-close').click();assert.equal(await card(first.id).getByTestId('pi-instruction-text').inputValue(),edited);
  check('Actual question and queue editor drafts survive file-panel reparenting without delivery',()=>assert.equal(occurrences(session,edited),0));
  await card(first.id).getByTestId('pi-instruction-save').click();
  await until(async()=>(await snap()).controls.find(item=>item.id===first.id).revision===1);
  check('Visible editor commits revised text and mode while preserving original ID',()=>assert.equal(occurrences(session,edited),0));
  await card(third.id).getByTestId('pi-instruction-withdraw').click();await until(async()=>(await snap()).controls.find(item=>item.id===third.id).state==='withdrawn');
  check('Visible withdraw records truthful state before SDK delivery',()=>assert.equal(occurrences(session,third.text),0));
  const replay=await mutate({sessionId:session,controlId:first.id,revision:0,action:'edit',text:edited,mode:'followUp'});
  const denied=await Promise.all([
    mutate({sessionId:session,controlId:first.id,revision:0,action:'edit',text:'过期覆盖',mode:'steer'}),
    mutate({sessionId:`aisession_${randomUUID()}`,controlId:second.id,revision:0,action:'withdraw'}),
    mutate({sessionId:session,controlId:second.id,revision:0,action:'withdraw',apiKey:'not-a-credential'}),
  ]);
  check('Mutation replay is idempotent; stale, foreign and extra authority fields rejected',()=>{assert(replay.ok);assert.equal(denied[0].error,'command_conflict');assert.equal(denied[1].error,'permission_denied');assert.equal(denied[2].error,'invalid_input');});
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.browserWindow(page).then(win=>win.evaluate((window,size)=>window.setContentSize(...size),[width,height]));
    await card(second.id).getByTestId('pi-instruction-edit').evaluate(node=>node.scrollIntoView({block:'center'}));
    const box=await card(second.id).getByTestId('pi-instruction-edit').boundingBox(),view=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
    check(`Queue mutation actions reachable at ${width}x${height}`,()=>assert(box&&box.y>=0&&box.y+box.height<=view.height+1));
    await page.screenshot({path:path.join(output,`queue-${width}x${height}.png`)});
  }
  await page.getByTestId('pi-question-option-1').click();await page.getByTestId('pi-question-submit').click();let state=await terminal(session);
  check('Native SDK receives edited follow-up once, original duplicate once, withdrawn never',()=>{assert.equal(state.projection.turns.at(-1).status,'completed');assert.equal(occurrences(session,edited),1);assert.equal(occurrences(session,same),1);assert.equal(occurrences(session,third.text),0);assert.equal(state.controls.find(item=>item.id===first.id).state,'applied');assert.equal(state.controls.find(item=>item.id===third.id).state,'withdrawn');assert(state.projection.turns.at(-1).items.some(item=>item.role==='assistant'&&item.text.includes(edited.match(/[a-f0-9]{8}/)[0])));});
  const late=await mutate({sessionId:session,controlId:first.id,revision:1,action:'withdraw'});
  check('Delivered command cannot be withdrawn retroactively',()=>assert.equal(late.error,'permission_denied'));
  await app.close();app=undefined;await launch();await page.getByTestId(`ai-conversation-session-${session}`).click();await ready();state=await snap();
  check('Actual restart retains revision/mode and withdrawal without requeue',()=>{assert(!state.running);assert.equal(state.controls.find(item=>item.id===first.id).revision,1);assert.equal(state.controls.find(item=>item.id===first.id).mode,'followUp');assert.equal(state.controls.find(item=>item.id===third.id).state,'withdrawn');assert.equal(occurrences(session,edited),1);});
  await fresh();const competing=await ask(),original=await queue('并发编辑前的合成指令。');
  const concurrent=await Promise.all(['版本甲','版本乙'].map(text=>mutate({sessionId:competing,controlId:original.id,revision:0,action:'edit',text,mode:'steer'})));
  state=await snap();check('Concurrent edits have one winner and one revision increment',()=>{assert.equal(concurrent.filter(item=>item.ok).length,1);assert.equal(state.controls.find(item=>item.id===original.id).revision,1);});
  const stopRace=await Promise.all([mutate({sessionId:competing,controlId:original.id,revision:1,action:'withdraw'}),page.evaluate(id=>window.omniEdu.stopXiaozhi(id),competing)]);state=await terminal(competing);
  check('Stop/edit race cannot deliver or revive a command',()=>{assert(stopRace[1].ok);assert.equal(state.projection.turns.at(-1).status,'interrupted');assert.equal(occurrences(competing,original.text),0);assert(state.controls.filter(item=>item.kind==='instruction').every(item=>['withdrawn','interrupted'].includes(item.state)));});
  await fresh();const capSession=await ask();const admitted=await page.evaluate(id=>Promise.all(Array.from({length:16},(_,index)=>window.omniEdu.queueXiaozhi({sessionId:id,commandId:`xicmd_${crypto.randomUUID()}`,text:`合成上限指令${index}`,mode:'steer'}))),capSession);assert(admitted.every(item=>item.ok));
  const capped=(await snap()).controls.find(item=>item.kind==='instruction');await card(capped.id).getByTestId('pi-instruction-withdraw').click();await until(async()=>(await snap()).controls.find(item=>item.id===capped.id).state==='withdrawn');await queue('撤回之后的新指令。');
  state=await snap();check('Withdrawal releases a pending slot without dropping other queued commands',()=>{assert.equal(occurrences(capSession,'撤回之后的新指令。'),0);assert.equal(state.controls.filter(item=>item.kind==='instruction'&&item.state==='queued').length,16);assert.equal(state.controls.filter(item=>item.kind==='instruction'&&item.state==='withdrawn').length,1);});
  await page.getByRole('button',{name:'停止本轮',exact:true}).click();await terminal(capSession);
  await fresh();const streaming=await send('请写一篇约两千字的五年级分数课教案，逐段写，暂时不要提问或操作文件。');
  await until(async()=>(await snap(streaming)).running&&(await snap(streaming)).projection.turns.at(-1).items.some(item=>item.role==='assistant'&&(item.text||'').length>40));
  const streamed=await queue('后续只回复：待修改的指令。','followUp');await card(streamed.id).getByTestId('pi-instruction-edit').click();
  const newText='后续只回复：模型输出期间修改成功。';await card(streamed.id).getByTestId('pi-instruction-text').fill(newText);await card(streamed.id).getByTestId('pi-instruction-save').click();state=await terminal(streaming);
  check('Editing is available during actual model streaming, not only teacher waits',()=>{assert.equal(state.projection.turns.at(-1).status,'completed');assert.equal(occurrences(streaming,newText),1);assert.equal(occurrences(streaming,streamed.text),0);assert(state.projection.turns.at(-1).items.some(item=>item.role==='assistant'&&item.text.includes('模型输出期间修改成功')));});
  await app.close();app=undefined;await launch(20000);await fresh();const crash=await ask(),pending=await queue('不要在崩溃后自动重发这条指令。');
  await page.getByTestId('pi-question-option-1').click();await page.getByTestId('pi-question-submit').click();const marker=path.join(data,'.e2e-pi-queue-dispatching');await until(()=>fs.existsSync(marker));
  state=await snap();const blocked=await mutate({sessionId:crash,controlId:pending.id,revision:0,action:'withdraw'});
  check('Durable dispatching is locked but never mislabeled delivered',()=>{assert.equal(state.controls.find(item=>item.id===pending.id).state,'dispatching');assert.equal(blocked.error,'permission_denied');assert.equal(occurrences(crash,pending.text),0);});
  await kill();await launch();await page.getByTestId(`ai-conversation-session-${crash}`).click();await ready();state=await snap();
  check('Real crash at dispatch gap recovers interrupted and never replays queued text',()=>{assert(!state.running);assert.equal(state.controls.find(item=>item.id===pending.id).state,'interrupted');assert.equal(occurrences(crash,pending.text),0);});
  report.success=true;
}catch(error){report.error=String(error.stack).replaceAll(key,'[credential]').slice(0,5000);if(page){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});report.snapshot=await snap().catch(()=>undefined);}}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.relative(root,path.join(output,'report.json'))}));}
if(!report.success)process.exitCode=1;
