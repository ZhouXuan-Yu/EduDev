import {testMain} from '../acceptance/build-root.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(appRoot,'test-results/xiaozhi-agent/pi-control-ui-'));let dataRoot=path.join(output,'data');fs.mkdirSync(dataRoot);
const cfg=fs.readFileSync(path.join(appRoot,'.env.local'),'utf8');
const pick=name=>cfg.match(new RegExp(`^${name}\\s*=\\s*["']?([^\\r\\n"']+)`,'m'))?.[1]?.trim();
const key=pick('DEEPSEEK_API_KEY'),model=pick('DEEPSEEK_MODEL') || 'deepseek-flash';assert(key);
const checks=[],report={suite:'pi-control-formal-ui',success:false,model,checks,boundaries:['Real DeepSeek and formal Electron with synthetic teacher prompts','Actual owned process kill; no provider history fixture','P04-A only; full budget/compaction/education memory and VPN-off remain pending']};
let app,page;
const check=(name,fn)=>{fn();checks.push({name,pass:true});};
const until=async(fn,ms=120000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Control acceptance condition timed out');};
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:dataRoot,OMNI_EDU_REPO_ROOT:path.resolve(appRoot,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:model};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[testMain(appRoot),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:30000});await ready();}
async function ready(){await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);}
async function id(){return page.locator('.office-composer-container').getAttribute('data-session-id');}
async function snap(session){return page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session || await id());}
function rows(){const db=new DatabaseSync(path.join(dataRoot,'app.db'),{readOnly:true});try{return {controls:db.prepare('SELECT * FROM xiaozhi_pi_controls ORDER BY created_at,rowid').all().map(row=>({...row,payload:JSON.parse(row.payload_json)})),runs:db.prepare("SELECT * FROM ai_agent_runs WHERE sub_intent='pi_education'").all(),bindings:db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').all()};}finally{db.close();}}
async function fresh(){const old=await id();await page.getByTestId('ai-conversation-new').click();await page.waitForFunction(old=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')!==old,old);await ready();}
const task='请先调用 update_plan 设两步：确定年级（in_progress）、给教学导入建议（pending）。然后必须调用 ask_teacher 提问“这次分数课面向哪个年级？”建议选项为“三年级”和“五年级”。等待回答后按回答给出一句教学导入建议，再 update_plan 将两步均设为 completed。不要写文件，不要反复提问，不要只用文字代替工具。';
async function ask(){await page.getByTestId('office-prompt-input').fill(task);await page.getByTestId('office-prompt-input').press('Enter');await page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').waitFor({state:'visible',timeout:90000});return (await snap()).controls.find(item=>item.kind==='question'&&item.state==='pending');}
async function terminal(session){await until(async()=>!(await snap(session)).running);return snap(session);}
async function kill(){const pid=app.process().pid;execFileSync('taskkill',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'pipe'});await app.close().catch(()=>{});app=undefined;}
try{
  await launch();const session=await id(),question=await ask();let state=await snap();
  check('Real model plan and durable question reach formal waiting_input UI',()=>{assert.equal(state.projection.turns.at(-1).status,'waiting_input');assert(state.controls.some(item=>item.kind==='plan'&&item.steps[0].status==='in_progress'));assert.equal(rows().controls.find(row=>row.id===question.id).state,'pending');});
  const nativePlan=state.controls.find(item=>item.kind==='plan'),planCard=page.getByTestId('pi-task-plan'),livePlan=page.getByTestId('pi-live-task');
  assert(await livePlan.isVisible());assert.equal(await planCard.getByTestId('pi-plan-step').count(),nativePlan.steps.length);
  for(let index=0;index<nativePlan.steps.length;index++)assert.equal(await planCard.getByTestId('pi-plan-step').nth(index).getAttribute('data-state'),nativePlan.steps[index].status);
  await livePlan.locator('[data-slot="chain-of-thought-trigger"]').click();assert.equal(await livePlan.getByTestId('pi-plan-step').count(),nativePlan.steps.length);await livePlan.locator('[data-slot="chain-of-thought-trigger"]').click();
  check('Actual native plan states and collapsible resident task summary match while waiting',()=>{});
  const stopSquare=await page.getByRole('button',{name:'停止本轮',exact:true}).locator('span[aria-hidden="true"]').boundingBox();
  check('Actual resident stop icon has a visible square while waiting for the teacher',()=>assert(stopSquare&&stopSquare.width===12&&stopSquare.height===12));
  const textStyle=await page.getByTestId('pi-question-answer').evaluate(element=>({font:getComputedStyle(element).fontSize,weight:getComputedStyle(element).fontWeight}));
  check('Actual free-answer primitive uses normal 15px text',()=>{assert.equal(textStyle.font,'15px');assert.equal(textStyle.weight,'400');});
  for(const [w,h] of [[1366,768],[1920,1080]]){await page.setViewportSize({width:w,height:h});const bounds=await page.getByTestId('pi-question-option-1').boundingBox();check(`Question actions reachable at ${w}x${h}`,()=>assert(bounds&&bounds.y>=0&&bounds.y+bounds.height<=h));await page.screenshot({path:path.join(output,`question-${w}x${h}.png`)});}
  const wrong=await page.evaluate(q=>window.omniEdu.answerXiaozhi({sessionId:`aisession_${crypto.randomUUID()}`,controlId:q,answer:'五年级'}),question.id);
  const extra=await page.evaluate(q=>window.omniEdu.answerXiaozhi({sessionId:document.querySelector('.office-composer-container').getAttribute('data-session-id'),controlId:q,answer:'五年级',apiKey:'not-a-secret-fixture'}),question.id);
  check('Cross-conversation and extra authority fields are rejected',()=>{assert.equal(wrong.error,'permission_denied');assert.equal(extra.error,'invalid_input');});
  await page.getByTestId('office-prompt-input').fill('本轮导入建议必须包含“纸片通分”。');await page.getByTestId('pi-queue-submit').click();
  await until(async()=>rows().controls.some(row=>row.kind==='instruction'));const steer=rows().controls.find(row=>row.kind==='instruction');
  check('Visible native steering queue accepts once and clears composer',()=>{assert.equal(steer.state,'queued');assert.equal(steer.payload.mode,'steer');});assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');
  const duplicate=await page.evaluate(({session,command,text})=>Promise.all([window.omniEdu.queueXiaozhi({sessionId:session,commandId:command,text,mode:'steer'}),window.omniEdu.queueXiaozhi({sessionId:session,commandId:command,text,mode:'followUp'})]),{session,command:steer.id,text:steer.payload.text});
  check('Queued command replay is idempotent and mode conflict is rejected',()=>{assert(duplicate[0].ok);assert.equal(duplicate[1].error,'command_conflict');assert.equal(rows().controls.filter(row=>row.id===steer.id).length,1);});
  await page.getByTestId('pi-queue-mode-followup').click();await page.getByTestId('office-prompt-input').fill('接着请只补一行：教师复核提醒。');await page.getByTestId('pi-queue-submit').click();
  await until(async()=>rows().controls.filter(row=>row.kind==='instruction').length===2);check('Follow-up remains queued while teacher question waits',()=>assert.equal(rows().controls.find(row=>row.payload.mode==='followUp').state,'queued'));
  await page.getByTestId('pi-question-option-1').click();
  check('Selecting an actual suggested answer does not dispatch until explicit send',()=>{});
  assert.equal((await snap()).controls.find(item=>item.id===question.id).state,'pending');assert.equal(await page.getByTestId('pi-question-answer').inputValue(),'五年级');
  await page.getByTestId('pi-question-submit').click();
  const racingAnswers=await page.evaluate(({session,q})=>Promise.all([window.omniEdu.answerXiaozhi({sessionId:session,controlId:q,answer:'五年级'}),window.omniEdu.answerXiaozhi({sessionId:session,controlId:q,answer:'五年级'})]),{session,q:question.id});
  check('Concurrent identical answers acknowledge the same committed result',()=>assert(racingAnswers.every(item=>item.ok)));
  state=await terminal(session);
  const transcript=fs.readFileSync(path.join(dataRoot,'xiaozhi-pi',rows().bindings.find(row=>row.conversation_id===session).session_file),'utf8');
  check('Teacher answer resumes SDK; native steer and followUp are actually consumed',()=>{assert.equal(state.projection.turns.at(-1).status,'completed');assert.equal(rows().controls.find(row=>row.id===question.id).state,'answered');assert(rows().controls.filter(row=>row.kind==='instruction').every(row=>row.state==='applied'));assert(transcript.includes('纸片通分'));assert(transcript.includes('教师复核提醒'));const text=state.projection.turns.at(-1).items.map(item=>item.text||'').join('\n');assert(text.includes('纸片通分'));assert(text.includes('教师复核'));const history=transcript.trim().split('\n').map(line=>JSON.parse(line));for(const queued of rows().controls.filter(row=>row.kind==='instruction'))assert.equal(history.filter(entry=>entry.type==='message'&&entry.message.role==='user'&&entry.message.content.some(part=>part.type==='text'&&part.text===queued.payload.text)).length,1);});
  check('Every real assistant text segment remains intact across followUp and finalization',()=>{
    const native=transcript.trim().split('\n').map(line=>JSON.parse(line)).filter(entry=>entry.type==='message'&&entry.message.role==='assistant').map(entry=>entry.message.content.filter(part=>part.type==='text').map(part=>part.text).join('').trim()).filter(Boolean);
    const visible=state.projection.turns.at(-1).items.filter(item=>item.kind==='message'&&item.role==='assistant').map(item=>(item.text || '').trim()).filter(Boolean);
    assert.deepEqual(visible,native);assert(visible.length>=2);
  });
  const before=rows().runs.length;const repeat=await page.evaluate(({session,q})=>window.omniEdu.answerXiaozhi({sessionId:session,controlId:q,answer:'五年级'}),{session,q:question.id});
  check('Repeated answered question acknowledges without another run',()=>{assert(repeat.ok);assert.equal(rows().runs.length,before);});
  await app.close();app=undefined;await launch();state=await snap(session);
  check('Completed plan and queue receipts restore across actual restart',()=>{assert(state.controls.find(item=>item.kind==='plan').steps.every(step=>step.status==='completed'));assert(state.controls.filter(item=>item.kind==='instruction').every(item=>item.state==='applied'));});
  await fresh();const stoppedSession=await id(),stopped=await ask();
  const capped=await page.evaluate(session=>Promise.all(Array.from({length:20},(_,i)=>window.omniEdu.queueXiaozhi({sessionId:session,commandId:`xicmd_${crypto.randomUUID()}`,text:`并发队列边界${i}，等待教师回答前不执行。`,mode:'steer'}))),stoppedSession);
  check('Concurrent queue admission remains bounded at 16 pending instructions',()=>{assert.equal(capped.filter(item=>item.ok).length,16);assert.equal(capped.filter(item=>item.error==='busy').length,4);assert.equal(rows().controls.filter(row=>row.conversation_id===stoppedSession&&row.kind==='instruction').length,16);});
  await page.getByRole('button',{name:'停止本轮',exact:true}).click();await terminal(stoppedSession);
  const late=await page.evaluate(({session,q})=>window.omniEdu.answerXiaozhi({sessionId:session,controlId:q,answer:'五年级'}),{session:stoppedSession,q:stopped.id});
  check('Stop releases live question and refuses late answer without new run',()=>{assert.equal(late.error,'permission_denied');assert.equal(rows().controls.find(row=>row.id===stopped.id).state,'interrupted');assert(!rows().controls.find(row=>row.id===stopped.id).payload.canResume);});
  await fresh();const crashSession=await id(),crashed=await ask();await page.getByTestId('office-prompt-input').fill('不要在重启后自动发送这条未送达指令。');await page.getByTestId('pi-queue-submit').click();await until(async()=>rows().controls.some(row=>row.conversation_id===crashSession&&row.kind==='instruction'));
  await kill();await launch();await page.getByTestId(`ai-conversation-session-${crashSession}`).click();await ready();
  state=await snap(crashSession);check('Actual process crash retains plan/question but never replays queued instruction',()=>{assert.equal(state.controls.find(item=>item.id===crashed.id).state,'interrupted');assert(state.controls.find(item=>item.id===crashed.id).canResume);assert.equal(state.controls.find(item=>item.kind==='instruction').state,'interrupted');assert(!state.running);assert(state.projection.turns.at(-1).items.some(item=>item.kind==='plan'));});
  const oldCount=rows().runs.length;await page.getByTestId('pi-question-answer').fill('五年级；已明确，不再询问年级，直接给分数导入建议。');await page.getByTestId('pi-question-submit').click();await until(async()=>rows().runs.length===oldCount+1);state=await terminal(crashSession);
  check('Teacher free answer explicitly starts a new safe run after crash',()=>{assert.equal(rows().runs.length,oldCount+1);assert.equal(state.projection.turns.at(-1).status,'completed');assert.equal(rows().controls.find(row=>row.id===crashed.id).state,'answered');assert.equal(rows().controls.find(row=>row.conversation_id===crashSession&&row.kind==='instruction').state,'interrupted');});
  await fresh();const naturalSession=await id();
  await page.getByTestId('office-prompt-input').fill('帮我准备分数加法课的导入。我还没说这节课面向哪个年级，请先问我年级，等我回答后再给一句建议。');await page.getByTestId('office-prompt-input').press('Enter');
  await page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').waitFor({state:'visible',timeout:90000});await page.getByTestId('pi-question-answer').fill('五年级');await page.getByTestId('pi-question-submit').click();
  const natural=await terminal(naturalSession);
  check('Natural teacher request invokes real clarification without tool names in the prompt',()=>{assert.equal(natural.projection.turns.at(-1).status,'completed');assert(natural.controls.some(item=>item.kind==='question'&&item.state==='answered'&&item.answer==='五年级'));});
  if(process.argv[2]){
    await app.close();app=undefined;
    const source=fs.realpathSync(path.resolve(appRoot,process.argv[2])),testRoot=fs.realpathSync(path.join(appRoot,'test-results/xiaozhi-agent'));
    const relative=path.relative(testRoot,source);assert(!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(source)==='data','Only explicitly named isolated test data may be copied');
    dataRoot=path.join(output,'prior-data');fs.cpSync(source,dataRoot,{recursive:true,errorOnExist:true,force:false});
    await launch();
    const legacy=rows().bindings.find(row=>!fs.readFileSync(path.join(dataRoot,'xiaozhi-pi',row.session_file),'utf8').includes('xiaozhi.education.controls.v1'));assert(legacy,'Prior SDK snapshot fixture required');
    const priorText=fs.readFileSync(path.join(dataRoot,'xiaozhi-pi',legacy.session_file),'utf8');
    await page.getByTestId(`ai-conversation-session-${legacy.conversation_id}`).click();await ready();
    await page.getByTestId('office-prompt-input').fill('只根据当前会话已有资料，说出分数加法需要先做什么。不要写文件，不需要澄清。');await page.getByTestId('office-prompt-input').press('Enter');
    await until(async()=>(await snap(legacy.conversation_id)).running);const migrated=await terminal(legacy.conversation_id);
    const nextText=fs.readFileSync(path.join(dataRoot,'xiaozhi-pi',legacy.session_file),'utf8');
    check('Copied prior SDK history upgrades controls without changing identity or replaying effects',()=>{assert.equal(migrated.projection.turns.at(-1).status,'completed');assert(nextText.startsWith(priorText));assert(nextText.includes('xiaozhi.education.controls.v1'));assert.equal(rows().bindings.find(row=>row.conversation_id===legacy.conversation_id).session_file,legacy.session_file);});
  }
  report.success=true;
}catch(error){report.error=String(error).replaceAll(key,'[credential]');if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,report:path.relative(appRoot,path.join(output,'report.json'))}));}
if(!report.success)process.exitCode=1;
