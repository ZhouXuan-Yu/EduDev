// Read-only review of the rejected real renderer against its existing isolated acceptance data.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {createStyleAuditor} from './xiaozhi-agent/ui-style-evidence.mjs';
const desktop=path.resolve(import.meta.dirname,'..');
const baseline=JSON.parse(fs.readFileSync(path.join(desktop,'test-results/desktop-process-XAeXw5/report.json'),'utf8'));
const out=path.join(desktop,'test-results/ui-rebuild-20261024/runtime-audit');fs.mkdirSync(out,{recursive:true});
const db=new DatabaseSync(path.join(baseline.temp,'data/app.db'),{readOnly:true});
const row=db.prepare("SELECT session_id FROM ai_conversation_messages WHERE json_extract(metadata_json,'$.agentRunId')=? AND role='assistant'").get(baseline.tools.id);db.close();assert(row);
const env={...process.env,NODE_ENV:'development',OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:path.join(baseline.temp,'data')};
for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_'))delete env[key];
for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'])delete env[key];
const app=await electron.launch({args:[path.join(desktop,'test-results/desktop-process-trial-XAeXw5/build/main/index.js'),'--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-ui-audit-'))],cwd:desktop,env,timeout:60000});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
 await page.getByTestId('ai-conversation-session-'+row.session_id).click();
 const toggle=page.getByTestId('agent-trace-toggle').first();await toggle.waitFor();
 if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
 await toggle.scrollIntoViewIfNeeded();
 const auditor=await createStyleAuditor(page,path.join(desktop,'src/renderer'));
 const samples=[];
 for(const selector of ['.desktop-titlebar','.product-rail button','.pi-conversation-sidebar','.ai-chat-header','.ai-chat-header button','[data-slot="chain-of-thought-trigger"]']){
  samples.push(await auditor.sample(selector,'rejected-renderer-default'));
 }
 const button=page.locator('.ai-chat-header button').first();
 await button.hover();samples.push(await auditor.sample('.ai-chat-header button','rejected-renderer-hover'));
 await button.focus();samples.push(await auditor.sample('.ai-chat-header button','rejected-renderer-focus'));
 const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());
 fs.writeFileSync(path.join(out,'rejected-chat.png'),Buffer.from(data.split(',')[1],'base64'));
 await page.getByTestId('product-nav-materials').click();
 await page.getByTestId('product-space-header').waitFor();
 for(const selector of ['.product-header','.product-page-link','.product-workspace'])samples.push(await auditor.sample(selector,'materials-default'));
 fs.writeFileSync(path.join(out,'cssom.json'),JSON.stringify({actualRuntime:'rejected final build, existing isolated acceptance dataset; no provider request',samples,errors},null,2));
 console.log(JSON.stringify({samples:samples.length,errors:errors.length,output:out}));
}finally{await app.close();}
