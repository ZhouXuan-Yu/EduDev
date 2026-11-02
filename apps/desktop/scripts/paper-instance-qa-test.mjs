import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import {instanceUiReady, instanceSchema} from './acceptance/paper-instance-ui-driver.mjs';
import {instanceDomainEvidence, assertInstanceDomainUnchanged, storedPaperDigest} from './acceptance/paper-instance-ui-evidence.mjs';

const dom = new JSDOM('<div data-testid="paper-basket-workspace" data-basket-id="basket-test" data-basket-revision="7" data-stage="organize"><button data-testid="paper-basket-stage-organize"></button></div>');
const prior = Object.fromEntries(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const key of ['window', 'document']) Object.defineProperty(globalThis, key, {value: key === 'window' ? dom.window : dom.window.document, configurable: true});
const root = document.querySelector('[data-testid="paper-basket-workspace"]'), stage = root.querySelector('button');
const reference = {schemaVersion: instanceSchema, sessionId: 'owner-test', basketId: 'basket-test'};
const expected = {stage: 'organize', revision: 7};
const value = {schemaVersion: instanceSchema, id: reference.basketId, sessionId: reference.sessionId,
  revision: 7, uiState: {stage: 'organize', filters: {}, offset: 0}};
let reads = 0, passed = 0;
window.omniEdu = {readPaperBasketV2: async input => {reads++; assert.deepEqual(input, reference); return {ok: true, value};},
  readPaperBasket: () => {throw Error('V1 must never be used by B QA');}};
