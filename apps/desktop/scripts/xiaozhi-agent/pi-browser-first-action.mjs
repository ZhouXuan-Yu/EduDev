import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {createBrowserChatFixture} from './browser-chat-fixture.mjs';

const [strategy, buildRoot, ledger] = process.argv.slice(2);
assert(['split','combined','grounded'].includes(strategy) && buildRoot && ledger, 'Expected split|combined, build root and evidence JSONL');
const main = path.resolve(buildRoot,'main/index.js');
const build = createHash('sha256').update(fs.readFileSync(main)).digest('hex');
const parent=process.env.OMNI_EDU_BROWSER_BENCH_TEMP==='1'?tmpdir():path.resolve('test-results/xiaozhi-agent');
const output = fs.mkdtempSync(path.join(parent,'browser-first-'));
const data = path.join(output,'data');
const profile = path.join(output,'profile');
const url = 'https://fixture.invalid/teaching';
const resultText = '初二物理实验共七项';
const html = `<meta charset="utf-8"><h1>教学资料</h1><button aria-label="筛选年级" onclick="window.count++;setTimeout(()=>document.querySelector('p').textContent='初二物理实验共七项',100)">筛选</button><p>全部年级</p><script>window.count=0</script>`;
let requests = [];
const fixture = await createBrowserChatFixture({url,resultText,separate:strategy==='split',direct:strategy==='grounded',onRequest:event=>requests.push(event)});
const boot = path.join(output,'boot.cjs');
fs.writeFileSync(boot,`const {app,net}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
globalThis.browserTrialSpans=[];
require('node:diagnostics_channel').channel('omni-edu.xiaozhi.lifecycle.v1').subscribe(e=>globalThis.browserTrialSpans.push(e));
net.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input.url||input.href);
if(u.origin!=='https://api.deepseek.com')throw Error('unexpected fixture request');
return globalThis.fetch('http://127.0.0.1:${fixture.server.address().port}'+u.pathname,init)};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)}));`);
const env = {...process.env, DEEPSEEK_API_KEY:'local-only', DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..')};
delete env.NODE_OPTIONS;
delete env.ELECTRON_RUN_AS_NODE;
let app;
let priorId;
try {
  app = await electron.launch({args:[boot],env,timeout:60000});
  const page = await app.firstWindow();
  const input = page.getByTestId('office-prompt-input');
  await input.waitFor({timeout:60000});
  await app.evaluate(({app,session},html)=>{
    const seen=new Set();
    app.on('web-contents-created',(_e,wc)=>{
      if(wc.session===session.defaultSession||wc.getLastWebPreferences().preload||seen.has(wc.session))return;
      seen.add(wc.session);
      wc.session.protocol.handle('https',req=>new URL(req.url).hostname==='fixture.invalid'?new Response(html,{headers:{'content-type':'text/html;charset=utf-8'}}):new Response('',{status:403}));
    });
  },html);
  for(const temperature of ['cold','warm']){
    const row={temperature,strategy,build,output,requests:[]};
    try {
      if(priorId){
        await page.getByTestId('pi-new-session').click();
        await page.waitForFunction(old=>{const id=document.querySelector('.office-composer-container')?.dataset.sessionId;return id&&id!==old;},priorId);
      }
      await page.locator('.office-composer-container[data-session-id^="aisession_"]').waitFor();
      priorId=await page.locator('.office-composer-container').getAttribute('data-session-id');
      assert(priorId);
      fixture.reset(); requests=[];
      await input.fill('在内置浏览器打开 '+url+'，筛选年级并核对更新的物理实验列表。');
      row.start=Date.now();await input.press('Enter');
      const yes=page.getByText('同意这次操作',{exact:true}).last();
      await yes.waitFor({timeout:90000});row.approval=Date.now();
      await yes.click();await page.getByTestId('pi-question-submit').click();row.approved=Date.now();
      const deadline=Date.now()+90000;
      let finished=false;
      while(!finished && Date.now()<deadline){
        finished=await page.evaluate(async ({id,resultText})=>{
          const s=await window.omniEdu.getXiaozhiSnapshot(id);
          const turn=s.projection.turns.at(-1);
          return !s.running && turn?.status==='completed' && turn.items.some(it=>it.kind==='message'&&it.phase==='final_answer'&&it.text.includes(resultText));
        },{id:priorId,resultText});
        if(!finished)await new Promise(resolve=>setTimeout(resolve,200));
      }
      assert(finished,'No terminal final answer with verified result within 90s');
      row.end=Date.now();
      assert(!fixture.problem && fixture.checks.length);
      assert.deepEqual(fixture.actions,['navigate',...(strategy==='grounded'?[]:['snapshot']),'click',...(strategy==='split'?['wait']:[])]);
      const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
      try{
        const run=db.prepare('SELECT id,created_at,completed_at FROM ai_agent_runs WHERE session_id=? ORDER BY created_at DESC LIMIT 1').get(priorId);
        row.runCreated=run.created_at;row.completed=run.completed_at;
        row.toolStarts=db.prepare("SELECT r.call_id call,r.tool,e.created_at started,r.phase,r.success FROM xiaozhi_tool_receipts r JOIN xiaozhi_event_journal e ON e.run_id=r.run_id AND e.sequence=r.start_sequence WHERE r.run_id=? ORDER BY r.start_sequence").all(run.id);
        const firstBrowser=row.toolStarts.find(r=>r.tool==='office_browser');
        assert(firstBrowser && row.toolStarts.filter(r=>r.tool==='office_browser').every(r=>r.phase==='settled' && r.success===1));
        row.first=Date.parse(firstBrowser.started)-row.start;
        const {session_file}=db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(priorId);
        const entries=fs.readFileSync(path.join(data,'xiaozhi-pi',session_file),'utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(e=>e.message);
        row.events=entries.map(e=>({at:Date.parse(e.timestamp),role:e.message.role,tool:e.message.toolName}));
        const last=entries.findLast(e=>e.message.role==='toolResult'&&e.message.toolName==='office_browser');
        const receipt=JSON.parse(last.message.content[0].text);
        assert.equal(receipt.url,url); assert(receipt.text.includes(resultText));
      }finally{db.close();}
      const clickCounts=await app.evaluate(async({webContents},url)=>Promise.all(webContents.getAllWebContents().filter(w=>w.getURL()===url).map(w=>w.executeJavaScript('window.count'))),url);
      assert(clickCounts.length && clickCounts.every(n=>n===1));
      row.total=row.end-row.start;
      row.auto=row.total-(row.approved-row.approval);
      row.firstModelBrowserRequest=requests.find(r=>r.next==='navigate').at-row.start;
      row.ok=true;
    }catch(error){row.error=String(error).slice(0,700);row.ok=false;process.exitCode=1;}
    finally{
      row.requests=requests;
      row.spans=await app.evaluate((_electron,start)=>globalThis.browserTrialSpans.filter(s=>s.startedEpochMs>=start),row.start).catch(()=>[]);
      fs.appendFileSync(ledger,JSON.stringify(row)+'\n');
      console.log(JSON.stringify({temperature,strategy,ok:row.ok,first:row.first,auto:row.auto,error:row.error,output}));
    }
    if(!row.ok)break;
  }
}finally{
  await app?.close().catch(()=>{});
  fixture.server.close();fixture.server.closeAllConnections();
}
