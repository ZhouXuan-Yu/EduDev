import {testMain} from '../acceptance/build-root.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-files-ui-'));
const data=path.join(output,'data'),workspace=path.join(output,'教研目录');fs.mkdirSync(workspace);fs.mkdirSync(path.join(workspace,'数学'));
const marker=`课堂代号${randomUUID()}`,text=`备课资料\n${marker}\n课时37分钟`,markdown=`# 分数教研\n\n**${marker}**\n\n![外部图片](https://example.invalid/do-not-fetch.png)\n\n<script>window.NOT_EXECUTED=true</script>`;
fs.writeFileSync(path.join(workspace,'讲义.txt'),text);fs.writeFileSync(path.join(workspace,'数学','计划.md'),markdown);fs.writeFileSync(path.join(workspace,'课堂.bin'),'%PDF-synthetic');
fs.writeFileSync(path.join(workspace,'图.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64'));
fs.writeFileSync(path.join(workspace,'.env.local'),'SYNTHETIC_CREDENTIAL');fs.writeFileSync(path.join(workspace,'大文件.txt'),Buffer.alloc(1048577,65));
const report={success:false,checks:[],boundaries:['Actual formal Electron/typed IPC/Hana filesystem/source bytes and restart; synthetic local files','Controlled native chooser result; no artificial file list/preview','No provider request or Office/PDF content preview claim; reference DPI and native frame pending']};
let app,page,session;const errors=[],remoteRequests=[];
const check=(name,fn=()=>{})=>{fn();report.checks.push({name,pass:true});console.log(`PASS ${name}`);};
async function until(fn,timeout=25000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,80));}throw new Error('File panel UI condition timed out');}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),initial=hash(fs.readFileSync(path.join(workspace,'讲义.txt')));
async function resize(width,height){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});}
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[testMain(desktop),`--user-data-dir=${path.join(output,'electron-profile')}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error)));page.on('request',request=>{if(/example\.invalid/.test(request.url()))remoteRequests.push(request.url());});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());session=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
const item=name=>page.getByTestId(`pi-file-entry-${name==='计划.md'?'数学/计划.md':name}`);
async function clickFile(name){await item(name).click();await until(async()=>await page.getByTestId('pi-file-preview').getAttribute('aria-busy')==='false');}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
try{
  await launch();await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-file-error').waitFor({state:'visible'});assert((await page.getByTestId('pi-file-error').innerText()).includes('选择教学工作目录'));
  check('Actual ungranted conversation shows no_workspace and does not browse private history');
  await app.evaluate(async({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},workspace);
  await page.getByTestId('pi-files-choose').click();await item('讲义.txt').waitFor({state:'visible'});assert.equal((await snapshot()).workspace.label,'教研目录');assert(!await item('.env.local').count());
  check('Teacher chooses directory through actual UI/native chooser/SQLite grant; original Pro FileTree receives real files');
  await clickFile('讲义.txt');assert.equal(await page.getByTestId('pi-file-text').innerText(),text);check('Real bounded text preview exactly matches random disk facts');
  await item('数学').click();await item('计划.md').waitFor({state:'visible'});await clickFile('计划.md');assert((await page.getByTestId('pi-file-preview').innerText()).includes(marker));assert.equal(await page.getByTestId('pi-file-preview').locator('h1').innerText(),'分数教研');assert.equal(await page.getByTestId('pi-file-preview').locator('img,script').count(),0);assert.equal(await page.evaluate(()=>window.NOT_EXECUTED),undefined);assert.deepEqual(remoteRequests,[]);
  check('Lazy real directory expansion and safe Markdown render no remote image, script or model request');
  await page.getByRole('tab',{name:'讲义.txt',exact:true}).click();await until(async()=>await page.getByTestId('pi-file-text').count());assert.equal(await page.getByTestId('pi-file-text').innerText(),text);
  await page.getByTestId('pi-file-tab-close').click();await until(async()=>!await page.getByRole('tab',{name:'讲义.txt',exact:true}).count());assert(await page.getByRole('tab',{name:'计划.md',exact:true}).isVisible());
  check('Original OSS Tabs switch real previews and close current tab without losing another file');
  await clickFile('图.png');const img=page.getByTestId('pi-file-image');await until(async()=>await img.evaluate(element=>element.complete&&element.naturalWidth===1));assert((await img.getAttribute('src')).startsWith('data:image/png;base64,'));check('Actual local image decodes from signature-verified bounded bytes');
  await clickFile('课堂.bin');assert((await page.getByTestId('pi-file-preview').innerText()).includes('暂不支持此格式'));check('Unknown binary displays actual metadata; real Office/PDF is verified in separate native suite');
  await clickFile('大文件.txt');assert((await page.getByTestId('pi-file-preview').innerText()).includes('超过本地预览大小限制'));check('Oversize real file shows actionable error and retains directory');
  await clickFile('讲义.txt');fs.appendFileSync(path.join(workspace,'讲义.txt'),'\n修改后课时38分钟');await clickFile('图.png');await page.getByRole('tab',{name:'讲义.txt',exact:true}).click();await until(async()=>(await page.getByTestId('pi-file-preview').innerText()).includes('已变化'));check('Actual file mutation cannot silently substitute old expected version');
  await page.getByTestId('pi-file-preview-refresh').click();await item('讲义.txt').waitFor({state:'visible'});await clickFile('讲义.txt');assert((await page.getByTestId('pi-file-text').innerText()).includes('修改后课时38分钟'));check('Actual preview failure refresh obtains new file version and reads changed facts');
  fs.unlinkSync(path.join(workspace,'课堂.bin'));await page.getByRole('tab',{name:'课堂.bin',exact:true}).click();await until(async()=>(await page.getByTestId('pi-file-preview').innerText()).includes('已不存在'));check('Real removed file is not presented from a stale cached tab');
  for(const [width,height]of [[1366,768],[1920,1080]]){
    await resize(width,height);await clickFile('讲义.txt');const input=await page.getByTestId('office-prompt-input').boundingBox(),panel=await page.getByTestId('pi-file-panel').boundingBox(),send=await page.locator('.office-composer [data-slot="prompt-input-send"]').boundingBox();assert(input.x>=0&&input.y+input.height<=height);assert(panel.width>=359&&panel.x+panel.width<=width+1);assert(send.x+send.width<=panel.x+1&&send.y+send.height<=height);
    await page.screenshot({path:path.join(output,`files-${width}x${height}.png`)});check(`Chat input, original tree/tab and real preview remain reachable at ${width}x${height}`);
  }
  const handle=page.locator('.pi-shell-files [data-slot="resizable-handle"]');const box=await handle.boundingBox(),before=(await page.getByTestId('pi-file-panel').boundingBox()).width;await page.mouse.move(box.x+box.width/2,box.y+100);await page.mouse.down();await page.mouse.move(box.x-110,box.y+100,{steps:12});await page.mouse.up();await until(async()=>Math.abs((await page.getByTestId('pi-file-panel').boundingBox()).width-before)>60);report.panelWidthAfterDrag=(await page.getByTestId('pi-file-panel').boundingBox()).width;
  check('Original Pro Resizable performs actual pointer drag and saves layout');
  await page.getByTestId('pi-files-explorer-toggle').click();assert(!await item('讲义.txt').isVisible());assert((await page.getByTestId('pi-file-text').innerText()).includes('修改后课时38分钟'));await page.getByTestId('pi-files-explorer-toggle').click();assert(await item('讲义.txt').isVisible());check('Original file tree can actually close and reopen without discarding the local preview');
  for(const [width,height]of[[1366,768],[1920,1080]]){
    await resize(width,height);const narrow=await handle.boundingBox();await page.mouse.move(narrow.x+narrow.width/2,narrow.y+100);await page.mouse.down();await page.mouse.move(width-350,narrow.y+100,{steps:12});await page.mouse.up();
    await page.getByTestId('pi-files-explorer-toggle').click();const panel=await page.getByTestId('pi-file-panel').boundingBox(),reading=await page.getByTestId('pi-file-preview').boundingBox();assert(panel.width<=380&&panel.width>=359);assert(reading.width>=330);
    for(const action of [page.getByTestId('pi-files-explorer-toggle'),page.getByTestId('pi-files-refresh'),page.getByTestId('pi-files-close'),page.locator('.office-composer [data-slot="prompt-input-send"]')]){const rect=await action.boundingBox();assert(rect&&rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0&&rect.y+rect.height<=height);}
    await page.screenshot({path:path.join(output,`files-narrow-${width}x${height}.png`)});await page.getByTestId('pi-files-explorer-toggle').click();check(`Actual minimum file pane expands reading by hiding tree with all controls reachable at ${width}x${height}`);
  }
  report.panelWidthAfterDrag=(await page.getByTestId('pi-file-panel').boundingBox()).width;
  await page.getByTestId('pi-file-filter').fill('讲义');assert(!await item('图.png').count());assert(await item('讲义.txt').isVisible());await page.getByTestId('pi-file-filter').fill('');check('Filtering real loaded entries does not fabricate or query unauthorized paths');
  const old=session;await page.getByTestId('ai-conversation-new').click();await until(async()=>await page.getByTestId('pi-file-error').count());session=await page.locator('.office-composer-container').getAttribute('data-session-id');assert.notEqual(session,old);assert.equal(await page.getByRole('tab').count(),0);assert(!await page.getByTestId('pi-file-preview').innerText().then(value=>value.includes(marker)));
  check('Conversation switch cancels prior requests/bytes/tabs and requires its own workspace grant');
  const denied=await page.evaluate(id=>window.omniEdu.listXiaozhiFiles({schemaVersion:'xiaozhi.files.v1',sessionId:id,requestId:`xifile_${crypto.randomUUID()}`,path:'../outside'}),old);assert.equal(denied.error,'invalid_input');check('Actual typed IPC rejects traversal with no raw path disclosure');
  await page.getByTestId(`ai-conversation-session-${old}`).click();session=old;await item('讲义.txt').waitFor({state:'visible'});await clickFile('讲义.txt');await page.getByTestId('pi-files-close').click();await page.getByTestId('pi-file-panel').waitFor({state:'hidden'});assert(await page.getByTestId('xiaozhi-pi-inspector').isVisible());await page.getByTestId('pi-files-toggle').click();await item('讲义.txt').waitFor({state:'visible'});assert.equal(await page.getByRole('tab').count(),0);
  check('Closing returns to compact context and reopening revalidates directory without persisting preview body');
  assert.equal((await snapshot()).projection.turns.length,0);assert.deepEqual(remoteRequests,[]);report.preferences=await page.evaluate(()=>localStorage.getItem('xiaozhi.ui.v1'));assert.equal(JSON.parse(report.preferences).files,true);
  await app.close();app=undefined;await launch();await resize(1920,1080);await item('讲义.txt').waitFor({state:'visible'});assert.equal(await page.getByRole('tab').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('xiaozhi.ui.v1')),report.preferences);assert.deepEqual((await snapshot()).workspace,{label:'教研目录'});assert(!await page.evaluate(value=>Object.values(localStorage).some(item=>item.includes(value)),marker));
  check('Actual restart restores file mode/SQLite grant/layout and does not persist file text or resume model work');
  const afterWidth=(await page.getByTestId('pi-file-panel').boundingBox()).width;report.panelWidthAfterRestart=afterWidth;assert(Math.abs(afterWidth-report.panelWidthAfterDrag)<5);
  await page.getByTestId(`ai-conversation-session-${session}`).click({button:'right'});await page.getByTestId('ai-conversation-context-archive').click();await page.getByTestId('ai-conversation-archive-confirm').click();await until(async()=>(await page.evaluate(()=>window.omniEdu.listAiConversations())).archivedSessions.some(item=>item.id===old));
  const archived=await page.evaluate(id=>window.omniEdu.listXiaozhiFiles({schemaVersion:'xiaozhi.files.v1',sessionId:id,requestId:`xifile_${crypto.randomUUID()}`,path:'.'}),old);assert.equal(archived.error,'permission_denied');check('Actual teacher archive removes file authority through production host, not only navigation');
  for(const candidate of [`aisession_${randomUUID()}`,old]){
    await page.evaluate(id=>localStorage.setItem('xiaozhi.current-session.v1',id),candidate);await app.close();app=undefined;await launch();const list=await page.evaluate(()=>window.omniEdu.listAiConversations());assert(list.sessions.some(item=>item.id===session));assert.notEqual(session,candidate);assert.equal(await page.evaluate(()=>localStorage.getItem('xiaozhi.current-session.v1')),session);
    check(candidate===old?'Archived remembered session falls back to an actual active conversation after restart':'Unknown remembered session cannot create phantom authority after restart');
  }
  assert.notEqual(hash(fs.readFileSync(path.join(workspace,'讲义.txt'))),initial);assert.deepEqual(errors,[]);report.success=true;
}catch(error){process.exitCode=1;report.error=String(error.stack||error).slice(0,3000);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});report.rendererErrors=errors;report.remoteRequests=remoteRequests;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))}));}
