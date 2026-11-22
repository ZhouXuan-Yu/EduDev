import assert from 'node:assert/strict';
import path from 'node:path';

export const independentTitle='同会话独立教案：从事实认识推理';

export function lessonCard(page,rootId){
 return page.getByTestId('pi-classroom-plan-review').filter({has:page.getByTestId('pi-classroom-plan-open')})
  .and(page.locator(`[data-root-id="${rootId}"]`));
}

export async function openLessonFromChat(page,rootId,currentId){
 const card=lessonCard(page,rootId);
 await card.waitFor();
 assert.equal(await card.getAttribute('data-plan-id'),currentId);
 await card.getByTestId('pi-classroom-plan-open').click();
 const detail=page.getByTestId('classroom-plan-detail');
 await detail.waitFor();
 assert.equal(await detail.getAttribute('data-root-id'),rootId);
 assert.equal(await detail.getAttribute('data-plan-id'),currentId);
}

export async function readLessonOwner(page,row){
 const read=await page.evaluate(async ({sessionId,rootId})=>{
  const api=window.omniEdu;
  const exact=await api.openClassroomPlan({sessionId,rootId});
  const wrong=await api.openClassroomPlan({sessionId:'aisession_'+crypto.randomUUID(),rootId});
  return {exact,wrong};
 },{sessionId:row.session_id,rootId:row.id});
 assert(read.exact.ok);
 assert.deepEqual(read.wrong,{ok:false,error:'permission_denied'});
 return read.exact.data;
}

export async function assertStaleLessonEdit(page,item,plans){
 const before=plans();
 const stale=await page.evaluate(item=>window.omniEdu.editClassroomPlan({
  id:item.id,version:item.version,document:{...item.document,title:'过期编辑不应保存'},
 }),item);
 assert.deepEqual(stale,{ok:false,error:'conflict'});
 assert.deepEqual(plans(),before);
}

export async function verifyLessonReturn({page,app,root,initial,current,independent,until,check}){
 const original=lessonCard(page,initial.id);
 const other=lessonCard(page,independent.id);
 await original.waitFor();
 await other.waitFor();
 assert.equal(independent.session_id,initial.session_id);
 assert.notEqual(independent.run_id,initial.run_id);
 assert.equal(await original.getAttribute('data-origin-run-id'),initial.run_id);
 assert.equal(await original.getAttribute('data-plan-id'),current.id);
 assert.equal(await other.getAttribute('data-plan-id'),independent.id);

 await page.getByTestId('pi-aside-toggle').click();
 const aside=page.getByTestId('pi-context-classroom-plan');
 await aside.waitFor();
 assert.equal(await aside.count(),1);
 assert.equal(await aside.getAttribute('data-root-id'),independent.id);
 assert.match(await aside.innerText(),/教学|事实/);
 for(const [width,height] of [[1366,768],[1920,1080]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
  await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
  await aside.getByTestId('pi-classroom-plan-open').click({trial:true});
  await page.screenshot({path:path.join(root,`lesson-task-${width}x${height}.png`),animations:'disabled'});
 }
 await aside.getByTestId('pi-classroom-plan-open').click();
 assert.equal(await page.getByTestId('classroom-plan-detail').getAttribute('data-plan-id'),independent.id);
 await page.getByTestId('classroom-plan-source-chat').click();
 await other.waitFor();
 await until(async()=>other.getByTestId('pi-classroom-plan-open').evaluate(el=>document.activeElement===el));
 await openLessonFromChat(page,initial.id,current.id);
 assert.equal(await page.getByTestId('classroom-plan-detail').getAttribute('data-status'),'confirmed');
 check('Two independent lessons retain their own original Run and exact current version, and the task inspector opens only its owner');
}
