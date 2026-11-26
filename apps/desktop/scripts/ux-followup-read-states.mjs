import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';
import {fingerprint} from './acceptance/evidence.mjs';

const desktop=path.resolve(import.meta.dirname,'..');
const output=fs.mkdtempSync(path.resolve(desktop,'../../acceptance/ux-followup-20261126/read-states-'));
const root=path.join(desktop,'test-results',path.basename(output)),data=path.join(root,'data'),profile=path.join(root,'profile');
fs.mkdirSync(profile,{recursive:true});
const main=testMain(desktop),bootstrap=zeroNetworkBootstrap({output,main,profile,counter:'__readStatesHttp'});
const cases=[
 {id:'knowledge',channel:'materials:catalog-list',empty:'materials-count',retry:'materials-refresh',failed:'materials-read-failed'},
 {id:'notebook',channel:'notebooks:list',empty:'teacher-notebook-empty',retry:'teacher-notebook-refresh',failed:'teacher-notebook-error'},
 {id:'book',channel:'teachingBook:list',empty:'teaching-book-empty',retry:'teaching-book-refresh',failed:'teaching-book-read-failed'},
 {id:'question_notebook',channel:'questionNotebook:list',empty:'question-notebook-empty',retry:'question-notebook-refresh',failed:'question-notebook-read-failed'},
 {id:'artifacts',channel:'documents:listArtifacts',emptyText:'还没有教学文件',retry:'artifacts-refresh',failed:'artifacts-read-failed'},
];
// Test-only boundary: delay/reject original READ handlers. No replacement data,
// service, mutation, permission, model or persistence implementation is installed.
const hook=`
globalThis.__readFault={mode:'normal',channel:'',calls:[],pending:[]};
const originalHandle=e.ipcMain.handle.bind(e.ipcMain);
e.ipcMain.handle=function(channel,listener){return originalHandle(channel,async(...args)=>{
  const fault=globalThis.__readFault;
  if(${JSON.stringify(cases.map(c=>c.channel))}.includes(channel)&&fault.channel===channel){
    fault.calls.push({channel,mode:fault.mode});
    if(fault.mode==='reject')throw new Error('UI_ACCEPTANCE_READ_UNAVAILABLE');
    if(fault.mode==='hold')await new Promise(resolve=>fault.pending.push(resolve));
  }
  return listener(...args);
});};`;
fs.writeFileSync(bootstrap,fs.readFileSync(bootstrap,'utf8').replace("mark('started');","mark('started');\n"+hook));
const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_SKIP_DOTENV:'1'};
for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'].includes(key))delete env[key];
const report={success:false,main,data,profile,source:fingerprint(path.join(desktop,'src')).sha256,build:fingerprint(path.dirname(path.dirname(main))).sha256,cases:[],pageErrors:[],consoleErrors:[],
 boundary:'Production Electron with delayed/rejected original readonly IPC; recovered empty results come from real SQLite. No OCR/provider output is simulated. These are controlled UI failure tests, not service outage or natural teacher acceptance.'};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
