import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {_electron as electron} from 'playwright';
const desktop=process.cwd(),output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-failure-recovery-'));
const workspace=path.join(output,'教研目录');fs.mkdirSync(workspace);fs.writeFileSync(path.join(workspace,'课程.txt'),'合成课程：分数加法。');
const cfg=fs.readFileSync(path.join(desktop,'.env.local'),'utf8');
const key=process.env.DEEPSEEK_API_KEY||cfg.match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const report={success:false,checks:[],boundary:'Real DeepSeek/native budget failure and actual UI retry preparation, synthetic owned files; chooser controlled; no network fault/VPN-off/PDF claim'};
let app,page,id;const errors=[];
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn){const end=Date.now()+120000;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Failure UI condition timed out');}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
async function budget(calls){const current=(await snapshot()).budgetSettings;await page.getByTestId('pi-task-details-expand').click();if(await page.getByTestId('pi-budget-expand').getAttribute('aria-expanded')!=='true')await page.getByTestId('pi-budget-expand').click();await page.getByTestId('pi-budget-maxModelCalls').fill(String(calls));await page.getByTestId('pi-budget-activeMs').fill('120');await page.getByTestId('pi-budget-save').click();await until(async()=>(await snapshot()).budgetSettings.version===current.version+1);await page.getByTestId('pi-task-details-expand').click();}
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(output,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error).replaceAll(key,'[redacted]')));
 await page.getByTestId('office-conversation').waitFor();await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());id=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},workspace);await page.getByRole('button',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snapshot()).workspace));
 await budget(1);const task='请实际调用 office_list_files 列出当前教研目录，然后根据工具结果回答。不要写文件、不要提问，也不要省略工具。';
 const input=page.getByTestId('office-prompt-input');await input.fill(task);await page.getByRole('button',{name:'发送消息',exact:true}).click();assert.equal(await input.inputValue(),'');
 await until(async()=>(await snapshot()).projection.turns.length>0&&!(await snapshot()).running);const before=await snapshot(),turn=before.projection.turns.at(-1);
 assert.equal(turn.status,'failed');assert(before.usage.some(item=>item.runId===turn.id&&item.exhausted==='model_calls'));assert(turn.items.some(item=>item.kind==='tool'&&item.status==='completed'));
 check('Real provider tool completes before the native next-request budget failure; partial facts remain');
 const notice=page.locator(`[data-turn-id="${turn.id}"] .office-turn-notice`);assert(!/TypeError|fetch failed|sk-/.test(await notice.innerText()));assert(await notice.getByTestId('office-turn-retry').isVisible());
 for(const [width,height]of[[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await notice.scrollIntoViewIfNeeded();const box=await notice.getByTestId('office-turn-retry').boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=height);await page.screenshot({path:path.join(output,`failure-${width}x${height}.png`)});check(`Real failure recovery action and previous evidence remain reachable at ${width}x${height}`);}
 await input.fill('教师的新草稿');await notice.getByTestId('office-turn-retry').click();assert.equal(await input.inputValue(),'教师的新草稿');assert((await page.getByTestId('pi-retry-hint').innerText()).includes('已为你保留'));assert.equal((await snapshot()).projection.turns.length,before.projection.turns.length);check('Preparing recovery cannot overwrite another unsent draft or start a run');
 await input.fill('');await notice.getByTestId('office-turn-retry').click();assert.equal(await input.inputValue(),task);assert.equal((await snapshot()).projection.turns.length,before.projection.turns.length);assert(!(await snapshot()).running);assert.deepEqual(fs.readdirSync(workspace),['课程.txt']);check('Actual failed task returns to the unsent composer without replaying tools or writes');
 await page.getByRole('button',{name:'显示或隐藏文件面板',exact:true}).click();assert.equal(await input.inputValue(),task);await page.getByRole('button',{name:'显示或隐藏文件面板',exact:true}).click();assert.equal(await input.inputValue(),task);check('Prepared recovery draft survives real file reparenting');
 await budget(4);await input.fill('只回复：任务已重新整理。不要调用工具或写文件。');await page.getByRole('button',{name:'发送消息',exact:true}).click();await until(async()=>(await snapshot()).projection.turns.length===before.projection.turns.length+1&&!(await snapshot()).running);const after=await snapshot();assert.equal(after.projection.turns.at(-1).status,'completed');assert.equal(after.projection.turns[0].status,'failed');assert.equal(after.usage.at(-1).toolCalls,0);assert.equal(await input.inputValue(),'');assert.deepEqual(fs.readdirSync(workspace),['课程.txt']);assert.deepEqual(errors,[]);check('Teacher edits and explicitly sends a new successful real request; previous failed turn and effects stay intact');report.success=true;
}catch(error){process.exitCode=1;report.error=String(error.stack||error).replaceAll(key,'[redacted]').slice(0,3000);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))}));}

