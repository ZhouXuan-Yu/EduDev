/** Preparation defaults to offline --check. Only the parent runs --run after freezing
 * --source-sha256. Four real print jobs, zero models; no product App/out entry point.
 * Evidence is C2c PDF feasibility only, never Office approval/Pi acceptance. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn, spawnSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {build} from 'esbuild';

const self = fileURLToPath(import.meta.url), desktop = path.resolve(path.dirname(self), '../..');
const readback = path.join(path.dirname(self), 'paper-layout-pdf-readback.py');
const args = process.argv.slice(2), mode = args[0] || '--check';
if (!['--check', '--run'].includes(mode)) throw Error('Use --check or --run --source-sha256 <offline fingerprint> [--python <existing executable>]');
const options = {};
for (let i = 1; i < args.length; i += 2) {
  if (!['--source-sha256', '--python'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw Error('Unknown, missing or duplicate option');
  options[args[i]] = args[i + 1];
}
if (mode === '--run' && !/^[a-f0-9]{64}$/i.test(options['--source-sha256'] || '')) throw Error('--run requires explicit --source-sha256 from reviewed --check');
const python = options['--python'] || process.env.OMNI_EDU_FIXTURE_PYTHON || 'C:/Python314/python.exe';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2), {flag: 'wx'});
function pythonCall(argv) {
  const result = spawnSync(python, ['-B', ...argv], {encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1048576});
  if (result.error || result.status !== 0) throw Error(`Existing Python check failed: ${result.error || result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

/** Exit 0 alone is not completion: all durable child facts and four PDFs are required. */
function completionErrors(child, ids, pdfs, staging) {
  const errors = [];
  if (!child || typeof child !== 'object') return ['Missing or invalid electron-report.json'];
  if (child.success !== true || child.finalized !== true) errors.push('Child did not finalize successfully');
  if (child.printJobs !== 4 || child.completedPrintJobs !== 4) errors.push('Expected four started and four completed real print jobs');
  if (child.modelCalls !== 0 || child.fetchAttempts !== 0) errors.push('Unexpected model/network counter');
  if (!Array.isArray(child.cases) || child.cases.length !== ids.length
    || child.cases.some((item, index) => item?.id !== ids[index] || item.blockedResources !== 0 || !(item.bytes > 5))) errors.push('Missing/invalid four-case completion receipts');
  if (child.leaks?.windows !== 0 || !Array.isArray(child.leaks?.staging) || child.leaks.staging.length) errors.push('Child did not attest zero hidden windows and staging');
  if (staging.length) errors.push('Parent found leaked staging: ' + staging.join(', '));
  for (const id of ids) if (pdfs[id]?.valid !== true) errors.push('Missing/invalid final PDF: ' + id);
  for (const item of Array.isArray(child.cases) ? child.cases : []) {
    if (pdfs[item?.id]?.bytes !== item?.bytes) errors.push('Final PDF byte count differs from child receipt: ' + item?.id);
  }
  return errors;
}
function completionSelfCheck() {
  const ids = ['portrait-1', 'portrait-2', 'landscape-1', 'landscape-2'];
  const pdfs = Object.fromEntries(ids.map(id => [id, {valid: true, bytes: 100}]));
  const child = {success: true, finalized: true, printJobs: 4, completedPrintJobs: 4, modelCalls: 0, fetchAttempts: 0,
    cases: ids.map(id => ({id, bytes: 100, blockedResources: 0})), leaks: {windows: 0, staging: []}};
  assert.deepEqual(completionErrors(child, ids, pdfs, []), []);
  const rejects = [null, {...child, success: false}, {...child, finalized: false}, {...child, printJobs: 3},
    {...child, completedPrintJobs: 3}, {...child, fetchAttempts: 1}, {...child, cases: child.cases.slice(1)},
    {...child, leaks: {windows: 1, staging: []}}, {...child, leaks: {windows: 0, staging: ['office-render-x']}}];
  for (const invalid of rejects) assert(completionErrors(invalid, ids, pdfs, []).length);
  assert(completionErrors(child, ids, {}, []).length);
  assert(completionErrors(child, ids, pdfs, ['office-render-x']).length);
  assert(completionErrors(child, ids, {...pdfs, 'portrait-1': {valid: true, bytes: 99}}, []).length);
  return {checks: 13, passed: true, scope: 'offline completion predicate only; no Electron/print mock'};
}

