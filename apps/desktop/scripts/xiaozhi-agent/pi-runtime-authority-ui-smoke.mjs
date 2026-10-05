import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,inspectLoadedMainModules} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {settleWorkspaceTransitions,measureTextContrast} from './capture-workspace-metrics.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-runtime-ui-')),data=path.join(output,'data');
const main=testMain(desktop),build=fingerprint(path.dirname(path.dirname(main)));
const config=fs.readFileSync(path.join(desktop,'.env.local'),'utf8');
const pick=name=>config.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`,'m'))?.[1]?.replace(/^['"]|['"]$/g,'');
const key=process.env.DEEPSEEK_API_KEY||pick('DEEPSEEK_API_KEY');assert(key,'local test credential required');
const model=process.env.DEEPSEEK_MODEL||pick('DEEPSEEK_MODEL');
const marker=randomUUID().slice(0,8),errors=[],facadeOnly=process.env.OMNI_EDU_TEST_RUNTIME_FACADE_ONLY==='1';
const compatibilityCommand=`xicmd_${randomUUID()}`;
const compatibilityMarker=randomUUID().slice(0,8);
const report={success:false,checks:[],visual:[],rendererErrors:errors,layer:'C isolated formal Electron / real DeepSeek / synthetic teacher request',humanAccepted:false,build:{files:build.files.length,sha256:build.sha256},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),boundaries:['No daily profile, installer, VPN-off or complete Phase2/Goal acceptance','Startup lookup delay/failure injected only into isolated main handler; teaching request uses real production Pi']};
let app,page,session;
const check=(name,fn)=>{fn();report.checks.push({name,pass:true});console.log(`PASS ${name}`);};
async function until(fn,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Runtime UI condition timed out');}
async function launch(){const env={...process.env,DEEPSEEK_API_KEY:key,OMNI_EDU_XIAOZHI_PI:'0',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..')};if(model)env.DEEPSEEK_MODEL=model;
  delete env.OMNI_EDU_E2E_LEGACY_RUNTIME;delete env.OMNI_EDU_E2E_DIALOG_MODE;delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  const profile=path.join(output,'profile');fs.mkdirSync(profile,{recursive:true});
  app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));
  const paths=await app.evaluate(({app})=>({userData:app.getPath('userData'),sessionData:app.getPath('sessionData')}));assert.equal(paths.userData,profile);assert.equal(paths.sessionData,profile);report.profile=paths;}
async function ready(){await page.getByTestId('office-prompt-input').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]').disabled);session=await page.locator('.office-composer-container').getAttribute('data-session-id');}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
const runs=()=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare('SELECT id,status,sub_intent FROM ai_agent_runs').all();}finally{db.close();}};
async function capture(state,theme,width,height){await page.emulateMedia({colorScheme:theme});await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});await settleWorkspaceTransitions(page);
  const status=page.getByTestId('pi-runtime-status');const contrast=await measureTextContrast(status.locator('p'));assert(contrast.ratio>=4.5,`${state} ${theme}: ${contrast.ratio}`);
  const bounds=await status.boundingBox();assert(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1);
  for(const button of await status.getByRole('button').all()){const b=await button.boundingBox();assert(b&&b.y+b.height<=height+1&&b.x+b.width<=width+1);}
  const png=path.join(output,`${state}-${theme}-${width}x${height}.png`);await page.screenshot({path:png});report.visual.push({state,theme,width,height,png,bounds,contrast});
}
async function replaceLookup(mode){await app.evaluate(({ipcMain,BrowserWindow},mode)=>{ipcMain.removeHandler('xiaozhi:enabled');ipcMain.handle('xiaozhi:enabled',event=>{
  const current=BrowserWindow.getAllWindows()[0];if(event.sender!==current.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('permission_denied');
  if(mode==='hang')return new Promise(()=>{});if(mode==='fail')throw Error('isolated_startup_failure');return true;
});},mode);await page.reload();}
try{
  await launch();await ready();
  const startupModules=await inspectLoadedMainModules(app,main);
  check('Formal main never loads historical runtime chunk on startup',()=>assert(!startupModules.some(url=>/test-runtime-/.test(url))));report.startupModules=startupModules;
  check('Normal app ignores old zero flag and opens Pi',()=>assert(session));
  assert.equal(await page.evaluate(()=>window.omniEdu.isXiaozhiEnabled()),true);
  check('No legacy run on startup',()=>assert.equal(runs().length,0));
  const assertNoDemo=async()=>{
    const boot=await page.evaluate(()=>window.omniEdu.bootstrap());assert.equal(boot.students.length,0);
    const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{for(const table of ['students','learning_records','question_bank_items'])assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,0,`${table} must contain no auto demo facts`);}finally{db.close();}
  };
  await assertNoDemo();await assertNoDemo();
  check('Fresh production bootstrap never injects demo students records or questions',()=>{});
  const results=await page.evaluate(async()=>{const api=window.omniEdu,request={schemaVersion:'xiazhi.capability.request.v1',turnId:'retired-test',capability:'chat',prompt:'不执行'};
    const calls=[['handshake',()=>api.deepTutorHandshake()],['start',()=>api.deepTutorStartTurn(request)],['continue',()=>api.deepTutorContinueTurn({continuationToken:'unknown'})],['budget',()=>api.deepTutorApproveBudget('unknown')],['mutate',()=>api.deepTutorMutateRun({sourceRunId:'unknown',action:'retry',idempotencyKey:'unknown'})],['graph',()=>api.resumeTripletRun('unknown','unknown')],['input',()=>api.deepTutorSubmitUserInput({requestId:'unknown',text:'不执行'})],['cancel',()=>api.deepTutorCancelTurn('unknown')],['stop',()=>api.deepTutorStop()]];
    const results=[];for(const [name,call]of calls){try{await call();results.push({name,rejected:false});}catch(error){results.push({name,rejected:/legacy_runtime_retired/.test(String(error))});}}return results;});
  check('Remaining 9 old orchestration IPCs reject before work',()=>{assert.equal(results.length,9);assert(results.every(item=>item.rejected));assert.equal(runs().length,0);});report.legacyIpc=results;
  const invalidAliases=await page.evaluate(async()=>Promise.all([window.omniEdu.runDeepTutorConsole({prompt:''}),window.omniEdu.runDeepSeek({prompt:'不执行',studentId:'unsupported'})]));
  check('Both production aliases reject invalid or unsupported requests without work',()=>{assert(invalidAliases.every(value=>!value.ok));assert.equal(runs().length,0);});
  assert.deepEqual(await page.evaluate(()=>window.omniEdu.listPendingDeepTutorInputs()),[]);
  check('No pending legacy input rehydrated in normal app',()=>assert.equal(runs().length,0));
  const originalSession=session;
  const legacy=await page.evaluate(async()=>{const detail=await window.omniEdu.createAiConversationSession({title:'旧版教学会话'});
    await window.omniEdu.appendAiConversationMessage(detail.session.id,{role:'user',content:'上次讨论分数课导入。',metadata:{}});
    await window.omniEdu.appendAiConversationMessage(detail.session.id,{role:'assistant',content:'保留旧版教学建议：用分纸条理解平均分。',metadata:{ok:true}});return detail.session.id;});
  await page.reload();await ready();await page.getByTestId(`ai-conversation-session-${legacy}`).click();
  await page.getByTestId('office-conversation').getByText('保留旧版教学建议：用分纸条理解平均分。',{exact:true}).waitFor();
  const legacySnapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),legacy);
  check('Teacher opens preserved legacy history in Pi without replay',()=>{assert.equal(legacySnapshot.legacyHistory,true);assert.equal(runs().length,0);});
  await page.screenshot({path:path.join(output,'legacy-history.png')});
  await page.getByTestId(`ai-conversation-session-${originalSession}`).click();
  await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===originalSession);session=originalSession;
  if(!facadeOnly){
  await replaceLookup('hang');await page.getByTestId('pi-runtime-startup').waitFor();
  const pendingComposers=await page.locator('[data-testid="ai-console-prompt"], [data-testid="office-prompt-input"]').count();
  check('Pending lookup mounts no old composer',()=>assert.equal(pendingComposers,0));
  // Capture while lookup is pending. Reset before each capture so the real 10s timeout is not raced by screenshot work.
  for(const theme of ['light','dark'])for(const [width,height]of [[1366,768],[1920,1080]]){await replaceLookup('hang');await page.getByTestId('pi-runtime-startup').waitFor();await capture('preparing',theme,width,height);}
  await page.getByTestId('pi-runtime-retry').waitFor({timeout:15000});
  const timeoutMessage=await page.getByTestId('pi-runtime-status').innerText();
  check('Hung startup becomes recoverable error without fallback',()=>assert(timeoutMessage.includes('小智暂时无法启动')));
  for(const theme of ['light','dark'])for(const [width,height]of [[1366,768],[1920,1080]])await capture('error',theme,width,height);
  await page.getByTestId('pi-runtime-leave').click();await page.getByTestId('nav-ai').waitFor();
  const teacherNavigation=await page.getByTestId('nav-knowledge').count();
  check('Startup error can return to teacher workspace',()=>assert.equal(teacherNavigation,1));
  await page.getByTestId('nav-ai').click();await page.getByTestId('pi-runtime-retry').waitFor();
  await app.evaluate(({ipcMain,BrowserWindow})=>{ipcMain.removeHandler('xiaozhi:enabled');ipcMain.handle('xiaozhi:enabled',event=>{const current=BrowserWindow.getAllWindows()[0];if(event.sender!==current.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('permission_denied');return true;});});
  await page.getByTestId('pi-runtime-retry').click();await ready();
  check('Visible retry recovers to the same Pi workspace',()=>assert(session));
  await replaceLookup('fail');await page.getByTestId('pi-runtime-retry').waitFor();
  const rejectedMessage=await page.getByTestId('pi-runtime-status').innerText();
  check('Rejected lookup stays in error state',()=>assert(rejectedMessage.includes('小智暂时无法启动')));
  // Restart restores the actual unmodified production handler before the real teacher operation.
  await app.close();app=undefined;await launch();await ready();
  }
  await page.getByTestId('office-prompt-input').fill(`请给小学老师一句简短的分数课备课建议，包含核验编号${marker}，这轮不需要使用工具。`);
  await page.getByTestId('office-prompt-input').press('Enter');
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');
  await until(async()=>{const state=await snapshot();return state.projection.turns.length===1&&!state.running&&state.projection.turns[0].status==='completed'&&runs()[0]?.status==='succeeded';},120000);
  await until(async()=>await page.locator('[data-slot="chat-message-assistant"]').count()>0&&(await page.locator('[data-slot="chat-message-assistant"]').innerText()).includes(marker));
  const final=await snapshot();report.model=final.projection.model;
  const visible=await page.locator('[data-slot="chat-message-assistant"]').innerText();
  check('Real teacher request succeeds through only one Pi run',()=>{assert(visible.includes(marker));assert.equal(runs().length,1);assert.equal(runs()[0].sub_intent,'pi_education');assert.equal(runs()[0].status,'succeeded');});
  await page.screenshot({path:path.join(output,'real-pi-teacher.png')});
  const compatibilityInput={sessionId:session,commandId:compatibilityCommand,prompt:`请给小学老师一句不同的分数课建议，包含核验编号${compatibilityMarker}，不用工具。`};
  await page.evaluate(input=>{window.compatibilityWork=Promise.all([window.omniEdu.runDeepTutorConsole(input),window.omniEdu.runDeepSeek(input)]);},compatibilityInput);
  await until(async()=>{const state=await snapshot();return !state.running&&state.projection.turns.length===2&&runs().every(row=>row.status==='succeeded');},120000);
  const compatibilityResults=await page.evaluate(()=>window.compatibilityWork);
  check('Concurrent old aliases share one real Pi admission and committed receipt',()=>{
    assert.equal(runs().length,2);assert(compatibilityResults.every(value=>value.ok&&value.content.includes(compatibilityMarker)&&!value.structuredReply&&!value.harness));
    assert.equal(compatibilityResults[0].runtimeReceipt.runId,compatibilityResults[1].runtimeReceipt.runId);
    assert.equal(compatibilityResults[0].runtimeReceipt.sessionId,session);assert(runs().every(row=>row.sub_intent==='pi_education'));
    const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{
      const saved=db.prepare("SELECT content FROM ai_conversation_messages WHERE role='assistant' AND json_extract(metadata_json,'$.agentRunId')=?").get(compatibilityResults[0].runtimeReceipt.runId);
      for(const value of compatibilityResults)assert.equal(value.content,saved.content);
    }finally{db.close();}
  });report.compatibilityReceipts=compatibilityResults.map(value=>value.runtimeReceipt);
  // Existing workspace hydrates typed compatibility requests from the same host-owned history.
  await page.reload();await ready();await until(async()=>(await page.getByTestId('office-conversation').innerText()).includes(compatibilityMarker));
  const compatibilityVisible=await page.getByTestId('office-conversation').innerText();
  check('Compatibility response is visible in current Pi workspace',()=>assert(compatibilityVisible.includes(compatibilityMarker)));
  for(const theme of ['light','dark'])for(const [width,height]of [[1366,768],[1920,1080]]){
    await page.emulateMedia({colorScheme:theme});await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});await settleWorkspaceTransitions(page);
    const composer=await page.getByTestId('office-prompt-input').boundingBox();assert(composer&&composer.x>=0&&composer.y>=0&&composer.x+composer.width<=width+1&&composer.y+composer.height<=height+1);
    const png=path.join(output,`compatibility-${theme}-${width}x${height}.png`);await page.screenshot({path:png});report.visual.push({state:'compatibility',theme,width,height,png,composer});
  }
  const conflict=await page.evaluate(input=>window.omniEdu.runDeepSeek({...input,prompt:'同一命令另一个内容'}),compatibilityInput);
  check('Conflicting replay cannot create another Pi run',()=>{assert.equal(conflict.ok,false);assert.equal(runs().length,2);});
  const nativeFiles=()=>{const root=path.join(data,'xiaozhi-pi',session);return fs.readdirSync(root,{recursive:true}).filter(file=>String(file).endsWith('.jsonl')).map(file=>({file:String(file),sha256:sha256(fs.readFileSync(path.join(root,String(file))))}));};
  const nativeBefore=nativeFiles();assert(nativeBefore.length>0);
  const before=JSON.stringify(runs());await app.close();app=undefined;await launch();await ready();
  await page.locator('[data-slot="chat-message-assistant"]').last().waitFor();
  check('Cold restore keeps answer without another model run',()=>{assert.equal(JSON.stringify(runs()),before);});
  const replay=await page.evaluate(input=>window.omniEdu.runDeepTutorConsole(input),compatibilityInput);
  check('Cold alias retry returns same receipt without model or transcript replay',()=>{assert.equal(replay.ok,true);assert.equal(replay.runtimeReceipt.runId,compatibilityResults[0].runtimeReceipt.runId);assert.equal(JSON.stringify(runs()),before);assert.deepEqual(nativeFiles(),nativeBefore);});
  report.nativeFiles=nativeBefore;
  await assertNoDemo();check('Cold production bootstrap keeps business facts empty',()=>{});
  const coldModules=await inspectLoadedMainModules(app,main);
  check('Real Pi alias requests and cold replay never load historical runtime',()=>assert(!coldModules.some(url=>/test-runtime-/.test(url))));report.coldModules=coldModules;
  check('No renderer errors',()=>assert.deepEqual(errors,[]));report.success=true;
}catch(error){report.error=String(error);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}finally{if(app)await app.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,error:report.error}));}
