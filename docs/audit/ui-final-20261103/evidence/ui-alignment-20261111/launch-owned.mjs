import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {zeroNetworkBootstrap} from '../../scripts/acceptance/zero-network-bootstrap.mjs';
import {fingerprint} from '../../scripts/acceptance/evidence.mjs';

const require = createRequire(import.meta.url);
const desktop = path.resolve(import.meta.dirname,'../..');
const stage = process.argv[2];
if (!['before','after'].includes(stage)) throw new Error('Expected before or after');
const pins = JSON.parse(fs.readFileSync(path.join(import.meta.dirname,stage+'-pins.json')));
const buildRoot = path.resolve(pins.buildRoot);
if (!buildRoot.startsWith(import.meta.dirname + path.sep)) throw new Error('Build outside owned output');
if (fingerprint(buildRoot).sha256 !== pins.build) throw new Error('Frozen build changed');
const main = path.join(buildRoot,'main/index.js');
if (!fs.existsSync(main)) throw new Error('Build missing');
const output = fs.mkdtempSync(path.join(import.meta.dirname,stage+'-runtime-'));
let data = path.join(output,'data');
let profile = path.join(output,'profile');
let reusedBefore;
if (stage === 'after' && process.argv.includes('--reuse-before')) {
  const before = JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'before-runtime.json')));
  const runtimes = [before];
  const previousRuntime = path.join(import.meta.dirname,'after-runtime.json');
  if (fs.existsSync(previousRuntime)) {
    const previous = JSON.parse(fs.readFileSync(previousRuntime));
    runtimes.push(previous);
    fs.copyFileSync(previousRuntime,path.join(output,'previous-runtime.json'));
  }
  for (const runtime of runtimes) {
    try { process.kill(runtime.pid,0); throw new Error('Close the owned runtime before reuse: '+runtime.pid); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  const beforeRoot = path.resolve(before.output);
  if (!beforeRoot.startsWith(import.meta.dirname + path.sep + 'before-runtime-')) throw new Error('Unexpected owned before directory');
  data = path.join(beforeRoot,'data');
  profile = path.join(beforeRoot,'profile');
  const archive = fs.mkdtempSync(path.join(import.meta.dirname,'before-state-archive-'));
  const proofs = [];
  for (const name of ['data','profile']) {
    const source = path.join(beforeRoot,name);
    const snapshot = fingerprint(source);
    const destination = path.join(archive,name);
    fs.cpSync(source,destination,{recursive:true,force:false,errorOnExist:true});
    if (fingerprint(destination).sha256 !== snapshot.sha256) throw new Error('Owned archive mismatch');
    proofs.push({name,sha256:snapshot.sha256});
  }
  reusedBefore = {pid:before.pid,original:beforeRoot,archive,proofs};
} else {
  fs.mkdirSync(data);
  fs.mkdirSync(profile);
}
const original = zeroNetworkBootstrap({output,main,profile,counter:'__alignmentHttp'});
const launcher = path.join(output,'launch.cjs');
let moduleProbe = '';
if (process.argv.includes('--module-probe')) {
  const probeSource = path.join(import.meta.dirname, 'library-sol/owned-startup-probe.cjs');
  const probeCopy = path.join(output, 'owned-startup-probe.cjs');
  fs.copyFileSync(probeSource, probeCopy, fs.constants.COPYFILE_EXCL);
  moduleProbe = `require(${JSON.stringify(probeCopy)})({electron,output:${JSON.stringify(output)},repository:${JSON.stringify(path.resolve(desktop,'../..'))}});`;
}
const startupProbe = process.argv.includes('--startup-probe') ? `
const probeFs = require('node:fs');
const probeEvents = [];
const originalLock = electron.app.requestSingleInstanceLock;
electron.app.requestSingleInstanceLock = function (...args) {
  const started = performance.now();
  const cpu = process.cpuUsage();
  try { return originalLock.apply(this, args); }
  finally {
    probeEvents.push({operation:'requestSingleInstanceLock', elapsedMs:performance.now()-started, cpu:process.cpuUsage(cpu)});
    probeFs.writeFileSync(${JSON.stringify(path.join(output,'native-startup-probe.json'))}, JSON.stringify({versions:process.versions,events:probeEvents}));
    electron.app.requestSingleInstanceLock = originalLock;
  }
};
` : '';
fs.writeFileSync(launcher,`
const electron = require('electron');
const observedFs = require('node:fs');
const observedCrypto = require('node:crypto');
const observed = {attachedBeforeMain:true, consoleErrors:[], processEvents:[], dropped:0};
function saveObserved(stage) {
  observedFs.writeFileSync(${JSON.stringify(path.join(output,'observed-errors.json'))}, JSON.stringify({
    ...observed, stage, httpAttempts:globalThis.__alignmentHttp?.length ?? null,
  }));
}
function recordObserved(list, value) {
  if (list.length < 100) list.push(value);
  else observed.dropped++;
  saveObserved('running');
}
electron.app.on('web-contents-created', (_event, contents) => {
  const type = contents.getType(), id = contents.id;
  contents.on('console-message', details => {
    if (details.level === 'error') recordObserved(observed.consoleErrors, {
      webContentsId:id, type, sourceProtocol:String(details.sourceId).split(':')[0],
      messageSha256:observedCrypto.createHash('sha256').update(details.message).digest('hex'),
    });
  });
  contents.on('render-process-gone', (_event, details) => recordObserved(observed.processEvents,
    {scope:'renderer',webContentsId:id,type,reason:details.reason,exitCode:details.exitCode}));
});
electron.app.on('child-process-gone', (_event, details) => recordObserved(observed.processEvents,
  {scope:'child',type:details.type,reason:details.reason,exitCode:details.exitCode}));
electron.app.on('will-quit', () => saveObserved('closing'));
saveObserved('before-main');
${startupProbe}
${moduleProbe}
electron.app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', () => {
    saveObserved('window-loaded');
    window.setTitle(${JSON.stringify('小智 · UI对齐验收 · '+stage)});
    window.show();
    window.focus();
  });
});
require(${JSON.stringify(original)});
`);
const env = {...process.env};
for (const name of Object.keys(env)) {
  if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name) || name.startsWith('OMNI_EDU_') ||
      ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(name)) delete env[name];
}
Object.assign(env,{
  OMNI_EDU_DATA_ROOT:data,
  OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
  OMNI_EDU_XIAOZHI_PI:'1',
  OMNI_EDU_E2E_VISIBLE:'1',
  OMNI_EDU_E2E_DIALOG_MODE:'1',
  OMNI_EDU_SKIP_DOTENV:'1',
  OMNI_EDU_BOOK_WRITEBACK:'0',
  DEEPSEEK_API_KEY:'',
});
const stdout = fs.openSync(path.join(output,'stdout.log'),'a');
const stderr = fs.openSync(path.join(output,'stderr.log'),'a');
const child = spawn(require('electron'),[launcher,'--user-data-dir='+profile,'--force-device-scale-factor=1','--remote-debugging-port=0'],{
  cwd:desktop,env,detached:true,windowsHide:false,stdio:['ignore',stdout,stderr],
});
child.unref();
fs.closeSync(stdout);
fs.closeSync(stderr);
const metadata = {stage,pid:child.pid,main,output,data,profile,startupProbe:Boolean(startupProbe),moduleProbe:Boolean(moduleProbe),build:fingerprint(buildRoot).sha256,...(reusedBefore?{reusedBefore}:{})};
fs.writeFileSync(path.join(import.meta.dirname,stage+'-runtime.json'),JSON.stringify(metadata,null,2));
console.log(JSON.stringify(metadata));