// Real production helper imports are compiled in memory, not executed by --check.
// These paths deliberately never reference out/main/index or any product App bootstrap.
const entry = `
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {app,BrowserWindow}=require('electron');
const {paperLayoutHtml}=require('./src/main/xiaozhi-agent/paper-layout-html.ts');
const {withStaticOfficePage}=require('./src/main/xiaozhi-agent/office-pdf-renderer.ts');
const {renderHanaPdfJob}=require('./src/main/xiaozhi-agent/vendor/hana/office-pdf/render-job.ts');
const root=process.argv[2];
assert(path.isAbsolute(root)&&fs.readFileSync(path.join(root,'owned-root.txt'),'utf8')==='paper-layout-pdf-owned-v1');
app.setName('PaperLayoutPdfFeasibility');
for(const name of ['profile','session','crashes','logs'])fs.mkdirSync(path.join(root,name));
app.setPath('userData',path.join(root,'profile'));app.setPath('sessionData',path.join(root,'session'));
app.setPath('crashDumps',path.join(root,'crashes'));app.setAppLogsPath(path.join(root,'logs'));
app.disableHardwareAcceleration();
const report={success:false,finalized:false,modelCalls:0,fetchAttempts:0,printJobs:0,completedPrintJobs:0,windowAllClosedEvents:0,cases:[],boundary:'PDF helper feasibility only; no Office approvals or Pi'};
const trace=(phase,details={})=>{report.phase=phase;fs.appendFileSync(path.join(root,'lifecycle.jsonl'),JSON.stringify({time:new Date().toISOString(),phase,...details})+'\\n');};
// Hana destroys its last window before withStaticOfficePage awaits session cleanup.
// Electron must stay alive until all four jobs, cleanup and the durable report finish.
const keepAlive=()=>{report.windowAllClosedEvents++;trace('window-all-closed',{events:report.windowAllClosedEvents});};
app.on('window-all-closed',keepAlive);
app.on('before-quit',()=>trace('before-quit',{finalized:report.finalized}));
app.on('will-quit',()=>trace('will-quit',{finalized:report.finalized}));
process.on('exit',code=>{if(!report.finalized)trace('premature-process-exit',{code});});
trace('keepalive-installed');
globalThis.fetch=async()=>{report.fetchAttempts++;throw Error('No network/model calls in this standalone fixture');};
app.whenReady().then(async()=>{
 try{
  trace('app-ready');
  const fixtures=JSON.parse(fs.readFileSync(path.join(root,'fixtures.json'),'utf8'));
  const png=fs.readFileSync(path.join(root,'approved-fixture.png'));
  for(const fixture of fixtures){
   trace('case-start',{id:fixture.id});
   let blocked=0;
   const blocks=fixture.blocks.map(b=>b.kind==='image'?{...b,png}:b);
   const html=paperLayoutHtml(fixture.layout,fixture.header,blocks);
   fs.writeFileSync(path.join(root,fixture.id+'.html'),html,{flag:'wx'});
   const bytes=await withStaticOfficePage(html,{dataRoot:root,deadlineMs:30000,images:new Map([['host-approved-fixture',png]]),onBlockedResource:()=>blocked++},async({Window,htmlPath,outputPath,deadline})=>{
    report.printJobs++;
    await renderHanaPdfJob({htmlPath,outputPath,viewport:{width:1280,height:900},embedHanaFonts:false,allowJavaScript:false,timeoutMs:deadline,settleMs:100,pageSize:'A4',preferCSSPageSize:true,printBackground:true,landscape:fixture.layout.orientation==='landscape'},Window);
    trace('hana-job-finished',{id:fixture.id});
    return fs.readFileSync(outputPath);
   });
   trace('static-host-cleanup-finished',{id:fixture.id});
   assert(bytes.subarray(0,5).toString()==='%PDF-');
   fs.writeFileSync(path.join(root,fixture.id+'.pdf'),bytes,{flag:'wx'});
   assert.equal(blocked,0,'Unexpected resource request');
   assert.equal(BrowserWindow.getAllWindows().length,0,'Hidden renderer leaked');
   assert(!fs.readdirSync(root).some(n=>n.startsWith('office-render-')),'Staging leaked');
   report.cases.push({id:fixture.id,bytes:bytes.length,blockedResources:blocked});
   report.completedPrintJobs++;trace('case-complete',{id:fixture.id});
  }
  assert.equal(report.printJobs,4);assert.equal(report.completedPrintJobs,4);assert.equal(report.fetchAttempts,0);report.success=true;
 }catch(e){report.error=e.stack||String(e);trace('case-failed',{error:report.error});console.error(report.error);}
 finally{
  report.leaks={windows:BrowserWindow.getAllWindows().length,staging:fs.readdirSync(root).filter(n=>n.startsWith('office-render-'))};
  if(report.leaks.windows||report.leaks.staging.length)report.success=false;
  report.finalized=true;trace('final-report-ready');
  fs.writeFileSync(path.join(root,'electron-report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  trace('final-report-written');app.removeListener('window-all-closed',keepAlive);app.exit(report.success?0:1);
 }
}).catch(e=>{trace('bootstrap-or-finalization-failed',{error:e.stack||String(e)});console.error(e);app.exit(1);});
`;
const bundle = await build({stdin: {contents: entry, resolveDir: desktop, sourcefile: 'paper-layout-pdf-entry.cjs'},
  absWorkingDir: desktop, bundle: true, platform: 'node', format: 'cjs', external: ['electron'],
  write: false, metafile: true, logLevel: 'silent'});
