import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

let fixture;
const report = {success: false, paidCalls: 0, checks: [], pageErrors: [],
  scope: 'Actual Electron workbench against owned synthetic SQLite. UI stop is a real interaction. Cold open and read-only navigation never dispatch a model request or change recovered Task facts.'};
const labels = {active: '执行中', review_required: '待你核对', paused: '需要重新核对',
  interrupted: '本轮未完成', completed: '你已确认', ended: '已结束'};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = name => report.checks.push({name, status: 'PASS'});

function readOriginalFacts(root) {
  const db = new DatabaseSync(path.join(root, 'data', 'app.db'), {readOnly: true});
  try {
    const taskRows = db.prepare(`SELECT key,value_json FROM app_settings
      WHERE key GLOB 'xiaozhi.task.v1:xitask_*'
        AND key = 'xiaozhi.task.v1:' || json_extract(value_json,'$.view.id')
      ORDER BY key`).all();
    return {
      tasks: taskRows.map(row => JSON.parse(row.value_json).view),
      taskHash: hash(JSON.stringify(taskRows)),
      titles: Object.fromEntries(db.prepare('SELECT id,title FROM ai_conversation_sessions WHERE archived_at IS NULL').all().map(row => [row.id,row.title])),
      runs: db.prepare('SELECT id,session_id,status FROM ai_agent_runs ORDER BY id').all(),
      effects: db.prepare('SELECT effect_id,state FROM xiaozhi_effects_v1 ORDER BY effect_id').all(),
      approvals: db.prepare('SELECT id,session_id,status FROM ai_confirmation_items ORDER BY id').all(),
    };
  } finally {
    db.close();
  }
}

async function openWorkbench(page) {
  await page.getByTestId('pi-workbench-open').click();
  await page.getByTestId('pi-task-filter').waitFor();
}

async function waitForPersistedStop(root, sessionId) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const facts = readOriginalFacts(root);
    if (facts.tasks.some(task => task.sessionId === sessionId && task.state === 'interrupted') &&
        facts.runs.some(run => run.session_id === sessionId && run.status !== 'running')) return facts;
    await delay(100);
  }
  throw Error('The interrupted Task and terminal Run did not settle in SQLite.');
}

async function matchRows(page, facts, filter, expected) {
  await page.getByTestId('pi-task-filter').selectOption(filter);
  const ids = expected.map(task => task.id).sort();
  const counts = page.getByTestId('pi-task-counts');
  const completed = facts.tasks.filter(task => task.state === 'completed').length;
  const ended = facts.tasks.filter(task => task.state === 'ended').length;
  const countLine = '任务总数 ' + facts.tasks.length + ' · 当前筛选 ' + ids.length +
    ' · 已确认 ' + completed + ' · 已结束 ' + ended;
  await counts.filter({hasText: countLine}).waitFor();
  const rows = page.getByTestId('pi-task-overview-row');
  assert.deepEqual(await rows.evaluateAll(items => items.map(row => row.dataset.taskId).sort()), ids);
  assert.equal(await page.getByTestId('pi-task-partial').count(), 0);
  for (const task of expected) {
    const row = page.locator('[data-testid="pi-task-overview-row"][data-task-id="' + task.id + '"]');
    assert.equal(await row.locator('h3').innerText(), facts.titles[task.sessionId]);
    assert.equal(await row.locator('p').first().innerText(), labels[task.state]);
    if (task.state === 'completed') {
      assert.equal(await row.getByTestId('pi-task-overview-resume').count(), 0);
      assert.equal(await row.getByTestId('pi-task-overview-continue').count(), 0);
    }
  }
}

async function checkOverview(page, facts, pending) {
  const unfinished = facts.tasks.filter(task => !['completed', 'ended'].includes(task.state));
  await openWorkbench(page);
  await matchRows(page, facts, 'unfinished', unfinished);
  const pendingRow = page.locator('[data-testid="pi-task-overview-row"][data-task-id="' + pending + '"]');
  const pendingCount = facts.approvals.filter(approval =>
    approval.session_id === facts.tasks.find(task => task.id === pending)?.sessionId && approval.status === 'pending').length;
  assert(pendingCount > 0);
  assert((await pendingRow.innerText()).includes('待审批 ' + pendingCount));
  assert((await pendingRow.innerText()).includes('有待处理审批'));
  await matchRows(page, facts, 'completed', facts.tasks.filter(task => task.state === 'completed'));
  await matchRows(page, facts, 'all', facts.tasks);
}

