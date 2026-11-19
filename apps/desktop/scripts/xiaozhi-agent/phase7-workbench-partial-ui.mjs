import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const fixture = await startWorkbenchFixture({background: true});
const {page, root, output} = fixture;
const db = new DatabaseSync(path.join(root, 'data/app.db'));
db.exec('PRAGMA busy_timeout=3000');
const report = {success:false, root, paidCalls:0, cases:[], errors:[],
  mainSha256:createHash('sha256').update(fs.readFileSync(fixture.main)).digest('hex')};
const endTask = 'xiaozhi.task.v1:xitask_' + 'b'.repeat(64);
const extension = 'xiaozhi.extension.package.v1.fixture-unreadable-' + randomUUID();
const badApproval = 'confirm_' + randomUUID();
const modelBefore = fixture.requests.length;
const viewportSizes = [{width:1366,height:768},{width:1920,height:1080}];
page.on('pageerror', error => report.errors.push(error.message));

function facts() {
  return {
    tasks: db.prepare("SELECT key,value_json FROM app_settings WHERE key GLOB 'xiaozhi.task.v1:xitask_*' ORDER BY key").all(),
    runs: db.prepare('SELECT id,status FROM ai_agent_runs ORDER BY id').all(),
    approvals: db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all(),
    extensions: db.prepare("SELECT key,value_json FROM app_settings WHERE key LIKE 'xiaozhi.extension.package.v1.%' ORDER BY key").all(),
  };
}
function injectSetting(key) {
  db.prepare('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)').run(key,'{}',new Date().toISOString());
  return () => assert.equal(db.prepare('DELETE FROM app_settings WHERE key=?').run(key).changes,1);
}
function injectApproval() {
  const change = db.prepare(`INSERT INTO ai_confirmation_items
    (id,run_id,session_id,action_type,status,title,description,preview_md,payload_json,created_at,updated_at)
    SELECT ?,run_id,session_id,action_type,'failed','Unreadable synthetic approval','','','{}',created_at,updated_at
    FROM ai_confirmation_items WHERE session_id=? AND action_type='xiaozhi_permission_v2' LIMIT 1`)
    .run(badApproval, fixture.ids.permission.sessionId);
  assert.equal(change.changes,1);
  return () => assert.equal(db.prepare('DELETE FROM ai_confirmation_items WHERE id=?').run(badApproval).changes,1);
}
const testId = id => page.getByTestId(id);
async function checkSurface({kind,empty,rows,counts,partial,refresh,corrupt,inject,showRows,showEmpty}) {
  const scope = {kind, viewports:[]};
  report.cases.push(scope);
  await showEmpty();
  await testId(empty).waitFor();
  assert(!(await partial.isVisible()));
  const restore = inject();
  try {
    for (const size of viewportSizes) {
      await page.setViewportSize(size);
      await showRows();
      await partial.filter({hasText:corrupt}).waitFor();
      await testId(rows).first().waitFor();
      await testId(counts).filter({hasText:'未完整核对'}).waitFor();
      await showEmpty();
      await testId(refresh).click();
      await partial.filter({hasText:corrupt}).waitFor();
      const message = await partial.innerText();
      const misleadingEmpty = await testId(empty).isVisible();
      assert.equal(await testId(rows).count(),0);
      assert.match(await testId(counts).innerText(),/未完整核对/);
      scope.viewports.push({size,message,misleadingEmpty,passed:!misleadingEmpty&&message.includes('请')&&message.includes('刷新')});
      await page.screenshot({path:path.join(output,kind+'-partial-empty-'+size.width+'.png')});
    }
  } finally {
    restore();
  }
  await testId(refresh).click();
  await partial.waitFor({state:'hidden'});
  await testId(empty).waitFor();
  assert(!(await partial.isVisible()));
  scope.refreshRestoresCompleteEmpty = true;
}
try {
  const original = facts();
  await testId('pi-workbench-open').click();
  await checkSurface({kind:'tasks',empty:'pi-task-overview-empty',rows:'pi-task-overview-row',counts:'pi-task-counts',
    partial:testId('pi-task-partial'),refresh:'pi-task-overview-refresh',corrupt:'tasks: corrupt',
    inject:()=>injectSetting(endTask),showRows:()=>testId('pi-task-filter').selectOption('all'),showEmpty:()=>testId('pi-task-filter').selectOption('ended')});
  await testId('pi-workbench-approvals').click();
  await checkSurface({kind:'approvals',empty:'pi-approval-inbox-empty',rows:'pi-approval-inbox-row',counts:'pi-approval-counts',
    partial:page.getByRole('status').filter({hasText:'部分审批来源未读取'}),refresh:'pi-approval-inbox-refresh',corrupt:'approvals: corrupt',
    inject:injectApproval,showRows:()=>testId('pi-approval-filter').selectOption('pending'),showEmpty:()=>testId('pi-approval-filter').selectOption('rejected')});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await testId('pi-settings-tab-capabilities').click();
  const search = async query => {await testId('pi-capability-search').fill(query); await testId('pi-capability-search-submit').click();};
  await checkSurface({kind:'capabilities',empty:'pi-capability-empty',rows:'pi-capability-row',counts:'pi-capability-counts',
    partial:testId('pi-capability-partial'),refresh:'pi-capability-refresh',corrupt:'extensions: corrupt',
    inject:()=>injectSetting(extension),showRows:()=>search('合成候选'),showEmpty:()=>search('不存在的合成匹配-'+root.slice(-6))});
  assert.deepEqual(facts(),original);
  assert.equal(fixture.requests.length,modelBefore);
  assert.deepEqual(report.errors,[]);
  report.durableFactsUnchanged = true;
  report.modelRequestsFromReads = fixture.requests.length-modelBefore;
  report.success = report.cases.every(item=>item.refreshRestoresCompleteEmpty&&item.viewports.length===2&&item.viewports.every(viewport=>viewport.passed));
} catch (error) {
  report.error = String(error.stack || error);
} finally {
  db.close();
  await fixture.close().catch(error=>{report.closeError=String(error);report.success=false;});
  fs.writeFileSync(path.join(output,'partial-empty-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if(!report.success) process.exitCode=1;
}
