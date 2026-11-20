import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const runRoot=path.join(desktop,'test-results','artifact-file-actions');
fs.mkdirSync(runRoot,{recursive:true});
const output=fs.mkdtempSync(path.join(runRoot,'ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),workspace=path.join(output,'备课');
const sources=path.join(workspace,'物理','浮力');
for(const dir of [data,profile,sources])fs.mkdirSync(dir,{recursive:true});
const original=path.join(sources,'演示.html');
const originalBytes=Buffer.from('<!doctype html><html lang="zh"><title>浮力演示</title><p>浮力等于排开液体的重力。</p></html>');
fs.writeFileSync(original,originalBytes);
const copy=path.join(output,'课堂演示.html');
const main=testMain(desktop);
const checks=[],errors=[];
let app,page;

async function check(name,run){
  await run();
  checks.push(name);
  console.log('PASS '+name);
}

try{
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:''};
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});
  page=await app.firstWindow();
  page.on('pageerror',error=>errors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  const sessionId=await page.locator('.office-composer-container[data-session-id^="aisession_"]').getAttribute('data-session-id',{timeout:60000});
  assert.match(sessionId??'',/^aisession_/);
  await page.getByTestId('pi-files-toggle').click();
  const toolbar=page.getByTestId('pi-file-panel');
  await toolbar.waitFor();
  await app.evaluate(({dialog,shell},{directory,destination})=>{
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});
    dialog.showSaveDialog=async()=>({canceled:false,filePath:destination});
    globalThis.artifactFileOsCalls=[];
    shell.openPath=async file=>{globalThis.artifactFileOsCalls.push(['open',file]);return '';};
    shell.showItemInFolder=file=>globalThis.artifactFileOsCalls.push(['reveal',file]);
  },{directory:workspace,destination:copy});
  await page.getByTestId('pi-files-choose').click();
  const item=name=>page.getByTestId(`pi-file-entry-${name}`);
  const input=page.getByTestId('pi-file-filter'),toggle=page.getByTestId('pi-files-explorer-toggle');
  const actions=page.getByTestId('artifact-file-actions'),message=page.getByTestId('artifact-file-action-message');
  const choose=async id=>{await actions.click();await page.getByTestId(`artifact-file-${id}`).click();};
  const current=item('物理/浮力/演示.html');
  await item('物理').click();
  await item('物理/浮力').click();
  await current.click();
  await actions.waitFor();

  await check('Keyboard menu opens and locates the selected file through two parent folders',async()=>{
    if(!await input.isVisible())await toggle.click();
    await item('物理').click();
    await input.fill('hidden-by-filter');
    await toggle.click();
    await actions.focus();
    await page.keyboard.press('Enter');
    if(process.platform==='win32')await page.getByTestId('artifact-file-open-with').waitFor();
    await page.getByTestId('artifact-file-location').click();
    await current.waitFor();
    assert.equal(await current.getAttribute('data-current'),'true');
    assert.equal(await input.inputValue(),'');
  });
  await check('Default open and Explorer receive the exact file path',async()=>{
    await choose('open');
    await choose('reveal');
    await page.waitForFunction(()=>!document.querySelector('[data-testid="artifact-file-actions"]')?.hasAttribute('disabled'));
    const calls=await app.evaluate(()=>globalThis.artifactFileOsCalls);
    assert.deepEqual(calls,[['open',original],['reveal',original]]);
  });
  await check('Save As preserves original bytes, rejects collisions and accepts cancellation',async()=>{
    await choose('save-as');
    await page.getByText('已另存为 课堂演示.html',{exact:true}).waitFor();
    assert.deepEqual(fs.readFileSync(copy),originalBytes);
    await choose('save-as');
    await page.getByText('目标文件已存在',{exact:false}).waitFor();
    assert.deepEqual(fs.readFileSync(copy),originalBytes);
    assert.deepEqual(fs.readFileSync(original),originalBytes);
    await app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
    await choose('save-as');
    await page.waitForFunction(()=>!document.querySelector('[data-testid="artifact-file-actions"]')?.hasAttribute('disabled'));
    assert.equal(await message.count(),0);
  });
  await check('Outside edits are rejected before shell dispatch',async()=>{
    fs.appendFileSync(original,'<!-- changed -->');
    await choose('open');
    await page.getByText('已变化',{exact:false}).waitFor();
    assert.equal(await app.evaluate(()=>globalThis.artifactFileOsCalls.length),2);
  });
  await check('An already exported file outside the working directory shows its location and copies without a duplicate catalog row',async()=>{
    const saved=await page.evaluate(({sessionId,destinationRoot})=>window.omniEdu.exportDocumentArtifact({
      sessionId,destinationRoot,title:'已保存讲义',fileName:'已保存讲义.md',type:'markdown',contentMd:'# 本地课堂',
    }),{sessionId,destinationRoot:output});
    await page.getByTestId('pi-files-refresh').click();
    if(!await input.isVisible())await toggle.click();
    await page.getByTestId('conversation-saved-file').getByText('已保存讲义.md',{exact:true}).click();
    await choose('location');
    const location=page.getByTestId('artifact-file-location');
    await location.waitFor();
    const leaf=location.locator('[aria-current="true"]');
    assert.equal(await leaf.innerText(),path.basename(saved.filePath));
    const title=page.getByRole('heading',{name:'已保存讲义.md',exact:true});
    const anchor=await actions.boundingBox(),heading=await title.boundingBox();
    assert(anchor&&heading&&anchor.x>heading.x&&Math.abs(anchor.y-heading.y)<24,'Actions belong at the top right of the saved preview');
    const icon=await leaf.locator('svg').boundingBox(),label=await leaf.locator('span').boundingBox();
    assert(icon&&label&&label.x>icon.x&&Math.abs((label.y+label.height/2)-(icon.y+icon.height/2))<3,
      'File name and icon share the current tree row');
    const savedCopy=path.join(output,'已保存讲义副本.md');
    await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},savedCopy);
    await choose('save-as');
    await page.getByText('已另存为 已保存讲义副本.md',{exact:true}).waitFor();
    assert.deepEqual(fs.readFileSync(savedCopy),fs.readFileSync(saved.filePath));
    assert.deepEqual((await page.evaluate(()=>window.omniEdu.listDocumentArtifacts())).map(row=>row.id),[saved.id]);
  });
  await check('The preview menu stays reachable at 1366×768 and 1920×1080',async()=>{
    for(const [width,height]of[[1366,768],[1920,1080]]){
      await page.setViewportSize({width,height});
      await actions.click();
      const menu=page.getByRole('menu',{name:'文件操作'});
      const box=await menu.boundingBox();
      assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
      await page.screenshot({path:path.join(output,`menu-${width}x${height}.png`),animations:'disabled'});
      await menu.getByRole('menuitem').first().press('Escape');
      await menu.waitFor({state:'hidden'});
    }
  });
  assert.deepEqual(errors,[]);
}catch(error){
  process.exitCode=1;
  errors.push(String(error.stack||error));
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
  await app?.close().catch(()=>{});
  const report={success:!process.exitCode,checks,errors,main,
    osBoundary:'Native shell/chooser results controlled in Electron; the Windows Open With UI was not invoked.'};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,output}));
}
