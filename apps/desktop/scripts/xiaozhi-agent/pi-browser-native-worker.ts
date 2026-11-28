import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import electron from 'electron';
import http from 'node:http';
import {createXiaozhiBrowserHost} from '../../src/main/xiaozhi-agent/browser-host';
import {validBrowserInput,type XiaozhiBrowserInput,type XiaozhiBrowserReceipt} from '../../src/shared/xiaozhi-browser';
import {createPublicBrowserProxy} from '../../src/main/xiaozhi-agent/browser-proxy';
import {createHash} from 'node:crypto';
import {readBrowserCapture} from '../../src/main/xiaozhi-agent/browser-capture-reader';
import {validBrowserCapture,validBrowserCaptureInput} from '../../src/shared/xiaozhi-browser-capture';
const statusFile=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','renderer/browser-status.html');
const output=process.env.OMNI_EDU_BROWSER_TEST_OUTPUT||process.argv[2],report:{success:boolean;checks:{name:string;pass:boolean}[];error?:string;boundary:string}={success:false,checks:[],boundary:'Real owned Electron browser DOM/views/session/network policy. Synthetic public-origin protocol fixture for actions, plus real public HTTPS via checked-IP proxy. Not formal business UI/Pi/teacher acceptance.'};
const check=(name:string)=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
const html=`<!doctype html><title>合成教研浏览器</title><h1>教研资料</h1><p id="result">尚未处理</p><input aria-label="检索内容" id="q"><input type="password" value="synthetic-secret"><select aria-label="学科" id="subject"><option value="math">数学</option><option value="cn">语文</option></select><button onclick="document.getElementById('result').textContent='已处理数学教研'">处理</button><a href="https://fixture.invalid/next">下一页</a><a href="http://127.0.0.1/private">私网</a><div style="height:1600px">尾部资料</div>`;
let writes=0,confirmations=0,allow=true,contents:electron.WebContents|undefined;
const fixtures=new WeakSet<electron.Session>();
const host=createXiaozhiBrowserHost({statusFile,root:path.join(output,'captures'),sanitize:async text=>text.replaceAll('student-private','[已脱敏]'),afterTabCreated:async(wc,partition)=>{
  contents=wc;if(fixtures.has(partition))return;fixtures.add(partition);await partition.protocol.handle('https',request=>{if(new URL(request.url).hostname!=='fixture.invalid')return electron.net.fetch(request,{bypassCustomProtocolHandlers:true});if(request.method==='POST')writes++;return new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}});});
}});
const id='aisession_'+randomUUID(),other='aisession_'+randomUUID(),controller=new AbortController();
const context={signal:controller.signal,dnsMode:'auto' as const,current:()=>true,confirm:async()=>{confirmations++;return allow;}};
const call=(input:XiaozhiBrowserInput,sid=id)=>host.execute(sid,input,context);
const page=(value:unknown)=>{assert(value&&typeof value==='object'&&'snapshotId' in value);return value as XiaozhiBrowserReceipt;};
const ref=(p:XiaozhiBrowserReceipt,name:string)=>{const line=p.text!.split('\n').find(line=>line.includes(name)&&/\[\d+\]/.test(line));assert(line,name);const match=line.match(/\[(\d+)\]/);assert(match);return Number(match[1]);};
const until=async(fn:()=>unknown)=>{for(let i=0;i<100;i++){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw new Error('Native status did not arrive');};
try{
 let got=0;const accessor=Object.defineProperty({action:'snapshot'},'text',{get(){got++;return 'x';},enumerable:true});assert(!validBrowserInput(accessor));assert.equal(got,0);assert(!validBrowserInput({action:'snapshot',url:'x'}));assert(!validBrowserInput({action:'type',ref:1}));check('Strict browser boundary rejects accessors, extra action fields and missing ref epoch');
 const navigation = {runId:randomUUID(), callId:randomUUID()};
 let p=page(await host.execute(id,{action:'navigate',url:'https://fixture.invalid'},{...context,invocation:navigation}));
 assert(host.hasLiveNavigation(id,navigation.runId,navigation.callId));
 assert(!host.hasLiveNavigation(other,navigation.runId,navigation.callId));
 assert(!host.hasLiveNavigation(id,randomUUID(),navigation.callId));
 assert(!host.hasLiveNavigation(id,navigation.runId,randomUUID()));
 check('Navigation proof matches only its owning live session, run and call');
 assert(p.text!.includes('教研资料'));assert(!p.text!.includes('synthetic-secret'));const wc=contents!;assert.deepEqual(await wc.executeJavaScript('({node:typeof process,ipc:typeof window.omniEdu})'),{node:'undefined',ipc:'undefined'});check('Actual native view renders fixture, original Hana snapshot has refs, password value omitted and Node/business IPC absent');
 const latest = () => ({tabId:p.tabId,snapshotId:p.snapshotId});
 await wc.executeJavaScript(`{
   window.browserKeyHits=0;
   const input=document.querySelector('#q');
   input.addEventListener('keydown',event=>{if(event.key==='Enter')window.browserKeyHits++;});
   input.focus();
 }`);
 p=page(await call({action:'key',key:'Enter',...latest()}));
 assert.equal(await wc.executeJavaScript('window.browserKeyHits'),1);
 check('An authorized Pi key reaches the focused page through the normal Electron dispatcher');

 await wc.executeJavaScript(`{
   const button=document.createElement('button');
   button.setAttribute('aria-label','筛选年级');
   button.textContent='筛选';
   button.onclick=()=>{window.filterClicks=(window.filterClicks||0)+1;setTimeout(()=>document.querySelector('#result').textContent='初二列表已更新',1600)};
   document.querySelector('button').replaceWith(button);
 }`);
 const found=page(await call({action:'snapshot',role:'button',name:'筛选年级',...latest()}));
 assert(found.matchedRef, 'unique accessible target');
 p=page(await call({action:'click',ref:found.matchedRef,tabId:found.tabId,snapshotId:found.snapshotId}));
 p=page(await call({action:'wait',text:'初二列表已更新',...latest()}));
 assert(p.text?.includes('初二列表已更新'));assert.equal(await wc.executeJavaScript('window.filterClicks'),1);
 check('Redrawn control found by Chromium role and name; delayed result verified after one click');
 await wc.executeJavaScript("document.body.append(document.querySelector('button').cloneNode(true))");
 await assert.rejects(call({action:'snapshot',role:'button',name:'筛选年级',...latest()}),/ambiguous_target/);
 p=page(await call({action:'snapshot'}));
 await wc.executeJavaScript("document.querySelectorAll('button')[1].hidden=true");
 p=page(await call({action:'snapshot',role:'button',name:'筛选年级',...latest()}));assert(p.matchedRef);
 check('Same names refused; hidden duplicate excluded');
 await wc.executeJavaScript(`document.body.insertAdjacentHTML('beforeend','<div id="cover" style="position:fixed;inset:0;z-index:9999"></div>')`);
 await assert.rejects(call({action:'click',ref:p.matchedRef,...latest()}),/target_unavailable/);
 assert.equal(await wc.executeJavaScript('window.filterClicks'),1);
 await wc.executeJavaScript("document.querySelector('#cover').remove()");
 check('Covered controls are refused without another click');

 const stopping=new AbortController();
 const waiting=host.execute(id,{action:'wait',text:'不会出现',...latest()},{...context,signal:stopping.signal});
 setTimeout(()=>stopping.abort(),100);await assert.rejects(waiting);check('Stopping conditional wait produces no success');
 await assert.rejects(call({action:'wait',text:'不会出现',...latest()}),/timeout/);
 const changing=call({action:'wait',text:'不会出现',...latest()});
 setTimeout(()=>void wc.loadURL('https://fixture.invalid/other'),100);
 await assert.rejects(changing,/attachment_changed/);assert(!host.hasLiveNavigation(id,navigation.runId,navigation.callId));check('Timeout and teacher navigation end the original wait');
 p=page(await call({action:'navigate',url:'https://fixture.invalid'}));
 const ownerWindow=new electron.BrowserWindow({show:false,width:800,height:600});
 try{
   await wc.executeJavaScript("document.querySelector('#q').value='draft'");
   await host.teacher(id,'dock',ownerWindow,{x:300,y:80,width:420,height:400});
   assert(ownerWindow.contentView.children.some(view=>(view as electron.WebContentsView).webContents===wc));
   await host.teacher(id,'float');assert(!ownerWindow.contentView.children.some(view=>(view as electron.WebContentsView).webContents===wc));
   assert.equal(await wc.executeJavaScript("document.querySelector('#q').value"),'draft');
   check('Dock and float retain the original guest and unsaved input');
 }finally{ownerWindow.destroy();}
 const requested=Promise.withResolvers<void>(),decision=Promise.withResolvers<boolean>();
 const previous={...latest(),ref:ref(p,'处理')};
 const inFlight=host.execute(id,{action:'click',...previous},{...context,confirm:async()=>{requested.resolve();return decision.promise;}});
 await requested.promise;
 assert.equal((await host.chromeStatus(id)).activity,'awaiting-confirmation');
 await host.teacher(id,'teacher');
 await until(async()=>!(await wc.executeJavaScript("document.querySelector('[data-xiaozhi-pointer]') !== null")));
 assert.equal((await host.chromeStatus(id)).activity,undefined);
 const floating=electron.BaseWindow.getAllWindows().find(w=>w.contentView.children.some(v=>(v as electron.WebContentsView).webContents===wc))!;
 assert.match(floating.getTitle(),/老师操作中/,'Floating browser must identify the active controller');
 for(const action of ['snapshot','tabs','close','screenshot'] as const)await assert.rejects(call({action}),/teacher_control/);
 decision.resolve(true);await assert.rejects(inFlight);
 const stopPage=wc.stop.bind(wc);let stoppedManual=0;
 wc.stop=()=>{stoppedManual++;stopPage();};
 try{host.cancel(id);assert.equal(stoppedManual,0);}finally{wc.stop=stopPage;}

 assert.equal(await wc.executeJavaScript("document.querySelector('#result').textContent"),'尚未处理');
 await host.teacher(id,'agent');assert.match(floating.getTitle(),/小智操作中/);await assert.rejects(call({action:'click',...previous}),/observation_required/);
 p=page(await call({action:'snapshot'}));await assert.rejects(call({action:'click',...previous}),/attachment_changed/);
 check('Teacher takeover cancels pending authorization, forbids reading and screenshots, and requires fresh observation');
 const namedClick={action:'click' as const,...latest(),ref:ref(p,'处理'),role:'button' as const,name:'处理'};
 assert(validBrowserInput(namedClick),'Consistent role and name may further constrain the latest click reference');
 const namedBefore=confirmations;
 await assert.rejects(call({...namedClick,name:'不存在的按钮'}),/target_missing/);
 assert.equal(confirmations,namedBefore);
 await assert.rejects(call({...namedClick,ref:ref(p,'学科')}),/attachment_changed/);
 assert.equal(confirmations,namedBefore);
 const namedDenied=await host.execute(id,namedClick,{...context,confirm:async()=>false}).then(()=>false,e=>e.message==='permission_denied');
 assert(namedDenied);
 assert.equal(await wc.executeJavaScript("document.querySelector('#result').textContent"),'尚未处理');
 await assert.rejects(host.execute(id,namedClick,{...context,confirm:async()=>{
   await wc.executeJavaScript("document.querySelector('button').setAttribute('aria-label','更新名称')");
   return true;
 }}),/target_missing/);
 assert.equal(await wc.executeJavaScript("document.querySelector('#result').textContent"),'尚未处理');
 await wc.executeJavaScript("document.querySelector('button').removeAttribute('aria-label')");
 const namedResult=page(await call(namedClick));
 assert(namedResult.text?.includes('已处理数学教研'));
 await wc.executeJavaScript("document.querySelector('#result').textContent='尚未处理';void 0");
 p=page(await call({action:'snapshot'}));
 check('Semantic hints must match the same fresh click reference and preserve rejection');
 const copied=ref(p,'处理');
 await wc.executeJavaScript("const old=document.querySelector('button');old.replaceWith(old.cloneNode(true));");
 await assert.rejects(call({action:'click',...latest(),ref:copied}),/attachment_changed/);
 p=page(await call({action:'snapshot'}));
 await assert.rejects(call({action:'select',...latest(),ref:ref(p,'学科'),value:'not-present'}),/target_unavailable/);
 const beforeAlreadyVisible=confirmations;
 await assert.rejects(call({action:'click',...latest(),ref:ref(p,'处理'),expectText:'教研资料'}),/result_already_visible/);
 assert.equal(confirmations,beforeAlreadyVisible,'Do not ask a teacher to approve a result already visible on the page');
 const appearedDuringApproval='审批期间列表已更新';
 await assert.rejects(host.execute(id,{action:'click',...latest(),ref:ref(p,'处理'),expectText:appearedDuringApproval},{
   ...context,confirm:async()=>{
     await wc.executeJavaScript("document.querySelector('#result').textContent='审批期间列表已更新';void 0");
     return true;
   }
 }),/result_already_visible/);
 assert.equal(await wc.executeJavaScript("document.querySelector('#result').textContent"),appearedDuringApproval);
 await wc.executeJavaScript("document.querySelector('#result').textContent='尚未处理';void 0");
 check('Identical replacement, missing option and previously visible expected result are rejected');
 const initial=p;await assert.rejects(call({action:'snapshot',tabId:p.tabId},other),/permission_denied/);check('Cross-conversation tab identity denied');
 allow=false;await assert.rejects(call({action:'click',ref:ref(p,'处理'),snapshotId:p.snapshotId}),/permission_denied/);assert.equal(await wc.executeJavaScript("document.getElementById('result').textContent"),'尚未处理');check('Teacher rejection produces no button effect');
 allow=true;p=page(await call({action:'click',ref:ref(p,'处理'),snapshotId:p.snapshotId}));assert(p.text!.includes('已处理数学教研'));await assert.rejects(call({action:'click',ref:ref(initial,'处理'),snapshotId:initial.snapshotId}),/attachment_changed/);check('Actual authorized DOM action changes content; stale snapshot rejected');
 p=page(await call({action:'type',ref:ref(p,'检索内容'),snapshotId:p.snapshotId,text:'数学教研'}));assert.equal(await wc.executeJavaScript("document.getElementById('q').value"),'数学教研');assert(!p.text!.includes('value="数学教研"'));check('Actual input insertion uses latest ref and values stay out of the model snapshot');
 p=page(await call({action:'select',ref:ref(p,'学科'),snapshotId:p.snapshotId,value:'cn'}));assert.equal(await wc.executeJavaScript("document.getElementById('subject').value"),'cn');check('Actual select/change action works with explicit confirmation');
 await assert.rejects(call({action:'navigate',url:'http://127.0.0.1/private'}),/permission_denied/);await assert.rejects(call({action:'navigate',url:'https://fixture.invalid?token=secret'}),/permission_denied/);check('Private URLs and credential-bearing URLs refused before load');
 await wc.executeJavaScript("fetch('https://fixture.invalid/write',{method:'POST',body:'x'}).catch(()=>{})");await new Promise(r=>setTimeout(r,200));assert.equal(writes,0);check('Background POST outside explicit action scope is blocked');
 await assert.rejects(call({action:'snapshot'}),/permission_denied/);await assert.rejects(call({action:'screenshot'}),/permission_denied/);p=page(await call({action:'navigate',url:'https://fixture.invalid'}));check('Failure cannot become DOM or screenshot source; a new navigation recovers');
 await wc.session.protocol.unhandle('https');p=page(await call({action:'navigate',url:'https://example.com'}));check('Native capture uses real public HTTPS transport after deterministic action fixture is removed');
 fs.writeFileSync(path.join(output,'capture-diagnostics.json'),JSON.stringify({dom:await wc.executeJavaScript('({visibility:document.visibilityState,width:innerWidth,height:innerHeight,hasBody:!!document.body,ready:document.readyState})'),windows:electron.BaseWindow.getAllWindows().map(w=>({title:w.getTitle(),visible:w.isVisible(),minimized:w.isMinimized(),bounds:w.getContentBounds(),views:w.contentView.children.map(v=>({bounds:v.getBounds(),url:(v as electron.WebContentsView).webContents?.getURL()}))}))},null,2));
 const captured=await call({action:'screenshot'});assert('capture'in captured&&validBrowserCapture(captured.capture));const capture=captured.capture!;
 const local=await readBrowserCapture(path.join(output,'captures'),id,capture);assert(local.startsWith('data:image/png;base64,'));assert(fs.readdirSync(path.join(output,'captures')).length===1);check('Actual screenshot returns a versioned local capture; fd/hash/PNG dimensions verify the exact image');
 let calls=0;const bad=Object.defineProperty({schemaVersion:'xiaozhi.browser-capture.v1',sessionId:id},'captureId',{get(){calls++;return capture.id;},enumerable:true});assert(!validBrowserCaptureInput(bad));assert.equal(calls,0);assert(!validBrowserCaptureInput({schemaVersion:'xiaozhi.browser-capture.v1',sessionId:id,captureId:'../x.png'}));check('Capture endpoint selector rejects accessors and arbitrary paths');
 await assert.rejects(readBrowserCapture(path.join(output,'captures'),other,capture),/ENOENT/);const file=path.join(output,'captures',createHash('sha256').update(id).digest('hex'),capture.id),saved=fs.readFileSync(file),changed=Buffer.from(saved);changed[changed.length-1]^=1;fs.writeFileSync(file,changed);await assert.rejects(readBrowserCapture(path.join(output,'captures'),id,capture),/changed/);fs.writeFileSync(file,saved);check('Cross-session local bytes and changed file contents cannot become the original screenshot');
 const originalCapture=wc.capturePage.bind(wc);wc.capturePage=async(...args)=>{const image=await originalCapture(...args);await wc.loadURL('https://example.com/?native-next');return image;};
 await assert.rejects(call({action:'screenshot'}),/attachment_changed/);wc.capturePage=originalCapture;check('Navigation during actual capture refuses a mismatched URL/revision receipt');
 const cancelCapture=new AbortController();wc.capturePage=async(...args)=>{const image=await originalCapture(...args);cancelCapture.abort();return image;};
 await assert.rejects(host.execute(id,{action:'screenshot'},{...context,signal:cancelCapture.signal}),error=>error instanceof Error&&error.name==='AbortError');wc.capturePage=originalCapture;check('Cancellation during actual capture cannot publish a successful receipt');
 p=page(await call({action:'navigate',url:'https://example.com/?native-next',newTab:true}));const tabs=await call({action:'tabs'});assert('tabs' in tabs&&tabs.tabs.length===2);await call({action:'close',tabId:p.tabId});check('Real native tabs switch and close independently');
 const stopped=new AbortController();stopped.abort();await assert.rejects(host.execute(id,{action:'snapshot'},{...context,signal:stopped.signal}),()=>true);check('Cancelled command admits no new browser operation');
 const proxy=await createPublicBrowserProxy('system');try{const status=(headers={})=>new Promise<number>((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:proxy.port,path:'http://127.0.0.1/private',headers},response=>{response.resume();resolve(response.statusCode!);}).on('error',reject);});assert.equal(await status(),407);assert.equal(await status({'Proxy-Authorization':'Basic '+Buffer.from(proxy.username+':'+proxy.password).toString('base64')}),403);}finally{await proxy.close();}check('Owned proxy requires ephemeral credentials and denies unauthorized/private target');
 const actual=createXiaozhiBrowserHost({statusFile,root:path.join(output,'actual'),sanitize:async t=>t});try{
  // OS DNS can legitimately return public addresses on an unproxied machine.
  // Inject only the system DNS answer in this disposable Electron process.
  const dns=(await import('node:dns/promises')).default;
  const {syncBuiltinESMExports}=await import('node:module');
  const lookup=dns.lookup;
  try {
    dns.lookup=((name,...args)=>name==='virtual-dns.example.com'
      ? Promise.resolve([{address:'198.18.0.23',family:4}]) : Reflect.apply(lookup,dns,[name,...args])) as typeof lookup;
    syncBuiltinESMExports();
    await assert.rejects(actual.execute(id,{action:'navigate',url:'http://virtual-dns.example.com'},{...context,dnsMode:'system'}),/dns_blocked/);
  } finally {dns.lookup=lookup;syncBuiltinESMExports();}assert.deepEqual((await actual.status(id)).tabs,[]);await assert.rejects(actual.execute(id,{action:'snapshot'},context),/dns_blocked/);
  const status=await until(()=>electron.webContents.getAllWebContents().find(wc=>wc.getURL().includes('/browser-status.html#dns_blocked'))) as electron.WebContents;
  await until(()=>status.executeJavaScript("document.querySelector('[data-state=dns_blocked]')!==null"));assert((await status.executeJavaScript('document.body.innerText')).includes('网页解析受阻'));assert.deepEqual(await status.executeJavaScript('({node:typeof process,ipc:typeof window.omniEdu})'),{node:'undefined',ipc:'undefined'});
  const window=electron.BaseWindow.getAllWindows().find(w=>w.contentView.children.some(view=>(view as electron.WebContentsView).webContents===status))!;assert(window);
  for(const [width,height] of [[1366,768],[1920,1080]]){window.setContentSize(width,height);await until(async()=>await status.executeJavaScript('innerWidth')===width);fs.writeFileSync(path.join(output,`visible-dns-failure-${width}.png`),(await status.capturePage()).toPNG());}check('Actual HTTP virtual DNS denial shows original Pro state at two sizes; failure is not source or DOM success');
  const receipt=page(await actual.execute(id,{action:'navigate',url:'https://example.com'},{...context,dnsMode:'auto'}));assert(receipt.text!.includes('Example Domain'));check('Same existing browser group switches from explicit system to auto and loads real HTTPS');const domestic=page(await actual.execute(id,{action:'navigate',url:'https://www.moe.gov.cn'},{...context,dnsMode:'auto'}));assert(domestic.text!.includes('教育'));check('Actual domestic education site renders and returns real DOM snapshot');
  await assert.rejects(actual.execute(id,{action:'navigate',url:'https://xiaozhi-test.invalid'},{...context,dnsMode:'auto'}),/permission_denied/);
  await until(()=>status.executeJavaScript("document.querySelector('[data-state=permission_denied]')!==null"));
  await status.executeJavaScript("location.href='xiaozhi-browser:close'");
  assert((await actual.status(id)).open);
  assert((await status.executeJavaScript('document.body.innerText')).includes('刷新当前页'));
  const failedTab=(await actual.chromeStatus(id)).tabs?.find(tab=>tab.active);
  assert(failedTab && failedTab.state==='failed');
  await actual.teacher(id,'close-tab',undefined,undefined,failedTab.tabId);
  assert(!(await actual.status(id)).open);
  assert((await host.status(id)).open);
  check('Failed page stays open until its trusted tab command; special scheme cannot close either group');

 }finally{await actual.dispose();}
 // A second active tab and a late dialog use a separate conversation so receipt checks above remain independent.
 const manualChat='aisession_'+randomUUID();
 const firstTab=page(await call({action:'navigate',url:'https://fixture.invalid/first'},manualChat));
 const manualTab=page(await call({action:'navigate',url:'https://fixture.invalid/second',newTab:true},manualChat));
 const manualPage=contents!;
 const opened=Promise.withResolvers<void>(),oldChoice=Promise.withResolvers<boolean>();
 const oldClick={action:'click' as const,tabId:manualTab.tabId,snapshotId:manualTab.snapshotId,ref:ref(manualTab,'处理')};
 const held=host.execute(manualChat,oldClick,{...context,confirm:async()=>{opened.resolve();return oldChoice.promise;}});
 await opened.promise;
 await host.teacher(manualChat,'teacher');
 for(const action of ['snapshot','screenshot'] as const){
   await assert.rejects(call({action,tabId:firstTab.tabId},manualChat),/teacher_control/);
 }
 await assert.rejects(call({action:'show'},manualChat),/teacher_control/);
 await assert.rejects(call(oldClick,manualChat),/teacher_control/);
 await manualPage.executeJavaScript("document.querySelector('#q').value='教师手动筛选';document.querySelector('#result').textContent='手动筛选完成';void 0");
 host.cancel(manualChat);
 if(process.env.OMNI_EDU_BROWSER_LONG_HANDOFF==='1')await new Promise(r=>setTimeout(r,120000));
 oldChoice.resolve(true);await assert.rejects(held);
 assert.equal(await manualPage.executeJavaScript("document.querySelector('#result').textContent"),'手动筛选完成');
 await host.teacher(manualChat,'agent');
 await assert.rejects(call(oldClick,manualChat),/observation_required/);
 const refreshed=page(await call({action:'snapshot',tabId:manualTab.tabId},manualChat));
 assert(refreshed.text?.includes('手动筛选完成'));
 await assert.rejects(call(oldClick,manualChat),/attachment_changed/);
 await call({action:'close'},manualChat);
 check('Two tabs preserve the manual result across a late approval and require fresh observation after handback');
 const profileChat='aisession_'+randomUUID();
 await call({action:'navigate',url:'https://fixture.invalid'},profileChat);
 await host.teacher(profileChat,'teacher');
 const temp=contents!.session;
 await host.teacher(profileChat,'remember');const remembered=contents!.session;
 assert.notEqual(temp,remembered);
 await remembered.cookies.set({url:'https://fixture.invalid',name:'test_profile',value:'synthetic',expirationDate:Date.now()/1000+600});
 assert.equal((await temp.cookies.get({name:'test_profile'})).length,0);
 const profileOther='aisession_'+randomUUID();
 await call({action:'navigate',url:'https://fixture.invalid'},profileOther);await host.teacher(profileOther,'teacher');
 await assert.rejects(host.teacher(profileOther,'remember'),/busy/);
 await assert.rejects(host.teacher(profileOther,'forget'),/busy/);
 await host.teacher(profileChat,'forget');
 assert.equal((await remembered.cookies.get({name:'test_profile'})).length,0);assert.notEqual(contents!.session,remembered);
 await host.teacher(profileOther,'remember');assert.equal(contents!.session,remembered);await host.teacher(profileOther,'forget');
 check('Remembered HTTPS partition isolates synthetic login, excludes another chat, and clears stored cookies');
 await host.teacher(profileOther,'remember');
 const store=contents!.session;
 const entered=Promise.withResolvers<void>(),resume=Promise.withResolvers<void>();
 const clear=store.clearStorageData.bind(store);
 store.clearStorageData=async (...args)=>{entered.resolve();await resume.promise;return clear(...args);};
 const forgetting=host.teacher(profileOther,'forget');
 await entered.promise;
 let closed=false;
 const close=host.dispose().then(()=>{closed=true;});
 await new Promise(resolve=>setTimeout(resolve,30));
 assert(!closed);resume.resolve();await forgetting;await close;
 check('Closing the host waits for an admitted site-login removal before releasing the browser');
 assert(confirmations>=4);report.success=true;
}catch(error){report.error=String(error);throw error;}finally{await host.dispose();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('REPORT '+output);}

