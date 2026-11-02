import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {basketUiReady, schemaVersion} from './acceptance/paper-basket-ui-driver.mjs';

// Test the actual serializable QA gate with deferred read-only DTOs; no app/browser/DB/model.
const dom = new JSDOM('<div data-testid="paper-basket-workspace" data-basket-id="" data-stage="preview"><button data-testid="paper-basket-stage-organize"></button></div>');
const prior = {window: Object.getOwnPropertyDescriptor(globalThis, 'window'), document: Object.getOwnPropertyDescriptor(globalThis, 'document')};
Object.defineProperty(globalThis, 'window', {value: dom.window, configurable: true});
Object.defineProperty(globalThis, 'document', {value: dom.window.document, configurable: true});
const reference = {schemaVersion, sessionId: 'aisession_11111111-1111-4111-8111-111111111111', basketId: 'xibasket_11111111-1111-4111-8111-111111111111'};
const expected = {stage: 'organize', query: 'saved query'};
const value = {id: reference.basketId, sessionId: reference.sessionId, uiState: {stage: 'organize', filters: {query: expected.query}}};
const root = document.querySelector('[data-testid="paper-basket-workspace"]');
let result = {ok: true, value}, reads = 0, passed = 0;
window.omniEdu = {readPaperBasket: async input => {assert.deepEqual(input, reference); reads++; return result;}};
const check = async (name, fn) => {await fn(); passed++; console.log('PASS ' + name);};
const ready = () => basketUiReady({reference, expected});
try {
  await check('mounted shell with empty identity cannot pass restoration', async () => {assert.equal(await ready(), false); assert.equal(reads, 0);});
  root.dataset.basketId = 'xibasket_22222222-2222-4222-8222-222222222222';
  await check('a different nonempty basket cannot satisfy the target', async () => assert.equal(await ready(), false));
  root.dataset.basketId = reference.basketId;
  await check('correct basket with prior DOM stage cannot pass', async () => assert.equal(await ready(), false));
  root.dataset.stage = expected.stage;
  const pending = document.createElement('p'); pending.dataset.testid = 'paper-basket-ui-pending'; root.append(pending);
  await check('unsaved preference marker prevents early host acceptance', async () => {assert.equal(await ready(), false); assert.equal(reads, 0);});
  pending.remove();
  result = {ok: true, value: {...value, uiState: {...value.uiState, stage: 'preview'}}};
  await check('rendered next stage still waits for its durable host stage', async () => assert.equal(await ready(), false));
  result = {ok: true, value: {...value, uiState: {...value.uiState, filters: {query: 'old query'}}}};
  await check('durable next stage with stale query cannot pass the save boundary', async () => assert.equal(await ready(), false));
  result = {ok: false, error: 'permission_denied'};
  await check('failed host read never claims restoration success', async () => assert.equal(await ready(), false));
  result = {ok: true, value: {...value, id: 'wrong-id'}};
  await check('host basket identity must match exactly', async () => assert.equal(await ready(), false));
  result = {ok: true, value: {...value, sessionId: 'wrong-owner'}};
  await check('host owner identity must match exactly', async () => assert.equal(await ready(), false));
  let resolveRead, settled = false;
  window.omniEdu.readPaperBasket = input => {assert.deepEqual(input, reference); return new Promise(resolve => {resolveRead = resolve;});};
  const deferred = ready().then(value => {settled = true; return value;});
  await check('read in flight cannot resolve the QA gate early', async () => {await Promise.resolve(); assert.equal(settled, false);});
  resolveRead({ok: true, value});
  await check('only the exact completed stage and query release the gate', async () => assert.equal(await deferred, true));
  window.omniEdu.readPaperBasket = async () => ({ok: true, value});
  const duplicate = root.cloneNode(true); document.body.append(duplicate);
  await check('duplicate workspaces cannot silently select a first match', async () => assert.equal(await ready(), false));
  duplicate.remove();
  await check('cold restore can release only after exact saved reference is present', async () => assert.equal(await ready(), true));
  async function duringRead(change) {
    let finish;
    window.omniEdu.readPaperBasket = () => new Promise(resolve => {finish = resolve;});
    const checking = ready();
    assert.equal(typeof finish, 'function', 'Regression must change DOM during the actual host await');
    change();
    finish({ok: true, value});
    return checking;
  }
  await check('reset identity during deferred host read cannot pass using the old DOM sample', async () => {
    assert.equal(await duringRead(() => {root.dataset.basketId = '';}), false);
    root.dataset.basketId = reference.basketId;
  });
  await check('same-reference remount during deferred host read cannot pass using a disconnected node', async () => {
    const replacement = root.cloneNode(true);
    assert.equal(await duringRead(() => root.replaceWith(replacement)), false);
    replacement.replaceWith(root);
  });
  await check('loading or pending save starting during deferred host read keeps the gate closed', async () => {
    const button = root.querySelector('button');
    assert.equal(await duringRead(() => {button.disabled = true;}), false);
    button.disabled = false;
    assert.equal(await duringRead(() => root.append(pending)), false);
    pending.remove();
  });
  console.log(JSON.stringify({success: true, passed, scope: 'QA readiness predicate with deferred read-only host fixture; no runtime or product changes'}));
} finally {
  for (const key of ['window', 'document']) {
    if (prior[key]) Object.defineProperty(globalThis, key, prior[key]); else delete globalThis[key];
  }
  dom.window.close();
}
