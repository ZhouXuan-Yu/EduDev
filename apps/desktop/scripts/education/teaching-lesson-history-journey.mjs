import assert from 'node:assert/strict';
import path from 'node:path';

export async function verifyReadonlyLessonHistory({page,app,root,plans,document,expand,until,check}){
 const before=plans();
 const current=page.getByTestId('classroom-plan-detail');
 const currentId=await current.getAttribute('data-plan-id');
 const first=before.find(row=>JSON.parse(row.payload_json).revision===1);
 const trigger=page.getByTestId('classroom-plan-history-open-1');
 const dialog=page.getByTestId('classroom-plan-history-dialog');
 await trigger.press('Enter');
 await dialog.waitFor();
 assert.equal(await dialog.getAttribute('data-plan-id'),first.id);
 assert.match(await dialog.innerText(),/第 1 版.*只读预览/s);
 assert((await dialog.innerText()).includes(document.objectives[0]));
 assert((await dialog.innerText()).includes(document.scenes[0].activity));
 assert.equal(await dialog.locator('input,textarea,select,[contenteditable=true]').count(),0);

 await expand('classroom-history-scene-assess');
 const assessment=document.lesson.phases.find(phase=>phase.sceneId==='assess');
 assert((await dialog.innerText()).includes(assessment.checks[0].expectedEvidence));
 await expand('classroom-history-sources');
 const sources=dialog.getByTestId('classroom-history-sources');
 assert.match(await sources.innerText(),/A版/);
 assert((await sources.innerText()).includes(document.lesson.mappings[0].quote));
 for(const [width,height] of [[1366,768],[1920,1080]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
  await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
  const close=dialog.getByRole('button',{name:'关闭',exact:true});
  await close.click({trial:true});
  const fits=await dialog.evaluate(el=>{const measured=el.getBoundingClientRect();return measured.width<=innerWidth&&measured.height<=innerHeight;});
  assert(fits);
  await page.screenshot({path:path.join(root,`readonly-history-${width}x${height}.png`),animations:'disabled'});
 }
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'hidden'});
 await until(async()=>trigger.evaluate(button=>document.activeElement===button));
 assert.deepEqual(plans(),before);
 assert.equal(await current.getAttribute('data-plan-id'),currentId);
 assert(await page.getByTestId('classroom-plan-save').isDisabled());

 const intermediate=page.getByTestId('classroom-plan-history-open-2');
 await intermediate.click();
 await dialog.waitFor();
 assert.match(await dialog.innerText(),/第 2 版.*45分钟/s);
 await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 await dialog.waitFor({state:'hidden'});

 const activity=page.getByTestId('classroom-plan-scene-toggle-intro').locator('textarea');
 const original=await activity.inputValue();
 const unsaved='这是一句仅用于验收的未保存活动。';
 await activity.fill(unsaved);
 await trigger.click();
 await dialog.waitFor();
 await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 await dialog.waitFor({state:'hidden'});
 assert.equal(await activity.inputValue(),unsaved);
 assert(await page.getByTestId('classroom-plan-restore-1').isDisabled());
 assert.deepEqual(plans(),before);
 await activity.fill(original);
 check('Saved lessons open exact historical content and source, preserve dirty work, and support keyboard return and both viewports without writes');
}
