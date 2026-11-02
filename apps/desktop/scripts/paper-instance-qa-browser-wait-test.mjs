import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {waitInstanceCondition} from './acceptance/paper-instance-ui-wait.mjs';
import {instanceUiReady, instanceSchema} from './acceptance/paper-instance-ui-driver.mjs';

// Independent about:blank Chromium, not Electron/product UI. No business fixture, model or build.
const browser = await chromium.launch({headless: true});
let passed = 0;
const check = async (name, fn) => {await fn(); passed++; console.log('PASS ' + name);};
try {
  const page = await browser.newPage();
  await check('installed raw Playwright waitForFunction resolves async false, reproducing the actual wrapper defect', async () => {
    const handle = await page.waitForFunction(async () => false, null, {timeout: 300});
    assert.equal(await handle.jsonValue(), false); await handle.dispose();
  });
  await check('B wrapper awaits async false and correctly fails at its deadline', async () => {
    await assert.rejects(waitInstanceCondition(page, async () => false, null, {timeout: 300}), error => error.name === 'TimeoutError');
  });
  await check('B wrapper polls resolved booleans until actual true rather than passing a Promise object', async () => {
    await page.evaluate(() => {window.unitCalls = 0;});
    await waitInstanceCondition(page, async () => {await Promise.resolve(); return ++window.unitCalls >= 3;}, null, {timeout: 3000});
    assert.equal(await page.evaluate(() => window.unitCalls), 3);
  });
  await check('B wrapper timeout also bounds a predicate whose async read never resolves', async () => {
    await assert.rejects(waitInstanceCondition(page, () => new Promise(() => {}), null, {timeout: 200}), error => error.name === 'TimeoutError');
  });
  const reference = {schemaVersion: instanceSchema, sessionId: 'unit-owner', basketId: 'unit-basket'};
  await page.setContent('<div data-testid="paper-basket-workspace" data-basket-id="" data-stage="organize" data-basket-revision="9"><button data-testid="paper-basket-stage-organize"></button></div>');
  await page.evaluate(reference => {window.omniEdu = {readPaperBasketV2: async () => ({ok: true,
    value: {...reference, id: reference.basketId, revision: 9, uiState: {stage: 'organize', filters: {}}}})};}, reference);
  await check('actual B readiness predicate in browser cannot release an empty mounted shell', async () => {
    await assert.rejects(waitInstanceCondition(page, instanceUiReady, {reference, expected: {stage: 'organize', revision: 9}}, {timeout: 300}), error => error.name === 'TimeoutError');
  });
  await check('actual B readiness releases only matching live DOM and host revision', async () => {
    await page.evaluate(() => {document.querySelector('[data-testid="paper-basket-workspace"]').dataset.basketId = 'unit-basket';});
    await waitInstanceCondition(page, instanceUiReady, {reference, expected: {stage: 'organize', revision: 9}}, {timeout: 3000});
    assert.equal(await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'), reference.basketId);
  });
  await page.setContent('<div data-testid="paper-basket-workspace" data-basket-id="unit-basket" data-stage="select" data-basket-revision="9"><button data-testid="paper-basket-stage-select"></button><button data-testid="paper-basket-refresh-candidates"></button></div>');
  await page.evaluate(reference => {window.unitUi = undefined; window.omniEdu = {readPaperBasketV2: async () => ({ok: true,
    value: {...reference, id: reference.basketId, revision: 9, ...(window.unitUi === undefined ? {} : {uiState: window.unitUi})}})};}, reference);
  await check('real browser awaited gate accepts fresh absent preferences as the official select defaults', async () => {
    await waitInstanceCondition(page, instanceUiReady, {reference, expected: {stage: 'select', revision: 9, query: '', offset: 0, scrollTop: 0}}, {timeout: 1000});
  });
  await check('real browser gate still times out on explicitly saved mismatching preferences', async () => {
    await page.evaluate(() => {window.unitUi = {stage: 'organize', filters: {query: 'kept'}, offset: 12, scrollTop: 100};});
    await assert.rejects(waitInstanceCondition(page, instanceUiReady, {reference, expected: {stage: 'select', revision: 9}}, {timeout: 300}), error => error.name === 'TimeoutError');
  });
  console.log(JSON.stringify({success: true, passed, scope: 'Real headless browser and installed Playwright wrapper; no Electron/product acceptance claim'}));
} finally {await browser.close();}
