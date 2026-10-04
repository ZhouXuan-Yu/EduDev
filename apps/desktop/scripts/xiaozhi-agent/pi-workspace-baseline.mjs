import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { captureWorkspaceMetrics } from './capture-workspace-metrics.mjs';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(desktop, 'test-results/xiaozhi-agent/pi-workspace-baseline-'));
const env = { ...process.env, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_DIALOG_MODE: '1',
  OMNI_EDU_DATA_ROOT: path.join(output, 'data'), OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..') };
delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
let app;
try {
  app = await electron.launch({ args: [path.join(desktop, 'out/main/index.js'), `--user-data-dir=${path.join(output, 'profile')}`], env, timeout: 60000 });
  const page = await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 60000 });
  await page.getByTestId('office-conversation').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
  const metrics = [];
  for (const [width, height] of [[1366,768],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    metrics.push(await captureWorkspaceMetrics(page, app, output, `before-${width}x${height}`));
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ success: true, metrics,
    boundary: 'Read-only actual empty workspace geometry; no provider request or real teacher data; reference DPI unknown' }, null, 2));
  console.log(JSON.stringify({ success: true, report: path.relative(desktop, path.join(output, 'report.json')) }));
} catch (error) { process.exitCode = 1; console.error(String(error)); }
finally { await app?.close().catch(() => {}); }