const ready = overrides => instanceUiReady({reference, expected: {...expected, ...overrides}});
const check = async (name, fn) => {await fn(); passed++; console.log('PASS ' + name);};
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-instance-qa-unit-'));
try {
  await check('B gate calls only real V2 read and requires exact current revision', async () => {
    assert.equal(await ready(), true); assert.equal(reads, 1);
    root.dataset.basketRevision = '6'; assert.equal(await ready(), false); root.dataset.basketRevision = '7';
  });
  async function duringRead(change) {
    let resolve;
    const original = window.omniEdu.readPaperBasketV2;
    window.omniEdu.readPaperBasketV2 = () => new Promise(done => {resolve = done;});
    try {const pending = ready(); assert(resolve); change(); resolve({ok: true, value}); return await pending;}
    finally {window.omniEdu.readPaperBasketV2 = original;}
  }
  await check('identity reset during awaited IPC fails rather than certifying old DOM', async () => {
    assert.equal(await duringRead(() => {root.dataset.basketId = '';}), false); root.dataset.basketId = reference.basketId;
  });
  await check('same-ID remount during awaited IPC fails connected-node identity check', async () => {
    const replacement = root.cloneNode(true);
    assert.equal(await duringRead(() => root.replaceWith(replacement)), false); replacement.replaceWith(root);
  });
  await check('loading and pending preference save during IPC keep the gate closed', async () => {
    assert.equal(await duringRead(() => {stage.disabled = true;}), false); stage.disabled = false;
    const pending = document.createElement('p'); pending.dataset.testid = 'paper-basket-ui-pending';
    assert.equal(await duringRead(() => root.append(pending)), false); pending.remove();
  });
  await check('cold unsaved recovery requires exact-entry enabled discard, not disabled navigation alone', async () => {
    stage.disabled = true;
    assert.equal(await ready({unsavedEntryId: 'entry-test'}), false);
    const editor = document.createElement('section'); editor.dataset.testid = 'paper-instance-editor'; editor.dataset.entryId = 'entry-test';
    const discard = document.createElement('button'); discard.dataset.testid = 'paper-instance-discard'; discard.disabled = true; editor.append(discard); root.append(editor);
    assert.equal(await ready({unsavedEntryId: 'entry-test'}), false);
    discard.disabled = false; assert.equal(await ready({unsavedEntryId: 'another-entry'}), false);
    assert.equal(await ready({unsavedEntryId: 'entry-test'}), true);
    editor.remove(); stage.disabled = false;
  });
  await check('V1-shaped response cannot satisfy the B gate even with matching identity', async () => {
    const original = window.omniEdu.readPaperBasketV2;
    window.omniEdu.readPaperBasketV2 = async () => ({ok: true, value: {...value, schemaVersion: 'xiaozhi.paper-basket.v1'}});
    assert.equal(await ready(), false); window.omniEdu.readPaperBasketV2 = original;
  });
  const originalUi = value.uiState;
  root.dataset.stage = 'select'; stage.dataset.testid = 'paper-basket-stage-select';
  const refresh = document.createElement('button'); refresh.dataset.testid = 'paper-basket-refresh-candidates'; root.append(refresh);
  delete value.uiState;
  await check('fresh absent uiState matches only the official empty select/filter/offset/scroll defaults', async () => {
    assert.equal(await ready({stage: 'select', query: '', offset: 0, scrollTop: 0}), true);
    assert.equal(await ready({stage: 'select', query: 'not saved'}), false);
    assert.equal(await ready({stage: 'select', offset: 12}), false);
    assert.equal(await ready({stage: 'select', scrollTop: 100}), false);
    root.dataset.stage = 'organize'; stage.dataset.testid = 'paper-basket-stage-organize';
    assert.equal(await ready(), false, 'Absent host preferences cannot validate organize merely because DOM has that stage');
    root.dataset.stage = 'select'; stage.dataset.testid = 'paper-basket-stage-select';
  });
  value.uiState = {stage: 'select', filters: {query: 'saved query'}, offset: 12, scrollTop: 100};
  await check('explicit saved preferences still win and every requested mismatch keeps the gate closed', async () => {
    assert.equal(await ready({stage: 'select', query: '', offset: 0, scrollTop: 0}), false);
    assert.equal(await ready({stage: 'select', query: 'saved query', offset: 12, scrollTop: 100}), true);
    value.uiState = {...value.uiState, stage: 'organize'};
    assert.equal(await ready({stage: 'select'}), false);
    value.uiState = null; assert.equal(await ready({stage: 'select'}), false, 'Present malformed preferences are never defaulted');
  });
  value.uiState = originalUi; refresh.remove(); root.dataset.stage = 'organize'; stage.dataset.testid = 'paper-basket-stage-organize';
  const db = new DatabaseSync(path.join(temporary, 'app.db'));
  try {
    // Unit database for evidence-helper regression only. Never used as the actual UI fixture.
    db.exec("CREATE TABLE question_bank_items(id TEXT, stem TEXT); CREATE TABLE ai_confirmation_items(id TEXT, action_type TEXT, payload_json TEXT); INSERT INTO question_bank_items VALUES('unit-q','unit-source'); INSERT INTO ai_confirmation_items VALUES('unit-old','pi_paper_candidate','unit-payload');");
    const before = instanceDomainEvidence(temporary), originalDigest = storedPaperDigest(temporary, 'unit-old');
    await check('new legitimate paper rows are allowed while existing history stays exact', async () => {
      db.exec("INSERT INTO ai_confirmation_items VALUES('unit-new','pi_paper_candidate','unit-new-payload')");
      assertInstanceDomainUnchanged(before, instanceDomainEvidence(temporary));
      assert.equal(storedPaperDigest(temporary, 'unit-old'), originalDigest);
    });
    await check('bank mutation, history mutation and deletion are detected independently', async () => {
      db.exec("UPDATE question_bank_items SET stem='changed'");
      assert.throws(() => assertInstanceDomainUnchanged(before, instanceDomainEvidence(temporary)));
      db.exec("UPDATE question_bank_items SET stem='unit-source'; UPDATE ai_confirmation_items SET payload_json='changed' WHERE id='unit-old'");
      assert.throws(() => assertInstanceDomainUnchanged(before, instanceDomainEvidence(temporary)));
      db.exec("DELETE FROM ai_confirmation_items WHERE id='unit-old'");
      assert.throws(() => assertInstanceDomainUnchanged(before, instanceDomainEvidence(temporary)));
    });
  } finally {db.close();}
  await check('check is preparation-only and missing run-ui cannot accidentally start Electron', async () => {
    const checkOnly = spawnSync(process.execPath, ['scripts/ui-goal-paper-instance.mjs', '--check'], {encoding: 'utf8'});
    assert.equal(checkOnly.status, 0, checkOnly.stderr); const report = JSON.parse(checkOnly.stdout.trim());
    assert.equal(report.preparedOnly, true); assert.equal(report.execution, false); assert.equal(report.modelCalls, 0);
    const noFlag = spawnSync(process.execPath, ['scripts/ui-goal-paper-instance.mjs'], {encoding: 'utf8'});
    assert.notEqual(noFlag.status, 0); assert(noFlag.stderr.includes('Nothing launched'));
  });
  console.log(JSON.stringify({success: true, passed, scope: 'QA-only deferred-DOM gate, read-only evidence helper against disposable unit SQLite and preparation CLI; no app/build/model'}));
} finally {
  for (const key of ['window', 'document']) {
    if (prior[key]) Object.defineProperty(globalThis, key, prior[key]); else delete globalThis[key];
  }
  dom.window.close();
  for (const name of fs.readdirSync(temporary)) fs.unlinkSync(path.join(temporary, name));
  fs.rmdirSync(temporary);
}
