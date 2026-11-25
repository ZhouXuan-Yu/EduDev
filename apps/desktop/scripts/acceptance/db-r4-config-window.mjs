import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { assertIsolatedPiMain, testMain } from './build-root.mjs';
import { withSql } from './db-foundation-r1-task-fixture.mjs';

const desktop = resolve(import.meta.dirname, '../..');
const main = testMain(desktop);
const output = resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT || join(desktop, 'test-results', 'xiaozhi-db-r4'));
mkdirSync(output, { recursive: true });
const root = mkdtempSync(join(output, 'windows-'));
const data = join(root, 'data');
const profile = join(root, 'profile');
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = { success: false, root, sourceMain: main, mainSha256: sha256(main), runnerSha256: sha256(import.meta.filename), checks: [] };
const mutation = process.env.OMNI_EDU_R4_MUTATION === '1';
const recovery = process.env.OMNI_EDU_R4_RECOVERY === '1';
const visibleJourney = process.env.OMNI_EDU_R4_VISIBLE_JOURNEY === '1';
const manualProbe = process.argv.includes('--manual-probe');
const manual = process.argv.includes('--manual') || manualProbe;
const modelA = 'deepseek-flash', modelB = 'deepseek-v4-pro', modelC = 'deepseek-r4-fixture';
const env = {
  ...process.env, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_E2E_VISIBLE: '1',
  OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: resolve(desktop, '../..'),
  DEEPSEEK_API_KEY: 'r4-synthetic-directory-only', GLM_API_KEY: '', OPENAI_API_KEY: '', DEEPSEEK_MODEL: 'deepseek-flash',
};
for (const name of ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL']) delete env[name];

async function until(check, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await wait(50);
  }
  assert.fail(description);
}

