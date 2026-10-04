// Actual Electron-main compatibility; isolated module test, not a production UI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptRoot, '../..');
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/office-plan/hana-electron-'));
let source = fs.readFileSync(path.join(scriptRoot, 'hana-tools-smoke.mjs'), 'utf8')
  .replace("import './register-source.mjs';", '')
  .replaceAll("'../../src/", `'${appRoot.replaceAll('\\', '/')}/src/`)
  .replace("const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');", `const root = ${JSON.stringify(appRoot)};`);
source = `import { app } from 'electron';\napp.setPath('userData', ${JSON.stringify(path.join(output, 'user-data'))});\n` + source;
const entry = path.join(output, 'entry.mjs'); fs.writeFileSync(entry, source);
let application;
const result = { suite: 'hana-tools-electron-main', success: false, boundaries: ['Module compatibility in isolated Electron main', 'No production IPC/UI or OS sandbox claim'] };
try {
  await build({ configFile: false, logLevel: 'error', build: {
    ssr: true, target: 'node22', outDir: output, emptyOutDir: false,
    rollupOptions: { input: entry, external: ['electron', /^node:/, /^(jsdom|undici|ipaddr.js)(\/|$)/],
      output: { format: 'es', entryFileNames: 'main.mjs', inlineDynamicImports: true } },
  } });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  application = await electron.launch({ args: [path.join(output, 'main.mjs')], env, timeout: 30000 });
  const report = await application.evaluate(async () => {
    const until = Date.now() + 30000;
    while (!globalThis.hanaToolsHostReport && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 50));
    return globalThis.hanaToolsHostReport;
  });
  assert(report?.success, report?.error || 'Missing Electron-host report');
  Object.assign(result, { success: true, electron: report.electron, node: report.node, checks: report.checks,
    reportPath: path.relative(appRoot, report.reportPath) });
} catch (error) { result.failure = String(error.stack).slice(0, 3000); process.exitCode = 1; }
finally {
  await application?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, report: path.relative(appRoot, path.join(output, 'report.json')) }));
}
