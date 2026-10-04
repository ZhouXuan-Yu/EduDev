import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { _electron as electron } from 'playwright';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceArg = process.argv.indexOf('--projection');
assert(sourceArg >= 0 && process.argv[sourceArg + 1], 'Supply a real successful P0 public-projection.json with --projection');
const sourceFile = path.resolve(appRoot, process.argv[sourceArg + 1]);
const source = await readFile(sourceFile, 'utf8');
const projection = JSON.parse(source);
const sourceReport = JSON.parse(await readFile(path.join(path.dirname(sourceFile), 'report.json'), 'utf8'));
assert(sourceReport.success === true && sourceReport.checks.some(check => check.name === 'real-stream-canonical-projection-idempotence' && check.pass), 'Source must have passed real-provider projection verification');
assert.equal(projection.schemaVersion, 'xiaozhi.office.projection.v1');
assert.equal(projection.provider, 'deepseek');
const resultParent = path.join(appRoot, 'test-results/office-plan');
await mkdir(resultParent, { recursive: true });
const runRoot = await mkdtemp(path.join(resultParent, 'office-ui-'));
const checks = [];
let server, app;
const report = { suite: 'office-ui-components-electron', timestamp: new Date().toISOString(),
  sourceProjection: path.relative(appRoot, sourceFile), sourceSha256: createHash('sha256').update(source).digest('hex'),
  provider: projection.provider, model: projection.model, success: false, checks,
  boundaries: ['Component-only Electron instance; production Office Host/IPC not integrated', 'Message fixture is actual successful DeepSeek history; interaction fault callbacks are synthetic', 'No full desktop visual-parity or Windows OS sandbox claim'] };