async function exerciseMutation(app, primary, secondary) {
  const primaryModel = primary.getByTestId('pi-settings-default-model');
  const secondaryModel = secondary.getByTestId('pi-config-window-default_model');
  const primarySave = primary.getByTestId('pi-settings-save');
  const secondarySave = secondary.getByTestId('pi-config-window-save-default_model');
  const history = () => secondary.evaluate(() => window.xiaozhiConfigWindow.history('default_model')).then(result => {
    assert(result.ok);
    return result.value;
  });
  const choosePrimary = async model => {
    await primaryModel.click();
    await primary.getByRole('menuitemradio', { name: model, exact: true }).click();
  };
  const chooseSecondary = async model => {
    await secondaryModel.click();
    await secondary.getByRole('option', { name: model, exact: true }).click();
  };
  const hold = async (clicked) => {
    await app.evaluate(() => { globalThis.r4HoldNext = true; });
    await clicked();
    await until(() => app.evaluate(() => Boolean(globalThis.r4Release)), 'model validation is waiting in the controlled directory');
  };
  const release = () => app.evaluate(() => { globalThis.r4Release(); globalThis.r4Release = undefined; });
  await secondary.evaluate(() => {
    globalThis.r4Observer = [];
    globalThis.r4StopObserver = window.xiaozhiConfigWindow.onChange(event => globalThis.r4Observer.push(event));
  });

  const initial = await history();
  await choosePrimary(modelB);
  await chooseSecondary(modelA);
  await hold(() => primarySave.click());
  try {
    await secondarySave.click();
    await until(async () => (await history()).value === modelA, 'secondary commits before primary');
  } finally {
    await release();
  }
  await primary.getByTestId('pi-settings-draft-conflict').waitFor();
  assert.match(await primaryModel.innerText(), new RegExp(modelB));
  const first = await history();
  assert.equal(first.version, initial.version + 1);
  await primary.getByTestId('pi-settings-discard').click();
  await until(async () => (await primaryModel.innerText()).includes(modelA), 'primary discards to the winning value');

  await choosePrimary(modelB);
  await chooseSecondary(modelC);
  await hold(() => secondarySave.click());
  try {
    await primarySave.click();
    await until(async () => (await history()).value === modelB, 'primary commits before secondary');
  } finally {
    await release();
  }
  const second = await history();
  assert.equal(second.version, first.version + 1);
  const conflict = secondary.getByTestId('pi-config-window-conflict-default_model');
  await conflict.waitFor();
  assert.match(await conflict.innerText(), /当前已保存：deepseek-v4-pro。草稿：deepseek-r4-fixture。/);
  assert(await secondarySave.isDisabled());
  await secondary.getByTestId('pi-config-window-rebase-default_model').click();
  await secondarySave.click();
  await until(async () => (await history()).value === modelC, 'explicit rebase allows a new save');
  const current = await history();
  assert.equal(current.version, second.version + 1);
  report.checks.push({ id: 'AC-R4-04', secondaryWon: first, primaryWon: second, draftsPreserved: true });
  report.checks.push({ id: 'AC-R4-05', explicitDiscard: true, explicitRebase: true, thirdCommit: current.version });

  const send = input => secondary.evaluate(request => window.xiaozhiConfigWindow.commit(request), input);
  const input = { field: 'default_model', value: null, expectedVersion: current.version, operationId: randomUUID() };
  await secondary.evaluate(async request => { await window.xiaozhiConfigWindow.commit(request); }, input);
  const replay = await send(input);
  assert(replay.ok);
  assert.equal(replay.value.version, current.version + 1);
  assert.deepEqual(await send({ ...input, value: modelA }), { ok: false, error: 'invalid_input' });
  assert.deepEqual(await send({ ...input, credentialId: randomUUID() }), { ok: false, error: 'permission_denied' });
  assert.deepEqual(await send({ ...input, field: 'session_thinking', sessionId: 'aisession_' + randomUUID() }),
    { ok: false, error: 'permission_denied' });
  const noop = await send({ ...input, expectedVersion: replay.value.version, operationId: randomUUID() });
  assert(noop.ok && noop.value.outcome === 'no_change');
  assert.equal((await history()).undo.changeId, replay.value.changeId);
  const sql = withSql(data, false, db => ({
    replayReceipts: db.prepare('SELECT count(*) AS count FROM xiaozhi_config_operations_v1 WHERE operation_id=?').get(input.operationId).count,
    replayChanges: db.prepare('SELECT count(*) AS count FROM xiaozhi_config_changes_v1 WHERE change_id=?').get(replay.value.changeId).count,
  }));
  assert.deepEqual(sql, { replayReceipts: 1, replayChanges: 1 });
  await until(() => secondary.evaluate(version => globalThis.r4Observer.some(event => event.version === version), replay.value.version), 'post-commit notification delivered');
  await secondary.evaluate(() => globalThis.r4StopObserver());
  const events = await secondary.evaluate(() => globalThis.r4Observer);
  assert.deepEqual(events.filter(event => event.version === replay.value.version),
    [{ field: 'default_model', scope: 'global', version: replay.value.version }]);
  report.checks.push({ id: 'AC-R4-06', replay, noop, sql, events });
  return { hold, release, current: await history() };
}

