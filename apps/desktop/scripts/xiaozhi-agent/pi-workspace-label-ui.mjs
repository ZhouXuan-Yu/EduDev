import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint} from '../acceptance/evidence.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const sourceData=path.join(desktop,'test-results/education-journey-brFkEo/data/app.db');
const output=path.join(desktop,'test-results/goal/teacher-mainline-workspace-label-20261022');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'edu-workspace-label-'));
const data=path.join(temporary,'data'),profile=path.join(temporary,'profile'),workspace=path.join(temporary,'workspace');
fs.mkdirSync(data,{recursive:true});fs.copyFileSync(sourceData,path.join(data,'app.db'));
fs.mkdirSync(workspace);fs.writeFileSync(path.join(workspace,'教师备课.md'),'# 教师备课\n\n教学内容。\n');
fs.mkdirSync(output,{recursive:true});
const main=testMain(desktop),build=fingerprint(path.dirname(path.dirname(main)));
const report={schema:'teacher.workspace-label.ui.v1',success:false,build:{sha256:build.sha256,files:build.files.length},
  boundary:'Current Electron and copied local database. Raw directory label remains workspace; only the teacher-facing renderer label is checked. No provider or business write.'};
let app,page;
try{
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};
  delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.ELECTRON_RENDERER_URL;
  app=await electron.launch({args:[main,`--user-data-dir=${profile}`,'--force-device-scale-factor=1'],env,timeout:60000});
  report.launch=await assertIsolatedPiMain(app,main,profile);
  page=await app.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor({state:'visible',timeout:60000});
  const previous=await page.locator('.office-composer-container').getAttribute('data-session-id');
  await page.getByTestId('ai-conversation-new').click();
  await page.waitForFunction(previousId=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')&&document.querySelector('.office-composer-container')?.getAttribute('data-session-id')!==previousId,previous);
  const session=await page.locator('.office-composer-container').getAttribute('data-session-id');
  await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},workspace);
  await page.getByTestId('pi-permission-picker').click();
  await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();
  await page.locator('.pi-context-header').getByText('教学工作目录',{exact:true}).waitFor();
  await page.getByTestId('pi-files-toggle').click();
  await page.getByTestId('pi-file-filter').waitFor({state:'visible'});
  const explorer=page.locator('.pi-file-explorer');
  assert.equal(await explorer.locator('strong').innerText(),'教学工作目录');
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  const stored=db.prepare('SELECT label FROM xiaozhi_pi_workspaces WHERE conversation_id=?').get(session);
  db.close();assert.equal(stored.label,'workspace');
  await page.emulateMedia({colorScheme:'dark'});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
  await page.waitForFunction(()=>innerWidth===1366&&innerHeight===768);
  report.screenshot='workspace-label-dark-1366x768.png';
  await page.screenshot({path:path.join(output,report.screenshot),animations:'disabled'});
  report.rawLabel=stored.label;report.teacherLabel=await explorer.locator('strong').innerText();
  report.fileCount=await page.locator('.pi-file-explorer .file-tree__item').count();
  assert(report.fileCount>=1);
  report.success=true;
}catch(error){
  report.error=String(error?.stack||error);process.exitCode=1;
  await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});
}finally{
  await app?.close().catch(()=>{});
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,report:path.relative(desktop,path.join(output,'report.json')),error:report.error}));
}
