/** A07/A08 component-tier Electron regression. Controlled events, no production IPC/provider. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {_electron as electron} from 'playwright';
import {fingerprint} from '../acceptance/evidence.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(desktop, 'test-results/ui-final-process-clock-'));
const source = fingerprint(path.join(desktop, 'src')).sha256;
const report = {success: false, output, source, checks: [], screens: [], errors: [], modelCalls: 0,
  tier: 'component-electron-controlled-events',
  boundaries: ['Original production components, reducer and CSS in isolated Electron.',
    'Controlled event fixtures prove presentation behavior. No production host, provider or persistence acceptance.']};
const write = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const check = name => {report.checks.push({name, pass: true}); write(); console.log('PASS ' + name);};
let server, app;
try {
  fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><html lang="zh-CN" data-edu-modern data-theme="light"><head><meta charset="utf-8"><title>小智 · 过程计时组件验收</title></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>');
  fs.writeFileSync(path.join(output, 'entry.tsx'), `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import '/src/renderer/heroui-styles';
import '/src/renderer/ui-system/base.css';
import '/src/renderer/styles.css';
import {OfficeAgentTurn} from '/src/renderer/components/office/OfficeAgentTurn';
import {applyXiaozhiEvent} from '/src/shared/xiaozhi-projection';
function Harness() {
  const [turn, setTurn] = useState({id:'initial',status:'running',items:[]});
  window.clockFixture = {
    reset: id => setTurn({id,status:'running',items:[]}),
    event: event => setTurn(previous => applyXiaozhiEvent(previous,event)),
    read: () => turn,
  };
  return <main style={{maxWidth:840,margin:'32px auto',padding:24}}>
    <p>组件验收 · 受控事件，无模型调用</p>
    <OfficeAgentTurn turn={turn} sessionId="component-fixture" />
  </main>;
}
createRoot(document.getElementById('root')).render(<Harness />);
`);
  server = await createServer({configFile: false, root: desktop, plugins: [react()],
    optimizeDeps: {include: ['react', 'react-dom/client', '@heroui/react', 'lucide-react']},
    server: {host: '127.0.0.1', port: 0}, logLevel: 'error'});
  await server.listen();
  const base = server.resolvedUrls.local[0];
  const url = new URL(path.relative(desktop, path.join(output, 'index.html')).replaceAll('\\', '/'), base).href;
  fs.writeFileSync(path.join(output, 'main.cjs'), `
const {app,BrowserWindow,session}=require('electron');
app.setPath('userData',${JSON.stringify(path.join(output, 'profile'))});
app.whenReady().then(()=>{
 session.defaultSession.webRequest.onBeforeRequest((details,done)=>{
   const url=new URL(details.url);done({cancel:!['http:','ws:'].includes(url.protocol)||url.hostname!=='127.0.0.1'});
 });
 const window=new BrowserWindow({width:1366,height:768,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.loadURL(${JSON.stringify(url)});
});
app.on('window-all-closed',()=>app.quit());
`);
  const env = {...process.env};
  for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)
    || key.startsWith('OMNI_EDU_') || ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE'].includes(key)) delete env[key];
  app = await electron.launch({args: [path.join(output, 'main.cjs'), '--force-device-scale-factor=1'],
    cwd: desktop, env, timeout: 30000});
  const page = await app.firstWindow();
  page.on('pageerror', error => report.errors.push(error.stack || error.message));
  page.on('console', message => {if (message.type() === 'error') report.errors.push(message.text());});
  await page.waitForFunction(() => Boolean(window.clockFixture));
  const baseTime = Date.now() - 3000;
  async function events(values) {
    for (const value of values) await page.evaluate(value => window.clockFixture.event(value), value);
  }
  async function reset(id) {
    await page.evaluate(id => window.clockFixture.reset(id), id);
    await page.waitForFunction(id => window.clockFixture.read().id === id, id);
  }
  async function capture(name) {
    for (const [width, height] of [[1366, 768], [1920, 1080]]) {
      await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
      await page.waitForFunction(width => innerWidth === width, width);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await page.locator('details, summary').count(), 0);
      const file = `${name}-${width}.png`;
      await page.screenshot({path: path.join(output, file), animations: 'disabled'});
      report.screens.push(file);
    }
  }
  const tool = [
    {kind: 'tool_start', callId: 'read', tool: 'office_read_attachment', capturedAt: baseTime},
    {kind: 'tool_end', callId: 'read', tool: 'office_read_attachment', success: true},
  ];
  await reset('explicit');
  await events([{kind: 'assistant_start', segment: 1},
    {kind: 'assistant_phase', segment: 1, phase: 'commentary', since: baseTime},
    {kind: 'text_delta', delta: '先核对教学资料，再整理教学建议。', capturedAt: baseTime}, ...tool]);
  await page.getByTestId('reply-process-summary').waitFor();
  assert.equal(await page.getByTestId('agent-trace-toggle').count(), 0);
  assert.equal(await page.getByTestId('agent-tool-glyph').getAttribute('data-tool-kind'), 'file-read');
  await capture('live');
  check('public process is ordinary prose with actual tool identity before final boundary');
  await events([{kind: 'assistant_end', segment: 1, final: false}, {kind: 'assistant_start', segment: 2},
    {kind: 'assistant_phase', segment: 2, phase: 'final_answer', since: baseTime + 4000},
    {kind: 'text_delta', delta: '建议先通过实验观察浮力。'}]);
  const toggle = page.getByTestId('agent-trace-toggle');
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await toggle.getByTestId('model-thinking-duration').textContent(), '4 秒');
  await page.getByTestId('agent-reply-body').waitFor();
  await capture('handoff');
  check('explicit boundary folds before body completion and freezes four-second public clock at top');
  await toggle.focus();
  await toggle.press('Enter');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await events([{kind: 'text_delta', delta: '随后比较重力与浮力。'},
    {kind: 'assistant_end', segment: 2, final: true, since: baseTime + 9000},
    {kind: 'status', status: 'completed', finishedAt: baseTime + 10000}]);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await toggle.getByTestId('model-thinking-duration').textContent(), '4 秒');
  assert((await page.getByTestId('agent-reply-body').textContent()).includes('随后比较重力与浮力。'));
  await capture('manual-open-completed');
  check('keyboard reopening survives later body deltas and terminal completion without timing growth');
  await toggle.press('Space');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await reset('legacy');
  await events([...tool, {kind: 'assistant_start', segment: 1}, {kind: 'text_delta', delta: '兼容回复正文。'},
    {kind: 'assistant_end', segment: 1, final: true, since: baseTime + 9000},
    {kind: 'status', status: 'completed', finishedAt: baseTime + 10000}]);
  await page.getByTestId('agent-reply-body').waitFor();
  assert.equal(await page.getByTestId('model-thinking-duration').count(), 0);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await capture('legacy');
  check('legacy execution retains body and collapsed tools without claiming answer-inclusive duration');
  for (const status of ['failed', 'interrupted']) {
    await reset(status);
    await events([...tool, {kind: 'status', status, finishedAt: baseTime + 4000}]);
    await toggle.waitFor();
    assert.equal(await toggle.getByTestId('model-thinking-duration').textContent(), '4 秒');
    assert((await toggle.textContent()).includes(status === 'failed' ? '处理未完成' : '处理已停止'));
    await capture(status);
    check(status + ' freezes real public execution at terminal boundary');
  }
  assert.equal(await page.getByTestId('office-turn-duration').count(), 0);
  assert.equal(report.errors.length, 0);
  assert.equal(fingerprint(path.join(desktop, 'src')).sha256, source);
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  if (server) await server.close();
  write();
  console.log(JSON.stringify({success: report.success, checks: report.checks.length, output, error: report.error}));
}
