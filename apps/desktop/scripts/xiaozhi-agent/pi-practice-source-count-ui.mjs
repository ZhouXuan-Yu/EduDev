import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint} from '../acceptance/evidence.mjs';
import {settleWorkspaceTransitions} from './capture-workspace-metrics.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const sourceData=path.join(desktop,'test-results/education-journey-brFkEo/data/app.db');
const output=path.join(desktop,'test-results/goal/teacher-mainline-practice-count-20261022');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'edu-practice-count-'));
const data=path.join(temporary,'data'),profile=path.join(temporary,'profile');
fs.mkdirSync(data,{recursive:true});fs.copyFileSync(sourceData,path.join(data,'app.db'));
fs.mkdirSync(output,{recursive:true});
const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
const student=db.prepare("SELECT id,display_name FROM students WHERE status='active' ORDER BY created_at,id LIMIT 1").get();
const exercise=db.prepare('SELECT id,title FROM exercise_sets WHERE student_id=? ORDER BY created_at,id LIMIT 1').get(student?.id);
db.close();assert(student&&exercise);

const main=testMain(desktop),build=fingerprint(path.dirname(path.dirname(main)));
const report={schema:'teacher.practice-source-count.ui.v1',success:false,build:{sha256:build.sha256,files:build.files.length},
  boundary:'Current build launched against a copied accepted exercise database. No provider call, no source database mutation, no write action.'};
let app,page;
try{
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1'};
  delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.ELECTRON_RENDERER_URL;
  app=await electron.launch({args:[main,`--user-data-dir=${profile}`,'--force-device-scale-factor=1'],env,timeout:60000});
  report.launch=await assertIsolatedPiMain(app,main,profile);
  page=await app.firstWindow();
  const rail=page.locator('[data-testid=product-rail]:visible');await rail.waitFor({timeout:60000});
  await rail.getByTestId('product-nav-students').click();
  const studentRow=page.getByText(student.display_name,{exact:true}).first();
  await studentRow.waitFor();
  await studentRow.click();
  await page.getByTestId('nav-mistakes').click();
  const card=page.getByTestId('exercise-set-card-'+exercise.id);await card.waitFor();
  await card.getByTestId('exercise-set-details-'+exercise.id).locator('summary').click();
  await card.getByTestId('practice-source-open').click();
  const dialog=page.getByTestId('practice-source-dialog');await dialog.waitFor();
  const text=await dialog.innerText();
  assert.match(text,/共 2 题，请逐题核对/);
  assert.match(text,/第 1\/2 题/);
  assert.match(text,/第 2\/2 题/);
  const count=dialog.getByTestId('practice-review-count');
  await count.waitFor();assert.equal(await count.getAttribute('role'),'status');
  await page.emulateMedia({colorScheme:'dark'});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
  await page.waitForFunction(()=>innerWidth===1366&&innerHeight===768);
  const hiddenSnapshot=await app.evaluate(({BrowserWindow})=>!BrowserWindow.getAllWindows()[0].isVisible());
  report.transitions=await settleWorkspaceTransitions(page,{hiddenSnapshot});
  const second=dialog.getByTestId('practice-review-item').nth(1);
  await second.evaluate(element=>{
    const container=element.closest('.pi-question-candidates');
    if(!container)throw new Error('missing practice scroller');
    const offset=element.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop-46;
    container.scrollTop=Math.max(0,offset);
  });
  await page.waitForTimeout(100);
  assert(await second.isVisible());
  const countBox=await count.boundingBox(),headingBox=await second.locator('strong').boundingBox();
  const secondBox=await second.boundingBox(),dialogBox=await dialog.boundingBox();
  assert(countBox&&headingBox&&headingBox.y>=countBox.y+countBox.height-1);
  assert(secondBox&&dialogBox&&secondBox.y<dialogBox.y+dialogBox.height);
  report.screenshot='practice-source-count-dark-1366x768.png';
  await page.screenshot({path:path.join(output,report.screenshot),animations:'disabled'});
  report.screen={
    width:await page.evaluate(()=>innerWidth),height:await page.evaluate(()=>innerHeight),
    countText:await count.innerText(),first:await dialog.getByTestId('practice-review-item').first().locator('strong').innerText(),
    second:await second.locator('strong').innerText(),secondVisible:await second.isVisible()
  };
  report.success=true;
}catch(error){
  report.error=String(error?.stack||error);process.exitCode=1;
  await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});
}finally{
  await app?.close().catch(()=>{});
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,report:path.relative(desktop,path.join(output,'report.json')),error:report.error}));
}
