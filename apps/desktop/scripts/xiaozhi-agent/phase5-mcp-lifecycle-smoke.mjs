import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/phase5-mcp-lifecycle-'));
await build({entryPoints: ['scripts/xiaozhi-agent/phase5-mcp-lifecycle-worker.ts'], outfile: path.join(output, 'worker.mjs'),
  bundle: true, format: 'esm', platform: 'node', target: 'node24', packages: 'external', logLevel: 'warning'});
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(output, 'profile'))});app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(path.join(output, 'worker.mjs')).href)});app.exit(process.exitCode||0);}catch(error){console.error(error.stack);app.exit(1);}});`);
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE/iu.test(name)));
const stream = fs.createWriteStream(path.join(output, 'worker.log'));
const child = spawn(createRequire(import.meta.url)('electron'), [bootstrap, output], {env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
child.stdout.pipe(stream, {end: false}); child.stderr.pipe(stream, {end: false});
const timer = setTimeout(() => child.kill(), 180000);
const code = await new Promise((resolve, reject) => {child.once('error', reject); child.once('exit', resolve);});
clearTimeout(timer); await new Promise(resolve => stream.end(resolve));
let report; try {report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));} catch {}
const success = code === 0 && report?.success && report.checks.length === 11;
if (!success) process.exitCode = 1;
console.log(JSON.stringify({success, exitCode: code, passed: report?.checks.length, output, root: report?.root, error: report?.error}));
