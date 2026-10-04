import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { _electron as electron } from 'playwright';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-process-approval-ui-')),data=path.join(output,'data'),workspace=path.join(output,'teacher-workspace');
fs.mkdirSync(workspace);const source=path.join(workspace,'教学资料.txt');fs.writeFileSync(source,'五年级分数课：先图示，再讨论；教师核对后使用。');const bytes=fs.readFileSync(source);
const cfg=fs.readFileSync(path.join(desktop,'.env.local'),'utf8'),pick=name=>cfg.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`,'m'))?.[1]?.replace(/^['"]|['"]$/g,'');const key=process.env.DEEPSEEK_API_KEY||pick('DEEPSEEK_API_KEY'),model=process.env.DEEPSEEK_MODEL||pick('DEEPSEEK_MODEL');assert(key);
const checks=[],report={success:false,checks,boundary:'Formal real DeepSeek and actual local copy with synthetic owned files; native chooser return controlled; no real teacher data or external writes'};let app,page,session;
const switching=process.env.OMNI_EDU_E2E_PI_HISTORY_MODEL_APPROVAL==='1';
const sha=value=>createHash('sha256').update(value).digest('hex');
function nativeIdentity(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{
  const binding=db.prepare('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session);
  const file=path.join(data,'xiaozhi-pi',binding.session_file),bytes=fs.readFileSync(file),rows=bytes.toString('utf8').trimEnd().split('\n').map(JSON.parse);
  return{file,bytes,header:rows[0],snapshot:sha(JSON.stringify(rows.find(row=>row.customType==='xiaozhi.education.snapshot.v1'))),
    counts:[db.prepare('SELECT count(*) AS n FROM ai_conversation_messages WHERE session_id=?').get(session).n,db.prepare('SELECT count(*) AS n FROM ai_agent_runs WHERE session_id=?').get(session).n]};
}finally{db.close();}}
async function selectModel(target){const before=nativeIdentity(),prior=(await snapshot()).approvals;
  await until(async()=>!await page.getByRole('button',{name:'选择模型',exact:true}).isDisabled());
  await page.getByRole('button',{name:'选择模型',exact:true}).click();await page.getByRole('menuitemradio',{name:target,exact:true}).click();
  await until(async()=>(await snapshot()).projection.model===target&&!await page.getByTestId('office-prompt-input').isDisabled());
  const after=nativeIdentity();assert.equal(after.file,before.file);assert.deepEqual(after.header,before.header);assert.equal(after.snapshot,before.snapshot);assert.deepEqual(after.counts,before.counts);assert(after.bytes.subarray(0,before.bytes.length).equals(before.bytes));assert.deepEqual((await snapshot()).approvals,prior);
}
const until=async(test)=>{const end=Date.now()+120000;while(Date.now()<end){if(await test())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Process approval UI timed out');};
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
function check(name,test){test();checks.push({name,pass:true});console.log(`PASS ${name}`);}
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:switching?'deepseek-flash':model};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);session=await page.locator('.office-composer-container').getAttribute('data-session-id');}
try{
  await launch();await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},workspace);await page.getByRole('button',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snapshot()).workspace));
  for(const [decision,target] of [['reject','拒绝的草稿.txt'],['approve','确认的草稿.txt']]){
    const input=page.getByTestId('office-prompt-input');await input.fill(`请把已授权目录中的教学资料.txt复制为${target}，实际发起需要教师确认的复制操作，等待我决定；不要只解释方法，不要覆盖其他文件。`);await page.locator('.office-composer [data-slot="prompt-input-send"]').click();assert.equal(await input.inputValue(),'');
    const card=page.locator('[data-testid="pi-copy-approval"][data-state="pending"]').last();await card.waitFor({state:'visible',timeout:90000});assert(!fs.existsSync(path.join(workspace,target)));
    if(switching){assert(await page.getByRole('button',{name:'选择模型',exact:true}).isDisabled());const result=await page.evaluate(id=>window.omniEdu.selectXiaozhiModel({schemaVersion:'xiaozhi.settings.v1',sessionId:id,version:0,model:'deepseek-v4-pro'}),session);check(`Pending ${decision} approval locks model mutation`,()=>assert(!result.ok&&result.error==='busy'));}
    if(decision==='reject')for(const [width,height]of[[1366,768],[1920,1080]]){if(switching){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});}else await page.setViewportSize({width,height});await card.scrollIntoViewIfNeeded();const rect=await card.getByTestId('pi-copy-reject').boundingBox();check(`Actual pending approval remains reachable at ${width}x${height}`,()=>assert(rect&&rect.y>=0&&rect.y+rect.height<=height));}
    if(decision==='reject'&&!switching)for(const [width,height]of[[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await card.scrollIntoViewIfNeeded();for(const action of ['approve','reject']){const rect=await card.getByTestId(`pi-copy-${action}`).boundingBox();assert(rect&&rect.x>=0&&rect.x+rect.width<=width&&rect.y>=0&&rect.y+rect.height<=height);}await page.screenshot({path:path.join(output,`approval-${width}x${height}.png`),animations:'disabled'});}
    await card.getByTestId(`pi-copy-${decision}`).click();await until(async()=>!(await snapshot()).running);const state=await snapshot(),turn=state.projection.turns.at(-1);
    check(decision==='reject'?'Teacher rejection stays visible and performs zero file write':'Teacher approval performs one actual verified copy with measured process state',()=>{assert.equal(turn.status,'completed');assert(state.approvals.some(item=>item.target===target&&item.state===(decision==='reject'?'rejected':'executed')));assert(turn.items.some(item=>item.kind==='tool'&&item.status===(decision==='reject'?'declined':'completed')));assert(Number.isFinite(turn.elapsedMs));});
    if(decision==='reject')assert(!fs.existsSync(path.join(workspace,target)));else assert.deepEqual(fs.readFileSync(path.join(workspace,target)),bytes);
    if(switching){await selectModel(decision==='reject'?'deepseek-v4-pro':'deepseek-flash');check(`Same-history model switch after ${decision} preserves teacher decision and creates no extra effect`,()=>{assert(!fs.existsSync(path.join(workspace,'拒绝的草稿.txt')));if(decision==='approve')assert.deepEqual(fs.readFileSync(path.join(workspace,'确认的草稿.txt')),bytes);});}
  }
  if(switching){
    const n=(await snapshot()).projection.turns.length;await page.getByTestId('office-prompt-input').fill('只生成逐条编号的五千条合成备课要点；不要调用工具或复制文件。');await page.locator('.office-composer [data-slot="prompt-input-send"]').click();
    await until(async()=>{const state=await snapshot();return state.running&&state.projection.turns.length>n;});await page.locator('.office-composer [data-slot="prompt-input-send"]').click();await until(async()=>!(await snapshot()).running);
    const stopped=await snapshot();check('Real active run stops through the composer before same-history model switching',()=>{assert.equal(stopped.projection.turns.at(-1).status,'interrupted');assert.equal(stopped.projection.turns.at(-1).error,'已停止本轮。');});
    await selectModel('deepseek-v4-pro');check('Idle switch after stop retains approvals and cannot resume cancelled work',()=>assert.deepEqual(fs.readFileSync(path.join(workspace,'确认的草稿.txt')),bytes));
    for(const size of[{width:1366,height:768},{width:1920,height:1080}]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),size);await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,size);await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      await page.getByRole('button',{name:'选择模型',exact:true}).click();const menu=page.getByRole('menuitemradio',{name:'deepseek-flash',exact:true});await menu.waitFor();await page.screenshot({path:path.join(output,`model-menu-stable-${size.width}.png`),animations:'disabled'});
      const rect=await menu.boundingBox();assert(rect&&rect.x>=0&&rect.y>=36&&rect.x+rect.width<=size.width&&rect.y+rect.height<=size.height);await page.keyboard.press('Escape');
      const send=await page.locator('.office-composer [data-slot="prompt-input-send"]').boundingBox(),composer=await page.locator('.office-composer [data-slot="prompt-input-shell"]').boundingBox();
      assert(send&&composer&&send.x>=composer.x&&send.y>=composer.y&&send.x+send.width<=composer.x+composer.width+1&&send.y+send.height<=composer.y+composer.height+1,'Entire send/stop button must remain inside the composer');
    }check('Same-history model menu is reachable in stable captures at both actual window sizes',()=>assert(true));
  }
  const previous=(await snapshot()).approvals;await app.close();app=undefined;await launch();await page.getByTestId(`ai-conversation-session-${session}`).click();
  check('Actual restart retains both teacher decisions and copy readback without replay',()=>assert.deepEqual(fs.readFileSync(source),bytes));assert.deepEqual((await snapshot()).approvals,previous);assert(!fs.existsSync(path.join(workspace,'拒绝的草稿.txt')));assert.deepEqual(fs.readFileSync(path.join(workspace,'确认的草稿.txt')),bytes);
  if(switching){assert.equal((await snapshot()).projection.model,'deepseek-v4-pro');assert(!(await snapshot()).running);check('Restart after switching and stopping keeps selected model and cannot replay file effects',()=>assert.equal(fs.readdirSync(workspace).filter(name=>name==='确认的草稿.txt').length,1));}
  report.success=true;
}catch(error){process.exitCode=1;report.error=String(error.stack||error).replaceAll(key,'[credential]').slice(0,2400);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))}));}
