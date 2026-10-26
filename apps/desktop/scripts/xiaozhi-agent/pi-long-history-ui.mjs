import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain, testMain} from '../acceptance/build-root.mjs';
import {fingerprint, sha256} from '../acceptance/evidence.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/xiaozhi-agent/pi-long-history-ui-'));
const dataRoot = path.join(output, 'data');
const profile = path.join(output, 'profile');
const main = testMain(appRoot);
const buildRoot = path.dirname(path.dirname(main));
const build = fingerprint(buildRoot);
const report = {
  schema: 'h09.long-history-ui.v1',
  success: false,
  phase: 'launch',
  build: {root: buildRoot, sha256: build.sha256, files: build.files.length},
  scriptSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  checks: [],
  measurements: {},
  errors: [],
  boundary: 'Actual isolated Electron and production Pi renderer over an owned 1000-run/2000-message SQLite fixture. No model request, tool effect, daily profile, student data, VPN change or installer claim.',
};
let app;
let page;
let sessionId;

const pass = name => {
  report.checks.push({name, pass: true});
  console.log(`PASS ${name}`);
};

async function until(check, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`condition timed out: ${report.phase}`);
}

function env() {
  const result = {
    ...process.env,
    OMNI_EDU_XIAOZHI_PI: '1',
    OMNI_EDU_DATA_ROOT: dataRoot,
    OMNI_EDU_REPO_ROOT: path.resolve(appRoot, '../..'),
    OMNI_EDU_E2E_DIALOG_MODE: '1',
  };
  delete result.ELECTRON_RUN_AS_NODE;
  delete result.NODE_OPTIONS;
  delete result.DEEPSEEK_API_KEY;
  delete result.DEEPSEEK_MODEL;
  delete result.OMNI_EDU_TEST_BUILD_ROOT;
  return result;
}

async function launch(label) {
  report.phase = `launch-${label}`;
  app = await electron.launch({
    args: [main, `--user-data-dir=${profile}`, '--force-device-scale-factor=1'],
    env: env(),
    timeout: 60_000,
  });
  (report.launches ||= []).push(await assertIsolatedPiMain(app, main, profile));
  page = await app.firstWindow();
  page.on('pageerror', error => report.errors.push(String(error).replace(/sk-[A-Za-z0-9_-]+/g, '[credential]')));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60_000});
  await until(() => page.evaluate(() => {
    const input = document.querySelector('[data-testid="office-prompt-input"]');
    return input instanceof HTMLTextAreaElement && !input.disabled;
  }));
  await page.evaluate(() => {
    globalThis.longHistoryEvents = [];
    window.omniEdu.onXiaozhiEvent(event => globalThis.longHistoryEvents.push(event));
  });
}

async function close() {
  await app?.close().catch(() => undefined);
  app = undefined;
  page = undefined;
}

function seed() {
  const database = new DatabaseSync(path.join(dataRoot, 'app.db'));
  const base = Date.parse('2026-01-01T00:00:00.000Z');
  const timestamp = index => new Date(base + index * 1000).toISOString();
  try {
    database.exec('BEGIN IMMEDIATE');
    database.prepare(`UPDATE ai_conversation_sessions
      SET title=?,last_prompt=?,last_response_preview=?,message_count=?,updated_at=? WHERE id=?`)
      .run('H09 一千轮教师会话', '合成第1000轮教师问题', '合成第1000轮小智答复', 2000,
        timestamp(2001), sessionId);
    const run = database.prepare(`INSERT INTO ai_agent_runs(
      id,parent_run_id,session_id,prompt,route,sub_intent,status,model,student_id,error_message,created_at,completed_at,updated_at
    ) VALUES(?,'',?,?,?,?,?,?, '', '', ?,?,?)`);
    const message = database.prepare(`INSERT INTO ai_conversation_messages(
      id,session_id,role,content,metadata_json,created_at
    ) VALUES(?,?,?,?,?,?)`);
    for (let index = 1; index <= 1000; index += 1) {
      const padded = String(index).padStart(4, '0');
      const runId = `xirun_history_${padded}`;
      const createdAt = timestamp((index - 1) * 2 + 1);
      const completedAt = timestamp((index - 1) * 2 + 2);
      run.run(runId, sessionId, `合成第${index}轮教师问题`, 'education', 'pi_education',
        'completed', 'deepseek-flash', createdAt, completedAt, completedAt);
      message.run(`aimsg_history_user_${padded}`, sessionId, 'user',
        `合成第${index}轮教师问题：请整理五年级分数课备课资料。`,
        JSON.stringify({agentRunId: runId, piVersion: 'xiaozhi.pi.education.v1'}), createdAt);
      message.run(`aimsg_history_assistant_${padded}`, sessionId, 'assistant',
        `合成第${index}轮小智答复：已整理为教师可修改的备课草稿。`,
        JSON.stringify({
          agentRunId: runId,
          piVersion: 'xiaozhi.pi.education.v1',
          ok: true,
          status: 'completed',
          publicItems: [{
            id: `${runId}:assistant`,
            kind: 'message',
            role: 'assistant',
            phase: 'final_answer',
            text: `合成第${index}轮小智答复：已整理为教师可修改的备课草稿。`,
          }],
        }), completedAt);
    }
    database.exec('COMMIT');
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch {}
    throw error;
  } finally {
    database.close();
  }
}

