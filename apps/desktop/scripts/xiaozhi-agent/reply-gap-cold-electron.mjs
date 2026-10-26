// Cold UI audit against an explicit copy of the prior isolated teaching database.
// No provider request; no access to the user's normal production data directory.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {DatabaseSync} from 'node:sqlite';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.resolve(process.env.XIAOZHI_COLD_OUTPUT||path.resolve(desktop,'../../docs/audit/chat-ui-2026-10-24'));
const prefix=process.env.XIAOZHI_COLD_PREFIX||'cold';
const source='C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-dsh-reasoning-uFcprX/data';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-gap-cold-'));
const dataRoot=path.join(temp,'data');
fs.cpSync(source,dataRoot,{recursive:true});fs.mkdirSync(output,{recursive:true});
const env={...process.env,DEEPSEEK_API_KEY:'',OMNI_EDU_DATA_ROOT:dataRoot,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),NODE_ENV:'development'};
for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_'))delete env[key];
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'])delete env[key];
const db=new DatabaseSync(path.join(source,'app.db'),{readOnly:true});
const session=db.prepare("SELECT session_id FROM ai_conversation_messages WHERE role='assistant' ORDER BY rowid DESC LIMIT 1").get().session_id;db.close();
let app;const errors=[];const report={scope:'Current Electron cold rendering of a copy of prior teaching test data; no streaming/provider acceptance',source,temp,session,errors};
try{
  app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+path.join(temp,'profile')],cwd:desktop,env,timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
  await page.getByTestId('ai-conversation-session-'+session).click();
  await page.waitForFunction(s=>document.querySelector('.office-composer-container')?.dataset.sessionId===s,session);
  await page.getByTestId('agent-trace-toggle').first().waitFor();
  report.runtime=await app.evaluate(({BrowserWindow})=>({cwd:process.cwd(),data:process.env.OMNI_EDU_DATA_ROOT,title:BrowserWindow.getAllWindows()[0].getTitle()}));
  report.url=page.url();
  report.dom=await page.evaluate(()=>({reasoningBlocks:document.querySelectorAll('[data-testid="agent-trace"]').length,executionBlocks:document.querySelectorAll('[data-testid="execution-trace"]').length,expanded:[...document.querySelectorAll('[data-testid="agent-trace-toggle"]')].map(e=>e.getAttribute('aria-expanded')),executionExpanded:[...document.querySelectorAll('[data-testid="execution-trace-toggle"]')].map(e=>e.getAttribute('aria-expanded')),layoutHeaderCount:[...document.querySelectorAll('[data-testid="agent-trace-toggle"], [data-testid="execution-trace-toggle"]')].filter(e=>e.getClientRects().length>0).length,extraComposerActivity:document.querySelectorAll('[data-testid="pi-workspace-activity"]').length,scripts:[...document.scripts].map(e=>e.src)}));
  report.screenshots=[];
  for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
    await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];if(w.isMinimized())w.restore();w.setTitle('小智 · 审计副本 · 不发模型请求');w.setContentSize(size.width,size.height);w.show();},size);
    await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);
    await page.waitForTimeout(250);await page.getByTestId('office-conversation').press('Control+Home');await page.waitForTimeout(300);await page.getByTestId('agent-trace-toggle').first().scrollIntoViewIfNeeded();await page.waitForTimeout(150);
    const image=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());
    const file=`${prefix}-${size.width}.png`;fs.writeFileSync(path.join(output,file),Buffer.from(image.split(',')[1],'base64'));report.screenshots.push(file);
  }
  report.success=true;
}catch(e){report.error=String(e.stack).slice(0,1600);process.exitCode=1;}
finally{await app?.close();fs.writeFileSync(path.join(output,prefix+'-electron.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
