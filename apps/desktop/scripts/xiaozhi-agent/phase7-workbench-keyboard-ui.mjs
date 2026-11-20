import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const size=process.argv[2]||'1366x768';
const inputMode=process.argv[3]||'keyboard';
assert(['keyboard','mixed'].includes(inputMode));
assert(['1366x768','1920x1080'].includes(size));
const [width,height]=size.split('x').map(Number);
const approvalDetailDelayMs=1800;
const fixture=await startWorkbenchFixture({background:true,approvalDetailDelayMs});
const {page,root,output,main}=fixture;
const testId=id=>page.getByTestId(id);
const report={success:false,root,viewport:{width,height},inputMode,pageErrors:[],checks:[],paidCalls:0,
  mainSha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex')};
page.on('pageerror',error=>report.pageErrors.push(error.message));
const focused=locator=>locator.evaluate(element=>element===document.activeElement);
async function tabTo(target,maximum=70) {
  for(let step=0;step<maximum;step++){
    if(await focused(target))return;
    await page.keyboard.press('Tab');
  }
  throw Error('Keyboard traversal could not reach '+target);
}
function readFacts(){
  const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});
  try{return {
    approvals:db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all(),
    grants:db.prepare('SELECT * FROM xiaozhi_permission_grants_v1 ORDER BY grant_id').all(),
    runs:db.prepare('SELECT id,status FROM ai_agent_runs ORDER BY id').all()
  };}finally{db.close();}
}
try{
  const before=readFacts();
  const modelBefore=fixture.requests.length;
  await fixture.application.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
  await page.setViewportSize({width,height});
  const trigger=testId('pi-workbench-open');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const panel=page.getByRole('dialog',{name:'恢复与待办',exact:true});
  await panel.waitFor();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='恢复与待办');
  await page.keyboard.press('Tab');
  assert(await focused(panel.getByRole('button',{name:'关闭恢复与待办',exact:true})));
  await tabTo(testId('pi-workbench-approvals'));
  await page.keyboard.press('Space');
  const inbox=testId('pi-approval-inbox');
  await inbox.waitFor();
  const row=testId('pi-approval-inbox-row').filter({hasText:'审批样本'});
  const detail=row.getByTestId('pi-approval-inbox-detail');
  await detail.waitFor();
  await tabTo(detail);
  if(inputMode==='mixed') await detail.click();
  else await page.keyboard.press('Space');
  const busy=inbox.getByRole('status').filter({hasText:'正在核对申请'});
  await busy.waitFor();
  assert(await detail.isDisabled());
  assert(await testId('pi-approval-inbox-refresh').isDisabled());
  assert.equal(await testId('pi-approval-inbox-selected').count(),0);
  report.focusInsideDuringBusy=await panel.evaluate(element=>element.contains(document.activeElement));
  await page.screenshot({path:path.join(output,'keyboard-detail-busy.png')});
  await page.keyboard.press('Escape');
  await panel.waitFor({state:'hidden',timeout:4000});
  assert.equal(report.focusInsideDuringBusy,true);
  await page.waitForFunction(()=>document.activeElement?.dataset.testid==='pi-workbench-open');
  await page.keyboard.press('Space');
  await panel.waitFor();
  await tabTo(testId('pi-workbench-approvals'));
  await page.keyboard.press('Space');
  await detail.waitFor();
  const deadline=Date.now()+10000;
  while (!await fixture.application.evaluate(()=>globalThis.phase7ApprovalDetailsSettled)) {
    if (Date.now()>=deadline) throw Error('Original closed-panel read did not settle');
    await page.waitForTimeout(75);
  }
  assert.equal(await testId('pi-approval-inbox-selected').count(),0);
  await tabTo(detail);
  await page.keyboard.press('Space');
  report.checks.push('Escape while detail is in flight cancels the opened panel; late detail never populates the reopened inbox');
  const selected=testId('pi-approval-inbox-selected');
  await selected.waitFor();
  const approve=selected.getByTestId('pi-permission-approve');
  await approve.waitFor();
  assert(await approve.isEnabled());
  await tabTo(approve);
  await tabTo(selected.getByTestId('pi-permission-reject'));
  await page.keyboard.press('Escape');
  await panel.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.dataset.testid==='pi-workbench-open');
  report.checks.push('Workbench Enter/Space, approval detail busy disable, reachable approval decisions, and Escape focus restoration');

  const settings=page.getByRole('button',{name:'设置',exact:true});
  await settings.press('Enter');
  const capTab=testId('pi-settings-tab-capabilities');
  await capTab.press('Enter');
  const search=testId('pi-capability-search');
  await search.fill('合成候选');
  await search.press('Enter');
  const rowCount=testId('pi-capability-row');
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid=pi-capability-row]').length===2);
  assert.equal(await rowCount.count(),2);
  await tabTo(testId('pi-capability-manage-skills'));
  await page.keyboard.press('Space');
  await testId('pi-skill-governance-select').waitFor();
  assert(await testId('pi-skill-governance-select').isEnabled());
  await page.screenshot({path:path.join(output,'keyboard-capability-skills.png')});
  report.checks.push('Settings Enter, actual capability search, and keyboard activation of Skill governance navigation');
  assert.deepEqual(readFacts(),before);
  assert.equal(fixture.requests.length,modelBefore);
  assert.deepEqual(report.pageErrors,[]);
  report.success=true;
}catch(error){
  report.error=String(error.stack||error);
  await page.screenshot({path:path.join(output,'keyboard-busy-failure.png')}).catch(()=>{});
}finally{
  await fixture.close().catch(error=>{report.success=false;report.closeError=String(error);});
  fs.writeFileSync(path.join(output,'keyboard-busy-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if(!report.success)process.exitCode=1;
}
