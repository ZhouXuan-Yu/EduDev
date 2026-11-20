import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

let fixture, application, page;
const report = {success: false, paidCalls: 0, checks: [], errors: [], boundary: 'Actual built production main/preload/renderer with original typed actions. Synthetic metadata seeded through original domain APIs; all model traffic loopback. Independent visual/mouse acceptance remains Terra.'};
async function until(action, timeout = 45000) {const end = Date.now() + timeout; do {if (await action()) return; await page.waitForTimeout(100);} while (Date.now() < end); throw Error('ui_readback_timeout');}
async function check(name, action) {const started = performance.now(); await action(); report.checks.push({name, pass: true, durationMs: performance.now() - started}); console.log('PASS ' + name);}
async function overview() {const button = page.getByTestId('pi-workbench-open'); await button.click(); await page.getByTestId('pi-workbench').waitFor();}
const summary = query => page.evaluate(query => window.omniEdu.getXiaozhiWorkbenchSummary({schemaVersion: 1, ...query}), query);
function database() {return new DatabaseSync(path.join(fixture.root, 'data', 'app.db'), {readOnly: true});}
function approvals() {const db = database(); try {return db.prepare("SELECT id,action_type,payload_json FROM ai_confirmation_items").all().map(row => ({id: row.id, action: row.action_type, value: JSON.parse(row.payload_json)}));} finally {db.close();}}
function runs(sessionId) {
  const db = database();
  try {return db.prepare('SELECT id,status,error_message FROM ai_agent_runs WHERE session_id=?').all(sessionId);}
  finally {db.close();}
}
async function verifyResumedRun(target, previous) {
  let run;
  // The full renderer snapshot reads multiple projections. While Pi is
  // preparing a Run, wait for its terminal row to keep the runtime unburdened.
  await until(() => {
    const created = runs(target.sessionId).filter(item => !previous.has(item.id));
    if (!created.length) return false;
    assert.equal(created.length, 1);
    run = created[0];
    return run.status !== 'running';
  }, 90000);
  report.resumedRuns ??= [];
  report.resumedRuns.push({taskId: target.task.id, sessionId: target.sessionId, ...run});
  assert.equal(run.status, 'succeeded', run.error_message || 'The resumed Run must succeed');
  await until(async () => {
    const state = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), target.sessionId);
    return state.running === false && state.task?.id === target.task.id;
  });
  assert.equal(runs(target.sessionId).length, previous.size + 1);
}
try {
  fixture = await startWorkbenchFixture({background: true}); application = fixture.application; page = fixture.page;
  report.root = fixture.root; report.output = fixture.output; page.on('pageerror', error => report.errors.push(error.message));
  await check('U01_visible_cross_session_overview_matches_original_completed_facts', async () => {
    await overview(); const value = await summary({kind: 'tasks', filter: 'unfinished'}); assert(value.ok && value.value.kind === 'tasks');
    assert.equal(value.value.partial, false); assert.equal(value.value.total, 5); assert.equal(value.value.matched, 4); assert.equal(value.value.counts.completed, 1);
    await page.getByTestId('pi-task-overview-row').first().waitFor(); assert.equal(await page.getByTestId('pi-task-overview-row').count(), 4);
    await page.getByTestId('pi-task-filter').selectOption('completed'); await until(async () => await page.getByTestId('pi-task-overview-row').count() === 1);
    assert((await page.getByTestId('pi-task-overview-row').innerText()).includes('已确认样本'));
    await page.getByTestId('pi-task-filter').selectOption('unfinished'); await until(async () => await page.getByTestId('pi-task-overview-row').count() === 4);
  });
  await check('U02_both_actual_sizes_keep_global_actions_pointer_reachable', async () => {
    for (const size of [{width: 1366, height: 768}, {width: 1920, height: 1080}]) {
      await application.evaluate(({BrowserWindow}, size) => {const window = BrowserWindow.getAllWindows()[0]; window.unmaximize(); window.setContentSize(size.width, size.height);}, size);
      await page.setViewportSize(size); const control = page.getByTestId('pi-task-overview-refresh'); await control.scrollIntoViewIfNeeded();
      assert(await control.evaluate(element => {const box = element.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight && element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));}));
      await page.screenshot({path: path.join(fixture.output, `workbench-${size.width}x${size.height}.png`)});
    }
  });
  await check('U03_cross_session_remaining_double_click_starts_one_original_same_Task_Run', async () => {
    const target = fixture.ids.remaining, before = new Set(runs(target.sessionId).map(run => run.id));
    const row = page.getByTestId('pi-task-overview-row').filter({hasText: '恢复样本 · 尚有剩余步骤'});
    await row.getByTestId('pi-task-overview-resume').click({clickCount: 2});
    await verifyResumedRun(target, before);
    assert.equal(await page.locator('.office-composer-container').getAttribute('data-session-id'), target.sessionId);
  });
  await check('U04_explicit_continue_rechecks_same_Task_in_original_Pi_loop', async () => {
    if (!await page.getByTestId('pi-workbench').isVisible()) await overview(); await page.getByTestId('pi-workbench-tasks').click();
    const target = fixture.ids.continuation, before = new Set(runs(target.sessionId).map(run => run.id));
    const row = page.getByTestId('pi-task-overview-row').filter({hasText: '核对样本 · 同任务继续'});
    const continueTask = row.getByTestId('pi-task-overview-continue');
    const unreadIndex = page.getByTestId('pi-workbench').getByRole('alert')
      .filter({hasText: '本地索引未读取，请重试。'});
    await continueTask.or(unreadIndex).first().waitFor();
    if (await unreadIndex.isVisible()) {
      report.continuationIndexRefresh = {reason: await unreadIndex.innerText()};
      await page.getByTestId('pi-task-overview-refresh').click();
      await continueTask.waitFor();
      report.continuationIndexRefresh.recovered = true;
    }
    await continueTask.click();
    await verifyResumedRun(target, before);
  });
  await check('U05_inbox_modern_rejection_uses_original_permission_CAS', async () => {
    if (!await page.getByTestId('pi-workbench').isVisible()) await overview(); await page.getByTestId('pi-workbench-approvals').click();
    const row = page.getByTestId('pi-approval-inbox-row').filter({hasText: '审批样本 · 现代权限申请'}).first();
    assert.match(await row.innerText(), /数据范围 脱敏资料/);
    assert.doesNotMatch(await row.innerText(), /redacted|申请版本/);
    await row.getByTestId('pi-approval-inbox-detail').click();
    const detail = page.getByTestId('pi-approval-inbox-selected');
    const requestDetails = detail.getByRole('button', {name: '请求详情', exact: true});
    await requestDetails.click();
    assert.match(await detail.innerText(), /申请版本 1/);
    const exposed = await page.evaluate(async () => {
      const settings = await window.omniEdu.getXiaozhiSettings();
      const secret = 'synthetic-phase7-loopback';
      return {configured: settings.ok && settings.value.configured,
        projectedSecret: JSON.stringify(settings).includes(secret),
        renderedSecret: document.querySelector('[data-testid="pi-approval-inbox"]').textContent.includes(secret)};
    });
    assert.deepEqual(exposed, {configured: true, projectedSecret: false, renderedSecret: false});
    await detail.getByTestId('pi-permission-reject').click();
    const id = fixture.ids.permission.approvals[0].id; await until(async () => approvals().some(item => item.id === id && item.value.state === 'rejected'));
    await page.getByTestId('pi-approval-filter').selectOption('rejected'); await page.getByTestId('pi-approval-inbox-row').filter({hasText: '审批样本'}).first().waitFor();
  });
  await check('U06_legacy_uncertain_verifies_existing_owned_copy_without_replay', async () => {
    await page.getByTestId('pi-approval-filter').selectOption('uncertain');
    const row = page.getByTestId('pi-approval-inbox-row').filter({hasText: '兼容样本'}).first(); await row.getByTestId('pi-approval-inbox-detail').click();
    await page.getByTestId('pi-approval-inbox-selected').getByTestId('pi-copy-verify').click();
    await until(async () => approvals().some(item => item.id === fixture.ids.legacy.uncertainApprovalId && item.value.state === 'verified'));
    assert.equal(fs.readFileSync(path.join(fixture.ids.workspace, 'legacy-uncertain.txt'), 'utf8'), fs.readFileSync(path.join(fixture.ids.workspace, 'source.txt'), 'utf8'));
  });
  await check('U07_capability_center_true_metadata_search_and_original_management_navigation', async () => {
    const before = fixture.requests.length; await page.getByRole('button', {name: '设置', exact: true}).click();
    await page.getByTestId('pi-settings-tab-capabilities').click(); await page.getByTestId('pi-capability-row').first().waitFor();
    assert((await page.getByTestId('pi-capability-context').innerText()).includes('任务'));
    await page.getByTestId('pi-capability-search').fill('合成候选'); await page.getByTestId('pi-capability-search-submit').click();
    await until(async () => await page.getByTestId('pi-capability-row').count() === 2);
    const text = await page.getByTestId('pi-capability-center').innerText(); assert(text.includes('已过期')); assert(text.includes('隔离')); assert(text.includes('需任务核对'));
    assert.equal(fixture.requests.length, before);
    await page.screenshot({path: path.join(fixture.output, 'capability-center.png')});
    await page.getByTestId('pi-capability-manage-skills').click(); await page.getByTestId('pi-skill-governance-select').waitFor();
    const view = await page.evaluate(() => window.omniEdu.getXiaozhiSkillGovernance());
    assert(view.ok && view.value.skills.some(item => item.scope === 'official') && view.value.skills.some(item => item.scope === 'team') && view.value.skills.some(item => item.scope === 'personal'));
  });
  await check('U08_original_idle_terminal_remains_controllable_with_global_navigation', async () => {
    await page.getByTestId('pi-settings-tab-permissions').click(); await page.getByTestId('pi-settings-permission-fullAccess').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="pi-settings-permission-fullAccess"]')?.getAttribute('aria-pressed') === 'true');
    await page.getByTestId('nav-ai').click(); const sessionId = await page.locator('.office-composer-container').getAttribute('data-session-id');
    await page.getByTestId('office-prompt-input').fill('FIXTURE_PTY 请打开合成任务的持久终端，回答结束后让我直接输入。'); await page.getByRole('button', {name: '发送消息', exact: true}).click();
    let jobId;
    await until(async () => {const result = await page.evaluate(id => window.omniEdu.listXiaozhiTerminals(id), sessionId);
      if (!result.ok) return false; const job = result.data.jobs.find(item => item.controls.write && item.controller === 'teacher'); jobId = job?.jobId; return Boolean(job);}, 90000);
    const toggle = page.getByTestId('terminal-jobs-toggle'); if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await page.getByTestId('terminal-select-' + jobId).click(); const console = page.locator(`[data-testid="agent-terminal-output"][data-terminal-id="${jobId}"]`).first();
    const modelCalls = fixture.requests.length; await console.getByTestId('terminal-input').fill("$global:phase7Value++; Write-Output ('PHASE7_VALUE_'+$global:phase7Value)"); await console.getByTestId('terminal-send').click();
    await until(async () => {const read = await page.evaluate(input => window.omniEdu.readXiaozhiTerminal(input), {sessionId, jobId, sinceSequence: 0}); return read.ok && read.data.output.includes('PHASE7_VALUE_41');});
    assert.equal(fixture.requests.length, modelCalls); await console.getByTestId('terminal-close').click();
    await until(async () => {const listed = await page.evaluate(id => window.omniEdu.listXiaozhiTerminals(id), sessionId); return listed.ok && listed.data.jobs.find(item => item.jobId === jobId)?.cleanup === 'complete';});
    assert.equal(fs.existsSync(path.join(fixture.ids.workspace, 'Microsoft', 'Windows', 'PowerShell', 'ModuleAnalysisCache')), false);
  });
  await check('U09_cold_original_summary_and_inbox_decision_readback', async () => {
    const before = await summary({kind: 'tasks', filter: 'all'}); assert(before.ok); report.modelCalls = fixture.requests.length; await fixture.close();
    fixture = await startWorkbenchFixture({root: fixture.root, background: true}); application = fixture.application; page = fixture.page;
    const after = await summary({kind: 'tasks', filter: 'all'}); assert(after.ok); assert.equal(after.value.total, before.value.total); assert.deepEqual(after.value.counts, before.value.counts);
    const saved = await summary({kind: 'approvals', state: 'all'}); assert(saved.ok && saved.value.items.some(item => item.id === fixture.ids.permission.approvals[0].id && item.state === 'rejected'));
    assert(saved.value.items.some(item => item.id === fixture.ids.legacy.uncertainApprovalId && item.state === 'verified'));
    assert.equal(fixture.requests.length, 0);
  });
  assert.deepEqual(report.errors, []); report.success = true;
} catch (error) {report.error = String(error.stack || error); process.exitCode = 1; await page?.screenshot({path: path.join(fixture.output, 'failure.png')}).catch(() => {});}
finally {if (fixture) {await fixture.close().catch(error => {report.closeError = String(error); process.exitCode = 1;}); report.modelCalls = (report.modelCalls || 0) + fixture.requests.length; fs.writeFileSync(path.join(fixture.output, 'ui-report.json'), JSON.stringify(report, null, 2));}
  console.log(JSON.stringify({success: report.success, passed: report.checks.length, root: report.root, error: report.error}));}
