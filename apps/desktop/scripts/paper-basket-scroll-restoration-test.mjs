import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';

// Independent Chromium DOM test, not the product app. Real delayed SVG decoding/intrinsic geometry;
// no Electron, model, business database, or mocked scrollHeight/naturalHeight/scroll events.
const server = await createServer({configFile: false, appType: 'custom', optimizeDeps: {noDiscovery: true},
  server: {middlewareMode: true, hmr: false, ws: false, watch: null}});
let browser, context, passed = 0, sequence = 0;
const checks = [];
const check = (name, fn) => {fn(); passed++; checks.push(name); console.log('PASS ' + name);};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1800"><rect width="400" height="1800" fill="#eee"/><text x="20" y="30">Layout unit fixture</text></svg>';
try {
  const {observeCandidateScroll} = await server.ssrLoadModule('/src/renderer/components/paper-ui/paper-basket-ui.ts');
  const source = observeCandidateScroll.toString();
  browser = await chromium.launch({headless: true});
  context = await browser.newContext({viewport: {width: 900, height: 700}, reducedMotion: 'reduce'});
  let page = await context.newPage();
  const errors = [];
  const observeErrors = page => page.on('pageerror', error => errors.push(error.message));
  observeErrors(page);
  async function mount(target) {
    let fulfill, requested;
    const request = new Promise(resolve => {requested = resolve;});
    const response = new Promise(resolve => {fulfill = resolve;});
    const url = `http://paper-layout.test/image-${++sequence}.svg`;
    await page.route(url, async route => {
      requested();
      const status = await response;
      await route.fulfill({status, contentType: 'image/svg+xml', body: status === 200 ? svg : ''});
    });
    await page.setContent(`<!doctype html><html><body style="margin:0">
      <div id="list" tabindex="0" style="height:300px;width:400px;overflow:auto;overscroll-behavior:contain">
        <article style="height:500px">First question body</article>
        <div id="picture" data-paper-image-state="pending"><img id="image" src="${url}" style="display:block;max-width:100%;height:auto"></div>
        <article id="last" style="height:400px">Last question body</article>
      </div>
      <script>
        window.writes = [];
        for (const event of ['load','error']) document.getElementById('image').addEventListener(event, () => {
          document.getElementById('picture').dataset.paperImageState = 'settled';
        });
      </script>
    </body></html>`, {waitUntil: 'domcontentloaded'});
    await request;
    await page.evaluate(({source, target}) => {
      window.stopRestore = (0, eval)('(' + source + ')')(document.getElementById('list'), target, value => window.writes.push(value));
    }, {source, target});
    return async (status = 200) => {
      fulfill(status);
      await page.waitForFunction(() => document.getElementById('picture').dataset.paperImageState === 'settled');
      await frames();
    };
  }
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const state = () => page.evaluate(() => ({position: document.getElementById('list').scrollTop,
    maximum: document.getElementById('list').scrollHeight - document.getElementById('list').clientHeight,
    naturalHeight: document.getElementById('image').naturalHeight, writes: window.writes.slice()}));
  async function wheel(delta, expected) {
    const rect = await page.locator('#list').boundingBox();
    await page.mouse.move(rect.x + 100, rect.y + 100); await page.mouse.wheel(0, delta);
    await page.waitForFunction(value => document.getElementById('list').scrollTop === value && window.writes.at(-1) === value, expected);
  }

  let release = await mount(1000);
  await frames();
  let actual = await state();
  check('pending intrinsic-size image does not clamp or overwrite the saved scroll target', () => {
    assert(actual.maximum < 1000); assert.equal(actual.position, 0); assert.equal(actual.naturalHeight, 0); assert.deepEqual(actual.writes, []);
  });
  await release();
  await page.waitForFunction(() => document.getElementById('list').scrollTop === 1000);
  actual = await state();
  check('decoded real 400x1800 image makes the full saved position reachable before restoration', () => {
    assert.equal(actual.naturalHeight, 1800); assert(actual.maximum >= 1000); assert.equal(actual.position, 1000); assert.deepEqual(actual.writes, []);
  });
  await wheel(120, 1120);
  const savedPreference = (await state()).writes.at(-1);
  check('real user wheel persists the actual position after restore', () => assert.equal(savedPreference, 1120));
  await page.evaluate(() => {document.getElementById('last').style.height = '800px';});
  await frames();
  actual = await state();
  check('later layout changes never compensate over a user-controlled position', () => assert.equal(actual.position, savedPreference));

  await page.evaluate(() => window.stopRestore());
  release = await mount(savedPreference);
  await frames(); assert.deepEqual((await state()).writes, []);
  await release();
  await page.waitForFunction(value => document.getElementById('list').scrollTop === value, savedPreference);
  actual = await state();
  check('returning to the same page restores its saved position only after the new delayed image settles', () => {
    assert.equal(actual.position, savedPreference); assert.deepEqual(actual.writes, []);
  });
  await page.evaluate(() => window.stopRestore());
  await context.close(); context = await browser.newContext({viewport: {width: 900, height: 700}, reducedMotion: 'reduce'});
  page = await context.newPage(); observeErrors(page);
  release = await mount(savedPreference);
  await frames(); assert.equal((await state()).position, 0);
  await release();
  await page.waitForFunction(value => document.getElementById('list').scrollTop === value, savedPreference);
  actual = await state();
  check('fresh browser context restores the host-style saved preference without clamped intermediate writes', () => {
    assert.equal(actual.position, savedPreference); assert.deepEqual(actual.writes, []);
  });

  await page.evaluate(() => window.stopRestore());
  release = await mount(1000);
  await wheel(120, 120);
  await release(); actual = await state();
  check('user scroll while the image is pending cancels all later restoration compensation', () => {
    assert.equal(actual.position, 120); assert(!actual.writes.includes(1000)); assert.equal(actual.naturalHeight, 1800);
  });

  await page.evaluate(() => window.stopRestore());
  release = await mount(1000);
  await release(404); actual = await state();
  check('terminal image error releases restoration using real available geometry without claiming preference save', () => {
    assert.equal(actual.naturalHeight, 0); assert.equal(actual.position, actual.maximum); assert.deepEqual(actual.writes, []);
  });
  await page.evaluate(() => window.stopRestore());
  release = await mount(1000);
  await page.evaluate(() => window.stopRestore());
  await release(); actual = await state();
  check('unmounted restoration ignores late image completion', () => {assert.equal(actual.position, 0); assert.deepEqual(actual.writes, []);});
  check('independent Chromium page errors are clean', () => assert.deepEqual(errors, []));
  console.log(JSON.stringify({success: true, passed, scope: 'actual Chromium image/layout/wheel; production restoration helper; no product/Electron/DB/model/build', checks}));
} finally {
  if (context) await context.close(); if (browser) await browser.close(); await server.close();
}