async function exerciseRecovery(app, primary, secondary, controls) {
  const history = (page, field) => page.evaluate(field => window.xiaozhiConfigWindow
    ? window.xiaozhiConfigWindow.history(field) : window.omniEdu.getXiaozhiConfigHistory({ field }), field).then(result => {
    assert(result.ok);
    return result.value;
  });
  const write = async (field, value) => {
    const { version: expectedVersion } = await history(secondary, field);
    const result = await secondary.evaluate(request => window.xiaozhiConfigWindow.commit(request),
      { operationId: randomUUID(), field, value, expectedVersion });
    assert(result.ok, JSON.stringify(result));
    return result.value;
  };
  const undo = page => page.getByTestId('pi-config-undo-default_model');
  const feedback = page => page.getByTestId('pi-config-feedback-default_model');
  const awaitUndo = page => until(async () => (await undo(page).getAttribute('aria-disabled')) === 'false', 'field undo is available');
  const setModels = models => app.evaluate((_, ids) => { globalThis.r4Models = ids; }, models);
  const draft = secondary.getByTestId('pi-config-window-default_model');
  const refresh = secondary.getByTestId('pi-config-window-refresh');

  await write('default_model', modelA);
  const old = await write('default_model', modelB);
  await primary.getByRole('button', { name: '最近配置修改', exact: true }).click();
  await secondary.getByRole('button', { name: '最近配置修改', exact: true }).click();
  await awaitUndo(primary);
  await controls.hold(() => undo(primary).click());

  let current;
  try {
    await write('default_model', modelC);
    current = await write('default_model', modelB);
    await write('global_thinking', 'low');
    const latest = await history(secondary, 'default_model');
    assert.equal(latest.value, modelB);
    assert.equal(latest.undo.changeId, current.changeId);
    assert.notEqual(latest.undo.changeId, old.changeId);
  } finally {
    await controls.release();
  }
  await until(async () => (await feedback(primary).textContent())?.includes('最近修改已发生变化'), 'old undo is rejected visibly');
  assert.equal((await history(primary, 'default_model')).undo.changeId, current.changeId);
  report.checks.push({ id: 'AC-R4-07', initialHead: old.changeId, observedHead: current.changeId, abaRejected: true, crossFieldStayedEligible: true });

  await draft.click();
  await secondary.getByRole('option', { name: modelA, exact: true }).click();
  await awaitUndo(secondary);
  await setModels([modelA, modelB]);
  const denial = '官方目录中没有这个模型，请刷新后重新选择。';
  const decline = async () => {
    await undo(secondary).click();
    await until(async () => (await feedback(secondary).textContent())?.includes(denial), 'unavailable model is rejected visibly');
    const state = await history(secondary, 'default_model');
    assert.equal(state.undo.changeId, current.changeId);
    assert.equal(state.value, modelB);
    assert.match(await draft.innerText(), new RegExp(modelA));
  };
  await decline();
  await refresh.click();
  await secondary.getByText('模型目录已刷新。', { exact: true }).waitFor();
  await decline();
  await setModels([modelA, modelB, modelC]);
  await refresh.click();
  await secondary.getByText('模型目录已刷新。', { exact: true }).waitFor();
  await undo(secondary).focus();
  await secondary.keyboard.press('Enter');
  await until(async () => (await feedback(secondary).textContent())?.includes('已撤回'), 'same target succeeds after official directory recovery');
  const restored = await history(secondary, 'default_model');
  assert.equal(restored.value, modelC);
  assert.equal(restored.undo, null);
  assert.equal(restored.items[0].kind, 'undo');
  assert(restored.items.find(item => item.changeId === current.changeId).undone);
  assert.match(await draft.innerText(), new RegExp(modelA));
  assert.equal(await secondary.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'pi-config-undo-default_model');
  const stored = withSql(data, false, db => db.prepare(
    'SELECT change_id, undo_of FROM xiaozhi_config_changes_v1 WHERE change_id=?',
  ).get(restored.items[0].changeId));
  assert.equal(stored.undo_of, current.changeId);
  report.checks.push({ id: 'AC-R4-08', target: current.changeId, savedBeforeRecovery: modelB,
    stillUnavailableAfterRefresh: true, keyboardRetry: true, draftPreserved: true, restored: restored.value, sql: stored });
  return restored;
}

