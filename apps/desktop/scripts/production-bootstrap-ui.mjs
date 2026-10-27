import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain, testMain} from './acceptance/build-root.mjs';
import {fingerprint} from './acceptance/evidence.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = testMain(desktop);
const output = fs.mkdtempSync(path.join(desktop, 'test-results/production-bootstrap-'));
const report = {ok:false, checks:[], rendererErrors:[], build:fingerprint(path.dirname(path.dirname(main))).sha256, probes:[]};
const legacyChannels = ['settings:getDeepSeek', 'ai:deepTutorListPendingInputs'];
const sharedChannels = ['knowledge:getOverview', 'aiConfirmations:list'];
let app, page;
const check = name => { report.checks.push({name, pass:true}); console.log('PASS ' + name); };
async function launch(legacy = false) {
  // Only explicit legacy acceptance uses OS-temp authority; product uses owned test-results.
  const dataRoot = legacy ? fs.mkdtempSync(path.join(tmpdir(), 'omni-edu-bootstrap-data-')) : path.join(output,'data');
  const profile = legacy ? fs.mkdtempSync(path.join(tmpdir(), 'omni-edu-bootstrap-profile-')) : path.join(output,'profile');
  const env = {...process.env, NODE_ENV:'development', OMNI_EDU_DATA_ROOT:dataRoot,
    OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'), OMNI_EDU_E2E_DIALOG_MODE:'1'};
  for (const key of Object.keys(env)) if (key.startsWith('OMNI_EDU_E2E_') && key !== 'OMNI_EDU_E2E_DIALOG_MODE') delete env[key];
  for (const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','OMNI_EDU_XIAOZHI_PI']) delete env[key];
  if (legacy) { env.OMNI_EDU_XIAOZHI_PI='0'; env.OMNI_EDU_E2E_LEGACY_RUNTIME='1'; }
  app = await electron.launch({args:[main,'--user-data-dir='+profile], cwd:desktop, env, timeout:60000});
  page = await app.firstWindow();
  page.on('pageerror', error => report.rendererErrors.push(String(error)));
  if (legacy) {
    await page.locator('.app-shell').waitFor();
    assert.equal(await page.evaluate(() => window.omniEdu.isXiaozhiEnabled()), false);
  } else { await readyPi(); await assertIsolatedPiMain(app, main, profile); }
  await app.evaluate(({ipcMain}, channels) => {
    // Instrument existing registered handlers; the renderer still uses the real typed preload.
    const state = globalThis.bootstrapProbe = {calls:[], releases:[], sharedReleases:[], gate:false, gateShared:false, failEnabled:false, failShared:false, failLegacy:false};
    for (const channel of channels) {
      const original = ipcMain._invokeHandlers.get(channel);
      if (!original) throw new Error('missing test handler: '+channel);
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, async (event, ...args) => {
        state.calls.push(channel);
        if (channel === 'xiaozhi:enabled') {
          if (state.gate) await new Promise(resolve => {state.releases.push(resolve);});
          if (state.failEnabled) throw Error('bootstrap_probe_runtime_failure');
        }
        if (channel === 'app:bootstrap') {
          if(state.gateShared)await new Promise(resolve=>state.sharedReleases.push(resolve));
          if(state.failShared)throw Error('bootstrap_probe_shared_failure');
        }
        if (['settings:getDeepSeek','ai:deepTutorListPendingInputs'].includes(channel) && state.failLegacy) throw Error('bootstrap_probe_legacy_failure');
        if (channel === 'ai:deepTutorListPendingInputs') return [{requestId:'owned-request', turnId:'owned-turn', prompt:'旧入口恢复的补充信息', questions:[]}];
        const result = await original(event,...args);
        if(state.sampleShared && channel === 'knowledge:getOverview')return {...result, counts:{...result.counts,resources:7,chunks:11,nodes:13,edges:17}};
        if(state.sampleShared && channel === 'aiConfirmations:list')return [{id:'owned-confirmation',status:'pending'}];
        return result;
      });
    }
  }, ['xiaozhi:enabled','app:bootstrap',...sharedChannels,...legacyChannels,'aiConversations:list']);
}
async function readyPi() {
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await page.waitForFunction(() => document.querySelector('.office-composer-container')?.getAttribute('data-session-id')?.startsWith('aisession_'), null, {timeout:60000});
}
async function configure(options) { await app.evaluate((_, value) => Object.assign(globalThis.bootstrapProbe, {calls:[]}, value), options); }
async function calls() { const value = await app.evaluate(() => globalThis.bootstrapProbe.calls); report.probes.push(value); return value; }
async function waitCall(channel) {
  await app.evaluate(async (_, value) => {
    const deadline=Date.now()+10000;
    while(!globalThis.bootstrapProbe.calls.includes(value)) {
      if(Date.now()>deadline)throw Error('Missing IPC: '+value);
      await new Promise(resolve=>setTimeout(resolve,25));
    }
  },channel);
}
function noLegacy(value) { for (const channel of legacyChannels) assert(!value.includes(channel), 'unexpected old bootstrap read: '+channel); }
async function openStudents() {
  await page.locator('[data-testid=product-rail]:visible').getByTestId('product-nav-students').click();
  await page.getByRole('region',{name:'学生目录',exact:true}).waitFor();
}
try {
  await launch();
  await configure({gate:true,failLegacy:true,sampleShared:true});
  await page.reload();
  await page.getByTestId('pi-runtime-startup').waitFor();
  // Let mount effects and two browser frames settle while the actual runtime IPC stays pending.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const pending = await calls();
  assert(pending.length > 0 && pending.every(channel => channel === 'xiaozhi:enabled'));
  assert.equal(await page.locator('.app-shell').count(),0);
  check('Pending runtime performs no data bootstrap and never exposes the legacy shell');
  await app.evaluate(() => {globalThis.bootstrapProbe.gate=false;globalThis.bootstrapProbe.releases.splice(0).forEach(resolve=>resolve());});
  await readyPi();
  await openStudents();
  await waitCall('app:bootstrap');
  const production = await calls(); noLegacy(production);
  assert.equal(production.filter(x => x === 'app:bootstrap').length,1);
  for(const channel of sharedChannels)assert.equal(production.filter(x=>x===channel).length,1,channel);
  // Pi owns the single initial workspace read; an extra App read is a regression.
  assert.equal(production.filter(x => x === 'aiConversations:list').length,1);
  check('Production retains shared bootstrap and Pi-owned session reads despite failing legacy dependencies');
  await page.locator('[data-testid=product-rail]:visible').getByTestId('nav-analytics').click();
  const content=page.getByTestId('product-space-content');
  await content.getByText('7 个资源 · 11 个切片',{exact:true}).waitFor();
  await content.getByText('13 个节点 · 17 条边',{exact:true}).waitFor();
  await content.getByText('1 个当前待确认动作',{exact:true}).waitFor();
  check('Production analytics retains nonzero shared knowledge and confirmation data through real navigation');
  await configure({failEnabled:true}); await page.reload();
  await page.getByTestId('pi-runtime-retry').waitFor();
  await waitCall('app:bootstrap');
  noLegacy(await calls()); assert.equal(await page.locator('.app-shell').count(),0);
  check('Runtime lookup failure exposes recovery without falling back to legacy reads or shell');
  await configure({failEnabled:false}); await page.getByTestId('pi-runtime-retry').click();
  await readyPi(); noLegacy(await calls());
  check('User retry enters Pi and keeps legacy dependencies isolated');
  await configure({gateShared:true,failShared:true}); await page.reload(); await readyPi();
  await openStudents(); await waitCall('app:bootstrap');
  await app.evaluate(() => {globalThis.bootstrapProbe.gateShared=false;globalThis.bootstrapProbe.sharedReleases.splice(0).forEach(resolve=>resolve());});
  await page.getByTestId('product-space-content').getByText("Error invoking remote method 'app:bootstrap': Error: bootstrap_probe_shared_failure",{exact:true}).waitFor();
  noLegacy(await calls());
  check('Shared bootstrap failure remains visible in the actual student product page');
  await configure({failShared:false}); await page.reload(); await readyPi(); await openStudents(); await waitCall('app:bootstrap');
  await page.getByTestId('student-lifecycle-no-student').waitFor(); noLegacy(await calls());
  check('Reload recovers shared student bootstrap without legacy reads');
  await app.close(); app=undefined;
  await launch(true); await configure({}); await page.reload();
  await page.getByRole('dialog',{name:'小智补充信息'}).getByText('旧入口恢复的补充信息',{exact:true}).waitFor();
  const legacy = await calls();
  for (const channel of ['app:bootstrap',...sharedChannels,...legacyChannels,'aiConversations:list']) assert.equal(legacy.filter(x => x === channel).length,1,channel);
  check('Explicit isolated legacy runtime retains every bootstrap read and pending-input recovery');
  await configure({failLegacy:true}); await page.reload();
  await page.locator('.app-shell').waitFor();
  await waitCall('settings:getDeepSeek');
  await page.waitForFunction(() => !document.querySelector('[aria-label="小智补充信息"]'));
  await app.evaluate(() => {
    const value=globalThis.bootstrapProbe.calls;
    if(!value.includes('knowledge:getOverview') || !value.includes('settings:getDeepSeek') || value.includes('aiConversations:list')) throw Error('legacy failure did not stop bootstrap');
  });
  check('Legacy dependency failure stops subsequent bootstrap reads while retaining its existing shell');
  assert.deepEqual(report.rendererErrors,[]); report.ok=true;
} catch(error) {report.error=String(error.stack||error);process.exitCode=1;}
finally {
  if(app) {if(!report.ok)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});await app.close();}
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,report:path.join(output,'report.json')}));
}
