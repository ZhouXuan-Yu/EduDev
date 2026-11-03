import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer, transformWithEsbuild} from 'vite';
import {chromium} from 'playwright';

// Actual installed HeroUI + actual production field, headless component scope only.
// Does not launch Electron, touch business data, change CSS, or call a provider.
const output = fs.mkdtempSync(path.resolve('test-results/paper-reference-checkbox-'));
const report = {success: false, passed: 0, checks: [], errors: [], scope: 'Headless Chromium mounted production field and installed official CSS; not Electron acceptance'};
const entry = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import '/src/renderer/heroui-styles.ts';
import {PaperReferenceField} from '/src/renderer/components/paper-ui/PaperReferenceFields.tsx';
const original = {value:'原始来源名称',status:'known',evidenceIds:['unit_evidence'],confirmed:false};
const evidence = {id:'unit_evidence',text:'标题：原始来源名称',part:'unit-only.txt',path:'line:1'};
window.patches=[];
function Fixture() {
  const [field,setField]=useState(original), [disabled,setDisabled]=useState(false);
  window.readState=()=>({field,evidence});
  return <main data-testid="checkbox-fixture">
    <button data-testid="before-field">Before</button>
    <PaperReferenceField path="title" label="试卷名称" field={field} candidate={{evidence:[evidence]}} disabled={disabled}
      onEdit={(_,patch)=>{window.patches.push(patch);setField(previous=>({...previous,...patch}));}}/>
    <button data-testid="toggle-disabled" onClick={()=>setDisabled(value=>!value)}>Toggle disabled</button>
  </main>;
}
document.documentElement.setAttribute('data-edu-modern','');
document.documentElement.dataset.theme='light';
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
const server = await createServer({configFile: false, appType: 'custom', esbuild: {jsx: 'automatic'},
  optimizeDeps: {include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@heroui/react']},
  plugins: [{name: 'reference-checkbox-component-test',
    resolveId(id) {if (id === '/__reference_checkbox.jsx') return '\0reference-checkbox.jsx';},
    load(id) {if (id === '\0reference-checkbox.jsx') return transformWithEsbuild(entry, 'reference-checkbox.jsx', {loader: 'jsx', jsx: 'automatic'});},
    configureServer(value) {value.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/') return next();
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__reference_checkbox.jsx"></script></body></html>');
    });},
  }], server: {host: '127.0.0.1', port: 0, strictPort: false, hmr: false, ws: false, watch: null}});
let browser, page;
const check = async (name, work) => {await work(); report.passed++; report.checks.push(name); console.log('PASS ' + name);};
try {
  await server.listen();
  browser = await chromium.launch({headless: true});
  page = await browser.newPage({viewport: {width: 1366, height: 768}});
  page.on('pageerror', error => report.errors.push(error.message)); page.setDefaultTimeout(10000);
  await page.goto(server.resolvedUrls.local[0], {waitUntil: 'commit', timeout: 30000});
  await page.getByTestId('checkbox-fixture').waitFor({timeout: 60000});
  const group = page.getByTestId('paper-reference-field-title'), checkbox = group.getByRole('checkbox', {name: '已核对此项', exact: true});
  const control = group.locator('[data-slot="checkbox-control"]');
  await check('production field exposes one uniquely named visible checkbox with official control/indicator', async () => {
    assert.equal(await checkbox.count(), 1); assert(await checkbox.isVisible());
    assert.equal(await group.locator('[data-slot="checkbox-content"]').count(), 1);
    assert.equal(await control.count(), 1);
    const box = await control.boundingBox();
    assert(box && box.width > 0 && box.height > 0, 'Official control must have a real visible box');
    assert.equal(await group.locator('[data-slot="checkbox-indicator"]').count(), 1); assert(!(await checkbox.isChecked()));
  });
  await check('visible official Control clicks toggle the real checkbox and update only confirmed', async () => {
    // React Aria intentionally visually hides the native input; click its visible official control.
    // No force, dispatchEvent, or CSS alteration to make the hidden input a pointer target.
    await control.click(); assert(await checkbox.isChecked());
    let state = await page.evaluate(() => window.readState()); assert.equal(state.field.confirmed, true);
    assert.equal(state.field.value, '原始来源名称'); assert.deepEqual(state.field.evidenceIds, ['unit_evidence']); assert.equal(state.field.teacherValue, undefined);
    await control.click(); assert(!(await checkbox.isChecked()));
  });
  await check('actual Tab reaches input then checkbox; Space toggles without clicking a label/span', async () => {
    await page.getByTestId('before-field').focus(); await page.keyboard.press('Tab');
    assert(await page.getByTestId('paper-reference-input-title').evaluate(node => node === document.activeElement));
    await page.keyboard.press('Tab'); assert(await checkbox.evaluate(node => node === document.activeElement));
    await page.keyboard.press('Space'); assert(await checkbox.isChecked());
    await page.keyboard.press('Space'); assert(!(await checkbox.isChecked()));
  });
  await check('teacher revision resets review and keyboard confirmation preserves original evidence and teacher input', async () => {
    await control.click(); assert(await checkbox.isChecked());
    await page.getByTestId('paper-reference-input-title').fill('教师修改名称'); assert(!(await checkbox.isChecked()));
    await checkbox.focus(); await page.keyboard.press('Space'); assert(await checkbox.isChecked());
    const state = await page.evaluate(() => window.readState());
    assert.equal(state.field.value, '原始来源名称'); assert.equal(state.field.teacherValue, '教师修改名称'); assert.equal(state.field.confirmed, true);
    assert.deepEqual(state.field.evidenceIds, ['unit_evidence']); assert.equal(state.evidence.text, '标题：原始来源名称');
  });
  await check('official control is disabled, Tab skips disabled inputs, and re-enabling restores keyboard operation', async () => {
    await page.getByTestId('toggle-disabled').click(); assert(await checkbox.isDisabled());
    const patches = await page.evaluate(() => window.patches.length);
    assert(await control.isDisabled()); assert(await checkbox.isChecked());
    assert.equal(await page.evaluate(() => window.patches.length), patches);
    await page.getByTestId('before-field').focus(); await page.keyboard.press('Tab');
    const nextEnabled = group.getByRole('button', {name: '试卷名称的原文依据', exact: true});
    assert.equal(await nextEnabled.count(), 1);
    assert(await nextEnabled.evaluate(node => node === document.activeElement));
    assert.equal(await page.evaluate(() => window.patches.length), patches);
    await page.getByTestId('toggle-disabled').click(); assert(await checkbox.isEnabled());
    await checkbox.focus(); await page.keyboard.press('Space'); assert(!(await checkbox.isChecked()));
  });
  await check('official checkbox interaction has no page errors or native details', async () => {
    assert.deepEqual(report.errors, []); assert.equal(await page.locator('details,summary').count(), 0);
  });
  await page.screenshot({path: path.join(output, 'component.png')}); report.success = true;
} catch (error) {
  report.failure = error.stack || String(error); if (page) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  console.error(report.failure); process.exitCode = 1;
} finally {
  if (browser) await browser.close(); await server.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({output, passed: report.passed, success: report.success, scope: report.scope}));
}