async function exerciseVisibleJourney(app, primary, primaryNative) {
  const ids = await primary.evaluate(async () => {
    const sessions = [];
    for (const title of ['R4 带任务切换甲', 'R4 带任务切换乙']) {
      sessions.push((await window.omniEdu.createAiConversationSession({ title })).session.id);
    }
    return sessions;
  });
  const [first, second] = ids;
  const setSession = async id => {
    const toggle = primary.getByTestId('workbench-sidebar-toggle');
    if (await toggle.getAttribute('aria-label') === '展开侧栏') await toggle.click();
    await primary.getByTestId('workbench-session-' + id).click();
    await primary.locator('.office-composer-container[data-session-id="' + id + '"]').waitFor();
  };
  const state = id => withSql(data, false, db => {
    const row = db.prepare('SELECT id,status FROM ai_agent_runs WHERE session_id=? ORDER BY created_at DESC LIMIT 1').get(id);
    return row ? { ...row } : undefined;
  });
  const send = async text => {
    await primary.getByTestId('office-prompt-input').fill(text);
    await primary.getByRole('button', { name: '发送消息', exact: true }).click();
  };
  const settings = async () => {
    await primary.getByRole('button', { name: '设置', exact: true }).click();
    await primary.getByRole('button', { name: '模型与连接', exact: true }).click();
  };
  await primary.getByRole('button', { name: '返回对话', exact: true }).click();
  await setSession(second);
  await send('请用一句话说明三角形的三条边。');
  await until(() => state(second)?.status === 'succeeded', 'second task has a durable completed result');
  const secondTaskRun = state(second);
  await setSession(first);
  await app.evaluate(() => { globalThis.r4HoldChatNext = true; });
  await send('请用一句话说明直角的定义。');
  await until(() => app.evaluate(() => Boolean(globalThis.r4ReleaseChat)), 'first task is active in the actual Pi provider path');
  const firstTaskRun = state(first);
  assert.equal(firstTaskRun.status, 'running');

  try {
    await settings();
    const opening = app.waitForEvent('window');
    await primary.getByTestId('pi-settings-open-session-config-window').click();
    const settingsWindow = await opening;
    const settingsNative = await app.browserWindow(settingsWindow);
    await settingsWindow.getByTestId('pi-config-window-session_thinking').waitFor();
    await settingsWindow.getByTestId('pi-config-window-session_thinking').focus();
    await settingsWindow.keyboard.press('Enter');
    await settingsWindow.getByRole('option', { name: '自动', exact: true }).waitFor();
    await settingsWindow.getByRole('option', { name: '自动', exact: true }).click();
    const discard = settingsWindow.getByTestId('pi-config-window-discard-session_thinking');
    await discard.focus();
    await settingsWindow.keyboard.press('Enter');
    await settingsWindow.getByText('已放弃本次草稿。', { exact: true }).waitFor();
    const untouched = await settingsWindow.evaluate(() => window.xiaozhiConfigWindow.history('session_thinking'));
    assert(untouched.ok && untouched.value.value === null);

    const dimensions = [];
    for (const [width, height] of [[1366, 768], [1920, 1080]]) {
      for (const [window, handle, kind] of [[primary, primaryNative, 'primary'], [settingsWindow, settingsNative, 'secondary']]) {
        await handle.evaluate((win, size) => win.setContentSize(...size), [width, height]);
        await window.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [width, height]);
        const metrics = await window.evaluate(() => ({
          viewport: [innerWidth, innerHeight],
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          configLayoutLeft: document.querySelector('[data-testid="pi-config-window"]')?.getBoundingClientRect().left,
          configLayoutPadding: Number.parseFloat(getComputedStyle(
            document.querySelector('[data-testid="pi-config-window"]') ?? document.body,
          ).paddingLeft),
        }));
        assert(metrics.horizontalOverflow <= 1 && metrics.bodyScrollWidth <= width + 1, JSON.stringify(metrics));
        if (kind === 'secondary') assert(metrics.configLayoutLeft > 0 && metrics.configLayoutPadding >= 16, 'config layout must apply');
        await window.screenshot({ path: join(root, kind + '-' + width + '.png') });
        dimensions.push({ kind, ...metrics });
      }
    }
    await primary.getByRole('button', { name: '返回对话', exact: true }).click();
    await setSession(second);
    assert.deepEqual(state(first), firstTaskRun);
    assert.deepEqual(state(second), secondTaskRun);
    assert((await settingsWindow.evaluate(() => window.xiaozhiConfigWindow.history('session_thinking'))).ok);
    const closed = settingsWindow.waitForEvent('close');
    await settingsNative.evaluate(win => win.close());
    await closed;
    assert.deepEqual(state(first), firstTaskRun);

    await settings();
    await primary.getByRole('button', { name: '策略与诊断', exact: true }).click();
    await primary.getByRole('button', { name: '当前配置来源', exact: true }).click();
    const sourceTable = primary.getByTestId('pi-resolved-config-table');
    await sourceTable.waitFor();
    assert.equal(await sourceTable.locator('input,select,textarea,[contenteditable="true"]').count(), 0);
    assert.match(await primary.getByTestId('pi-resolved-config-session').innerText(), /R4 带任务切换乙/);
    assert.deepEqual(state(first), firstTaskRun);
    report.checks.push({ id: 'AC-R4-13-automation', dimensions, keyboardDiscard: true,
      readonlySources: true, firstTaskRun, secondTaskRun, sameRunDuringSwitch: true, sameRunAfterWindowClosed: true });
  } finally {
    await app.evaluate(() => { globalThis.r4ReleaseChat?.(); globalThis.r4ReleaseChat = undefined; });
  }
  await until(() => state(first)?.status === 'succeeded', 'first task succeeds after switching and closure');
  assert.equal(state(first).id, firstTaskRun.id);
  report.checks.find(check => check.id === 'AC-R4-13-automation').settled = state(first);
}