async function snapshot() {
  return page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
}

async function openHistory() {
  if (await page.locator('.office-composer-container').getAttribute('data-session-id') === sessionId) return;
  const item = page.getByTestId(`ai-conversation-session-${sessionId}`);
  if (await item.count()) {
    await item.click();
  } else {
    await page.evaluate(id => localStorage.setItem('xiaozhi.current-session.v1', id), sessionId);
    await page.reload();
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60_000});
  }
  await until(async () => await page.locator('.office-composer-container').getAttribute('data-session-id') === sessionId);
  await until(async () => !(await snapshot()).projection.needsHydration);
}

try {
  await launch('seed');
  sessionId = await page.locator('.office-composer-container').getAttribute('data-session-id');
  assert.match(sessionId || '', /^aisession_[a-f0-9-]{36}$/i);
  await close();

  report.phase = 'seed-1000-runs';
  const seedStarted = performance.now();
  seed();
  report.measurements.seedMs = performance.now() - seedStarted;

  await launch('history');
  await openHistory();
  report.phase = 'initial-page';
  const initialStarted = performance.now();
  const initial = await snapshot();
  report.measurements.initialSnapshotMs = performance.now() - initialStarted;
  report.measurements.initialTurns = initial.projection.turns.length;
  report.measurements.initialHasMoreHistory = initial.projection.hasMoreHistory;
  await page.getByTestId('office-conversation').waitFor({state: 'visible'});
  await page.getByText('合成第1000轮小智答复', {exact: false}).last().waitFor({timeout: 60_000});
  assert(initial.projection.turns.length <= 40, `initial snapshot loaded ${initial.projection.turns.length} turns`);
  assert.equal(initial.projection.hasMoreHistory, true);
  const loadButton = page.getByRole('button', {name: '加载较早的消息', exact: true});
  await loadButton.waitFor({state: 'visible'});
  assert.equal(await loadButton.isDisabled(), false);
  assert.equal(await loadButton.getAttribute('aria-label'), '加载较早的消息');
  pass('Initial page is bounded, marks earlier history and exposes an enabled load control');

  const conversation = page.getByTestId('office-conversation');
  await conversation.evaluate(node => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event('scroll', {bubbles: true}));
  });
  await page.waitForTimeout(150);
  const oldestInitialTurn = initial.projection.turns[0];
  const beforeScroll = await conversation.evaluate(node => ({top: node.scrollTop, height: node.scrollHeight, client: node.clientHeight}));
  const beforeTop = await page.locator(`[data-turn-id="${oldestInitialTurn.id}"]`).evaluate(node => node.getBoundingClientRect().top);
  await loadButton.focus();
  await page.keyboard.press('Enter');
  report.phase = 'load-earlier';
  await until(() => page.locator('.office-turn').count().then(count => count > initial.projection.turns.length), 60_000);
  const loadedTurnCount = await page.locator('.office-turn').count();
  report.measurements.loadedTurns = loadedTurnCount;
  const afterScroll = await conversation.evaluate(node => ({top: node.scrollTop, height: node.scrollHeight, client: node.clientHeight}));
  const afterTop = await page.locator(`[data-turn-id="${oldestInitialTurn.id}"]`).evaluate(node => node.getBoundingClientRect().top);
  report.measurements.scrollAnchor = {beforeScroll, afterScroll, beforeTop, afterTop};
  report.measurements.readingAnchorDeltaPx = Math.abs(afterTop - beforeTop);
  const renderedTurnIds = await page.locator('.office-turn').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-turn-id')));
  assert(loadedTurnCount <= 80);
  assert.equal(new Set(renderedTurnIds).size, loadedTurnCount);
  assert(Math.abs(afterTop - beforeTop) <= 24, `reading anchor moved ${afterTop - beforeTop}px`);
  pass('Earlier page loads incrementally without duplicates and preserves the reading anchor');

  for (let pageIndex = 0; pageIndex < 30; pageIndex += 1) {
    const button = page.getByRole('button', {name: '加载较早的消息', exact: true});
    if (await button.count() === 0) break;
    await until(async () => await button.count() > 0 && !(await button.isDisabled()), 30_000);
    const beforeCount = await page.locator('.office-turn').count();
    await button.click();
    await until(() => page.locator('.office-turn').count().then(count => count > beforeCount), 60_000);
  }
  const continuedTurns = await page.locator('.office-turn').count();
  report.measurements.continuedTurns = continuedTurns;
  assert.equal(continuedTurns, 1000);
  assert.equal(await page.getByRole('button', {name: '加载较早的消息', exact: true}).count(), 0);
  assert.equal(await page.locator('[data-turn-id="xirun_history_0001"]').count(), 1);
  pass('Load earlier remains reachable through all 25 pages until the earliest turn and then disappears');

  report.phase = 'switch-conversation';
  await page.getByTestId('ai-conversation-new').click();
  await until(async () => await page.locator('.office-composer-container').getAttribute('data-session-id') !== sessionId);
  await openHistory();
  const switched = await snapshot();
  const switchedTurns = await page.locator('.office-turn').count();
  report.measurements.switchedTurns = switchedTurns;
  assert(switchedTurns <= 40);
  assert.equal(switched.projection.hasMoreHistory, true);
  assert.equal(switched.projection.turns.some(turn => turn.id === 'xirun_history_0001'), false);
  pass('Switching away and back starts from the bounded latest page with no foreign turns');

  const forged = await page.evaluate(async id => {
    try {
      await window.omniEdu.getXiaozhiHistoryPage({sessionId: id, before: 'xirun_missing'});
      return 'resolved';
    } catch (error) {
      return String(error?.message || error);
    }
  }, sessionId);
  assert.match(forged, /invalid_input/);
  pass('A forged or cross-session history cursor is rejected without returning transcript data');

  report.phase = 'responsive-load-control';
  for (const size of [{width: 390, height: 844}, {width: 1366, height: 768}, {width: 1920, height: 1080}]) {
    await app.evaluate(({BrowserWindow}, viewport) => BrowserWindow.getAllWindows()[0].setContentSize(viewport.width, viewport.height), size);
    await until(() => page.evaluate(viewport => innerWidth === viewport.width && innerHeight === viewport.height, size));
    const button = page.getByRole('button', {name: '加载较早的消息', exact: true});
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height);
    await page.screenshot({path: path.join(output, `history-load-${size.width}x${size.height}.png`), animations: 'disabled'});
  }
  pass('The load-older control is reachable at 390x844, 1366x768 and 1920x1080');

  await close();
  await launch('cold');
  await openHistory();
  const cold = await snapshot();
  const coldTurns = await page.locator('.office-turn').count();
  report.measurements.coldTurns = coldTurns;
  assert(coldTurns <= 40);
  assert.equal(cold.projection.hasMoreHistory, true);
  assert.equal(cold.projection.turns.at(-1).status, 'completed');
  assert.equal(report.errors.length, 0);
  const coldEvents = await page.evaluate(() => globalThis.longHistoryEvents);
  assert.equal(coldEvents.filter(event => event.kind === 'tool_start' || event.kind === 'text_delta').length, 0);
  const database = new DatabaseSync(path.join(dataRoot, 'app.db'), {readOnly: true});
  try {
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM ai_conversation_messages WHERE session_id=?').get(sessionId).count, 2000);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM ai_agent_runs WHERE session_id=?').get(sessionId).count, 1000);
  } finally {
    database.close();
  }
  pass('Cold restart restores the latest page, preserves all 1000 runs and creates no renderer error');

  await page.screenshot({path: path.join(output, 'cold-long-history.png'), fullPage: false});
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error).replace(/sk-[A-Za-z0-9_-]+/g, '[credential]').slice(0, 5000);
  if (page) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => undefined);
} finally {
  await close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    success: report.success,
    report: path.relative(appRoot, path.join(output, 'report.json')),
    build: report.build,
    measurements: report.measurements,
    error: report.error,
  }));
}

if (!report.success) process.exitCode = 1;
