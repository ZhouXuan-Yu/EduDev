import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createBrowserChatFixture} from './browser-chat-fixture.mjs';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from 'playwright';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/browser-dom-ui-'));
const profile=path.join(output,'profile'), data=path.join(output,'data');
const main=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT || 'out','main/index.js');
const url='https://fixture.invalid/teaching';
const syntheticCookie=randomBytes(24).toString('hex');
const backupDirectory=path.join(output,'teacher-backup');
fs.mkdirSync(backupDirectory);
const resultText='初二物理实验共七项';
const fixture = await createBrowserChatFixture({url,resultText});
const {server, actions, checks} = fixture;
let problem,app,page,display;
const boot=path.join(output,'test.cjs');
fs.writeFileSync(boot,`const {app,net}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
globalThis.checkedModelBodies=0;
globalThis.syntheticCookieSeen=false;
net.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input.url||input.href);
if(u.origin!=='https://api.deepseek.com')throw Error('unexpected fixture request');
if(init?.body && u.pathname.endsWith('/chat/completions')){
  const body=typeof init.body==='string'?init.body:Buffer.from(init.body).toString('utf8');
  globalThis.checkedModelBodies++;
  if(body.includes(${JSON.stringify(syntheticCookie)}))globalThis.syntheticCookieSeen=true;
}
return globalThis.fetch('http://127.0.0.1:${server.address().port}'+u.pathname,init)};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)}));`);
const html='<h1>教学资料</h1><button aria-label="筛选年级" onclick="window.count=(window.count||0)+1;setTimeout(()=>document.querySelector(\'p\').textContent=\''+resultText+'\',1300)">筛选</button><p>全部年级</p><textarea aria-label="备课草稿"></textarea><div style="height:2200px"></div>';
async function launch(){
  const env={...process.env,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE:JSON.stringify([backupDirectory]),OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'local-only',DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..')};
  delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;
  const args=process.argv.includes('--simulate-125')?[boot,'--force-device-scale-factor=1.25']:[boot];
  app=await electron.launch({args,env,timeout:60000});
  page=await app.firstWindow();await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
}
try {
  await launch();
  display=await app.evaluate(({screen,BrowserWindow})=>{
    const window=BrowserWindow.getAllWindows()[0];
    const monitor=screen.getDisplayMatching(window.getBounds());
    return {scaleFactor:monitor.scaleFactor,width:monitor.size.width,height:monitor.size.height};
  });
  await app.evaluate(({app,session},{html,syntheticCookie})=>{
    const seen=new Set();
    app.on('web-contents-created',(_e,wc)=>{
      if(wc.session===session.defaultSession||wc.getLastWebPreferences().preload||seen.has(wc.session))return;
      seen.add(wc.session);wc.session.protocol.handle('https',async request=>{await wc.session.cookies.set({url:'https://fixture.invalid',name:'qa_browser_cookie',value:syntheticCookie,httpOnly:true,secure:true,expirationDate:Date.now()/1000+600});return new URL(request.url).hostname==='fixture.invalid'?new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8'}}):new Response('',{status:403});});
    });
  },{html,syntheticCookie});
  await page.getByTestId('office-prompt-input').fill('在内置浏览器打开 '+url+'，筛选年级并核对更新的物理实验列表。');
  await page.getByTestId('office-prompt-input').press('Enter');
  const approve=page.getByText('同意这次操作',{exact:true}).last();
  await approve.waitFor({timeout:60000});
  const pendingDock=page.getByTestId('pi-browser-dock');
  await pendingDock.waitFor({timeout:10000});
  assert(await pendingDock.getByTestId('pi-browser-owner').isVisible());
  checks.push('Right dock and teacher control are available while the first browser approval is pending');
  if(process.argv.includes('--pointer')){
    await pendingDock.getByText('等待老师确认',{exact:true}).waitFor();
    const guest=app.context().pages().find(p=>p.url()===url);
    assert(guest);
    await guest.waitForFunction(()=>!!document.querySelector('[data-xiaozhi-pointer]'));
    assert.equal(await guest.evaluate(()=>getComputedStyle(document.querySelector('[data-xiaozhi-pointer]')).pointerEvents),'none');
    const box=await guest.getByRole('button',{name:'筛选年级'}).boundingBox();
    assert(box);
    await app.evaluate(({webContents},{url,x,y})=>{
      const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);
      wc.focus();
      wc.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x,y});
      wc.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x,y});
    },{url,x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)});
    await guest.evaluate(()=>new Promise(resolve=>setTimeout(resolve,80)));
    assert.equal(await guest.evaluate(()=>window.count||0),0);
    const capture=process.env.OMNI_EDU_BROWSER_POINTER_PROOF;
    if(capture)await guest.screenshot({path:capture});
    checks.push('Pending marker does not intercept events; raw mouse input cannot click while agent owns the guest');
  }
  await approve.click();
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
  assert.equal(count,1);assert.deepEqual(actions,['navigate','snapshot','click']);assert(!fixture.problem);
  checks.push('Composer → Pi → teacher approval → one Chromium click → delayed text');
  const dock=page.getByTestId('pi-browser-dock');
  await dock.waitFor({timeout:15000});
  const owner=page.getByTestId('pi-browser-owner');
  await owner.click();await dock.getByText('老师操作中',{exact:true}).waitFor();
  if(process.argv.includes('--pointer')){
    await view.waitForFunction(()=>!document.querySelector('[data-xiaozhi-pointer]'));
    assert.equal(await owner.innerText(),'交还小智');
    checks.push('Teacher control removes the agent marker and shows the hand-back action');
  }
  if(!process.argv.includes('--login-boundary')){
    const draft=view.getByRole('textbox',{name:'备课草稿'});
    await draft.click();assert(await draft.evaluate(el=>document.activeElement===el));
    await view.keyboard.insertText('浮力实验备课草稿');
    await view.mouse.wheel(0,300);
    await view.waitForFunction(()=>scrollY>0);
    const top=await view.evaluate(()=>scrollY);
    const readSurface=()=>app.evaluate(({BaseWindow,webContents},id)=>{
      const w=BaseWindow.getAllWindows().find(w=>w.contentView.children.some(v=>v.webContents===webContents.fromId(id)));
      return w && {id:w.id,title:w.getTitle()};
    },views[0]);
    const mainId=(await readSurface()).id;
    for(let i=0;i<10;i++){
      await dock.getByRole('button',{name:'独立窗口'}).click();
      await dock.getByText('网页已在独立窗口打开。').waitFor();
      const floating=await readSurface();
      assert.notEqual(floating.id,mainId);
      assert.match(floating.title,/老师操作中/);
      await dock.getByRole('button',{name:'放回对话'}).click();
      await page.getByTestId('pi-browser-slot').waitFor();
      await view.waitForFunction(()=>document.visibilityState==='visible');
      assert.equal(await draft.inputValue(),'浮力实验备课草稿');
      assert(Math.abs(await view.evaluate(()=>scrollY)-top)<=2);
      await page.waitForFunction(()=>document.querySelector('[data-testid="pi-browser-slot"]')?.clientWidth>0);
      const deadline=Date.now()+3000;
      while((await readSurface())?.id!==mainId){
        assert(Date.now()<deadline,'Guest did not return to the original host');
        await new Promise(r=>setTimeout(r,30));
      }
    }
    checks.push('Ten dock/float round trips preserve guest identity, Chinese draft, scroll offset and visible controller');
    await owner.click();await dock.getByText('小智操作中',{exact:true}).waitFor();
    assert.equal(await app.evaluate(({BrowserWindow,webContents},id)=>BrowserWindow.getAllWindows().some(w=>w.contentView.children.some(v=>v.webContents===webContents.fromId(id))),views[0]),true);
    checks.push('Teacher takes and returns control and reattaches the same native guest through visible controls');
    for(const [width,height] of [[1366,768],[1920,1080]]){
      const actualDisplay=await app.evaluate(({BrowserWindow,webContents,screen},{id,width,height})=>{
        const win=BrowserWindow.getAllWindows().find(w=>w.contentView.children.some(v=>v.webContents===webContents.fromId(id)));
        const candidates=[screen.getDisplayMatching(win.getBounds()),...screen.getAllDisplays()];
        const monitor=candidates.find(d=>d.workArea.width>=width+24 && d.workArea.height>=height+60);
        if(monitor)win.setPosition(monitor.workArea.x+8,monitor.workArea.y+8);
        win.setContentSize(width,height);
        return {width,height,scaleFactor:screen.getDisplayMatching(win.getBounds()).scaleFactor,physicalFit:!!monitor};
      },{id:views[0],width,height});
      (display.viewports??=[]).push(actualDisplay);
      await page.waitForFunction(w=>Math.abs(innerWidth-w)<3,width);
      const slot=await page.getByTestId('pi-browser-slot').boundingBox();
      assert(slot&&slot.width>250&&slot.height>150);
      await view.waitForFunction(size=>Math.abs(innerWidth-size.width)<3&&Math.abs(innerHeight-size.height)<3,slot);
    }
    checks.push('Native viewport follows the visible right-hand slot at 1366×768 and 1920×1080');
    await dock.getByRole('button',{name:'收起'}).click();
    await dock.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'浏览器',exact:true}).click();
    await dock.getByText('老师操作中',{exact:true}).waitFor();
    await owner.click();await dock.getByText('小智操作中',{exact:true}).waitFor();
    const originalSession=await page.locator('.office-composer-container').getAttribute('data-session-id');
    const deadline=Date.now()+45000;
    while((await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),originalSession)).running){
      assert(Date.now()<deadline);await new Promise(r=>setTimeout(r,150));
    }
    await page.getByTestId('pi-new-session').click();
    await page.waitForFunction(id=>{const next=document.querySelector('.office-composer-container')?.dataset.sessionId;return next?.startsWith('aisession_')&&next!==id;},originalSession);
    assert(!(await page.getByTestId('pi-browser-dock').isVisible()));
    await page.getByTestId('pi-sidebar-toggle').click();
    await page.getByTestId('ai-conversation-session-'+originalSession).click();
    await page.waitForFunction(id=>document.querySelector('.office-composer-container')?.dataset.sessionId===id,originalSession);
    const history=page.getByTestId('pi-sidebar-toggle');
    if(await history.getAttribute('aria-expanded')==='true')await history.click();
    // Returning to a loaded conversation automatically reopens its browser.
    // Clicking a toggle that appeared while Playwright waited would close it again.
    await page.getByRole('button',{name:'浏览器',exact:true}).waitFor();
    await dock.waitFor({timeout:15000});
    await page.getByTestId('pi-browser-slot').waitFor();
    assert.equal(await draft.inputValue(),'浮力实验备课草稿');
    checks.push('Collapsing gives control to the teacher; switching conversations hides the guest and returning preserves the draft');
  }
  await dock.getByText('老师操作中',{exact:true}).waitFor();
  const remember=dock.getByRole('button',{name:'打开此站的本机登录'});
  await remember.click();
  await remember.waitFor({state:'hidden'});
  const sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
  const readyBy=Date.now()+15000;
  let privacy;
  do {
    const control=await page.evaluate(id=>window.omniEdu.controlXiaozhiBrowser(id,'status'),sessionId);
    privacy=await app.evaluate(async({webContents,session})=>{
      const remembered=webContents.getAllWebContents().filter(w=>w.session!==session.defaultSession && w.session.isPersistent() && w.getURL().startsWith('https://fixture.invalid'));
      return {guests:remembered.length,present:remembered.length===1 && (await remembered[0].session.cookies.get({name:'qa_browser_cookie'})).length===1,
        checked:globalThis.checkedModelBodies,leaked:globalThis.syntheticCookieSeen};
    });
    privacy.remembered=control.status?.remembered===true;
    assert(!privacy.leaked,'A model request included synthetic cookie bytes');
    if(privacy.remembered && privacy.present)break;
    await new Promise(r=>setTimeout(r,100));
  } while(Date.now()<readyBy);
  assert(privacy.remembered && privacy.present && privacy.checked>=5,'Cookie and model request readback: '+JSON.stringify(privacy));
  const backup=await page.evaluate(()=>window.omniEdu.exportDataRoot('full'));
  assert(backup?.verified && fs.realpathSync(backup.exportPath).startsWith(fs.realpathSync(backupDirectory)+path.sep));
  const manifest=JSON.parse(fs.readFileSync(backup.manifestPath,'utf8'));
  assert(manifest.files.length && manifest.files.every(f=>!/(?:^|[\\/])(Partitions|Cookies|Local Storage)(?:[\\/]|$)/i.test(f.path)));
  function checkBackup(directory){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name);
      assert(!entry.isSymbolicLink());
      if(entry.isDirectory())checkBackup(file);
      else assert(!fs.readFileSync(file).includes(syntheticCookie),'Synthetic credential entered normal backup');
    }
  }
  checkBackup(backup.exportPath);
  checks.push('Synthetic HttpOnly cookie exists in remembered Chromium profile and is absent from model requests and verified normal backup');

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
} catch(error){
  const ui=await page?.evaluate(()=>({
    browserToggle:[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='浏览器')?.getAttribute('aria-pressed'),
    history:document.querySelector('[data-testid="pi-sidebar-toggle"]')?.getAttribute('aria-expanded'),
    dock:!!document.querySelector('[data-testid="pi-browser-dock"]'),
    slot:!!document.querySelector('[data-testid="pi-browser-slot"]'),
    owner:document.querySelector('[data-testid="pi-browser-owner"]')?.textContent,
    approvals:document.querySelectorAll('[data-testid="pi-teacher-question"]').length,
    session:document.querySelector('.office-composer-container')?.dataset.sessionId
  })).catch(()=>undefined);
  problem={detail:fixture.problem,error:String(error),ui};process.exitCode=1;
}
finally {
  if(app)await app.close().catch(()=>{});
  server.close();server.closeAllConnections();
  const report={scope:process.argv.includes('--login-boundary')?'login and privacy':'full conversation UI',checks,actions,problem,output,display,provider:'local deterministic SSE'};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
