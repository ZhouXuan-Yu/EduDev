import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {_electron as electron} from 'playwright';

const [build]=process.argv.slice(2);
assert(build,'Pass the isolated test build');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'edu-public-navigation-'));
const results=[];
let app;
try {
  const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:path.join(temp,'data'),OMNI_EDU_REPO_ROOT:path.resolve('../..')};
  delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:[path.resolve(build,'main/index.js'),'--user-data-dir='+path.join(temp,'profile')],env,timeout:60000});
  const page=await app.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
  await page.getByTestId('pi-browser-toggle').click();
  const dock=page.getByTestId('pi-browser-dock');
  const address=dock.getByTestId('browser-address');
  const sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
  const active=()=>page.evaluate(async id=>(await window.omniEdu.controlXiaozhiBrowser(id,'status')).status.tabs?.find(tab=>tab.active),sessionId);
  for(const [input,hostname,fragment] of [
    ['example.com/#lesson','example.com','#lesson'],
    ['https://www.moe.gov.cn/','www.moe.gov.cn',''],
    ['https://www.baidu.com/','www.baidu.com',''],
  ]){
    if(results.length)await dock.getByRole('button',{name:'新建网页标签'}).click();
    const start=performance.now();
    await address.fill(input);
    await address.press('Enter');
    const finish=Date.now()+25000;
    let tab;
    do {
      tab=await active();
      if(tab?.state==='ready'||tab?.state==='failed')break;
      await new Promise(resolve=>setTimeout(resolve,120));
    }while(Date.now()<finish);
    const url=tab?.url?new URL(tab.url):undefined;
    const pass=tab?.state==='ready'&&url?.hostname===hostname&&(!fragment||url.hash===fragment);
    const result={input,pass,state:tab?.state,loaded:tab?.url,title:tab?.title,elapsedMs:Math.round(performance.now()-start)};
    results.push(result);
    console.log(JSON.stringify(result));
  }
}finally{
  await app?.close();
  const resolved=fs.realpathSync(temp);
  assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
  assert(path.basename(resolved).startsWith('edu-public-navigation-'));
  fs.rmSync(resolved,{recursive:true,force:false,maxRetries:2});
  console.log(JSON.stringify({passed:results.filter(result=>result.pass).length,total:results.length,released:true}));
}
assert.equal(results.filter(result=>result.pass).length,3);
