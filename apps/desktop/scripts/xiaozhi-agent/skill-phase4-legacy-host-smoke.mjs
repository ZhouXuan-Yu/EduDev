import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// Original host tests now transitively load merged Electron utilityProcess and JSON modules.
// Compile as production does and run in a real isolated Electron main process.
const sourceDb = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'xiaozhi-phase3-production-JhTgs2/data/app.db'));
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/skill-phase4-legacy-host-'));
const checks = [];
for (const name of ['pi-skill-management-api-smoke', 'pi-skill-host-lock-smoke']) {
  const entry = path.resolve(`scripts/xiaozhi-agent/${name}.mjs`);
  const bundle = path.join(output, `${name}.mjs`);
  await build({entryPoints: [entry], outfile: bundle, bundle: true, packages: 'external', platform: 'node', target: 'node24',
    format: 'esm', logLevel: 'warning', plugins: [{name: 'retain-entry-location', setup(builder) {
      builder.onLoad({filter: /\.mjs$/}, args => args.path === entry ? {
        contents: fs.readFileSync(entry, 'utf8').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(entry).href)), loader: 'js',
      } : undefined);
    }}]});
  const bootstrap = path.join(output, `${name}.cjs`);
  fs.writeFileSync(bootstrap, `const {app,net}=require('electron');app.setPath('userData',${JSON.stringify(path.join(output, name+'-profile'))});net.fetch=async()=>{throw Error('network forbidden in legacy regression');};app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(bundle).href)});app.exit(process.exitCode||0);}catch(e){console.error(e.stack);app.exit(1);}});`);
  const env = {...process.env, DEEPSEEK_API_KEY: 'synthetic-legacy-blocked'};
  delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
  const log = fs.createWriteStream(path.join(output, `${name}.log`));
  const child = spawn(createRequire(import.meta.url)('electron'), [bootstrap, sourceDb], {env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  child.stdout.pipe(log, {end: false}); child.stderr.pipe(log, {end: false});
  const timer = setTimeout(() => child.kill(), 90000);
  const code = await new Promise((resolve, reject) => {child.once('error', reject); child.once('exit', resolve);});
  clearTimeout(timer); await new Promise(resolve => log.end(resolve));
  const lines = fs.readFileSync(path.join(output, `${name}.log`), 'utf8').trim().split(/\r?\n/);
  let summary;
  try { summary = JSON.parse(lines.findLast(line => line.startsWith('{"success"'))); } catch {}
  const expected = name === 'pi-skill-management-api-smoke' ? 15 : 9;
  const pass = code === 0 && summary?.success === true && summary.checks === expected;
  checks.push({name, pass, passed: summary?.checks, exitCode: code, log: path.join(output, `${name}.log`), summary});
  if (!pass) break;
}
const success = checks.length === 2 && checks.every(check => check.pass);
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({success, sourceDb, checks,
  boundary: 'Original assertions run in actual Electron with actual Store/Host and copied historical synthetic SQLite plus immutable Skill files. Host-lock controls only startup barrier. No model calls.'}, null, 2));
if (!success) process.exitCode = 1;
console.log(JSON.stringify({success, checks, output}));