try {
  await writeFile(path.join(runRoot, 'projection.json'), source);
  await writeFile(path.join(runRoot, 'index.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>小智办公组件验收</title></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>');
  await writeFile(path.join(runRoot, 'entry.tsx'), `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@heroui/react/styles';
import '/src/renderer/heroui-pro/heroui-pro.min.css';
import { OfficeConversation } from '/src/renderer/components/office/OfficeConversation';
import { OfficeComposer } from '/src/renderer/components/office/OfficeComposer';
import fixture from './projection.json';
const probe = { sends: [], stops: 0, models: [], failSend: false, failStop: false, deferred: false, release: null };
function Harness() {
  const [history, setHistory] = useState(fixture);
  const [status, setStatus] = useState('completed');
  const [model, setModel] = useState(fixture.model);
  window.testOfficeUI = { probe, setHistory, setStatus };
  return <div className="test-office-shell">
    <OfficeConversation projection={history} />
    <OfficeComposer sessionId={history.threadId} status={status} model={model} permissionLabel="只读" models={[
      { id: fixture.model, label: fixture.model }, { id: 'synthetic-menu-choice', label: '菜单边界测试模型' }
    ]} onSubmit={async prompt => {
      probe.sends.push(prompt);
      if (probe.deferred) await new Promise(resolve => { probe.release = resolve; });
      if (probe.failSend) throw Error('synthetic failure');
    }} onStop={async () => { probe.stops++; if (probe.failStop) throw Error('synthetic stop failure'); setStatus('interrupted'); }}
      onModelChange={value => { probe.models.push(value); setModel(value); }} />
  </div>;
}
const style = document.createElement('style');
style.textContent = 'html,body,#root{margin:0;height:100%;overflow:hidden;background:#fff}.test-office-shell{height:100%;display:flex;flex-direction:column;min-height:0}.test-office-shell>.office-conversation{flex:1;min-height:0;height:auto}';
document.head.append(style);
createRoot(document.getElementById('root')).render(<React.StrictMode><Harness /></React.StrictMode>);
`);
  server = await createServer({ configFile: false, root: appRoot, plugins: [react()], server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  const baseUrl = server.resolvedUrls.local[0];
  const url = new URL(path.relative(appRoot, path.join(runRoot, 'index.html')).split(path.sep).join('/'), baseUrl).href;
  await writeFile(path.join(runRoot, 'electron-main.cjs'), `const { app, BrowserWindow } = require('electron');
app.setPath('userData', ${JSON.stringify(path.join(runRoot, 'user-data'))});
app.whenReady().then(async () => { const window = new BrowserWindow({ width: 1366, height: 768, show: false,
  webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await window.loadURL(${JSON.stringify(url)}); });
app.on('window-all-closed', () => app.quit());`);
  const childEnv = { ...process.env }; delete childEnv.ELECTRON_RUN_AS_NODE; delete childEnv.NODE_OPTIONS;
  app = await electron.launch({ args: [path.join(runRoot, 'electron-main.cjs')], env: childEnv, timeout: 30000 });
  const window = await app.firstWindow();
  const runtimeErrors = [];
  window.on('pageerror', error => runtimeErrors.push(error.message));
  await window.getByTestId('office-prompt-input').waitFor();
  const messages = projection.turns.flatMap(turn => turn.items).filter(item => item.kind === 'message');
  assert.equal(await window.locator('[data-slot="chat-message-user"], [data-slot="chat-message-assistant"]').count(), messages.length);
  for (const message of messages) assert.equal(await window.locator(`[data-item-id="${message.id}"]`).count(), 1);
  assert((await window.getByTestId('office-conversation').innerText()).includes('连接正常'));
  const commentary = projection.turns.flatMap(turn => turn.items).find(item => item.phase === 'commentary');
  assert(commentary && (await window.locator(`[data-item-id="${commentary.id}"]`).innerText()).includes('weekly.txt'));
  assert.equal(await window.locator('[data-phase="commentary"]').count(), messages.filter(item => item.phase === 'commentary').length);
  assert.equal(await window.locator('[data-slot="chat-tool"]').count(), projection.turns.flatMap(turn => turn.items).filter(item => item.kind === 'tool').length);
  checks.push({ name: 'real-provider-history-stable-items-and-phases', pass: true, messages: messages.length });

  await window.evaluate(history => { history.privateReasoning = 'PRIVATE_REASONING_SENTINEL'; history.turns[0].items[0].rawResponse = 'PRIVATE_RAW_SENTINEL'; window.testOfficeUI.setHistory(history); }, structuredClone(projection));
  assert(!(await window.locator('body').innerText()).includes('PRIVATE_'));
  checks.push({ name: 'unknown-private-fields-not-rendered', pass: true });
  const input = window.getByTestId('office-prompt-input');
  await input.fill('中文候选词确认');
  await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, isComposing: true })));
  assert.equal(await window.evaluate(() => window.testOfficeUI.probe.sends.length), 0);
  assert.equal(await input.inputValue(), '中文候选词确认');
  await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true })));
  assert.equal(await window.evaluate(() => window.testOfficeUI.probe.sends.length), 0);
  await input.press('Shift+Enter');
  assert((await input.inputValue()).includes('\n'));
  checks.push({ name: 'ime-enter-229-and-shift-newline', pass: true });

  await window.evaluate(() => { window.testOfficeUI.probe.deferred = true; });
  await input.fill('冻结消息快照');
  await input.press('Enter');
  assert.equal(await input.inputValue(), '');
  await input.fill('下一条独立草稿');
  await input.press('Enter');
  assert.equal(await window.evaluate(() => window.testOfficeUI.probe.sends.length), 1);
  assert.equal(await input.inputValue(), '下一条独立草稿');
  await window.evaluate(() => { window.testOfficeUI.probe.release(); window.testOfficeUI.probe.deferred = false; });
  checks.push({ name: 'send-clears-freezes-and-rejects-reentry', pass: true });

  await window.evaluate(() => { window.testOfficeUI.probe.failSend = true; });
  await input.fill('失败发送快照');
  await input.press('Enter');
  await window.getByRole('button', { name: '重试发送', exact: true }).waitFor();
  await input.fill('失败后的新草稿');
  await window.evaluate(() => { window.testOfficeUI.probe.failSend = false; });
  await window.getByRole('button', { name: '重试发送', exact: true }).click();
  assert.equal(await input.inputValue(), '失败后的新草稿');
  assert.equal(await window.evaluate(() => window.testOfficeUI.probe.sends.at(-1)), '失败发送快照');
  checks.push({ name: 'failed-send-retry-separate-from-new-draft', pass: true });

  await window.getByRole('button', { name: '选择模型', exact: true }).click();
  await window.getByRole('menuitemradio', { name: '菜单边界测试模型', exact: true }).click();
  assert.equal(await window.evaluate(() => window.testOfficeUI.probe.models.at(-1)), 'synthetic-menu-choice');
  await window.evaluate(() => { window.testOfficeUI.setStatus('running'); window.testOfficeUI.probe.failStop = true; });
  await window.waitForFunction(() => document.querySelector('[aria-label="选择模型"]')?.disabled === true);
  assert.equal(await window.getByRole('button', { name: '选择模型', exact: true }).isDisabled(), true, 'Active run freezes model selection');
  await window.getByRole('button', { name: '停止本轮', exact: true }).click();
  await window.getByRole('alert').filter({ hasText: '停止请求未送达' }).waitFor();
  assert.equal(await window.getByRole('button', { name: '停止本轮', exact: true }).isDisabled(), false);
  await window.evaluate(() => { window.testOfficeUI.probe.failStop = false; });
  await window.getByRole('button', { name: '停止本轮', exact: true }).click();
  await window.getByRole('button', { name: '发送消息', exact: true }).waitFor();
  assert.equal(await input.inputValue(), '失败后的新草稿');
  checks.push({ name: 'model-menu-running-freeze-and-stop-error-reconcile', pass: true });

  const longHistory = structuredClone(projection);
  const lastTurn = longHistory.turns.at(-1);
  lastTurn.items.push({ id: 'scroll-test-text', kind: 'message', role: 'assistant', phase: 'final_answer', text: Array.from({ length: 100 }, (_, i) => `滚动边界测试第 ${i + 1} 行。`).join('\n\n') });
  await window.evaluate(history => window.testOfficeUI.setHistory(history), longHistory);
  const scroll = window.getByTestId('office-conversation');
  await window.waitForFunction(() => { const e = document.querySelector('[data-testid="office-conversation"]'); return e.scrollHeight > e.clientHeight * 2 && e.scrollTop > 200; });
  await scroll.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll', { bubbles: true })); });
  await window.getByRole('button', { name: '回到最新消息', exact: true }).waitFor({ state: 'visible' });
  longHistory.turns.at(-1).items.at(-1).text += '\n\n新增的公开正文片段。';
  await window.evaluate(history => window.testOfficeUI.setHistory(history), longHistory);
  await window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert((await scroll.evaluate(element => element.scrollTop)) < 10);
  await window.getByRole('button', { name: '回到最新消息', exact: true }).click();
  await window.waitForFunction(() => { const e = document.querySelector('[data-testid="office-conversation"]'); return e.scrollHeight - e.clientHeight - e.scrollTop < 10; });
  checks.push({ name: 'scroll-preserves-user-position-and-jump-latest', pass: true });

  await window.evaluate(() => { window.testOfficeUI.probe.deferred = true; window.testOfficeUI.probe.failSend = true; });
  await input.fill('旧会话中的待发送快照');
  await input.press('Enter');
  const differentSession = structuredClone(projection); differentSession.threadId = 'synthetic-session-switch';
  await window.evaluate(history => window.testOfficeUI.setHistory(history), differentSession);
  await window.waitForFunction(() => document.querySelector('.office-composer-container')?.dataset.sessionId === 'synthetic-session-switch');
  assert.equal(await input.inputValue(), '');
  await input.fill('新会话的草稿');
  await window.evaluate(() => { window.testOfficeUI.probe.release(); window.testOfficeUI.probe.deferred = false; });
  await window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await input.inputValue(), '新会话的草稿');
  assert.equal(await window.getByRole('button', { name: '重试发送', exact: true }).count(), 0);
  await window.evaluate(() => { window.testOfficeUI.probe.failSend = false; });
  checks.push({ name: 'session-switch-isolates-draft-and-late-send-failure', pass: true });

  await window.evaluate(history => window.testOfficeUI.setHistory(history), projection);
  await window.getByRole('button', { name: '选择模型', exact: true }).click();
  await window.getByRole('menuitemradio', { name: projection.model, exact: true }).click();
  await input.fill('整理这些资料，生成本周工作报告');
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await window.setViewportSize({ width, height });
    const geometry = await window.getByTestId('office-composer').boundingBox();
    assert(geometry && geometry.y >= 0 && geometry.y + geometry.height <= height);
    const clipped = await window.getByTestId('office-composer').evaluate(element => {
      const shell = element.querySelector('[data-slot="prompt-input-shell"]').getBoundingClientRect();
      return [...element.querySelectorAll('button,textarea')].filter(control => {
        const box = control.getBoundingClientRect();
        return box.top < shell.top - 1 || box.bottom > shell.bottom + 1 || box.left < shell.left - 1 || box.right > shell.right + 1;
      }).map(control => control.getAttribute('aria-label') ?? control.textContent);
    });
    assert.deepEqual(clipped, [], 'Composer child controls must be inside the visible shell');
    assert.equal(await window.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await window.screenshot({ path: path.join(runRoot, `components-${width}x${height}.png`) });
  }
  checks.push({ name: 'two-desktop-viewports-composer-reachable', pass: true });
  assert.deepEqual(runtimeErrors, []);
  report.success = true;
} catch (error) {
  report.failure = String(error.stack ?? error.message).slice(0, 2500);
  await app?.windows()[0]?.screenshot({ path: path.join(runRoot, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await app?.close();
  await server?.close();
  await writeFile(path.join(runRoot, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ suite: report.suite, success: report.success, passed: checks.length, report: path.relative(appRoot, path.join(runRoot, 'report.json')), failure: report.failure }));
}