async function runChecks(app, primary) {
  const sessionId = await primary.evaluate(async () => {
    const { session } = await window.omniEdu.createAiConversationSession({ title: 'R4 独立配置验收' });
    localStorage.setItem('xiaozhi.current-session.v1', session.id);
    return session.id;
  });
  await primary.getByRole('button', { name: '设置', exact: true }).click();
  await primary.getByRole('button', { name: '模型与连接', exact: true }).click();
  await primary.getByTestId('pi-model-settings').waitFor();
  const open = primary.getByTestId('pi-settings-open-config-window');
  assert.equal(await open.count(), 1, 'Behavior red: the formal model settings have no secondary-window action');

  const initialWindow = app.waitForEvent('window');
  await open.click();
  const secondary = await initialWindow;
  await secondary.getByTestId('pi-config-window').waitFor();
  await secondary.getByTestId('pi-config-window-default_model').waitFor();
  if (mutation) {
    assert.equal(await secondary.evaluate(() => typeof window.xiaozhiConfigWindow.commit), 'function',
      'The real auxiliary settings window can save a default model draft');
  }
  if (recovery) {
    await secondary.getByRole('button', { name: '最近配置修改', exact: true }).click();
    assert.equal(await secondary.getByTestId('pi-config-undo-default_model').count(), 1,
      'Behavior red: the formal auxiliary history has no field undo action');
    await secondary.getByRole('button', { name: '最近配置修改', exact: true }).click();
  }
  const nativeWindow = await app.browserWindow(secondary);
  const id = await nativeWindow.evaluate(win => win.id);
  const primaryNative = await app.browserWindow(primary);
  assert.equal(await nativeWindow.evaluate(win => ({ modal: win.isModal(), visible: win.isVisible() })).then(window => window.modal || !window.visible), false);
  assert.equal(app.windows().length, 2);
  await open.click();
  assert.equal(app.windows().length, 2);
  assert.equal(await nativeWindow.evaluate(win => win.id), id);
  if (visibleJourney) {
    await primary.getByTestId('pi-settings-open-session-config-window').click();
    await primary.getByText('已聚焦原窗口。要更换会话范围，请关闭该窗口后重新打开。', { exact: true }).waitFor();
    assert.equal(app.windows().length, 2);
  }
  assert.equal(await primaryNative.evaluate(win => win.isDestroyed()), false);
  report.checks.push({ id: 'AC-R4-01', secondWindowId: id, nonModal: true, singleton: true });

  const bridge = await secondary.evaluate(async () => ({
    methods: Object.keys(window.xiaozhiConfigWindow).sort(),
    fullPreload: typeof window.omniEdu,
    require: typeof window.require,
    view: await window.xiaozhiConfigWindow.read(),
    history: await window.xiaozhiConfigWindow.history('default_model'),
    absentSession: await window.xiaozhiConfigWindow.history('session_thinking'),
  }));
  assert.equal(bridge.fullPreload, 'undefined');
  assert.equal(bridge.require, 'undefined');
  const expectedMethods = mutation ? ['commit', 'history', 'onChange', 'read', 'refreshModels'] : ['history', 'read', 'refreshModels'];
  if (recovery) expectedMethods.push('undo');
  assert.deepEqual(bridge.methods, expectedMethods);
  assert(bridge.view.ok && bridge.history.ok);
  assert.deepEqual(bridge.absentSession, { ok: false, error: 'permission_denied' });
  assert.doesNotMatch(JSON.stringify(bridge), /synthetic-directory|maskedApiKey|sealedKey|credentialId|studentId|dataRoot|grantId/);
  const readsBefore = await app.evaluate(() => globalThis.r4CatalogueReads);
  await secondary.getByTestId('pi-config-window-refresh').click();
  await secondary.getByText('模型目录已刷新。', { exact: true }).waitFor();
  assert.equal(await app.evaluate(() => globalThis.r4CatalogueReads), readsBefore + 1);
  report.checks.push({ id: 'AC-R4-03', view: bridge.view, methods: bridge.methods, explicitDirectoryRefresh: true });

  assert.equal(await secondary.evaluate(() => Boolean(window.open('about:blank'))), false);
  const localUrl = secondary.url();
  assert.equal(await secondary.evaluate(() => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const bridge = typeof frame.contentWindow?.xiaozhiConfigWindow;
    frame.remove();
    return bridge;
  }), 'undefined');
  const unregisteredWindow = app.waitForEvent('window');
  await app.evaluate(({ BrowserWindow }, { preload, url }) => {
    const unregistered = new BrowserWindow({ show: false, webPreferences: { preload, sandbox: true, contextIsolation: true } });
    void unregistered.loadURL(url);
  }, { preload: resolve(main, '../../preload/config-window.cjs'), url: localUrl });
  const unregistered = await unregisteredWindow;
  await unregistered.waitForFunction(() => Boolean(window.xiaozhiConfigWindow));
  assert.deepEqual(await unregistered.evaluate(() => window.xiaozhiConfigWindow.read()), { ok: false, error: 'permission_denied' });
  const unregisteredNative = await app.browserWindow(unregistered);
  await unregisteredNative.evaluate(win => win.close());
  const changes = mutation ? await exerciseMutation(app, primary, secondary) : undefined;
  if (recovery) changes.current = await exerciseRecovery(app, primary, secondary, changes);
  const closed = secondary.waitForEvent('close');
  if (changes) {
    const operation = { field: 'default_model', expectedVersion: changes.current.version, value: modelA, operationId: randomUUID() };
    await changes.hold(() => secondary.evaluate(input => { void window.xiaozhiConfigWindow.commit(input).catch(() => {}); }, operation));
    try {
      await nativeWindow.evaluate(win => win.close());
      await closed;
    } finally {
      await changes.release();
    }
    const persisted = await primary.evaluate(() => window.omniEdu.getXiaozhiConfigHistory({ field: 'default_model' }));
    assert(persisted.ok);
    assert.equal(persisted.value.version, changes.current.version);
    const stored = withSql(data, false, db => db.prepare('SELECT 1 FROM xiaozhi_config_operations_v1 WHERE operation_id=?').get(operation.operationId));
    assert.equal(stored, undefined);
    report.checks.find(check => check.id === 'AC-R4-06').closedWriterDidNotCommit = true;
  } else {
    await nativeWindow.evaluate(win => win.close());
    await closed;
  }
  assert.equal(app.windows().length, 1);

  const scopedWindow = app.waitForEvent('window');
  await primary.getByTestId('pi-settings-open-session-config-window').click();
  const scoped = await scopedWindow;
  await scoped.getByTestId('pi-config-window-session_thinking').waitFor();
  const scopedNative = await app.browserWindow(scoped);
  assert.notEqual(await scopedNative.evaluate(win => win.id), id);
  const scopedRead = await scoped.evaluate(() => window.xiaozhiConfigWindow.history('session_thinking'));
  assert(scopedRead.ok);
  assert.equal(scopedRead.value.value, null);
  if (mutation) {
    await scoped.getByTestId('pi-config-window-session_thinking').click();
    await scoped.getByRole('option', { name: '自动', exact: true }).click();
    await scoped.getByTestId('pi-config-window-save-session_thinking').click();
    await until(async () => (await scoped.evaluate(() => window.xiaozhiConfigWindow.history('session_thinking'))).value?.value === 'auto',
      'scoped native window saves only the session selected at opening');
    const scopedSql = withSql(data, false, db => db.prepare(
      'SELECT next_value, scope_id FROM xiaozhi_config_changes_v1 WHERE field=?',
    ).all('session_thinking'));
    assert.deepEqual(scopedSql.map(row => ({ ...row })), [{ next_value: 'auto', scope_id: sessionId }]);
    report.checks.find(check => check.id === 'AC-R4-01').fixedSessionSaved = true;
    await scoped.screenshot({ path: join(root, 'scoped-window.png') });
  }
  await primary.evaluate(id => window.omniEdu.archiveAiConversationSession(id), sessionId);
  assert.deepEqual(await scoped.evaluate(() => window.xiaozhiConfigWindow.read()), { ok: false, error: 'permission_denied' });
  assert.deepEqual(await primary.evaluate(id => window.omniEdu.openXiaozhiConfigWindow(id), sessionId),
    { ok: false, error: 'permission_denied' });
  await scoped.evaluate(() => { location.assign('https://example.invalid/'); });
  await scoped.waitForFunction(url => location.href === url, localUrl);
  assert.equal(scoped.url(), localUrl);
  report.checks.push({ id: 'AC-R4-02', isolatedPreload: true, popupsDenied: true, navigationRetained: true,
    closeCleanedUp: true, sessionWasScoped: true, archivedDenied: true, subframeHasNoBridge: true, otherWindowDenied: true });
  if (visibleJourney) {
    const crashedId = await scopedNative.evaluate(win => win.id);
    await scopedNative.evaluate(win => win.webContents.forcefullyCrashRenderer());
    await until(() => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id) === null, crashedId),
      'the crashed auxiliary renderer and its window are reclaimed');
    await until(() => app.windows().length === 1, 'Playwright sees the remaining primary window');
    report.checks.find(check => check.id === 'AC-R4-02').rendererLossCleanedUp = true;
    await exerciseVisibleJourney(app, primary, primaryNative);
  }
}

