import assert from 'node:assert/strict';
import {createServer, transformWithEsbuild} from 'vite';
import {chromium} from 'playwright';
import {disclosureTrigger} from './acceptance/paper-basket-ui-driver.mjs';

// Standalone React/Chromium fixture using production components and scroll observer.
// Real native image errors/decoding/intrinsic layout; no Electron, host DB, model or product build.
const entry = `
import React, {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PaperQuestionImages} from '/src/renderer/components/paper-ui/PaperQuestionImages.tsx';
import {observeCandidateScroll} from '/src/renderer/components/paper-ui/paper-basket-ui.ts';
import {DisclosureCard} from '/src/renderer/components/ui/DisclosureCard.tsx';
import {PaperSelect} from '/src/renderer/components/paper-ui/PaperSelect.tsx';
const question = {id: 'question-layout-fixture', archive: {native: {roles: {question: {figures: [{}, {}]}}}}};
window.writes = []; window.readiness = []; window.reads = [];
window.omniEdu = {getNativeQuestionImage: async input => {
  window.reads.push(input.index);
  if (new URLSearchParams(location.search).has('read-error')) throw Error('unit read failure');
  return {dataUrl: '/__images__/' + input.index + '.svg'};
}};
function Fixture() {
  const list = useRef(null), [ready, setReady] = useState(false);
  const onReady = useCallback(value => {window.readiness.push(value); setReady(value);}, []);
  useLayoutEffect(() => observeCandidateScroll(list.current, 1000, value => window.writes.push(value)), []);
  return <>
    <div id="list" ref={list} tabIndex={0} style={{height:300,width:400,overflow:'auto',overscrollBehavior:'contain'}}>
      <article style={{height:500}}>First question body</article>
      <PaperQuestionImages question={question} contentVersion={'a'.repeat(64)} onReady={onReady}/>
      <article style={{height:400}}>Last question body</article>
    </div>
    <button id="add" disabled={!ready}>Add permission from onReady</button>
    <DisclosureCard title="蓝图与来源策略" data-testid="unit-blueprint-fold">
      {[0,1,2,3].map(index => <PaperSelect key={index} label={'Nested select ' + index} value="a"
        options={[{id:'a',label:'A'}]} onChange={() => {}}/>)}
    </DisclosureCard>
    <DisclosureCard title="参考答案与解析" data-testid="unit-answer-fold">
      <PaperSelect label="Nested answer control" value="a" options={[{id:'a',label:'A'}]} onChange={() => {}}/>
    </DisclosureCard>
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
const server = await createServer({configFile: false, appType: 'custom', esbuild: {jsx: 'automatic'},
  optimizeDeps: {include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@heroui/react']},
  plugins: [{name: 'paper-image-layout-fixture',
    resolveId(id) {if (id === '/__paper_image_fixture.jsx') return '\0paper-image-fixture.jsx';},
    async load(id) {
      if (id === '\0paper-image-fixture.jsx') return transformWithEsbuild(entry, 'paper-image-fixture.jsx', {loader: 'jsx', jsx: 'automatic'});
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/') return next();
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><html><body style="margin:0"><div id="root"></div><script type="module" src="/__paper_image_fixture.jsx"></script></body></html>');
      });
    }}],
  server: {host: '127.0.0.1', port: 0, strictPort: false, hmr: false, ws: false, watch: null}});
let browser, context, passed = 0;
const errors = [], checks = [];
const check = (name, fn) => {fn(); passed++; checks.push(name); console.log('PASS ' + name);};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1800"><rect width="400" height="1800" fill="#eee"/></svg>';
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await chromium.launch({headless: true});
  context = await browser.newContext({viewport: {width: 900, height: 700}});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  let gates;
  await page.route('**/__images__/*.svg', async route => {
    const index = Number(new URL(route.request().url()).pathname.match(/(\d+)\.svg$/)[1]);
    const gate = gates[index]; gate.requested();
    const status = await gate.response;
    await route.fulfill({status, contentType: 'image/svg+xml', body: status === 200 ? svg : ''});
  });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const state = () => page.evaluate(() => ({
    position: document.getElementById('list').scrollTop,
    maximum: document.getElementById('list').scrollHeight - document.getElementById('list').clientHeight,
    imageState: document.querySelector('.edu-paper-question-images').dataset.paperImageState,
    images: [...document.querySelectorAll('[data-testid="paper-basket-question-image"]')].map(image => ({complete: image.complete, naturalHeight: image.naturalHeight})),
    writes: window.writes.slice(), addDisabled: document.getElementById('add').disabled,
    alert: !!document.querySelector('.edu-paper-question-images [role="alert"]')
  }));
  async function mount() {
    gates = Array.from({length: 2}, () => {
      let requested, release;
      const request = new Promise(resolve => {requested = resolve;});
      const response = new Promise(resolve => {release = resolve;});
      return {request, response, requested, release};
    });
    await page.goto(origin, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('paper-basket-question-image').nth(1).waitFor({state: 'attached'});
    await Promise.all(gates.map(gate => gate.request));
    await frames();
  }
  async function end(index, status) {
    gates[index].release(status);
    await page.waitForFunction(index => document.querySelectorAll('[data-testid="paper-basket-question-image"]')[index]?.complete, index);
    await frames();
  }
  await mount();
  let actual = await state();
  check('two pending production images keep restoration and Add permission pending', () => {
    assert.equal(actual.imageState, 'pending'); assert.equal(actual.position, 0);
    assert(actual.maximum < 1000); assert.equal(actual.addDisabled, true); assert.deepEqual(actual.writes, []);
  });
  await end(0, 404); actual = await state();
  check('first real image error cannot settle the group while the second image is still loading', () => {
    assert.equal(actual.images[0].complete, true); assert.equal(actual.images[0].naturalHeight, 0);
    assert.equal(actual.images[1].complete, false); assert.equal(actual.imageState, 'pending');
    assert.equal(actual.position, 0); assert(actual.maximum < 1000); assert.deepEqual(actual.writes, []);
    assert.equal(actual.alert, true); assert.equal(actual.addDisabled, true);
  });
  await end(1, 200);
  await page.waitForFunction(() => document.getElementById('list').scrollTop === 1000);
  actual = await state();
  check('remaining real 400x1800 image finishes layout before exact unclamped restoration', () => {
    assert.equal(actual.images[1].naturalHeight, 1800); assert.equal(actual.imageState, 'settled');
    assert(actual.maximum >= 1000); assert.equal(actual.position, 1000); assert.deepEqual(actual.writes, []);
  });
  check('one failed figure continues to block Add after every figure is terminal', () => {
    assert.equal(actual.alert, true); assert.equal(actual.addDisabled, true);
  });
  for (const [testId, name, oldCount] of [['unit-blueprint-fold', '蓝图与来源策略', 5], ['unit-answer-fold', '参考答案与解析', 2]]) {
    const fold = page.getByTestId(testId);
    const broadCount = await fold.locator('button[aria-expanded]').count();
    const trigger = disclosureTrigger(fold, name);
    const triggerCount = await trigger.count();
    await trigger.click(); await trigger.and(page.locator('[aria-expanded="true"]')).waitFor();
    const expanded = await trigger.getAttribute('aria-expanded');
    await trigger.click(); await trigger.and(page.locator('[aria-expanded="false"]')).waitFor();
    const collapsed = await trigger.getAttribute('aria-expanded');
    check(name + ': exact official QA trigger excludes nested real Select controls', () => {
      assert.equal(broadCount, oldCount); assert.equal(triggerCount, 1);
      assert.equal(expanded, 'true'); assert.equal(collapsed, 'false');
    });
  }
  await mount(); await end(0, 200); actual = await state();
  check('one successful figure alone cannot enable Add or settle the pending second figure', () => {
    assert.equal(actual.imageState, 'pending'); assert.equal(actual.addDisabled, true); assert.equal(actual.position, 0);
  });
  await end(1, 200);
  await page.waitForFunction(() => !document.getElementById('add').disabled && document.getElementById('list').scrollTop === 1000);
  actual = await state();
  check('all successful figures settle and enable Add without preference writes', () => {
    assert.equal(actual.imageState, 'settled'); assert.equal(actual.addDisabled, false); assert.deepEqual(actual.writes, []);
  });
  await mount(); await end(0, 404); await end(1, 404); actual = await state();
  check('all failed figures release restoration only at the final terminal event and keep Add blocked', () => {
    assert.equal(actual.imageState, 'settled'); assert.equal(actual.position, actual.maximum);
    assert.equal(actual.addDisabled, true); assert.deepEqual(actual.writes, []);
  });
  await page.goto(origin + '?read-error', {waitUntil: 'domcontentloaded'});
  await page.locator('.edu-paper-question-images [role="alert"]').waitFor(); await frames(); actual = await state();
  check('image lookup failure with no rendered figures terminates layout and never enables Add', () => {
    assert.equal(actual.imageState, 'settled'); assert.equal(actual.images.length, 0);
    assert.equal(actual.addDisabled, true); assert.deepEqual(actual.writes, []);
  });
  check('standalone production image component has no uncaught browser errors', () => assert.deepEqual(errors, []));
  console.log(JSON.stringify({success: true, passed, checks,
    scope: 'real React PaperQuestionImages plus scroll observer in headless Chromium; controlled typed-API fixture; no product/Electron/host DB/model/full build'}));
} finally {
  if (context) await context.close(); if (browser) await browser.close(); await server.close();
}
