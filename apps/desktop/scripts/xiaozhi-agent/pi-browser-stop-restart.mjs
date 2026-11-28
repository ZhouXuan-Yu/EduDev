import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from 'playwright';
import {createBrowserChatFixture} from './browser-chat-fixture.mjs';

const stage = process.argv[2];
assert(['before-approval', 'after-click'].includes(stage), 'Choose before-approval or after-click');
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/browser-stop-'));
const profile = path.join(output, 'profile');
const data = path.join(output, 'data');
const url = 'https://fixture.invalid/teaching';
const fixture = await createBrowserChatFixture({url, resultText:'初二物理实验共七项'});
const report = {stage, output, checks:[]};
const main = path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT || 'out', 'main/index.js');
const boot = path.join(output, 'boot.cjs');
fs.writeFileSync(boot, `const {app,net}=require('electron');
app.setPath('userData', ${JSON.stringify(profile)});
net.fetch=(input,init)=>{
  const u=new URL(typeof input==='string'?input:input.url||input.href);
  if(u.origin!=='https://api.deepseek.com')throw Error('unexpected fixture request');
  return globalThis.fetch('http://127.0.0.1:${fixture.server.address().port}'+u.pathname,init);
};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)}));`);

const env = {...process.env, OMNI_EDU_XIAOZHI_PI:'1', OMNI_EDU_DATA_ROOT:data,
  OMNI_EDU_REPO_ROOT:path.resolve('../..'), OMNI_EDU_E2E_DIALOG_MODE:'1', DEEPSEEK_API_KEY:'local-only', DEEPSEEK_MODEL:'deepseek-flash'};
delete env.NODE_OPTIONS;
delete env.ELECTRON_RUN_AS_NODE;
let app;
async function launch() {
  app = await electron.launch({args:[boot], env, timeout:60000});
  const page = await app.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
  return page;
}