async function keepManualWindowOpen(app, primary) {
  await primary.evaluate(async () => {
    for (const title of ['R4 手测任务乙', 'R4 手测任务甲']) {
      const { session } = await window.omniEdu.createAiConversationSession({ title });
      localStorage.setItem('xiaozhi.current-session.v1', session.id);
    }
    await window.omniEdu.getXiaozhiSettings({ refresh: true });
  });
  await app.evaluate(({ app, BrowserWindow }) => {
    function allowSizeKeys(win) {
      win.webContents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown' || !['F8', 'F9'].includes(input.key)) return;
        event.preventDefault();
        const size = input.key === 'F8' ? [1366, 768] : [1920, 1080];
        for (const open of BrowserWindow.getAllWindows()) open.setContentSize(...size);
      });
    }
    BrowserWindow.getAllWindows().forEach(allowSizeKeys);
    app.on('browser-window-created', (_event, win) => allowSizeKeys(win));
  });
  const runtime = await app.evaluate(({ BrowserWindow }) => ({
    pid: process.pid, electron: process.versions.electron, visible: BrowserWindow.getAllWindows().some(win => win.isVisible()),
  }));
  assert(runtime.visible);
  const identity = { ...report, runtime, data, profile, openedAt: new Date().toISOString(), humanAcceptance: 'NOT_RUN' };
  writeFileSync(join(root, 'launch.json'), JSON.stringify(identity, null, 2));
  console.log(JSON.stringify({ launch: join(root, 'launch.json'), keyboardSizes: ['F8', 'F9'] }));
  if (manualProbe) {
    await app.close();
    return;
  }
  await app.waitForEvent('close', { timeout: 0 });
}

