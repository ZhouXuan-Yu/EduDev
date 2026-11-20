import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';
import {fingerprint, sha256} from './phase8-real-model-plan.mjs';

const size = process.argv[2] || '1366x768';
assert(['1366x768', '1920x1080'].includes(size));
const [width, height] = size.split('x').map(Number);
const report = {success: false, size, checks: [], pageErrors: [], paidCalls: 0};
const options = {background: true, onPageError: error => report.pageErrors.push(error.message)};
let fixture;
let page;
let root;
let facts;

async function until(read, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (value) return value;
    await page.waitForTimeout(100);
  }
  throw Error('legacy_copy_readback_timeout');
}

try {
  fixture = await startWorkbenchFixture(options);
  ({root, page} = fixture);
  const {sessionId, runId: originalRunId, pendingApprovalId: approvalId, task} = fixture.ids.legacy;
  const buildRoot = path.dirname(path.dirname(fixture.main));
  report.build = {main: fixture.main, mainSha256: sha256(fs.readFileSync(fixture.main)), sha256: fingerprint(buildRoot).sha256};
  await fixture.application.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), {width, height});
  const source = path.join(fixture.ids.workspace, 'source.txt');
  const target = path.join(fixture.ids.workspace, 'legacy-pending.txt');
  const sourceSha256 = sha256(fs.readFileSync(source));
  assert(!fs.existsSync(target));
  facts = () => {
    const db = new DatabaseSync(path.join(root, 'data', 'app.db'), {readOnly: true});
    try {
      const approval = db.prepare('SELECT payload_json FROM ai_confirmation_items WHERE id=? AND session_id=?').get(approvalId, sessionId);
      const runs = db.prepare('SELECT id, status, error_message FROM ai_agent_runs WHERE session_id=? ORDER BY id').all(sessionId);
      const documents = db.prepare(`SELECT value_json FROM app_settings WHERE key='xiaozhi.task.v1:' || json_extract(value_json, '$.view.id')
        AND json_extract(value_json, '$.view.sessionId')=? ORDER BY key`).all(sessionId);
      const tasks = documents.map(row => JSON.parse(row.value_json)).map(({view, lineage}) => ({id: view.id, lineage}));
      const permissionRows = db.prepare("SELECT payload_json FROM ai_confirmation_items WHERE session_id=? AND action_type='xiaozhi_permission_v2' ORDER BY id").all(sessionId);
      const permissions = permissionRows.map(row => JSON.parse(row.payload_json)).map(({state, request, requestDigest}) => ({
        state, providerId: request.provider?.id, runId: request.owner.runId, taskId: request.owner.taskId, requestDigest,
      }));
      return {approval: JSON.parse(approval.payload_json).state, runs, tasks, permissions};
    } finally {db.close();}
  };
  async function selectLegacy(state) {
    const panel = page.getByTestId('pi-workbench');
    if (!await panel.isVisible()) await page.getByTestId('pi-workbench-open').click();
    await panel.getByTestId('pi-workbench-approvals').click();
    await page.getByTestId('pi-approval-filter').selectOption(state);
    // The original card and the tool's execution receipt can share all visible
    // text. Match the stable ID in the same typed page before clicking its row.
    const listing = await page.evaluate(state => window.omniEdu.getXiaozhiWorkbenchSummary({
      schemaVersion: 1, kind: 'approvals', state, limit: 20,
    }), state);
    assert(listing.ok && listing.value.kind === 'approvals');
    const {items} = listing.value;
    const index = items.findIndex(item => item.id === approvalId && item.kind === 'legacy_copy' && item.state === state);
    assert(index >= 0, 'The exact original legacy approval is present in this page');
    const visibleRows = page.getByTestId('pi-approval-inbox-row');
    await visibleRows.nth(index).filter({hasText: 'legacy-pending.txt'}).waitFor();
    assert.equal(await visibleRows.count(), items.length);
    await visibleRows.nth(index).getByTestId('pi-approval-inbox-detail').click();
    return page.getByTestId('pi-approval-inbox-selected');
  }
  const before = facts();
  const pending = await selectLegacy('pending');
  assert.equal(await pending.getByTestId('pi-copy-approval').getAttribute('data-approval-id'), approvalId);
  await pending.getByTestId('pi-copy-approve').click();
  await until(() => facts().approval === 'approved');
  assert.deepEqual(facts().runs, before.runs);
  assert(!fs.existsSync(target));
  report.checks.push('Approved the exact legacy request in the inbox without starting a run or writing the target');

  fixture.scenario([
    {name: 'update_task_plan', input: {schemaVersion: 'xiaozhi.task-plan.v3', expectedRevision: 0, requirementsVersion: 1,
      reason: '继续教师明确批准的这次文件复制', steps: [
        {id: 'copy', text: '复制来源到批准的目标', dependsOn: [], reported: 'in_progress', kind: 'saved_text', target: 'legacy-pending.txt'},
        {id: 'review', text: '教师核对', dependsOn: ['copy'], reported: 'pending', kind: 'human'},
      ]}},
    {name: 'office_copy_file', input: {source: 'source.txt', target: 'legacy-pending.txt', taskStepId: 'copy'}},
  ]);
  const approved = await selectLegacy('approved');
  await approved.getByTestId('pi-approval-legacy-resume').click();
  const resumed = await until(() => {
    const snapshot = facts();
    const created = snapshot.runs.filter(run => !before.runs.some(previous => previous.id === run.id));
    assert(created.length <= 1);
    return created.length && created[0].status !== 'running' ? {snapshot, run: created[0]} : null;
  });
  report.resumed = resumed;
  assert.equal(resumed.run.status, 'succeeded');
  assert.equal(resumed.snapshot.approval, 'executed');
  assert.notEqual(resumed.run.id, originalRunId);
  assert.deepEqual(resumed.snapshot.tasks.map(item => item.id), [task.id]);
  const {lineage} = resumed.snapshot.tasks[0];
  assert.deepEqual(lineage.map(item => item.runId), [originalRunId, resumed.run.id]);
  assert.equal(lineage[1].generation, lineage[0].generation + 1);
  const usedPermissions = resumed.snapshot.permissions.filter(item => item.runId === resumed.run.id);
  assert.equal(usedPermissions.length, 1);
  assert.equal(usedPermissions[0].state, 'executed');
  assert.equal(usedPermissions[0].providerId, 'edu.native.tool.office_copy_file');
  assert.equal(usedPermissions[0].taskId, task.id);
  assert.equal(sha256(fs.readFileSync(target)), sourceSha256);
  assert.equal(sha256(fs.readFileSync(source)), sourceSha256);
  report.checks.push('Explicit resume made one new generation of the original task and copied the exact approved source');
  await page.screenshot({path: path.join(fixture.output, 'legacy-resumed.png')});

  await fixture.close();
  fixture = await startWorkbenchFixture({...options, root});
  page = fixture.page;
  const cold = await selectLegacy('executed');
  assert.match(await cold.innerText(), /已执行|已复制/u);
  assert.equal(await cold.getByTestId('pi-approval-legacy-resume').count(), 0);
  assert.deepEqual(facts(), resumed.snapshot);
  assert.equal(sha256(fs.readFileSync(target)), sourceSha256);
  assert.equal(fixture.requests.length, 0);
  assert.equal(fingerprint(buildRoot).sha256, report.build.sha256);
  assert.deepEqual(report.pageErrors, []);
  report.checks.push('Cold inbox reads the executed record without replay or another resume action');
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
  if (root && page) await page.screenshot({path: path.join(root, 'evidence', 'legacy-failure.png')}).catch(() => {});
  if (facts) {
    try {report.lastFacts = facts();} catch (readError) {report.readbackError = String(readError);}
  }
} finally {
  if (fixture) await fixture.close().catch(error => {report.closeError = String(error); report.success = false;});
  if (root) fs.writeFileSync(path.join(root, 'evidence', 'legacy-copy-resume-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({root, success: report.success, checks: report.checks.length, error: report.error}));
  if (!report.success) process.exitCode = 1;
}