let app,page;
async function nav(id){
 const navigation=page.locator('[data-testid=edu-navigation]:visible');
 if(id==='knowledge')await navigation.getByTestId('nav-knowledge').click();
 else{await navigation.getByTestId('nav-teaching').click();await page.getByTestId('hub-entry-'+id).click();}
 await page.locator('.edu-shell[data-view="'+id+'"]:visible').waitFor();
}
const emptyFor=item=>item.emptyText?page.getByText(item.emptyText,{exact:true}):page.getByTestId(item.empty);
async function capture(id,state){
 for(const [width,height]of [[1366,768],[390,844]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  assert.equal(overflow,false,id+' '+state+' horizontal overflow');
  await page.screenshot({path:path.join(output,id+'-'+state+'-'+width+'.png')});
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
}
try{
 app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 await page.getByTestId('office-prompt-input').waitFor({timeout:60000});report.identity=await assertIsolatedPiMain(app,main,profile);
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setMinimumSize(0,0);w.setContentSize(1366,768);w.show();w.focus();});
 for(const item of process.argv.includes('--header-only')?[]:cases){
  await app.evaluate((_e,channel)=>Object.assign(globalThis.__readFault,{mode:'hold',channel,calls:[]}),item.channel);
  await nav(item.id);
  await page.locator('[data-testid*=loading],[role=status]').filter({hasText:/正在(读取|加载|查询)/}).first().waitFor();
  assert(await app.evaluate(async()=>{
   const deadline=Date.now()+10000;
   while(!__readFault.calls.some(c=>c.mode==='hold')&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
   return __readFault.calls.some(c=>c.mode==='hold');
  }));
  await capture(item.id,'loading');
  await app.evaluate(()=>{__readFault.mode='normal';__readFault.pending.splice(0).forEach(resolve=>resolve());});
  await emptyFor(item).waitFor();
  await page.locator('[data-testid=edu-navigation]:visible').getByTestId('nav-ai-workspace').click();
  await app.evaluate(()=>{__readFault.mode='reject';});
  await nav(item.id);await page.getByTestId(item.failed).waitFor();
  if(item.id==='knowledge'){
   assert.deepEqual(await page.locator('[data-testid^=materials-range-] small').allTextContents(),['—','—','—']);
   assert.equal(await page.getByText('先添加一份资料',{exact:true}).isVisible(),false,'failed read cannot pretend a new library');
   assert.equal(await page.getByText('没有匹配的资料',{exact:true}).isVisible(),false,'failed read cannot pretend no matches');
  }else assert.equal(await emptyFor(item).isVisible(),false,'failed read cannot pretend empty');
  await capture(item.id,'read-failed');
  await app.evaluate(()=>{__readFault.mode='normal';});
  if(await page.getByTestId(item.retry).count())await page.getByTestId(item.retry).click();
  else await page.getByRole('button',{name:/重新读取/}).click();
  await page.getByTestId(item.failed).waitFor({state:'hidden'});await emptyFor(item).waitFor();
  await capture(item.id,'recovered');
  report.cases.push({id:item.id,channel:item.channel,states:['loading','read-failed','recovered'],calls:await app.evaluate(()=>globalThis.__readFault.calls)});save();
  await page.locator('[data-testid=edu-navigation]:visible').getByTestId('nav-ai-workspace').click();
 }
 report.headerGeometry=[];
 for(const [toggle,panelId]of [['pi-sidebar-toggle','edu-history-panel'],['pi-aside-toggle','edu-context-panel']]){
  for(const resizeWhileOpen of [false,true]){
   await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setContentSize(width,844),resizeWhileOpen?1366:390);
   await page.getByTestId(toggle).click();await page.getByTestId(panelId).waitFor();
   const openedPanel=await page.getByTestId(panelId).elementHandle();
   if(resizeWhileOpen)await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(390,844));
   await page.waitForFunction(id=>{
    const header=document.querySelector('[data-testid=pi-workspace-header]'),panel=document.querySelector('[data-testid="'+id+'"]');
    return innerWidth===390&&header&&panel&&Math.abs(panel.getBoundingClientRect().top-header.getBoundingClientRect().bottom)<=1;
   },panelId);
   assert(await openedPanel.evaluate(element=>element.isConnected),'Resizing must preserve the open panel instance');
   const geometry=await page.evaluate(id=>({headerBottom:document.querySelector('[data-testid=pi-workspace-header]').getBoundingClientRect().bottom,panelTop:document.querySelector('[data-testid="'+id+'"]').getBoundingClientRect().top,width:innerWidth}),panelId);
   report.headerGeometry.push({toggle,panelId,resizeWhileOpen,...geometry});
   await page.screenshot({path:path.join(output,panelId+'-'+(resizeWhileOpen?'resized':'initial')+'-390.png')});
   await page.keyboard.press('Escape');await page.getByTestId(panelId).waitFor({state:'hidden'});
  }
 }
 assert.equal(report.pageErrors.length,0);report.success=true;
}catch(error){
 report.failure=String(error.stack||error);process.exitCode=1;
 if(page&&!page.isClosed()){
  report.geometryDiagnostics=await page.evaluate(()=>[...document.querySelectorAll('.edu-header,.edu-workspace,.edu-history-panel,.wb-context')].filter(e=>e.getClientRects().length).map(e=>({className:e.className,box:e.getBoundingClientRect().toJSON(),position:getComputedStyle(e).position,top:getComputedStyle(e).top,headerHeight:getComputedStyle(e).getPropertyValue('--edu-header-height')}))).catch(()=>[]);
  await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
 }
}
finally{if(app)await app.close();save();console.log(JSON.stringify({output,success:report.success,passed:report.cases.length,failure:report.failure}));}
