import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-edu-xiaozhi-phase7-workbench-ui-'));
const report = {success: false, root, paidCalls: 0, checks: [], pageErrors: []};
let fixture;

function readFacts() {
  const db = new DatabaseSync(path.join(root, 'data/app.db'), {readOnly: true});
  try {
    return {
      approvals: db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all(),
      runs: db.prepare('SELECT id,status FROM ai_agent_runs ORDER BY id').all(),
    };
  } finally {
    db.close();
  }
}

function insertUnreadableApproval({sessionId, runId}) {
  const db = new DatabaseSync(path.join(root, 'data/app.db'));
  try {
    const id = 'confirm_' + randomUUID();
    const result = db.prepare(`INSERT INTO ai_confirmation_items
      (id,run_id,session_id,action_type,status,title,description,preview_md,payload_json,created_at,updated_at)
      SELECT ?,run_id,session_id,action_type,'failed','Unreadable synthetic approval','','','{}',created_at,updated_at
      FROM ai_confirmation_items WHERE session_id=? AND run_id=? AND action_type='xiaozhi_permission_v2' LIMIT 1`)
      .run(id, sessionId, runId);
    assert.equal(result.changes, 1);
    return id;
  } finally {
    db.close();
  }
}

try {
  fixture = await startWorkbenchFixture({root, background: true});
  const {main, ids: {permission}} = fixture;
  report.mainSha256 = createHash('sha256').update(fs.readFileSync(main)).digest('hex');
  const original = readFacts().approvals.find(row =>
    row.session_id === permission.sessionId && row.action_type === 'xiaozhi_permission_v2' && row.status === 'pending');
  assert(original, 'The real host must seed a pending permission request');
  await fixture.close();
  fixture = undefined;

  const badId = insertUnreadableApproval(permission);
  const expected = readFacts();
  assert(expected.approvals.some(row => row.id === badId && row.payload_json === '{}'));
  const startedAt = Date.now();
  fixture = await startWorkbenchFixture({root, background: true});
  report.coldOpenMs = Date.now() - startedAt;
  const {page} = fixture;
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await assertIsolatedPiMain(fixture.application, main, path.join(root, 'profile'));
  assert.equal(path.resolve(await page.evaluate(() => window.omniEdu.getDataRoot())), path.join(root, 'data'));
  await page.getByTestId('pi-workbench-open').click();
  await page.getByTestId('pi-workbench-approvals').click();
  const row = page.getByTestId('pi-approval-inbox-row').filter({hasText: original.title});
  for (const size of [{width:1366,height:768}, {width:1920,height:1080}]) {
    await page.setViewportSize(size);
    await page.getByTestId('pi-approval-inbox-refresh').click();
    await page.getByTestId('pi-approval-counts').filter({hasText: '未完整核对'}).waitFor();
    await page.getByRole('status').filter({hasText: /不可读 1.*approvals: corrupt/}).waitFor();
    await row.getByTestId('pi-approval-inbox-detail').click();
    await page.getByTestId('pi-approval-inbox-selected').waitFor();
    await page.screenshot({path: path.join(fixture.output, 'cold-approval-' + size.width + '.png')});
    report.checks.push({viewport: size, unavailable: 1, validApprovalDetail: true});
  }
  await row.getByTestId('pi-approval-open-session').click();
  const warning = page.getByTestId('pi-approval-records-incomplete');
  await warning.getByRole('button', {name: '重新读取会话', exact: true}).click();
  await warning.waitFor();
  const snapshot = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), permission.sessionId);
  assert(snapshot.projection.turns.some(turn => turn.id === permission.runId));
  assert(snapshot.approvals.some(approval => approval.id === original.id));
  assert(!snapshot.approvals.some(approval => approval.id === badId));
  assert.deepEqual(readFacts(), expected);
  assert.equal(fixture.requests.length, 0);
  assert.deepEqual(report.pageErrors, []);
  report.checks.push({affectedConversation: true, rowsPreserved: expected.approvals.length, replayedModelRequests: 0});
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
} finally {
  if (fixture) await fixture.close().catch(error => {report.closeError = String(error); report.success = false;});
  fs.writeFileSync(path.join(root, 'cold-approval-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (!report.success) process.exitCode = 1;
}
