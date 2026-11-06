/** Formal U4-A UI, no model/build. Explicit --run-ui and an owned real source fixture required. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {productEntry} from './product-navigation.mjs';
import {choose, enterPaper, ledger, settle, capturePaper, enabledContrast, historyStage, disclosureTrigger} from './acceptance/paper-basket-ui-driver.mjs';
import {instanceSchema, readInstanceBasket as readBasket, findInstanceCandidate as findCandidate,
  waitInstanceUi as waitForBasketUi, captureInstance, instanceAnswerKeyboard} from './acceptance/paper-instance-ui-driver.mjs';
import {candidateBody, entryCard, visibleUnique, selectTrigger} from './acceptance/paper-basket-ui-locators.mjs';
import {installPaperBasketDomTrace} from './acceptance/paper-basket-dom-trace.mjs';
import {continuationBootstrap, continuationGuardRead, waitContinuationBootstrap, readContinuationBootstrapFile} from './acceptance/paper-adaptation-continuation.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const command = 'node scripts/ui-goal-paper-basket.mjs --run-ui --from=test-results/<real-source-fixture> --owner=<session-B> --active-session=<session-A> --questions=<q1>,<q2>';
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({preparedOnly: true, execution: false, command, modelCalls: 0,
    requires: 'Two distinct genuinely ingested eligible questions with the same subject/grade/type; existing real owner; frozen formal out.',
    scope: 'real UI create/add/reorder/remove/re-add/blueprint/move/preview/pending-confirm/titlebar back-forward/cold restore/archive; teacher answer Tab/Enter/Escape; 1366/1920; no exports/model replay',
    exclusions: 'Source revocation and quota-failure injection stay in deterministic hook/host tests. Original export/provider gates are not rerun or claimed.'}));
  process.exit(0);
}
assert(process.argv.includes('--run-ui'), 'Nothing launched: supply --check or explicit --run-ui. ' + command);
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owned = fs.realpathSync(path.join(desktop, 'test-results'));
assert(arg('from') && arg('owner') && arg('questions'), command);
const original = fs.realpathSync(path.resolve(desktop, arg('from')));
assert(original.startsWith(owned + path.sep), 'Fixture must be an owned test-results child');
const owner = arg('owner'), activeSession = arg('active-session') || owner;
for (const id of [owner, activeSession]) assert(/^aisession_[\da-f-]{36}$/i.test(id));
const questionIds = arg('questions').split(',');
assert.equal(questionIds.length, 2); assert.notEqual(questionIds[0], questionIds[1]);
for (const id of questionIds) assert(/^[\w.-]{1,240}$/.test(id));
const sourceData = path.join(original, 'data');
assert(fs.existsSync(path.join(sourceData, 'app.db')), 'Source requires data/app.db');
const sourceHash = fingerprint(sourceData).sha256;
const main = testMain(desktop), buildRoot = path.dirname(path.dirname(main)), build = fingerprint(buildRoot);
const sourceBefore = fingerprint(path.join(desktop, 'src')).sha256;
const output = fs.mkdtempSync(path.join(owned, 'ui-goal-paper-basket-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
fs.cpSync(sourceData, data, {recursive: true, errorOnExist: true, force: false});
assert.equal(fingerprint(data).sha256, sourceHash);
const before = ledger(data);
const report = {success: false, scenario: 'U4-A-real-basket-UI', original, output, owner, activeSession, questionIds,
  buildBefore: build.sha256, sourceBefore: sourceHash, scriptSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  productionSourceBefore: sourceBefore,
  before, checks: [], screens: [], contrast: [], errors: [], networkAttempts: [], launches: [], domTraces: [],
  fixturePolicy: 'Byte copy of owned real data only; fresh isolated Chromium profile. No receipt rewriting, source mutation or external write authorization.',
  networkObservation: 'Shared zero-HTTP/model guard is installed before formal main import and composed with the original frame policy. Durable model ledgers independently check no added runs/requests.',
  notExercised: ['Rapid navigation during a deferred session read remains a separate focused test; this scenario waits for the original session callback.'],
  notCovered: ['Actual file exports/provider delivery remain separate frozen gates.', 'Host denial/source-change and preference-capacity failures are exercised in independent deterministic tests, not mocked into this UI run.']};
const check = name => {report.checks.push({name, pass: true}); console.log('PASS ' + name);};
let app, page, basketId, saved;
async function launch() {
  const env = {...process.env};
  for (const key of Object.keys(env)) {
    if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_') ||
      ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_RENDERER_URL'].includes(key)) delete env[key];
  }
  Object.assign(env, {OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '1', OMNI_EDU_E2E_DIALOG_MODE: '1'});
  const number = report.launches.length + 1;
  const bootstrap = path.join(output, `bootstrap-${number}.cjs`);
  const stateFile = path.join(output, `bootstrap-state-${number}.json`);
  fs.writeFileSync(bootstrap, continuationBootstrap({main, profile, diagnosticFile: stateFile}), {flag: 'wx'});
  app = await electron.launch({args: [bootstrap, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], cwd: output, env, timeout: 60000});
  const ready = app.firstWindow({timeout: 30000}).then(window => {page = window;});
  await Promise.all([ready, waitContinuationBootstrap(app, {
    timeout: 30000, readState: () => readContinuationBootstrapFile(stateFile, app.process())
  })]);
  page.setDefaultTimeout(30000);
  await page.evaluate(installPaperBasketDomTrace);
  page.on('pageerror', () => report.errors.push('pageerror'));
  page.on('console', message => {if (message.type() === 'error') report.errors.push('console.error');});
  const guard = await app.evaluate(continuationGuardRead, true);
  assert.equal(guard.policyProbe, 'FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED');
  await page.route('**/*', async route => {
    if (/^https?:/.test(route.request().url())) {report.networkAttempts.push({kind: 'blocked-renderer-http'}); await route.abort();}
    else await route.continue();
  });
  report.launches.push(await assertIsolatedPiMain(app, main, profile));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
  assert.equal(path.resolve(await page.evaluate(() => window.omniEdu.getDataRoot())), data);
}
async function close() {
  if (!app) return;
  const handle = app; app = undefined;
  try {
    if (page && !page.isClosed()) report.domTraces.push(await page.evaluate(() => window.__paperBasketDomTrace.snapshot()));
    const guard = await handle.evaluate(continuationGuardRead);
    (report.guards ||= []).push(guard);
    assert.equal(guard.networkAttempts, 0);
    assert.equal(guard.modelAttempts, 0);
    assert.equal(guard.rendererErrors, 0);
  } finally {await handle.close();}
}
async function current() {return readBasket(page, owner, basketId);}
async function waitRevision(revision) {
  await page.waitForFunction(rev => Number(document.querySelector('[data-testid="paper-basket-workspace"]')?.dataset.basketRevision) === rev, revision);
}
async function expandBlueprint() {
  const trigger = disclosureTrigger(page.getByTestId('paper-basket-blueprint-fold'), '蓝图与来源策略');
  await visibleUnique(trigger, 'Official blueprint disclosure trigger');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await settle(app, page);
}
async function captureEntry(name, entryId, preview = false) {
  await captureInstance({app, page, output, report}, name, entryId, preview);
}
async function addQuestion(question, targetSection) {
  const row = await findCandidate(page, report, owner, basketId, question);
  const candidate = await page.evaluate(({owner, basketId, questionId, schemaVersion}) => window.omniEdu.readPaperBasketCandidateV2({
    schemaVersion, sessionId: owner, basketId, questionId}), {owner, basketId, questionId: question.id, schemaVersion: instanceSchema});
  assert.equal(candidate.ok, true); assert.equal(candidate.value.eligibility.available, true);
  await choose(page, selectTrigger(row, '加入分节'), targetSection);
  const before = await current();
  await row.getByTestId('paper-basket-add').click(); await waitRevision(before.revision + 1);
  const after = await current(), entry = after.entries.find(item => item.questionId === question.id);
  assert(entry); assert.equal(entry.contentVersion, candidate.value.contentVersion); assert.deepEqual(entry.question, candidate.value.question);
  const added = row.getByTestId('paper-basket-add');
  await added.and(page.locator(':disabled')).waitFor();
  assert.equal(await added.innerText(), '已加入题篮');
  assert.equal(after.entries.filter(item => item.questionId === question.id).length, 1);
  return after;
}
try {
  await launch();
  const questions = await page.evaluate(ids => Promise.all(ids.map(id => window.omniEdu.getQuestionNotebookEntry(id))), questionIds);
  for (const q of questions) assert(q?.stem && q.answer && q.analysis, 'Use real complete source questions');
  assert.equal(questions[0].subject, questions[1].subject); assert.equal(questions[0].grade, questions[1].grade);
  assert.equal(questions[0].questionType, questions[1].questionType, 'This deterministic reorder scenario needs two eligible questions of the same type');
  const sidebar = page.locator('[data-testid="edu-navigation"]:visible');
  if (await sidebar.getAttribute('data-collapsed') === 'true') await sidebar.getByTestId('workbench-sidebar-toggle').click();
  const sessionButton = await visibleUnique(sidebar.getByTestId('workbench-session-' + activeSession), 'Exact initial session');
  await sessionButton.click();
  await visibleUnique(sessionButton.and(page.locator(':enabled[aria-current="page"]')), 'Completed target session selection');
  assert.equal(await sessionButton.isEnabled(), true);
  assert.equal(await sessionButton.getAttribute('aria-current'), 'page');
  await enterPaper(page);
  await page.getByTestId('paper-basket-owner-search').fill(owner);
  await choose(page, page.getByTestId('paper-basket-owner'), owner);
  const previousBasketId = await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');
  await page.getByTestId('paper-basket-new').click();
  if (await page.getByTestId('paper-basket-new-choice').isVisible()) await page.getByTestId('paper-basket-keep-new').click();
  await page.waitForFunction(previous => {
    const id = document.querySelector('[data-testid="paper-basket-workspace"]')?.dataset.basketId;
    return !!id && id !== previous;
  }, previousBasketId);
  // New baskets default to practice. This scenario explicitly exercises the exam blueprint.
  await choose(page, page.getByTestId('paper-basket-purpose'), 'paper');
  // Creating a new basket from an existing basket saves first, then edit its blueprint through the same public UI.
  if (await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id')) await expandBlueprint();
  const editor = page.getByTestId('paper-basket-blueprint-fold').getByTestId('paper-basket-blueprint');
  await visibleUnique(editor, 'Existing basket blueprint editor');
  await editor.getByTestId('paper-basket-title').fill('U4-A 确切手选 UI 复核');
  await editor.getByTestId('paper-basket-subject').fill(questions[0].subject);
  await editor.getByTestId('paper-basket-grade').fill(questions[0].grade);
  await choose(page, editor.getByTestId('paper-basket-mode'), 'source_only');
  while (await editor.getByTestId('paper-basket-section-editor').count() > 1) {
    const count = await editor.getByTestId('paper-basket-section-editor').count();
    const lastSection = editor.getByTestId('paper-basket-section-editor').nth(count - 1);
    assert.equal(await lastSection.locator(':scope > legend').innerText(), `第 ${count} 部分`);
    await (await visibleUnique(lastSection.getByRole('button', {name: '移除此分节', exact: true}), 'Remove final numbered section')).click();
  }
  await editor.getByTestId('paper-basket-section-type').fill(questions[0].questionType);
  await editor.getByTestId('paper-basket-section-count').fill('2');
  await editor.getByTestId('paper-basket-section-points').fill('50');
  await editor.getByTestId('paper-basket-total').fill('100');
  const hasBasket = !!await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');
  const beforeBlueprintRevision = Number(await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-revision'));
  await editor.getByTestId(hasBasket ? 'paper-basket-save-blueprint' : 'paper-basket-create').click();
  if (hasBasket) await waitRevision(beforeBlueprintRevision + 1);
  await page.waitForFunction(() => !!document.querySelector('[data-testid="paper-basket-workspace"]')?.dataset.basketId);
  basketId = await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');
  saved = await current();
  check('Real owner and positive exam blueprint saved by UI; no renderer-owned basket IDs');
  for (const question of questions) saved = await addQuestion(question, saved.blueprint.sections[0].id);
  assert.equal(saved.entries.length, 2); assert.deepEqual(saved.gaps, []);
  assert.equal(saved.complete, false, 'V2 requires explicit teacher review before delivery');
  assert.deepEqual(saved.entries.map(e => e.questionId), questionIds);
  const showcaseEntryId = saved.entries.find(entry => entry.questionId === questions[1].id).entryId;
  await settle(app, page);
  await enabledContrast(page, report, 'enabled search text', page.getByTestId('paper-basket-search'));
  await capturePaper(app, page, output, report, 'full-question-selected', await candidateBody(page, questions[1].id));
  check('Two exact real full candidates added once, duplicate actions disabled with correct feedback and host content versions');
  await page.getByTestId('paper-basket-stage-organize').click();
  const movedEntryId = saved.entries.find(entry => entry.questionId === questions[0].id).entryId;
  await (await visibleUnique(entryCard(page, movedEntryId).getByTestId('paper-basket-down'), 'Move exact first question down')).click();
  await waitRevision(saved.revision + 1);
  saved = await current(); assert.deepEqual(saved.entries.map(e => e.questionId), [...questionIds].reverse());
  const pinnedIds = saved.entries.map(e => e.entryId);
  await (await visibleUnique(entryCard(page, movedEntryId).getByTestId('paper-basket-remove'), 'Remove exact reordered question')).click();
  await waitRevision(saved.revision + 1);
  saved = await current(); assert.equal(saved.entries.length, 1);
  await page.getByTestId('paper-basket-stage-select').click();
  saved = await addQuestion(questions[0], saved.blueprint.sections[0].id);
  assert.equal(saved.entries[0].entryId, pinnedIds[0]);
  check('Actual organize reorder/remove/re-add preserves existing entry identity and submits real typed callbacks');
  await expandBlueprint();
  await editor.getByRole('button', {name: '添加分节', exact: true}).click();
  const sections = editor.getByTestId('paper-basket-section-editor');
  await page.waitForFunction(() => document.querySelector('[data-testid="paper-basket-blueprint-fold"]')
    ?.querySelectorAll('[data-testid="paper-basket-section-editor"]').length === 2);
  assert.equal(await sections.count(), 2, 'Exactly two numbered blueprint sections');
  assert.equal(await sections.nth(0).locator(':scope > legend').innerText(), '第 1 部分');
  assert.equal(await sections.nth(1).locator(':scope > legend').innerText(), '第 2 部分');
  await sections.nth(0).getByTestId('paper-basket-section-count').fill('1');
  await sections.nth(1).getByTestId('paper-basket-section-type').fill(questions[0].questionType);
  await sections.nth(1).getByTestId('paper-basket-section-points').fill('50');
  await editor.getByTestId('paper-basket-save-blueprint').click(); await waitRevision(saved.revision + 1);
  saved = await current(); assert.equal(saved.entries.length, 2); assert.equal(saved.complete, false);
  await page.getByTestId('paper-basket-stage-organize').click();
  const readdedEntryId = saved.entries.find(entry => entry.questionId === questions[0].id).entryId;
  await choose(page, entryCard(page, readdedEntryId).getByTestId('paper-basket-move'), saved.blueprint.sections[1].id);
  await waitRevision(saved.revision + 1); saved = await current(); assert.deepEqual(saved.gaps, []);
  await captureEntry('organized', showcaseEntryId);
  check('Blueprint changes retain members and expose gaps; real cross-section move restores completeness');
  for (const entry of saved.entries) {
    const card = entryCard(page, entry.entryId);
    if (!await card.getByTestId('paper-instance-form').count()) await card.getByTestId('paper-instance-open').click();
    await card.getByTestId('paper-instance-confirm').click();
    await waitRevision(saved.revision + 1);
    saved = await current();
    assert.equal(saved.entries.find(item => item.entryId === entry.entryId).reviewCurrent, true);
  }
  assert.equal(saved.complete, true, 'Exact quotas and explicit current instance reviews permit preview delivery');
  await page.getByTestId('paper-basket-stage-preview').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="paper-basket-workspace"]')?.dataset.stage === 'preview');
  await historyStage(page, report, owner, basketId, 'organize', 'back', instanceSchema);
  await historyStage(page, report, owner, basketId, 'preview', 'forward', instanceSchema);
  check('Actual application back/forward restores the same pinned basket and organize/preview stages without content revision changes');
  assert.equal(await page.getByTestId('paper-basket-answer').count(), 0);
  await captureEntry('student-preview', showcaseEntryId, true);
  await page.getByTestId('paper-basket-teacher').focus(); await page.getByTestId('paper-basket-teacher').press('Enter');
  await visibleUnique(entryCard(page, showcaseEntryId, true).getByTestId('paper-basket-answer'), 'Exact preview answer disclosure');
  await instanceAnswerKeyboard({app, page, output, report}, showcaseEntryId);
  check('Student answer DOM stays absent; teacher answer is Tab reachable and Enter toggles with Escape focus retained, no native details');
  await captureEntry('teacher-preview', showcaseEntryId, true);
  assert.equal(await page.getByTestId('paper-basket-workspace').locator('details,summary').count(), 0);
  await enabledContrast(page, report, 'enabled exact snapshot action', page.getByTestId('paper-basket-snapshot'));
  await page.getByTestId('paper-basket-snapshot').click(); await page.getByTestId('paper-basket-confirm').waitFor();
  await page.getByTestId('paper-basket-confirm').click(); await page.getByTestId('paper-export-entry').waitFor();
  assert.equal(await page.getByTestId('paper-export-entry').locator('.edu-paper-export-buttons button').count(), 6);
  check('Exact manual snapshot, real teacher confirmation, six original export choices present; no export/model requested');
  await page.getByTestId('paper-basket-back-teaching').click(); await enterPaper(page);
  await waitForBasketUi(page, owner, basketId, {stage: 'preview'});
  assert.equal(await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'), basketId);
  await page.getByTestId('paper-basket-stage-select').click();
  await waitForBasketUi(page, owner, basketId, {stage: 'select'});
  const restoredQuery = questions[0].stem.slice(0, 36);
  await page.getByTestId('paper-basket-search').fill(restoredQuery);
  await page.getByTestId('paper-basket-stage-organize').click();
  await waitForBasketUi(page, owner, basketId, {stage: 'organize', query: restoredQuery});
  saved = await current(); assert.equal(saved.uiState.stage, 'organize');
  assert.equal(saved.uiState.filters.query, restoredQuery);
  report.saved = {basketId, revision: saved.revision, entries: saved.entries.map(e => ({entryId: e.entryId, questionId: e.questionId, contentVersion: e.contentVersion})), uiState: saved.uiState};
  await close(); await launch(); await enterPaper(page);
  await waitForBasketUi(page, owner, basketId, {stage: 'organize', query: restoredQuery});
  assert.equal(await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'), basketId);
  const cold = await current();
  assert.deepEqual(cold.entries, saved.entries); assert.equal(cold.revision, saved.revision); assert.deepEqual(cold.uiState, saved.uiState);
  assert.equal(await page.getByTestId('paper-basket-workspace').getAttribute('data-stage'), 'organize');
  await captureEntry('cold-restored-organize', showcaseEntryId);
  check('Navigation and cold restart restore exact host basket, pinned versions, ordering and saved UI preferences');
  const archivedId = basketId;
  await page.getByTestId('paper-basket-new').click();
  await page.getByTestId('paper-basket-archive-new').click();
  await page.waitForFunction(id => {
    const next = document.querySelector('[data-testid="paper-basket-workspace"]')?.dataset.basketId;
    return !!next && next !== id;
  }, archivedId);
  const newId = await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');
  const archived = await readBasket(page, owner, archivedId);
  assert.equal(archived.state, 'archived'); assert.deepEqual(archived.entries, saved.entries);
  const fresh = await readBasket(page, owner, newId);
  assert.equal(fresh.state, 'active'); assert.equal(fresh.entries.length, 0);
  await choose(page, page.getByTestId('paper-basket-saved'), archivedId);
  await page.waitForFunction(id => document.querySelector('[data-testid="paper-basket-workspace"]')?.dataset.basketId === id, archivedId);
  assert.equal(await page.getByTestId('paper-basket-snapshot').isDisabled(), true);
  await expandBlueprint();
  const archivedEditor = page.getByTestId('paper-basket-blueprint-fold').getByTestId('paper-basket-blueprint');
  await visibleUnique(archivedEditor.getByTestId('paper-basket-save-blueprint'), 'Visible archived blueprint save action');
  assert.equal(await archivedEditor.getByTestId('paper-basket-save-blueprint').isDisabled(), true);
  await captureEntry('archived-readonly', showcaseEntryId, true);
  check('Explicit archive-and-new retains old pinned basket read-only and creates a separate empty active basket');
  await close();
  report.after = ledger(data); assert.deepEqual(report.after, before);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.networkAttempts, []);
  check('No added model runs/requests/events, clean renderer/console, zero network attempts from before main import');
  report.success = true;
} catch (error) {
  report.error = {name: error.name, message: String(error.message).replace(/sk-[\w-]+/g, '[credential]').slice(0, 1800),
    stack: String(error.stack || '').replace(/sk-[\w-]+/g, '[credential]').slice(0, 6000)};
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
} finally {
  await close().catch(() => {report.success = false; report.closeFailed = true;});
  report.buildAfter = fingerprint(buildRoot).sha256; report.sourceAfter = fingerprint(sourceData).sha256;
  report.productionSourceAfter = fingerprint(path.join(desktop, 'src')).sha256;
  if (report.productionSourceAfter !== report.productionSourceBefore) {report.success = false; report.integrityFailed = true;}
  if (report.buildAfter !== report.buildBefore || report.sourceAfter !== sourceHash) {report.success = false; report.integrityFailed = true;}
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, output, checks: report.checks.length}));
  if (!report.success) process.exitCode = 1;
}
