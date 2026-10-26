// Design review only: isolated Electron, no preload, no business IPC, no provider.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {_electron as electron} from 'playwright';
import {createStyleAuditor,compareOfficialAppearance} from './xiaozhi-agent/ui-style-evidence.mjs';
const desktop=path.resolve(import.meta.dirname,'..');
const output=path.join(desktop,'test-results/ui-rebuild-20261024/review');
fs.mkdirSync(output,{recursive:true});
const server=await createServer({configFile:false,root:desktop,plugins:[react()],server:{host:'127.0.0.1',port:0},optimizeDeps:{include:['react','react-dom/client','@heroui/react','lucide-react']}});
await server.listen();
const address=server.httpServer.address();
assert(address&&typeof address!=='string');
const url='http://127.0.0.1:'+address.port+'/src/renderer/design-review/index.html';
const host=path.join(output,'review-host.cjs');
fs.writeFileSync(host,`const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({width:1440,height:940,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});w.loadURL(process.argv[2]);});app.on('window-all-closed',()=>app.quit());`);
const env={...process.env};
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'])delete env[key];
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-ui-review-'));
const app=await electron.launch({args:[host,url,'--user-data-dir='+temp],cwd:desktop,env,timeout:60000});
const page=await app.firstWindow(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));
const check=(name,fn=()=>{})=>{fn();checks.push(name);console.log('PASS '+name);};
async function shot(name){const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(data.split(',')[1],'base64'));}
try{
 await page.getByTestId('ui-rebuild-review').waitFor({timeout:90000});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1366,768);w.setTitle('小智 · UI重建审阅（样张，非正式工作台）');w.show();});
 const mod=await server.ssrLoadModule('/src/renderer/design-review/page-contracts.ts');
 for(const contract of mod.PAGE_CONTRACTS){
  await page.getByTestId('review-nav-'+contract.id).click();
  await page.getByTestId('review-page-'+contract.id).waitFor();
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,heading:document.querySelector('.review-header strong')?.textContent}));
  check('page contract reachable: '+contract.id,()=>{assert.equal(layout.overflow,false);assert.equal(layout.heading,contract.title);});
  await page.mouse.move(1,1);await page.waitForTimeout(120);await shot('page-'+contract.id+'-1366');
 }
 await page.getByTestId('review-nav-ai').click();
 await page.getByRole('button',{name:'查看页面约束'}).click();
 check('current page constraints visible',()=>{});
 await shot('chat-with-contract');
 await page.getByRole('button',{name:'隐藏页面约束'}).click();
 await page.getByRole('button',{name:'播放完整过程'}).click();
 await page.getByText('读取教学资料.txt',{exact:true}).waitFor();
 check('sample process exposes distinct tool glyph rows',()=>{});
 await shot('chat-running');
 await page.getByTestId('review-final-answer').waitFor();
 assert.equal(await page.getByTestId('review-sealed-process').getByRole('button').first().getAttribute('aria-expanded'),'false');
 check('sample handoff folds process before result');
 await page.waitForFunction(()=>document.querySelector('[data-testid="sample-text-stream"]')?.textContent.length>15);
 await shot('chat-streaming-answer');
 await page.locator('[data-testid="sample-text-stream"][data-streaming="false"]').waitFor();
 await shot('chat-completed');
 await page.getByTestId('review-sealed-process').getByRole('button').first().click();
 assert.equal(await page.getByTestId('review-sealed-process').getByRole('button').first().getAttribute('aria-expanded'),'true');
 check('sample process can reopen');
 await shot('chat-reopened');
 await page.getByRole('button',{name:'原厂 Agent Trace Streaming',exact:true}).click();
 const official=page.locator('.review-official [data-slot="chain-of-thought"]').first();
 await official.waitFor();
 const reference=await official.evaluate(el=>({width:el.getBoundingClientRect().width,streaming:el.classList.contains('chain-of-thought--streaming'),expanded:el.querySelector('button')?.getAttribute('aria-expanded')}));
 check('unchanged official streaming reference',()=>{assert.equal(reference.width,420);assert.equal(reference.streaming,true);assert.equal(reference.expanded,'true');});
 await shot('official-reference');
 const auditor=await createStyleAuditor(page,path.join(desktop,'src/renderer'));
 const selector='.review-official [data-slot="chain-of-thought-trigger"]';
 const states=[await auditor.sample(selector,'official-default')];
 const trigger=page.locator(selector).first();
 await trigger.hover();states.push(await auditor.sample(selector,'official-hover'));await shot('official-hover');
 await trigger.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
 states.push(await auditor.sample(selector,'official-keyboard-focus'));await shot('official-focus');
 await trigger.hover();await page.mouse.down();
 states.push(await auditor.sample(selector,'official-active'));await shot('official-active');await page.mouse.up();
 const parity=await compareOfficialAppearance(page,selector,path.join(desktop,'src/renderer'),'light');
 check('official reference cosmetics match clean vendor CSS',()=>assert(Object.values(parity).every(v=>v.equal)));
 fs.writeFileSync(path.join(output,'official-states-cssom.json'),JSON.stringify({states,parity},null,2));
 const css=await page.locator('.review-official [data-slot="chain-of-thought-trigger"]').first().evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,font:s.fontSize,background:s.backgroundColor,padding:s.padding,animation:s.animationName};});
 fs.writeFileSync(path.join(output,'reference-computed.json'),JSON.stringify(css,null,2));
 for(const id of ['ai','knowledge','paper','notebook','settings']){
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
  await page.getByTestId('review-nav-'+id).click();
  if(id==='ai')await page.getByRole('button',{name:'产品时序样张',exact:true}).click();
  await page.waitForTimeout(200);await shot('page-'+id+'-1920');
 }
 check('no renderer exceptions',()=>assert.deepEqual(errors,[]));
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({success:true,reviewOnly:true,businessIpc:false,providerRequests:0,url,checks,errors,reference,css},null,2));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
 await page.getByTestId('review-nav-ai').click();
 console.log('Review is visible. This is a design artifact, not the production rebuild.');
 if(process.argv.includes('--stay')||process.env.XIAOZHI_REVIEW_STAY==='1')await new Promise(resolve=>app.on('close',resolve));
}catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),checks,errors},null,2));throw error;}
finally{await app.close().catch(()=>{});await server.close();}