try {
  const page = await launch();
  await app.evaluate(({app,session}, url) => {
    const seen = new Set();
    app.on('web-contents-created', (_event,wc) => {
      if (wc.session === session.defaultSession || wc.getLastWebPreferences().preload || seen.has(wc.session)) return;
      seen.add(wc.session);
      // The result never arrives, leaving a measurable interval after the real click.
      const html = '<h1>教学资料</h1><button aria-label="筛选年级" onclick="window.count++">筛选</button><p>全部年级</p><script>window.count=0</script>';
      wc.session.protocol.handle('https', req => req.url === url
        ? new Response(html, {headers:{'Content-Type':'text/html;charset=utf-8'}})
        : new Response('', {status:403}));
    });
  }, url);
  const input = page.getByTestId('office-prompt-input');
  await input.fill('在内置浏览器打开 '+url+'，筛选年级并核对更新的物理实验列表。');
  await input.press('Enter');
  const yes = page.getByText('同意这次操作', {exact:true}).last();
  await yes.waitFor({timeout:90000});
  const sessionId = await page.locator('.office-composer-container').getAttribute('data-session-id');
  const guest = app.context().pages().find(p=>p.url()===url);
  assert(guest && sessionId && !fixture.problem);
  assert.equal(await guest.evaluate(()=>window.count), 0);
  if (stage === 'after-click') {
    await yes.click();
    await page.getByTestId('pi-question-submit').click();
    await guest.waitForFunction(()=>window.count===1, undefined, {polling:25,timeout:5000});
  }
  await page.getByRole('button', {name:'停止本轮',exact:true}).click();
  const stopDeadline = Date.now()+20000;
  let interrupted = false;
  while (Date.now()<stopDeadline) {
    interrupted = await page.evaluate(async id=>{
      const snapshot = await window.omniEdu.getXiaozhiSnapshot(id);
      return !snapshot.running && snapshot.projection.turns.at(-1)?.status==='interrupted';
    },sessionId);
    if (interrupted) break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(interrupted,'Stop did not settle in the original conversation');
  report.clicks = await guest.evaluate(()=>window.count);
  assert.equal(report.clicks, stage==='after-click'?1:0);
  report.checks.push('Teacher stop reached an interrupted durable turn with expected independent page count');

  const callsBeforeRestart = [...fixture.actions];
  await app.close();
  app = undefined;
  const reopened = await launch();
  const restored = await reopened.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id), sessionId);
  assert(!restored.running && !restored.browser?.open);
  assert.equal(restored.projection.turns.at(-1)?.status, 'interrupted');
  assert.deepEqual(fixture.actions, callsBeforeRestart);
  const db = new DatabaseSync(path.join(data,'app.db'), {readOnly:true});
  try {
    const receipts = db.prepare("SELECT phase,success FROM xiaozhi_tool_receipts WHERE tool='office_browser' AND call_id='browser_2'").all();
    assert(receipts.length<=1 && receipts.every(row=>row.success!==1));
    const effects = db.prepare("SELECT state FROM xiaozhi_effects_v1 WHERE json_extract(document_json,'$.tool')='office_browser' AND call_id='browser_2'").all();
    report.receipts = receipts;
    report.effectStates = effects.map(row=>row.state);
    if (stage==='after-click') assert.deepEqual(report.effectStates,['unknown']);
    else assert(!report.effectStates.includes('committed'));
    const {session_file} = db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(sessionId);
    const entries = fs.readFileSync(path.join(data,'xiaozhi-pi',session_file),'utf8').trim().split('\n').map(s=>JSON.parse(s));
    const clicks = entries.flatMap(e=>Array.isArray(e.message?.content)?e.message.content:[])
      .filter(c=>c.type==='toolCall' && c.name==='office_browser' && c.arguments?.action==='click');
    assert.equal(clicks.length,1);
    assert.equal(clicks[0].id,'browser_2');
  } finally { db.close(); }
  report.checks.push('Cold SQLite, Pi transcript and absence of a reopened guest confirm no replay');
  if (stage==='after-click') {
    const composer=reopened.locator('.office-composer-container');
    if (await composer.getAttribute('data-session-id')!==sessionId) {
      await reopened.getByTestId('pi-sidebar-toggle').click();
      await reopened.getByTestId('ai-conversation-session-'+sessionId).click();
    }
    await reopened.waitForFunction(id=>document.querySelector('.office-composer-container')?.dataset.sessionId===id,sessionId);
    let turns=0;
    fixture.server.removeAllListeners('request');
    fixture.server.on('request',async(req,res)=>{
      if (req.url.endsWith('/models')) {
        res.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',input_modalities:['text']}]}));
        return;
      }
      let body='';
      for await (const part of req) body+=part;
      const messages=JSON.parse(body).messages;
      const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
      const planLine=system.split('\n').findLast(line=>line.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
      const task=planLine?JSON.parse(planLine):{requirementsVersion:1,revision:0};
      res.setHeader('content-type','text/event-stream');
      const frame=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'resume',model:'deepseek-flash',object:'chat.completion.chunk',choices:[{index:0,delta,finish_reason}]})+'\n\n';
      const tool=(id,name,args)=>({tool_calls:[{index:0,id,type:'function',function:{name,arguments:JSON.stringify(args)}}]});
      const responses=[
        tool('resume_plan','update_task_plan',{schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,expectedRevision:task.revision,reason:'按老师要求只读核对当前网页状态',steps:[
          {id:'verify-tabs',text:'查看本次可用的浏览器标签',kind:'web',target:url,dependsOn:[],reported:'pending'},
          {id:'inspect',text:'核对现有标签是否仍含原站结果',kind:'web',target:url,dependsOn:['verify-tabs'],reported:'pending'},
          {id:'review',text:'教师核对恢复状态',kind:'human',dependsOn:['inspect'],reported:'pending'}
        ]}),
        tool('resume_tabs','office_browser',{action:'tabs',taskStepId:'verify-tabs'}),
        {content:'上次筛选仍需核对，本轮没有再次点击。'}
      ];
      const delta=responses[Math.min(turns++,responses.length-1)];
      res.end(frame({role:'assistant'})+frame(delta)+frame({},delta.tool_calls?'tool_calls':'stop')+'data: [DONE]\n\n');
    });
    const prompt=reopened.getByTestId('office-prompt-input');
    await prompt.fill('请继续刚才的任务。先只读核对当前标签，上次筛选效果未知，不要重复点击。原页是 '+url);
    await prompt.press('Enter');
    const until=Date.now()+60000;
    let resumed=false;
    while(Date.now()<until) {
      resumed=await reopened.evaluate(async({id,old})=>{
        const s=await window.omniEdu.getXiaozhiSnapshot(id);
        const turn=s.projection.turns.at(-1);
        return !s.running && turn?.id!==old && turn?.status==='completed';
      },{id:sessionId,old:restored.projection.turns.at(-1).id});
      if(resumed && turns>=3)break;
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    const resumedDb=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
    try {
      const calls=resumedDb.prepare("SELECT call_id,success FROM xiaozhi_tool_receipts WHERE tool='office_browser' ORDER BY rowid").all();
      report.resumeCalls=calls.map(c=>[c.call_id,c.success]);
      assert(resumed && turns>=3,'The read-only continuation did not finish');
      assert.equal(calls.filter(c=>c.call_id==='browser_2').length,1);
      assert.equal(calls.at(-1).call_id,'resume_tabs');
      assert.equal(calls.at(-1).success,1);
      assert.equal(calls.length,4);
      const binding=resumedDb.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(sessionId);
      const history=fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file),'utf8').trim().split('\n').map(line=>JSON.parse(line).message);
      const receipt=history.findLast(m=>m?.role==='toolResult' && m.toolCallId==='resume_tabs');
      const actual=JSON.parse(receipt.content[0].text);
      assert(Array.isArray(actual.tabs) && !actual.tabs.some(t=>t.url===url));
      assert.equal(resumedDb.prepare("SELECT state FROM xiaozhi_effects_v1 WHERE call_id='browser_2'").get().state,'unknown');
      report.checks.push('Resuming the original chat reads current tabs; the old click remains unknown and is never submitted again');
    } finally {resumedDb.close();}
  }
  report.pass=true;
} catch(error) {
  report.error=String(error);
  process.exitCode=1;
} finally {
  await app?.close().catch(()=>{});
  fixture.server.close();
  fixture.server.closeAllConnections();
  fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
