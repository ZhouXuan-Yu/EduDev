import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {_electron as electron} from 'playwright';

const [build,evidence]=process.argv.slice(2);
assert(build&&evidence,'Pass the tested build and evidence directory');
const testDir=fs.mkdtempSync(path.join(os.tmpdir(),'edu-browser-workspace-'));
const library=path.join(testDir,'library');
fs.mkdirSync(library);
fs.writeFileSync(path.join(library,'第一份讲义.txt'),'第一份只读讲义');
fs.writeFileSync(path.join(library,'第二份讲义.md'),'# 第二份备课');
const origin='https://fixture.invalid';
const checks=[];
let instance;
try{
  const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_DATA_ROOT:path.join(testDir,'data'),OMNI_EDU_REPO_ROOT:path.resolve('../..')};
  delete env.ELECTRON_RUN_AS_NODE;
  instance=await electron.launch({args:[path.resolve(build,'main/index.js'),'--user-data-dir='+path.join(testDir,'profile')],env,timeout:60000});
  const page=await instance.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
  page.setDefaultTimeout(12000);
  await instance.evaluate(({app,session,dialog},directory)=>{
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});
    const seen=new Set();
    app.on('web-contents-created',(_event,contents)=>{
      const partition=contents.session;
      if(partition===session.defaultSession||contents.getLastWebPreferences().preload||seen.has(partition))return;
      seen.add(partition);
      partition.protocol.handle('https',req=>{
        const url=new URL(req.url);
        if(url.hostname!=='fixture.invalid')return new Response('',{status:403});
        if(url.pathname==='/unavailable')return Response.error();
        const routes={
          '/one':'<title>教研一</title><h1>教研一</h1><textarea aria-label="讨论草稿"></textarea><a href="/two">下一页</a>',
          '/two':'<title>教研二</title><h1>教研二</h1><a href="/three" target="_blank">另开资料</a>',
          '/three':'<title>教研三</title><h1>教研三</h1>'
        };
        return new Response(routes[url.pathname]||'',{headers:{'Content-Type':'text/html;charset=utf-8'}});
      });
    });
  },library);
  const dock=page.getByTestId('pi-browser-dock');
  const address=dock.getByTestId('browser-address');
  const tab=name=>dock.getByRole('button',{name,exact:true});
  await page.getByTestId('pi-browser-toggle').click();
  await dock.getByRole('heading',{name:'打开网页'}).waitFor();
  await page.screenshot({path:path.join(evidence,'new-tab.png')});
  await address.fill(origin+'/one');await address.press('Enter');
  await tab('教研一').waitFor();
  const guest=instance.context().pages().find(p=>p.url()===origin+'/one');
  assert(guest);
  await guest.getByRole('textbox',{name:'讨论草稿'}).fill('保留草稿');
  await guest.getByRole('link',{name:'下一页'}).click();await tab('教研二').waitFor();
  await tab('后退').click();await tab('教研一').waitFor();
  await tab('前进').click();await tab('教研二').waitFor();
  await tab('刷新').click();await guest.getByRole('heading',{name:'教研二'}).waitFor();
  checks.push('Blank conversation opens a site; native history back, forward and reload work');
  await guest.getByRole('link',{name:'另开资料'}).click();await tab('教研三').waitFor();
  assert.equal((await tab('教研三').getAttribute('aria-pressed')),'true');
  await tab('教研二').click();assert.equal(await guest.url(),origin+'/two');
  await tab('关闭网页 教研三').click();await tab('教研三').waitFor({state:'detached'});
  await tab('独立窗口').click();await dock.getByText('网页已在独立窗口打开。').waitFor();
  let toolbar;
  for(let i=0;!toolbar&&i<80;i++){
    toolbar=instance.context().pages().find(candidate=>candidate.url().endsWith('/browser-toolbar.html'));
    if(!toolbar)await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(toolbar);
  await toolbar.getByTestId('browser-address').waitFor();
  if(process.argv.includes('--pointer')){
    const control=toolbar.getByTestId('pi-browser-owner');
    await toolbar.getByText('老师操作中',{exact:true}).waitFor();
    assert.equal(await control.innerText(),'交还小智');
    await control.click();
    await toolbar.getByRole('button',{name:'获得控制权',exact:true}).waitFor();
    await control.click();
    await toolbar.getByText('老师操作中',{exact:true}).waitFor();
    checks.push('The standalone window can hand back and retake control through the same status strip');
  }

  await toolbar.getByRole('button',{name:'后退',exact:true}).click();
  await toolbar.getByRole('button',{name:'教研一',exact:true}).waitFor();
  await toolbar.getByRole('button',{name:'放回对话',exact:true}).click();
  await dock.getByTestId('pi-browser-slot').waitFor();
  assert.equal(instance.context().pages().find(p=>p.url()===origin+'/one'),guest);
  checks.push('Popup becomes a scoped tab; detached browser shares the live guest and navigation toolbar');
  await tab('在右侧工作区打开对话文件').click();
  await dock.locator('.browser-file-surface:visible').getByTestId('pi-files-choose').click();
  await dock.locator('.browser-file-surface:visible').getByTestId('pi-file-entry-第一份讲义.txt').click();
  await dock.locator('.browser-file-surface:visible').getByText('第一份只读讲义').waitFor();
  await tab('对话文件').click();
  await dock.locator('.browser-file-surface:visible').getByTestId('pi-file-entry-第二份讲义.md').click();
  await dock.locator('.browser-file-surface:visible').getByRole('heading',{name:'第二份备课'}).waitFor();
  await page.screenshot({path:path.join(evidence,'file-tabs.png')});
  await tab('第一份讲义.txt').click();
  await dock.locator('.browser-file-surface:visible').getByText('第一份只读讲义').waitFor();
  await tab('关闭文件 第一份讲义.txt').click();
  await tab('第一份讲义.txt').waitFor({state:'detached'});
  await tab('教研一').click();await dock.getByTestId('pi-browser-slot').waitFor();
  checks.push('Two authorized local documents share the tab strip and remain independently closable');
  await address.fill('http://127.0.0.1:15175/');await address.press('Enter');
  await dock.getByText('请使用公开 HTTP(S) 地址。去对话文件打开本地资料。').waitFor();
  assert.equal(guest.url(),origin+'/one');
  checks.push('Local port is refused and does not replace the active public page');
  await tab('新建网页标签').click();
  await address.fill(origin+'/unavailable');await address.press('Enter');
  await tab('刷新').waitFor({state:'visible'});
  assert(await tab('教研一').isVisible());
  await tab('刷新').click();
  await tab('教研一').click();await guest.getByRole('heading',{name:'教研一'}).waitFor();
  checks.push('A failed tab can retry without clearing previously opened tabs');
  await page.screenshot({path:path.join(evidence,'workspace.png')});
}finally{
  await instance?.close();
  const resolved=fs.realpathSync(testDir);
  assert(path.dirname(resolved)===fs.realpathSync(os.tmpdir())&&path.basename(resolved).startsWith('edu-browser-workspace-'));
  fs.rmSync(resolved,{recursive:true,force:false,maxRetries:2});
  console.log(JSON.stringify({checks,trial:resolved,released:!fs.existsSync(resolved)}));
}
