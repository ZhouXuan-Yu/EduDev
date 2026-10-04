// Actual isolated Electron main; executes the same real-provider instances.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { _electron as electron } from 'playwright';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptRoot, '../..');
fs.mkdirSync(path.join(appRoot, 'test-results/xiaozhi-agent'), { recursive: true });
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/xiaozhi-agent/pi-electron-'));
let source = fs.readFileSync(path.join(scriptRoot, 'pi-education-live-smoke.mjs'), 'utf8')
  .replace("import '../office-agent/register-source.mjs';", '')
  .replace("'../../src/", `'${appRoot.replaceAll('\\', '/')}/src/`)
  .replace("const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');", `const appRoot = ${JSON.stringify(appRoot)};`);
source = `import { app } from 'electron';\napp.setPath('userData', ${JSON.stringify(path.join(output, 'user-data'))});\n` + source;
const entry = path.join(output, 'entry.mjs'); fs.writeFileSync(entry, source);
let application;
const report = { suite: 'pi-education-electron-main', success: false,
  boundaries: ['Actual Electron main with private synthetic materials and real DeepSeek', 'No formal page or VPN-off claim'] };
try {
  await build({ configFile: false, logLevel: 'error', build: {
    ssr: true, target: 'node22', outDir: output, emptyOutDir: false,
    rollupOptions: { input: entry, external: ['electron', /^node:/, /^@earendil-works\//, 'jsdom', 'undici', 'ipaddr.js'],
      output: { format: 'es', entryFileNames: 'main.mjs', inlineDynamicImports: true } },
  } });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  application = await electron.launch({ args: [path.join(output, 'main.mjs')], env, timeout: 60000 });
  const until = Date.now() + 360000;
  let inner;
  while (Date.now() < until) {
    inner = await application.evaluate(() => globalThis.piEducationHostReport);
    if (inner) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert(inner?.success, inner?.failure || 'Missing Electron Pi instance report');
  Object.assign(report, { success: true, electron: inner.electron, node: inner.node, model: inner.model,
    checks: inner.checks, instanceReport: path.relative(appRoot, inner.reportPath) });
} catch (error) { report.failure = String(error.stack).slice(0, 3500).replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]'); process.exitCode = 1; }
finally {
  await application?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, reportPath: path.relative(appRoot, path.join(output, 'report.json')) }));
}