const sourcePaths = [...new Set([self, readback, path.join(desktop, 'package.json'), path.join(desktop, 'package-lock.json'), path.join(desktop, 'node_modules/electron/package.json'),
  ...Object.keys(bundle.metafile.inputs).filter(p => p !== 'paper-layout-pdf-entry.cjs').map(p => path.resolve(desktop, p))])].sort();
const sources = sourcePaths.map(file => ({file: path.relative(desktop, file).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(file))}));
const bundleBytes = bundle.outputFiles[0].contents;
const sourceFingerprint = hash(JSON.stringify({sources, bundle: hash(bundleBytes)}));
if (mode === '--run' && options['--source-sha256'].toLowerCase() !== sourceFingerprint) throw Error(`Source drift; no Electron started. Run --check and review ${sourceFingerprint}`);
const metadata = pythonCall([readback, '--check']);

// Host-created RGB PNG: thick red perimeter and four distinct corner fiducials.
// PyMuPDF later samples actual page pixels at the fiducials to detect clipping.
function pngFixture() {
  const width = 1200, height = 240, raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let rgb = [245, 245, 245];
    if (x < 12 || y < 12 || x >= width - 12 || y >= height - 12) rgb = [220, 20, 20];
    if (x < 48 && y < 48) rgb = [20, 170, 20];
    if (x >= width - 48 && y < 48) rgb = [20, 20, 220];
    if (x < 48 && y >= height - 48) rgb = [220, 170, 20];
    if (x >= width - 48 && y >= height - 48) rgb = [170, 20, 170];
    const offset = y * (width * 3 + 1) + 1 + x * 3; raw.set(rgb, offset);
  }
  function chunk(type, data) {
    const content = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
    for (const byte of content) {crc ^= byte; for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));}
    const size = Buffer.alloc(4), tail = Buffer.alloc(4); size.writeUInt32BE(data.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, content, tail]);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function fixtures() {
  return ['portrait', 'landscape'].flatMap(orientation => [1, 2].map(columns => {
    const markers = [], blocks = [], add = (text, role = 'body') => {markers.push({text, role}); return text;};
    const header = [add('HDRLEFT', 'header') + ' teacher exam identity'.repeat(6) + ' ' + add('HDRRIGHT', 'header')];
    for (let q = 1; q <= 80; q++) {
      blocks.push({kind: 'paragraph', text: [1, 2, 3].map(line => add(`Q${String(q).padStart(4, '0')}L${line}`) + ' controlled proof.').join('\n')});
      if (q === 5) {
        blocks.push({kind: 'paragraph', text: add('IMAGEPRE')});
        blocks.push({kind: 'image', width: 1200, height: 240, alt: 'Host-approved controlled RGB fixture'});
        blocks.push({kind: 'paragraph', text: add('IMAGEPOST')});
      }
      if (q === 12) {
        blocks.push({kind: 'paragraph', text: add('TABLEPRE')});
        blocks.push({kind: 'table', rows: Array.from({length: 8}, (_, row) => ['A', 'B'].map(cell => add(`T${String(row).padStart(3, '0')}${cell}`, 'table')))});
        blocks.push({kind: 'paragraph', text: add('TABLEPOST')});
      }
    }
    return {id: `${orientation}-${columns}`, layout: {schemaVersion: 'xiaozhi.paper-layout.v1', paper: 'A4', orientation, columns,
      margins: {top: 201, right: 192, bottom: 213, left: 224}, columnGap: 103}, header, blocks, markers};
  }));
}
const controlled = fixtures(), approvedPng = pngFixture();
assert.equal(controlled.length, 4);
for (const fixture of controlled) assert.equal(new Set(fixture.markers.map(m => m.text)).size, fixture.markers.length);
assert(approvedPng.length > 100);
const check = {mode, offlineCheckPassed: true, pdfAcceptance: 'NOT_RUN', sourceFingerprint, sources,
  bundleSha256: hash(bundleBytes), bundleBytes: bundleBytes.length, python: metadata,
  completionSelfCheck: completionSelfCheck(),
  plannedBudget: {electronProcesses: 1, realPrintJobs: 4, modelCalls: 0},
  boundary: 'Preparation only. Actual PDF results require --run plus independent readback; not Office/Pi acceptance.'};
