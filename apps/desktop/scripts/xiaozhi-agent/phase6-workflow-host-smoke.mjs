import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {buildCoreToolManifest} from '../build-core-tool-manifest.mjs';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-workflow-host-evidence-'));
const manifest = await buildCoreToolManifest();
await build({entryPoints: ['scripts/xiaozhi-agent/phase6-workflow-host-worker.ts'], outfile: path.join(output, 'worker.mjs'),
  bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external', logLevel: 'warning',
  plugins: process.env.PHASE6_WORKFLOW_DIAGNOSTIC === '1' ? [{name: 'owned-failed-publisher-stack', setup(builder) {
    builder.onLoad({filter: /[\\/]events[\\/]publisher\.ts$/}, args => {
      const original = fs.readFileSync(args.path, 'utf8'), needle = 'function fail(error:unknown){';
      if (original.split(needle).length !== 2) throw Error('diagnostic_needle_mismatch');
      fs.writeFileSync(path.join(output, 'diagnostic-source.json'), JSON.stringify({source: args.path, sha256: createHash('sha256').update(original).digest('hex'), needle}));
      return {contents: original.replace(needle, needle + "console.error('OWNED_PUBLISHER_FAILURE_STACK',error?.stack);"), loader: 'ts'};
    });
  }}] : []});
fs.copyFileSync('package.json', path.join(output, 'package.json'));
fs.symlinkSync(path.resolve('node_modules'), path.join(output, 'node_modules'), 'junction');
const identity = {manifest, bundleSha256: createHash('sha256').update(fs.readFileSync(path.join(output, 'worker.mjs'))).digest('hex'),
  scripts: ['phase6-workflow-host-smoke.mjs', 'phase6-workflow-host-worker.ts'].map(file => ({file,
    sha256: createHash('sha256').update(fs.readFileSync(path.join('scripts/xiaozhi-agent', file))).digest('hex')}))};
fs.writeFileSync(path.join(output, 'identity.json'), JSON.stringify(identity, null, 2));
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(output, 'profile'))});app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(path.join(output, 'worker.mjs')).href)});app.exit(process.exitCode||0);}catch(error){console.error(error.stack);app.exit(1);}});`);
const env = {...process.env}; delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
const log = fs.createWriteStream(path.join(output, 'worker.log'));
const child = spawn(createRequire(import.meta.url)('electron'), [bootstrap, output], {env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
child.stdout.pipe(log, {end: false}); child.stderr.pipe(log, {end: false});
const timer = setTimeout(() => child.kill(), 240000);
const code = await new Promise((resolve, reject) => {child.once('error', reject); child.once('close', resolve);}); clearTimeout(timer);
await new Promise(resolve => log.end(resolve));
let report; try {report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));} catch {}
const success = code === 0 && report?.success === true && report.checks.length === 5;
fs.writeFileSync(path.join(output, 'process-result.json'), JSON.stringify({success, exitCode: code, reportSuccess: report?.success, checks: report?.checks.length}, null, 2));
if (!success) process.exitCode = 1;
console.log(JSON.stringify({success, exitCode: code, passed: report?.checks.length, output, root: report?.root, error: report?.error}));
