import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';

// Reproduce a teacher-created pre-R2 synthesis only in the supported offline legacy fixture runtime.
export async function prepareLegacyMemorySource({desktop,main,sourceData,output}) {
  const data=fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-memory-source-'));
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-memory-profile-'));
  assert(!fs.existsSync(path.join(sourceData,'app.db-wal'))||!fs.statSync(path.join(sourceData,'app.db-wal')).size);
  fs.cpSync(sourceData,data,{recursive:true});
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_LEGACY_RUNTIME:'1',OMNI_EDU_XIAOZHI_PI:'0',OMNI_EDU_SKIP_DOTENV:'1'};
  for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY'])delete env[key];
  const app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env});
  let entry;
  try {
    await app.evaluate(({session})=>session.defaultSession.webRequest.onBeforeRequest({urls:['https://*/*','http://*/*']},(_details,done)=>done({cancel:true})));
    const page=await app.firstWindow();
    assert.equal(await page.evaluate(()=>window.omniEdu.isXiaozhiEnabled()),false);
    const back=page.getByTestId('ai-return-workspace');
    await page.waitForFunction(()=>['ai-return-workspace','nav-memory','nav-settings'].some(id=>document.querySelector('[data-testid="'+id+'"]')?.getClientRects().length),undefined,{timeout:30000});
    if(await back.isVisible())await back.click();
    if(!await page.getByTestId('nav-memory').isVisible())await page.keyboard.press('Control+,');
    await page.getByTestId('nav-memory').click();
    await page.getByTestId('memory-draft-l3').click();
    await page.getByTestId('memory-adopt-l3-0').click();
    await page.waitForFunction(async()=>Boolean((await window.omniEdu.getAiMemoryL3Document('profile'))?.entries.length),undefined,{timeout:30000});
    entry=await page.evaluate(async()=>(await window.omniEdu.getAiMemoryL3Document('profile')).entries[0]);
    assert(entry.sourceDocuments.includes('chat')&&entry.status==='active'&&entry.version===1);
  } catch(error){
    const page=await app.firstWindow();
    const controls=await page.locator('button:visible').evaluateAll(nodes=>nodes.slice(0,55).map(node=>({id:node.dataset.testid,label:node.getAttribute('aria-label')||node.title})));
    fs.writeFileSync(path.join(path.dirname(output),'legacy-source-failure.json'),JSON.stringify({data,profile,controls,error:String(error)},null,2));
    throw error;
  } finally {await app.close();}
  assert(!fs.existsSync(output));
  fs.cpSync(data,output,{recursive:true,errorOnExist:true,force:false});
  const db=new DatabaseSync(path.join(output,'app.db'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT status FROM ai_memory_l3_entries WHERE id=?').get(entry.id).status,'active');}
  finally{db.close();}
  const temp=fs.realpathSync(os.tmpdir());
  for(const owned of [data,profile]){
    const actual=fs.realpathSync(owned);
    assert.equal(path.dirname(actual).toLowerCase(),temp.toLowerCase());
    assert(/^omni-edu-memory-(source|profile)-[a-z0-9]+$/i.test(path.basename(actual)));
    fs.rmSync(actual,{recursive:true,force:true});
  }
  return entry;
}