if (mode === '--check') {
  console.log(JSON.stringify(check, null, 2));
} else {
  // No shared profile, existing App, user data, output directory, or production bootstrap.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-layout-pdf-owned-'));
  console.log('OWNED EVIDENCE ROOT ' + root);
  fs.writeFileSync(path.join(root, 'owned-root.txt'), 'paper-layout-pdf-owned-v1', {flag: 'wx'});
  json(path.join(root, 'preflight.json'), check); json(path.join(root, 'fixtures.json'), controlled);
  fs.writeFileSync(path.join(root, 'approved-fixture.png'), approvedPng, {flag: 'wx'});
  fs.writeFileSync(path.join(root, 'helpers.cjs'), bundleBytes, {flag: 'wx'});
  fs.copyFileSync(readback, path.join(root, 'readback.py'), fs.constants.COPYFILE_EXCL);
  const require = createRequire(import.meta.url), executable = require('electron');
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  const report = {success: false, sourceFingerprint, root, modelCalls: 0, boundary: check.boundary};
  try {
    // Recheck all sources immediately before launch, including readback and vendor.
    for (const item of sources) assert.equal(hash(fs.readFileSync(path.resolve(desktop, item.file))), item.sha256, 'Source drift before launch');
    const exitCode = await new Promise((resolve, reject) => {
      const log = fs.openSync(path.join(root, 'electron.log'), 'wx');
      const child = spawn(executable, [path.join(root, 'helpers.cjs'), root], {cwd: root, env, windowsHide: true, stdio: ['ignore', log, log]});
      const timer = setTimeout(() => {child.kill(); reject(Error('Standalone Electron exceeded 180s budget'));}, 180000);
      child.once('error', reject); child.once('close', code => {clearTimeout(timer); fs.closeSync(log); resolve(code);});
    });
    report.electronExitCode = exitCode;
    let childReport;
    try {childReport = JSON.parse(fs.readFileSync(path.join(root, 'electron-report.json'), 'utf8'));}
    catch (error) {report.electronReportError = String(error.message);}
    const pdfs = Object.fromEntries(controlled.map(fixture => {
      const file = path.join(root, fixture.id + '.pdf');
      if (!fs.existsSync(file)) return [fixture.id, {valid: false}];
      const bytes = fs.readFileSync(file);
      return [fixture.id, {valid: bytes.subarray(0, 5).toString() === '%PDF-', bytes: bytes.length, sha256: hash(bytes)}];
    }));
    report.electronCompletion = {childReport: childReport ?? null, pdfs,
      errors: completionErrors(childReport, controlled.map(f => f.id), pdfs, fs.readdirSync(root).filter(n => n.startsWith('office-render-')))};
    // Always attempt readback: partial render failures remain failed evidence.
    const parsed = spawnSync(python, ['-B', path.join(root, 'readback.py'), root], {encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1048576});
    fs.writeFileSync(path.join(root, 'readback.log'), (parsed.stdout || '') + (parsed.stderr || ''), {flag: 'wx'});
    report.readbackExitCode = parsed.status;
    report.success = exitCode === 0 && report.electronCompletion.errors.length === 0 && parsed.status === 0 && !parsed.error;
    if (!report.success) process.exitCode = 1;
  } catch (error) {report.error = String(error.stack || error); process.exitCode = 1;}
  finally {json(path.join(root, 'run-report.json'), report); console.log(JSON.stringify(report, null, 2));}
}