let app;
try {
  const args = [main, '--user-data-dir=' + profile];
  if (manual) args.push('--r4-manual-fixture');
  app = await electron.launch({ cwd: desktop, args, env, timeout: 60000 });
  await assertIsolatedPiMain(app, main, profile);
  const primary = await app.firstWindow();
  await primary.getByTestId('xiaozhi-pi-workspace').waitFor({ timeout: 60000 });
  await app.evaluate(({ net }, models) => {
    globalThis.r4CatalogueReads = 0;
    globalThis.r4Models = models;
    net.fetch = async (input, options) => {
      const target = new URL(typeof input === 'string' ? input : input.url);
      if (target.origin === 'https://api.deepseek.com' && target.pathname.endsWith('/chat/completions')) {
        const request = JSON.parse(options.body);
        if (process.argv.includes('--r4-manual-fixture') && JSON.stringify(request.messages.at(-1)).includes('R4 手测')) {
          await new Promise(resolve => setTimeout(resolve, 12000));
        }
        if (globalThis.r4HoldChatNext) {
          globalThis.r4HoldChatNext = false;
          await new Promise(resolve => { globalThis.r4ReleaseChat = resolve; });
        }
        const chunk = (delta, finish_reason) => 'data: ' + JSON.stringify({
          id: 'r4-acceptance', object: 'chat.completion.chunk', created: 0, model: request.model,
          choices: [{ index: 0, delta, finish_reason }],
        }) + '\n\n';
        return new Response(chunk({ role: 'assistant', content: 'R4 隔离验收任务已响应。' }, null) + chunk({}, 'stop') + 'data: [DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } });
      }
      if (target.origin !== 'https://api.deepseek.com' || !target.pathname.endsWith('/models')) {
        throw Error('Unexpected outbound request in the isolated provider fixture');
      }
      globalThis.r4CatalogueReads++;
      if (globalThis.r4HoldNext) {
        globalThis.r4HoldNext = false;
        await new Promise(resolve => { globalThis.r4Release = resolve; });
      }
      return Response.json({ object: 'list', data: globalThis.r4Models.map(id => ({
        id, context_window: 1048576, max_output_tokens: 32768,
        effort: { supported_levels: ['low', 'high', 'max'], default_level: 'high' },
      })) });
    };
  }, [modelA, modelB, modelC]);
  if (manual) {
    report.mode = 'manual_fixture';
    report.humanAcceptance = 'NOT_RUN';
    await keepManualWindowOpen(app, primary);
  } else {
    await runChecks(app, primary);
  }
  report.success = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
  if (manual && app) await app.close().catch(() => {});
} finally {
  if (app && !manual) await app.close();
  const path = join(root, 'report.json');
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, path, error: report.error }));
}
