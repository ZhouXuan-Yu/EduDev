import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
fs.mkdirSync('test-results/xiaozhi-agent', {recursive: true});
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/permission-phase3-production-'));
await build({entryPoints: ['scripts/xiaozhi-agent/permission-phase3-production-worker.ts'], outfile: path.join(output, 'worker.mjs'),
  bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external', logLevel: 'warning'});
await build({entryPoints: ['scripts/xiaozhi-agent/permission-phase3-recovery-worker.ts'], outfile: path.join(output, 'recovery.mjs'),
  bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external', logLevel: 'warning'});
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(output, 'profile'))});app.whenReady().then(async()=>{try{global.__phase3ImportStarted=Date.now();await import(process.argv[3]==='--recover-crash'?${JSON.stringify(pathToFileURL(path.join(output, 'recovery.mjs')).href)}:${JSON.stringify(pathToFileURL(path.join(output, 'worker.mjs')).href)});app.exit(process.exitCode||0);}catch(error){console.error(error.stack);app.exit(1);}});`);
const env = {...process.env}; delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
const timings = [];
async function run(mode, filename) {
  const started = performance.now();
  const log = fs.createWriteStream(path.join(output, filename));
  const child = spawn(createRequire(import.meta.url)('electron'), [bootstrap, output, ...(mode ? [mode] : [])], {env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  child.stdout.pipe(log, {end: false}); child.stderr.pipe(log, {end: false});
  const timeout = setTimeout(() => child.kill(), 240000);
  const code = await new Promise((resolve, reject) => {child.once('error', reject); child.once('exit', resolve);});
  clearTimeout(timeout); await new Promise(resolve => log.end(resolve));
  timings.push({mode: mode || 'primary', exitCode: code, durationMs: performance.now() - started});
  return code;
}
const code = await run('', 'worker.log');
let report; try {report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));} catch {}
let success = code === 0 && report?.success === true && report.checks.length === 8 && report.checks.every(item => item.pass);
if (success) {
  const crashCode = await run('--crash-cut', 'crash-worker.log');
  const expectedCrash = crashCode !== 0 && fs.existsSync(path.join(output, 'crash-checkpoint.json'));
  const recoveryCode = expectedCrash ? await run('--recover-crash', 'recovery-worker.log') : null;
  let recovered; try {recovered = JSON.parse(fs.readFileSync(path.join(output, 'restart-report.json'), 'utf8'));} catch {}
  success = expectedCrash && recoveryCode === 0 && recovered?.success === true;
  fs.writeFileSync(path.join(output, 'combined-report.json'), JSON.stringify({success, checks: report.checks,
    expectedCrash, crashExitCode: crashCode, recoveryExitCode: recoveryCode, recovery: recovered, timings}, null, 2));
}
if (!success) process.exitCode = 1;
console.log(JSON.stringify({success, exitCode: code, passed: success ? report.checks.length + 1 : report?.checks.length, output, root: report?.root, error: report?.error}));