try {
  fixture = await startWorkbenchFixture({background: true});
  const {page, root, main} = fixture;
  report.root = root;
  report.mainSha256 = hash(fs.readFileSync(main));
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await assertIsolatedPiMain(fixture.application, main, path.join(root, 'profile'));

  // Add an interruption through the actual composer and stop control.
  const sessionsBefore = Object.keys(readOriginalFacts(root).titles);
  await page.getByTestId('pi-new-session').click();
  const composer = page.locator('.office-composer-container');
  await page.waitForFunction(ids => {
    const session = document.querySelector('.office-composer-container')?.getAttribute('data-session-id');
    return Boolean(session && !ids.includes(session));
  }, sessionsBefore);
  const sessionId = await composer.getAttribute('data-session-id');
  fs.writeFileSync(path.join(root, 'stream-delay-ms.txt'), '600');
  await page.getByTestId('office-prompt-input').fill('合成课堂知识核对，请在输出过程中由教师停止。');
  await page.getByRole('button', {name:'发送消息', exact:true}).click();
  await page.getByRole('button', {name:'停止本轮', exact:true}).click();
  await page.waitForFunction(async id => {
    const snapshot = await window.omniEdu.getXiaozhiSnapshot(id);
    return !snapshot.running && snapshot.projection.turns.at(-1)?.status === 'interrupted';
  }, sessionId);
  const original = await waitForPersistedStop(root, sessionId);
  const interrupted = original.tasks.find(task => task.sessionId === sessionId);
  assert.equal(interrupted?.state, 'interrupted');
  assert(original.runs.some(run => run.session_id === sessionId && run.status !== 'running'));
  check('Actual UI stop persists an interrupted Task and its terminal Run');

  await checkOverview(page, original, fixture.ids.permission.task.id);
  check('Visible rows, reasons, counts, and completed exclusion agree with the original SQLite facts');
  for (const size of [{width:1366,height:768}, {width:1920,height:1080}]) {
    await fixture.application.evaluate(({BrowserWindow}, bounds) =>
      BrowserWindow.getAllWindows()[0].setContentSize(bounds.width,bounds.height), size);
    await page.setViewportSize(size);
    await page.getByTestId('pi-task-filter').scrollIntoViewIfNeeded();
    assert(await page.getByTestId('pi-task-filter').evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight &&
        element === document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    }));
    await page.screenshot({path:path.join(fixture.output,'cold-overview-' + size.width + '.png')});
  }
  check('Task filter is reachable at both required viewport sizes');
  const beforeClose = readOriginalFacts(root);
  assert.deepEqual(beforeClose, original);
  report.syntheticBeforeCold = fixture.requests.length;
  await fixture.close();
  fixture = undefined;
  fixture = await startWorkbenchFixture({root, background:true});
  fixture.page.on('pageerror', error => report.pageErrors.push(error.message));
  await checkOverview(fixture.page, original, fixture.ids.permission.task.id);
  const cold = readOriginalFacts(root);
  assert.deepEqual(cold, original);
  assert.equal(fixture.requests.length, 0);
  assert.deepEqual(report.pageErrors, []);
  report.coldFacts = {taskHash: cold.taskHash, states: cold.tasks.map(({id,state}) => ({id,state})),
    runs: cold.runs.length, effects: cold.effects.length, approvals: cold.approvals.length, modelRequests: fixture.requests.length};
  check('Cold open and overview filters preserve Task, Run, Effect, and approval facts with zero replay');
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
  await fixture?.page.screenshot({path:path.join(fixture.output,'cold-overview-fail.png')}).catch(() => {});
} finally {
  if (fixture) {
    await fixture.close().catch(error => {report.closeError = String(error); report.success = false;});
    fs.writeFileSync(path.join(fixture.output,'cold-overview-report.json'), JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify(report));
  if (!report.success) process.exitCode = 1;
}
