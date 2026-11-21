import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';
import {confirmSyntheticArtifact} from './phase8-correction-artifacts.mjs';

const report = {success: false, paidCalls: 0, checks: [], errors: []};
const practiceDraft = process.argv[2] === '--practice-draft';
const filename = practiceDraft ? 'practice.txt' : 'approval-wait.txt';
const contents = practiceDraft ? '合成练习：3/4 + 1/4 = 1' : '合成课堂记录，核对一次权限批准和原文件保存。';
let fixture;
let root;

function facts(sessionId) {
  const db = new DatabaseSync(path.join(root, 'data', 'app.db'), {readOnly: true});
  try {
    return {
      runs: db.prepare('SELECT id, status FROM ai_agent_runs WHERE session_id = ?').all(sessionId).map(row => ({...row})),
      approvals: db.prepare('SELECT id, status, payload_json FROM ai_confirmation_items WHERE session_id = ?').all(sessionId)
        .map(row => ({...row})),
    };
  } finally {
    db.close();
  }
}

async function until(predicate, message) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = predicate();
    if (result) return result;
    await fixture.page.waitForTimeout(40);
  }
  throw Error(message);
}

try {
  const options = {background: true, onPageError: error => report.errors.push(error.message)};
  fixture = await startWorkbenchFixture(options);
  root = fixture.root;
  report.root = root;
  const {page, application} = fixture;
  const workspace = path.join(root, 'approval-effect');
  fs.mkdirSync(workspace);
  const target = path.join(workspace, filename);
  const composer = page.locator('.office-composer-container');
  const previous = await composer.getAttribute('data-session-id');
  await page.getByTestId('pi-new-session').click();
  await page.waitForFunction(prior => {
    const current = document.querySelector('.office-composer-container')?.getAttribute('data-session-id');
    return current && current !== prior;
  }, previous);
  const sessionId = await composer.getAttribute('data-session-id');
  assert(sessionId);
  await application.evaluate(({dialog}, selected) => {
    globalThis.originalApprovalFixturePicker = dialog.showOpenDialog;
    dialog.showOpenDialog = async () => ({canceled: false, filePaths: [selected]});
  }, workspace);
  try {
    await page.getByTestId('pi-permission-picker').click();
    await page.getByRole('menuitem', {name: '选择教学工作目录', exact: true}).click();
    await page.waitForFunction(async id => Boolean((await window.omniEdu.getXiaozhiSnapshot(id)).workspace), sessionId);
  } finally {
    await application.evaluate(({dialog}) => {
      dialog.showOpenDialog = globalThis.originalApprovalFixturePicker;
      delete globalThis.originalApprovalFixturePicker;
    });
  }

  fixture.scenario([
    {name: 'update_task_plan', input: {schemaVersion: 'xiaozhi.task-plan.v3', expectedRevision: 0,
      requirementsVersion: 1, reason: '合成课堂记录需要核对并确认保存', steps: [
        {id: 'record', text: '准备合成课堂记录', dependsOn: [], reported: 'pending', kind: 'saved_text', target: filename},
        {id: 'review', text: '教师核对记录', dependsOn: [], reported: 'pending', kind: 'human'},
      ]}},
    {name: 'office_create_text', input: {path: filename, content: contents, taskStepId: 'record'}},
  ]);
  await page.getByTestId('office-prompt-input').fill(`请用当前工作目录把合成教学记录保存为 ${filename}。`);
  await page.getByRole('button', {name: '发送消息', exact: true}).click();
  const privilege = page.locator('[data-testid="pi-permission-approval"][data-state="pending"]');
  await privilege.waitFor({timeout: 20_000});
  const pending = facts(sessionId);
  assert.equal(pending.runs.length, 1);
  const [run] = pending.runs;
  assert.equal(run.status, 'running');
  const approvalId = await privilege.getAttribute('data-approval-id');
  assert(pending.approvals.some(approval => approval.id === approvalId && approval.status === 'pending'));
  const modelRequestsWhileWaiting = fixture.requests.length;
  await page.waitForTimeout(400);
  assert.deepEqual(facts(sessionId).runs, [run]);
  assert.equal(fixture.requests.length, modelRequestsWhileWaiting);
  assert(!fs.existsSync(target));
  report.checks.push('Active permission wait does not settle the Run, dispatch the write, or invoke the model again');

  await privilege.getByTestId('pi-permission-approve').click();
  const draft = page.locator('[data-testid="pi-text-change"][data-state="pending"]').filter({hasText: filename});
  await draft.waitFor({timeout: 20_000});
  assert.deepEqual(facts(sessionId).runs, [run]);
  assert.equal(fixture.requests.length, modelRequestsWhileWaiting);
  assert(!fs.existsSync(target));
  const consumed = facts(sessionId).approvals.find(approval => approval.id === approvalId);
  assert(consumed);
  const consumption = JSON.parse(consumed.payload_json);
  assert.equal(consumption.state, 'executing');
  assert.equal(consumption.admittedOwner.runId, run.id);
  report.checks.push('The exact approval enters executing for the same Run before the second, content-review decision');

  if (practiceDraft) {
    const decisions = [];
    await page.getByTestId('pi-text-diff').waitFor();
    await confirmSyntheticArtifact(page, 'Q7', workspace, decisions, sessionId);
    assert.equal(decisions.length, 1);
    assert.deepEqual(decisions[0].files, [filename]);
    report.draftConfirmations = decisions;
  } else {
    await draft.getByTestId('pi-text-approve').click();
  }
  await until(() => facts(sessionId).runs[0]?.status === 'succeeded', 'The original Run did not finish after saving');
  await page.waitForFunction(async ({sessionId: session, runId}) => {
    const snapshot = await window.omniEdu.getXiaozhiSnapshot(session);
    return snapshot.running === false && snapshot.projection.turns.some(turn => turn.id === runId && turn.status === 'completed');
  }, {sessionId, runId: run.id}, {timeout: 20_000});
  assert.equal(fs.readFileSync(target, 'utf8'), contents);
  const completed = facts(sessionId);
  assert.deepEqual(completed.runs, [{id: run.id, status: 'succeeded'}]);
  const finalApproval = completed.approvals.find(approval => approval.id === approvalId);
  assert(finalApproval);
  assert.equal(JSON.parse(finalApproval.payload_json).state, 'executed');
  report.checks.push('Teacher-approved draft saves exact bytes, leaving one durable Run and a consumed approval');

  await fixture.close();
  fixture = null;
  fixture = await startWorkbenchFixture({...options, root});
  assert.deepEqual(facts(sessionId), completed);
  assert.equal(fs.readFileSync(target, 'utf8'), contents);
  assert.equal(fixture.requests.length, 0);
  assert.deepEqual(report.errors, []);
  report.checks.push('Cold Electron readback retains the original approval and file without model replay');
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
  process.exitCode = 1;
} finally {
  await fixture?.close().catch(error => {
    report.error = String(error);
    report.success = false;
    process.exitCode = 1;
  });
  if (root) fs.writeFileSync(path.join(root, 'evidence', 'permission-active-run-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
