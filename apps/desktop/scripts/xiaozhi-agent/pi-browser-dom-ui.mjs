import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from 'playwright';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/browser-dom-ui-'));
const profile=path.join(output,'profile'), data=path.join(output,'data');
const main=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT || 'out','main/index.js');
const url='https://fixture.invalid/teaching';
const resultText='初二物理实验共七项';
const actions=[], checks=[];
let planned = false;
let guideRequested = false;
let problem, app, page, lastSnapshot, tabId, target;
function observe(messages) {
  const last=messages.findLast(message=>message.role==='tool');
  if (!last) return;
  const text=typeof last.content==='string'?last.content:JSON.stringify(last.content);
  lastSnapshot=text.match(/pisnapshot_[a-f0-9-]+/i)?.[0]??lastSnapshot;
  tabId=text.match(/pibrowser_[a-f0-9-]+/i)?.[0]??tabId;
  target=Number(text.replaceAll('\\','').match(/"matchedRef"\s*:\s*(\d+)/)?.[1]??target);
  return text;
}
const server=http.createServer(async(req,res)=>{
  if(req.url==='/v1/models')return res.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',input_modalities:['text'],context_window:1048576,max_output_tokens:32768}]}));
  let raw='';for await(const part of req)raw+=part;
  const body=JSON.parse(raw), last=observe(body.messages);
  const step=actions.length;
  const inputs=[{action:'navigate',url},{action:'snapshot',tabId,snapshotId:lastSnapshot,role:'button',name:'筛选年级'},
    {action:'click',tabId,snapshotId:lastSnapshot,ref:target,expectText:resultText}];
  const valid=step===0||step===1&&lastSnapshot||step===2&&target>0||step===3&&last?.includes(resultText);
  res.setHeader('content-type','text/event-stream');
  const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'browser-test',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})+'\n\n';
  if (!guideRequested) {
    const system = body.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const skill = (system.match(/<skill>[\s\S]*?<\/skill>/g) || []).find(block => block.includes('<name>education-evidence</name>'));
    const location = skill?.match(/<location>([^<]+)<\/location>/)?.[1];
    if (location) {
      guideRequested = true;
      return res.end(chunk({role:'assistant'})+chunk({tool_calls:[{index:0,id:'guide_1',type:'function',function:{name:'read',arguments:JSON.stringify({path:location})}}]})+chunk({},'tool_calls')+'data: [DONE]\n\n');
    }
    problem = {reason:'The current Pi system prompt did not advertise the enabled browser guide'};
  }
  if (!planned) {
    const system = body.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    if (guideRequested && last?.includes('内置浏览器操作手册') && last.includes('task_plan_required'))
      checks.push('Pi discovers and reads the managed browser guide');
    else problem ||= {reason:'The governed read did not return the current browser guide', detail:last?.slice(0,180)};
    const line = system.split('\n').findLast(l => l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
    const task = line ? JSON.parse(line) : {requirementsVersion: 1, revision: 0};
    const steps = [
      {id:'open', text:'打开教学资料页面', kind:'web', target:url, dependsOn:[], reported:'pending'},
      {id:'filter', text:'点击筛选并核对列表', kind:'web', target:url, dependsOn:['open'], reported:'pending'},
      {id:'review', text:'教师核对结果', kind:'human', dependsOn:['filter'], reported:'pending'}
    ];
    const args = {schemaVersion:'xiaozhi.task-plan.v3', requirementsVersion:task.requirementsVersion,
      expectedRevision:task.revision, reason:'浏览老师指定的资源并核对筛选结果', steps};
    planned = true;
    return res.end(chunk({role:'assistant'})+chunk({tool_calls:[{index:0,id:'plan_1',type:'function',function:{name:'update_task_plan',arguments:JSON.stringify(args)}}]})+chunk({},'tool_calls')+'data: [DONE]\n\n');
  }
  if(!valid)problem={step,last:last?.slice(0,600),tools:body.tools?.map(t=>t.function.name)};
  if(step<3&&valid){
    const input={...inputs[step],taskStepId:step < 2 ? "open" : "filter"};actions.push(input.action);
    return res.end(chunk({role:'assistant'})+chunk({tool_calls:[{index:0,id:'browser_'+step,type:'function',function:{name:'office_browser',arguments:JSON.stringify(input)}}]})+chunk({},'tool_calls')+'data: [DONE]\n\n');
  }
  return res.end(chunk({role:'assistant',content:valid?resultText:'夹具未读到真实工具结果'})+chunk({},'stop')+'data: [DONE]\n\n');
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const boot=path.join(output,'test.cjs');
fs.writeFileSync(boot,`const {app,net}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
net.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input.url||input.href);
if(u.origin!=='https://api.deepseek.com')throw Error('unexpected fixture request');
return globalThis.fetch('http://127.0.0.1:${server.address().port}'+u.pathname,init)};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)}));`);
const html='<h1>教学资料</h1><button aria-label="筛选年级" onclick="window.count=(window.count||0)+1;setTimeout(()=>document.querySelector(\'p\').textContent=\''+resultText+'\',1300)">筛选</button><p>全部年级</p>';
async function launch(){
  const env={...process.env,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'local-only',DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..')};
  delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:[boot],env,timeout:60000});
  page=await app.firstWindow();await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
}
try {
  await launch();
  await app.evaluate(({app,session},html)=>{
    const seen=new Set();
    app.on('web-contents-created',(_e,wc)=>{
      if(wc.session===session.defaultSession||wc.getLastWebPreferences().preload||seen.has(wc.session))return;
      seen.add(wc.session);wc.session.protocol.handle('https',request=>new URL(request.url).hostname==='fixture.invalid'?new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8'}}):new Response('',{status:403}));
    });
  },html);
  await page.getByTestId('office-prompt-input').fill('在内置浏览器打开 '+url+'，筛选年级并核对更新的物理实验列表。');
  await page.getByTestId('office-prompt-input').press('Enter');
  const approve=page.getByText('同意这次操作',{exact:true}).last();
  await approve.waitFor({timeout:60000});await approve.click();
  await page.getByTestId('pi-question-submit').click();
  await page.waitForFunction(text=>document.body.innerText.includes(text),resultText,{timeout:45000});
  const views=await app.evaluate(({webContents},url)=>webContents.getAllWebContents().filter(w=>w.getURL()===url).map(w=>w.id),url);
  assert.equal(views.length,1);
  checks.push('One native guest at the requested URL');
  const view=app.context().pages().find(p=>p.url()===url);
  assert(view, 'The Electron test driver must resolve the visible guest');
  assert.equal(await view.getByRole('button',{name:'筛选年级'}).count(),1);
  checks.push('Playwright sees the same guest and also the application renderer');
  const count=await app.evaluate(({webContents},id)=>webContents.fromId(id).executeJavaScript('window.count'),views[0]);
  assert.equal(count,1);assert.deepEqual(actions,['navigate','snapshot','click']);assert(!problem);
  checks.push('Composer → Pi → teacher approval → one Chromium click → delayed text');
  const dock=page.getByTestId('pi-browser-dock');
  await dock.waitFor({timeout:15000});
  const owner=page.getByTestId('pi-browser-owner');
  await owner.click();await dock.getByText('老师操作中',{exact:true}).waitFor();
  await dock.getByRole('button',{name:'独立窗口'}).click();
  await dock.getByText('网页已在独立窗口打开。').waitFor();
  await dock.getByRole('button',{name:'放回对话'}).click();
  await page.getByTestId('pi-browser-slot').waitFor();
  await owner.click();await dock.getByText('小智操作中',{exact:true}).waitFor();
  assert.equal(await app.evaluate(({BrowserWindow,webContents},id)=>BrowserWindow.getAllWindows().some(w=>w.contentView.children.some(v=>v.webContents===webContents.fromId(id))),views[0]),true);
  checks.push('Teacher takes and returns control and reattaches the same native guest through visible controls');
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow,webContents},{id,width,height})=>{
      const win=BrowserWindow.getAllWindows().find(w=>w.contentView.children.some(v=>v.webContents===webContents.fromId(id)));
      win.setContentSize(width,height);
    },{id:views[0],width,height});
    await page.waitForFunction(w=>Math.abs(innerWidth-w)<3,width);
    const slot=await page.getByTestId('pi-browser-slot').boundingBox();
    assert(slot&&slot.width>250&&slot.height>150);
    await view.waitForFunction(size=>Math.abs(innerWidth-size.width)<3&&Math.abs(innerHeight-size.height)<3,slot);
  }
  checks.push('Native viewport follows the visible right-hand slot at 1366×768 and 1920×1080');
  await owner.click();
  const remember=dock.getByRole('button',{name:'打开此站的本机登录'});
  await remember.click();
  await remember.waitFor({state:'hidden'});
  await dock.getByRole('button',{name:'清除此站登录',exact:true}).click();
  await dock.getByRole('button',{name:'确认清除此站登录',exact:true}).click();
  await dock.getByText('已清除此站保存在小智中的登录信息。').waitFor();
  await remember.waitFor();
  checks.push('Teacher selects the local login profile and explicitly confirms clearing it in the conversation');
  await app.close();app=undefined;await launch();
  assert.equal(await app.evaluate(({webContents},url)=>webContents.getAllWebContents().filter(w=>w.getURL()===url).length,url),0);
  const db = new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try {
    const receipts = db.prepare("SELECT call_id, phase, success FROM xiaozhi_tool_receipts WHERE tool='office_browser' ORDER BY start_sequence").all();
    assert.deepEqual(receipts.map(row => [row.call_id,row.phase,row.success]),actions.map((_,i) => ['browser_'+i,'settled',1]));
    const effects = db.prepare("SELECT call_id,state FROM xiaozhi_effects_v1 WHERE json_extract(document_json,'$.tool')='office_browser' ORDER BY created_at").all();
    assert.deepEqual(effects.map(row => [row.call_id,row.state]),[['browser_0','committed'],['browser_2','unknown']]);
    const {session_file} = db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings').get();
    const entries = fs.readFileSync(path.join(data,'xiaozhi-pi',session_file),'utf8').trim().split('\n').map(line=>JSON.parse(line));
    const wait = entries.find(entry => entry.message?.role==='toolResult' && entry.message.toolCallId==='browser_2');
    const result = JSON.parse(wait.message.content[0].text);
    assert.equal(result.url,url);
    assert(result.text.includes(resultText));
    checks.push('Restored SQLite receipts and Pi result bind the updated list to the requested URL');
  } finally {db.close();}
  assert.equal(actions.length,3);checks.push('Reopened profile, zero browser replays');
} catch(error){problem={detail:problem,error:String(error)};process.exitCode=1;}
finally {
  if(app)await app.close().catch(()=>{});
  server.close();server.closeAllConnections();
  const report={checks,actions,problem,output,provider:'local deterministic SSE'};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
