import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { captureWorkspaceMetrics } from './capture-workspace-metrics.mjs';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(desktop, 'test-results/xiaozhi-agent/pi-public-process-ui-')), data = path.join(output, 'data'), workspace = path.join(output, 'teacher-workspace');
fs.mkdirSync(workspace);
const marker = `教研核验${randomUUID().slice(0,8)}`, a = `课堂甲${randomUUID().slice(0,8)}`, b = `课堂乙${randomUUID().slice(0,8)}`;
const knowledge = path.join(output, '分数教研资料.md');
fs.writeFileSync(knowledge, `# 分数加法教研\n五年级数学，核验代号${marker}，课时37分钟；先明确分数单位，再图示，教师核对答案。\n`);
fs.writeFileSync(path.join(workspace, '课堂甲.txt'), `五年级分数加法，资料代号${a}，课时38分钟，强调图示理解。合成联系电话13800138000只作本地脱敏核验。`);
fs.writeFileSync(path.join(workspace, '课堂乙.txt'), `五年级分数加法，资料代号${b}，课时31分钟，强调教师讲评和反馈。`);
const cfg = fs.readFileSync(path.join(desktop,'.env.local'),'utf8'), pick = name => cfg.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`,'m'))?.[1]?.replace(/^['"]|['"]$/g,'');
const key = process.env.DEEPSEEK_API_KEY || pick('DEEPSEEK_API_KEY'), model = process.env.DEEPSEEK_MODEL || pick('DEEPSEEK_MODEL') || 'deepseek-flash'; assert(key);
const report = { success:false, suite:'pi-real-public-process', model, checks:[], boundaries:[
  'Actual formal Electron/main/preload and real DeepSeek with synthetic educational files only',
  'Native directory chooser return controlled in owned main; no Windows manual chooser claim',
  'Reference DPR unknown; full Codex shell/image/files/settings and VPN-off/installer still pending',
] };
const fileMode=process.env.OMNI_EDU_E2E_PI_FILES_MODE==='1';
let app,page,session;
function check(name, fn) { fn(); report.checks.push({name,pass:true}); console.log(`PASS ${name}`); }
async function until(test, timeout=120000) { const end=Date.now()+timeout;while(Date.now()<end){if(await test())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Public process UI condition timed out'); }
async function launch() {
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:model};
  delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
  session=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
async function send(text, observeLive=false) {
  const before=(await snapshot()).projection.turns.length,input=page.getByTestId('office-prompt-input');await input.fill(text);await input.press('Enter');assert.equal(await input.inputValue(),'');
  await until(async()=>(await snapshot()).projection.turns.length>before);
  if(observeLive) {
    await until(async()=>{
      const state=await snapshot();if(!state.running)return false;
      return (await page.locator(`[data-turn-id="${last(state).id}"] [data-slot="chat-message-assistant"]`).allTextContents()).some(text=>text.trim().length>0);
    });
    const live=await snapshot();check('Actual public text is already visible while the real model/tool run is still active',()=>assert(live.running));
    report.liveObservation={runId:last(live).id,segments:last(live).items.filter(item=>item.role==='assistant'&&item.text?.trim()).length,actualCalls:last(live).items.filter(item=>item.kind==='tool').length};
    if(fileMode)check('Actual local preview remains readable while real DeepSeek public process is active',()=>{assert(live.running);});
    if(fileMode){assert(await page.getByTestId('pi-file-panel').isVisible());assert((await page.getByTestId('pi-file-text').innerText()).includes(a.slice(-8)));}
    await page.screenshot({path:path.join(output,'live-process.png')});
    if(process.env.OMNI_EDU_E2E_PI_CHROME_MODE==='1'){
      await app.evaluate(({Menu,BrowserWindow})=>{const item=Menu.getApplicationMenu().getMenuItemById('settings');item.click(item,BrowserWindow.getAllWindows()[0],{triggeredByAccelerator:false});});
      await page.getByTestId('nav-ai').waitFor({state:'visible'});await page.getByTestId('desktop-back').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible'});
      await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===session);
      await until(async()=>Boolean((await snapshot()).projection.turns.find(turn=>turn.id===last(live).id)));
      const returned=await snapshot();assert.equal(last(returned).id,last(live).id);assert.equal(returned.projection.turns.length,live.projection.turns.length);
      report.nativeNavigation={beforeRun:last(live).id,afterRun:last(returned).id,activeBefore:live.running,activeAfter:returned.running};
      check('Native settings/back while a real DeepSeek process was active rehydrates the same run without replay or extra turn',()=>{});
      await page.screenshot({path:path.join(output,'native-return-process.png')});
    }
  }
  await until(async()=>!(await snapshot()).running);
  const state=await snapshot();assert.equal(state.projection.turns.at(-1).status,'completed',JSON.stringify(state.projection.turns.at(-1)));return state;
}
const last=state=>state.projection.turns.at(-1);
const answer=state=>last(state).items.filter(item=>item.role==='assistant').map(item=>item.text).join('').replace(/\s/g,'');
function entries() {
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});let binding;try{binding=db.prepare('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session);}finally{db.close();}
  return fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file),'utf8').trim().split('\n').map(JSON.parse);
}
try {
  await launch();await page.getByTestId('pi-rail-home').click();
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},knowledge);
  await page.getByTestId('nav-knowledge').click();await page.getByRole('button',{name:'导入知识资源',exact:true}).click();await page.getByText('分数教研资料.md',{exact:true}).first().waitFor();
  await page.getByTestId('nav-ai').click();
  await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},workspace);
  await page.getByRole('button',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snapshot()).workspace));
  if(fileMode){await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-file-entry-课堂甲.txt').click();await page.getByTestId('pi-file-text').waitFor({state:'visible'});}
  await page.evaluate(()=>{window.publicProcessEvents=[];window.omniEdu.onXiaozhiEvent(event=>window.publicProcessEvents.push(event));});
  let state=await send('请先查找教师知识库中的分数加法教研资料，再查看我授权的教研文件夹并读取课堂甲与课堂乙，为五年级分数加法课写三行备课摘要。准确保留三份资料的核验代号和课时分钟，注明资料来源；不要写文件。开始操作前和获得资料后，简短说明正在做什么。',true);
  if(fileMode)await page.getByTestId('pi-files-close').click();
  const natural=last(state), tools=natural.items.filter(item=>item.kind==='tool');
  check('Natural educational request streams public explanations around actual registered tools and preserves facts',()=>{
    assert(tools.length>=2);assert(tools.some(item=>item.label==='检索老师知识库'&&item.status==='completed'));assert(natural.items.filter(item=>item.role==='assistant').length>=2);
    assert(answer(state).includes(marker.slice(-8)));assert(answer(state).includes(a.slice(-8)));assert(answer(state).includes(b.slice(-8)));for(const minutes of ['37','38','31'])assert(answer(state).includes(minutes));
  });
  check('Real tool durations and actual total usage reach final main projection',()=>{
    assert(tools.every(item=>Number.isFinite(item.durationMs)&&item.durationMs>=0));
    assert(tools.some(item=>item.sources?.some(source=>source.title==='课堂甲.txt')));assert(tools.some(item=>item.sources?.some(source=>source.title==='课堂乙.txt')));
    const usage=state.usage.find(item=>item.runId===natural.id);assert.equal(natural.elapsedMs,usage.activeMs+usage.waitingMs);assert(natural.elapsedMs>0);
  });
  const section=page.locator(`[data-turn-id="${natural.id}"]`);
  const domIds=await section.locator('[data-item-id]').evaluateAll(elements=>elements.map(element=>element.getAttribute('data-item-id')));
  check('Actual UI preserves ordered call/segment identities and dark commentary',()=>{assert.deepEqual(domIds,natural.items.map(item=>item.id));});
  const colors=await section.locator('[data-phase="commentary"]').evaluateAll(elements=>elements.map(element=>getComputedStyle(element).color));assert(colors.every(color=>color==='rgb(48, 51, 50)'));
  const nativeTexts=entries().filter(entry=>entry.type==='message'&&entry.message.role==='assistant').map(entry=>entry.message.content.filter(item=>item.type==='text').map(item=>item.text).join('')).filter(Boolean);
  check('Native public text matches persisted segmented projection; private reasoning is absent from DOM',()=>{
    assert.deepEqual(natural.items.filter(item=>item.role==='assistant').map(item=>item.text),nativeTexts);
    assert(!JSON.stringify(natural).includes('13800138000'));assert(!JSON.stringify(natural).includes('reasoning_content'));
  });
  state=await send('请同时分别读取已授权目录中的课堂甲.txt与课堂乙.txt，然后对比它们的课时和教学重点。用简短说明交代动作，必须实际读取两份资料；不要写文件。');
  const groupTurn=last(state), group=page.locator(`[data-turn-id="${groupTurn.id}"]`).getByTestId('office-tool-group').first();
  await group.waitFor({state:'visible'});await group.locator('[data-slot="chat-tool-group-trigger"]').click();
  await group.getByTestId('office-tool-step').first().waitFor({state:'visible'});await group.getByTestId('office-tool-step').first().locator('[data-slot="chat-tool-trigger"]').click();
  check('Actual consecutive calls use existing Pro ChatToolGroup and reveal individual measured evidence',()=>{});
  assert(await group.getByTestId('office-tool-evidence').first().isVisible());assert((await group.innerText()).includes('实际用时'));
  assert((await group.innerText()).includes('课堂甲.txt'));assert((await group.innerText()).includes('课堂乙.txt'));
  for(const [width,height] of [[1366,768],[1920,1080]]) {
    await page.setViewportSize({width,height});await page.getByTestId('office-prompt-input').scrollIntoViewIfNeeded();
    const rect=await page.getByTestId('office-prompt-input').boundingBox();check(`Process and composer remain reachable at ${width}x${height}`,()=>assert(rect&&rect.y>=0&&rect.y+rect.height<=height));
    const metrics = await captureWorkspaceMetrics(page,app,output,`after-${width}x${height}`);
    const { regions, toolbarButtons } = metrics.renderer, shell = regions.composerShell.rect;
    check(`Actual reading and input edges align within 8 CSS pixels at ${width}x${height}`,()=>{
      assert(Math.abs(regions.assistant.rect.x-regions.input.rect.x)<=8);
      assert.equal(regions.assistantText.fontSize,'16px');assert.equal(regions.assistantText.color,'rgb(48, 51, 50)');
      assert.equal(regions.assistantText.lineHeight,'27.2px');
    });
    check(`Actual toolbar controls stay inside one row and the shell at ${width}x${height}`,()=>{
      assert(toolbarButtons.length>=5);
      for(const button of toolbarButtons)assert(button.rect.x>=shell.x && button.rect.x+button.rect.width<=shell.x+shell.width+1,button.name);
      assert(Math.max(...toolbarButtons.map(button=>button.rect.y))-Math.min(...toolbarButtons.map(button=>button.rect.y))<=6);
    });
  }
  state=await send('请尝试读取已授权目录里“缺失资料.txt”，不要创建文件；如果找不到，简短说明缺失，不能捏造内容。');
  const failed=last(state).items.find(item=>item.kind==='tool'&&item.status==='failed');assert(failed);
  const failedRow=page.locator(`[data-item-id="${failed.id}"]`);await failedRow.getByTestId('office-tool-evidence').waitFor({state:'visible'});
  check('Real missing-file failure is expanded automatically while completed work remains',()=>assert((failedRow&&last(state).items.some(item=>item.role==='assistant'))));
  const batch=Array.from({length:90},(_,i)=>`合成教研条目${i+1}：先明确分数单位，再组织图示比较，教师核对难度、来源与答案；所有活动为草稿，学生原图保留本地，练习需教师确认。`).join('\n');
  for(let i=0;i<2;i++)await send('阅读合成教研资料，只回复“已阅读”，不调用工具。\n'+batch);
  const count=(await snapshot()).projection.turns.length;await page.getByTestId('pi-task-details-expand').click();await page.getByTestId('pi-compact').click();await until(async()=>(await snapshot()).projection.turns.length>count);await until(async()=>!(await snapshot()).running);state=await snapshot();
  check('Actual native compaction displays completed fine row with real elapsed time and private summary hidden',()=>{assert.equal(last(state).status,'completed');assert(last(state).items.some(item=>item.kind==='compaction'&&item.status==='completed'));assert(state.usage.at(-1).modelCalls>0);});
  const compactRow=page.locator(`[data-turn-id="${last(state).id}"]`).getByTestId('pi-compaction-card').last();assert.equal(await compactRow.locator('[data-slot="chat-tool-trigger"]').getAttribute('aria-expanded'),'false');
  const before=(await snapshot()).projection.turns.length,input=page.getByTestId('office-prompt-input');await input.fill('请使用教师提问工具询问这节分数课安排上午还是下午，给两个选项，等待我回答，不要操作文件。');await input.press('Enter');
  await page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').waitFor({state:'visible',timeout:90000});
  const pendingRun = last(await snapshot()).id, unsent = '尚未发送的下一项教研说明';
  await page.getByTestId('pi-queue-mode-followup').click();await input.fill(unsent);
  await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-file-panel').waitFor({state:'visible'});
  assert.equal(await input.inputValue(),unsent);assert.equal(await page.getByTestId('pi-queue-mode-followup').getAttribute('aria-pressed'),'true');
  await page.getByTestId('pi-files-close').click();assert.equal(await input.inputValue(),unsent);
  check('Actual waiting run retains unsent queue draft and mode through file-panel reparenting without dispatch',()=>{});
  assert.equal(last(await snapshot()).id,pendingRun);assert.equal((await snapshot()).projection.turns.length,before+1);
  await input.fill('');await page.getByRole('button',{name:'停止本轮',exact:true}).click();await until(async()=>!(await snapshot()).running);
  const stopped=await snapshot();check('Real pending question and stop remain actionable with new process rows',()=>assert.equal(last(stopped).status,'interrupted'));
  assert.equal((await snapshot()).projection.turns.length,before+1);
  const persisted=(await snapshot()).projection.turns.map(turn=>({id:turn.id,elapsedMs:turn.elapsedMs,items:turn.items}));
  await app.close();app=undefined;await launch();await page.getByTestId(`ai-conversation-session-${session}`).click();
  check('Actual restart retains measured durations, original public order and history',()=>{});assert.deepEqual((await snapshot()).projection.turns.map(turn=>({id:turn.id,elapsedMs:turn.elapsedMs,items:turn.items})),persisted);
  report.success=true;
} catch(error) { process.exitCode=1;report.error=String(error.stack||error).replaceAll(key,'[credential]').slice(0,3000);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{}); }
finally { await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))})); }
