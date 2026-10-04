import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash,randomUUID } from 'node:crypto';
import { _electron as electron } from 'playwright';
const desktop=process.cwd(),output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-history-model-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const config=fs.readFileSync(path.join(desktop,'.env.local'),'utf8');
const apiKey=process.env.DEEPSEEK_API_KEY || config.match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(apiKey);
const report={success:false,checks:[],models:[],viewports:[],boundary:'Formal Electron visible model menu, same conversation and real DeepSeek; no full pixel-match/VPN-off/installer claim'};
const errors=[];let app,page,id,original;
const sha=value=>createHash('sha256').update(value).digest('hex');
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn,ms=120000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('History model UI condition timed out');}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const settings=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSettings({sessionId:id}),id);
function native(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{
  const binding=db.prepare('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(id);
  const ledger=db.prepare('SELECT * FROM xiaozhi_pi_model_state WHERE conversation_id=?').get(id);
  const transitions=db.prepare('SELECT status,source_model,target_model,expected_revision FROM xiaozhi_pi_model_transitions WHERE conversation_id=? ORDER BY expected_revision').all(id);
  const counts={messages:db.prepare('SELECT count(*) AS n FROM ai_conversation_messages WHERE session_id=?').get(id).n,
    runs:db.prepare('SELECT count(*) AS n FROM ai_agent_runs WHERE session_id=?').get(id).n};
  const file=path.resolve(data,'xiaozhi-pi',binding.session_file),bytes=fs.readFileSync(file),rows=bytes.toString('utf8').trimEnd().split('\n').map(JSON.parse);
  return{binding,ledger,transitions,counts,file,bytes,header:rows[0],rows};
}finally{db.close();}}
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'',DEEPSEEK_MODEL:''};
  delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();
  page.on('pageerror',error=>errors.push(String(error).replaceAll(apiKey,'[redacted]')));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
  const current=await page.locator('.office-composer-container').getAttribute('data-session-id');if(id)assert.equal(current,id);else id=current;
}
async function send(text,expectedModel,marker,busyCheck=false){const before=(await snapshot()).projection.turns.length,input=page.getByTestId('office-prompt-input');
  await input.fill(text);await page.locator('.office-composer [data-slot="prompt-input-send"]').click();assert.equal(await input.inputValue(),'');
  await until(async()=>(await snapshot()).projection.turns.length>before);
  if(busyCheck){await until(async()=>(await snapshot()).running);assert(await page.getByRole('button',{name:'选择模型',exact:true}).isDisabled());
    const result=await page.evaluate(id=>window.omniEdu.selectXiaozhiModel({schemaVersion:'xiaozhi.settings.v1',sessionId:id,version:0,model:'deepseek-v4-pro'}),id);assert(!result.ok&&result.error==='busy');check('Active run disables the actual menu and main rejects concurrent model mutation');}
  await until(async()=>!(await snapshot()).running);const end=await snapshot(),turn=end.projection.turns.at(-1);
  assert.equal(end.projection.model,expectedModel);assert.equal(turn.status,'completed',turn.error);
  assert(turn.items.some(item=>item.role==='assistant'&&item.text?.includes(marker)),'Actual model must recall the synthetic history marker');
  const current=native(),assistant=current.rows.filter(row=>row.type==='message'&&row.message.role==='assistant').at(-1);
  assert.equal(assistant.message.model,expectedModel);report.models.push({model:assistant.message.model,runId:turn.id,completed:true});
}
async function choose(model){const before=native(),state=await settings();assert(state.ok&&!state.value.sessionModel.locked);
  await until(async()=>!await page.getByRole('button',{name:'选择模型',exact:true}).isDisabled());
  await page.getByRole('button',{name:'选择模型',exact:true}).click();await page.getByRole('menuitemradio',{name:model,exact:true}).click();
  await until(async()=>(await snapshot()).projection.model===model&&!await page.getByTestId('office-prompt-input').isDisabled());
  const after=native();assert.equal(after.file,before.file);assert.deepEqual(after.header,before.header);assert(after.bytes.subarray(0,before.bytes.length).equals(before.bytes));
  assert.deepEqual(after.counts,before.counts);assert.equal(after.binding.schema_version,5);assert.equal(after.ledger.current_model,model);assert.equal(after.ledger.origin_model,'deepseek-flash');
  assert.equal(after.ledger.revision,state.value.sessionModel.version+1);assert.equal(after.transitions.at(-1).status,'committed');
  const snap=after.rows.find(row=>row.customType==='xiaozhi.education.snapshot.v1');assert.equal(sha(JSON.stringify(snap)),original);
}
try{
  await launch();await page.getByRole('button',{name:'小智模型设置',exact:true}).click();await page.getByTestId('pi-model-settings').waitFor();
  await until(async()=>!await page.getByTestId('pi-settings-key').isDisabled());await page.getByTestId('pi-settings-key').fill(apiKey);await page.getByTestId('pi-settings-save').click();
  await until(async()=>/已保存/.test(await page.getByTestId('pi-settings-feedback').innerText()));assert.equal(await page.getByTestId('pi-settings-key').inputValue(),'');
  await page.getByTestId('nav-ai').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
  check('Fresh owned profile configures live DeepSeek from the visible encrypted-key form');
  const marker='EDU-'+randomUUID().slice(0,8);
  await send(`合成备课验收。不要调用工具，只回复“${marker}”，后续我要确认你是否保留本会话上下文。`,'deepseek-flash',marker,true);
  const initial=native();original=sha(JSON.stringify(initial.rows.find(row=>row.customType==='xiaozhi.education.snapshot.v1')));const initialId=id,initialNativeId=initial.header.id;
  check('Initial Flash response is verified in real provider native history, and sent draft clears');
  await choose('deepseek-v4-pro');check('Visible bound-history menu switches Flash to Pro with same native file, history prefix, origin snapshot and no new run');
  const stale=await page.evaluate(id=>window.omniEdu.selectXiaozhiModel({schemaVersion:'xiaozhi.settings.v1',sessionId:id,version:0,model:'deepseek-flash'}),id);
  assert(!stale.ok&&stale.error==='conflict');assert.equal((await snapshot()).projection.model,'deepseek-v4-pro');check('Stale selector cannot change a committed model or silently replace conversation');
  await send('我上一条提到的合成备课验收标记是什么？不要调用工具，只回复该标记。','deepseek-v4-pro',marker);
  check('Live Pro continuation recalls prior Flash history; native assistant.model confirms actual requested model');
  await choose('deepseek-flash');check('Visible menu switches Pro back to Flash in the same native history');
  await send('请再确认本会话最初的合成备课验收标记，只回复那个标记，不调用工具。','deepseek-flash',marker);
  check('Live Flash continuation retains the same initial history across both switches');
  for(const size of [{width:1366,height:768},{width:1920,height:1080}]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),size);
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,size);
    await page.getByRole('button',{name:'选择模型',exact:true}).click();assert(await page.getByRole('menuitemradio',{name:'deepseek-v4-pro',exact:true}).isVisible());
    const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth+1}));assert(!dimensions.overflow);
    await page.screenshot({path:path.join(output,`history-models-${size.width}.png`),animations:'disabled'});await page.keyboard.press('Escape');report.viewports.push(dimensions);
    const send=await page.locator('.office-composer [data-slot="prompt-input-send"]').boundingBox(),composer=await page.locator('.office-composer [data-slot="prompt-input-shell"]').boundingBox();assert(send&&composer&&send.x>=composer.x&&send.x+send.width<=composer.x+composer.width+1&&send.y>=composer.y&&send.y+send.height<=composer.y+composer.height+1);
  }check('Existing HeroUI model menu is reachable with real history at both required viewports');
  const beforeRestart=native();await app.close();app=undefined;await launch();assert.equal(id,initialId);const restored=native();
  assert.equal(restored.header.id,initialNativeId);assert.equal(restored.ledger.current_model,'deepseek-flash');assert.equal(restored.ledger.revision,2);assert.deepEqual(restored.counts,beforeRestart.counts);
  assert.equal((await snapshot()).projection.turns.length,3);check('Restart preserves model selection, one conversation/native identity and public turns without replay');
  await send('重启后，继续之前会话：最开始的合成备课验收标记是什么？只回复标记，不调用工具。','deepseek-flash',marker);
  check('Real provider recalls original history after application restart');
  assert.equal(errors.length,0,errors.join('\n'));check('No renderer exceptions');report.success=true;
}catch(error){report.error={name:error.name,message:String(error.message).replaceAll(apiKey,'[redacted]'),stack:String(error.stack).replaceAll(apiKey,'[redacted]')};process.exitCode=1;
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,...(report.error?{error:report.error}:{})},null,2));
