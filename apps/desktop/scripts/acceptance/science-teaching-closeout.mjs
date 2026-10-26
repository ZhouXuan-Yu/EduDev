import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import JSZip from 'jszip';
import {fingerprint} from './evidence.mjs';
const root=path.resolve('test-results/goal/harness-science-teaching-20261021-first');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const build=read(path.join(root,'build-isolated.json'));
assert(build.sourceUnchanged);for(const row of build.source)assert.equal(sha(fs.readFileSync(row.file)),row.sha256);
assert.equal(fingerprint(build.root).sha256,build.sha256);
const npmBuild=fingerprint(path.resolve('test-results/goal/harness-science-teaching-20261021-npm-build/build-isolated'));assert.equal(npmBuild.sha256,build.sha256,'Standard npm build must match the actually tested binary');
// Exact existing source report directories are supplied; never search for a green run.
const paths={teaching:'science-teaching-oLnwDs',ui:'science-export-ui-Cfpmkp',anatomy:'pi-anatomy-1ArXbu',html:'pi-anatomy-html-browser-QbVtyo',boundaries:'science-export-boundaries-vpZ6sn'};
const reports={};for(const [key,folder] of Object.entries(paths)){const file=path.resolve('test-results/xiaozhi-agent',folder,'report.json');const report=read(file);assert(report.success, key);reports[key]={file,sha256:sha(fs.readFileSync(file)),checks:report.checks.length};}
const ui=read(reports.ui.file),teaching=read(reports.teaching.file);assert.equal(ui.build,build.sha256);
assert.equal(sha(fs.readFileSync(ui.ppt.file)),ui.ppt.sha256);assert.equal(sha(fs.readFileSync(ui.gif.file)),ui.gif.sha256);
assert.deepEqual(ui.reviewedTeaching,teaching.correctedTeaching);
const zip=await JSZip.loadAsync(fs.readFileSync(ui.ppt.file));const texts=[];
for(const [name,file] of Object.entries(zip.files)){
 if(name.endsWith('.rels'))assert(!/TargetMode="External"/.test(await file.async('string')));
 if(/^ppt\/slides\/slide\d+\.xml$/.test(name))texts.push(await file.async('string'));
}
assert(!texts.join('\n').includes(teaching.correctedTeaching.check.answer));
assert(texts.join('\n').includes(teaching.correctedTeaching.objective));
const office=read(path.join(root,'powerpoint-content-merge/report.json'));assert(office.success);
const playbackFailures=['powerpoint-first','powerpoint-final','powerpoint-visible','powerpoint-owned-focus'].map(folder=>{const file=path.join(root,folder,'report.json'),report=read(file);assert(!report.success);return {file,error:report.error};});
const legacy=fs.readFileSync(path.resolve('test-results/science-teaching-legacy.log'),'utf8');assert(/"passed":\s*207/.test(legacy)&&/"total":\s*207/.test(legacy));
const gif=read(path.join(root,'gif-readback.json'));assert(gif.frames>1&&gif.uniqueFrames>1&&gif.loop===0);
const scripts=['scripts/xiaozhi-agent/pi-science-teaching.mjs','scripts/xiaozhi-agent/pi-science-export-ui.mjs','scripts/xiaozhi-agent/pi-science-powerpoint.py','scripts/xiaozhi-agent/pi-science-content-merge.py','scripts/acceptance/science-teaching-closeout.mjs','scripts/acceptance/stage-science-teaching-example.mjs'].map(file=>({file,sha256:sha(fs.readFileSync(file))}));
const report={collectionValid:true,status:'IMPLEMENTED_PARTIAL_ACCEPTANCE',goalStatus:'ACTIVE',build:{sha256:build.sha256,files:build.count,sources:build.source.length},reports,office:{file:path.join(root,'powerpoint-content-merge/report.json'),checks:office.checks.length,playback:'NOT_ACCEPTED',playbackFailures},gates:{typecheck:0,renderer:'234/234',legacy:'207/207',worktreeDiffCheck:0,stagedDiffCheck:'Existing three trailing blank lines; preserved unrelated staged files'},boundaries:['Authored teaching fixture and synthetic approval session, no new provider calls','Visible PowerPoint animation not accepted: white captured surface / foreground denied; native render and merge checks do not replace playback','No real teacher usability or scientific correctness acceptance','No WPS, system-network-off, installed-package or auto-tool-selection acceptance','Existing Harness and original NET/IMG/FILE failures remain open'],artifacts:ui.ppt};
report.npmBuild={exitCode:0,sha256:npmBuild.sha256,matchesTestedBuild:true,log:path.resolve('test-results/goal/harness-science-teaching-20261021-npm-build/npm-build.log')};
report.gif=gif;report.scripts=scripts;
report.visualReview={nativeSlides:'All 5 original rendered slides reviewed; merged pages 2, 3, 5 reviewed',electron:'Cfpmkp export-1366/export-1920 reviewed; actual DPI 1.5',html:'oLnwDs teaching-1366/1920 reviewed',playback:'White/foreground-denied frames rejected; no playback acceptance'};
fs.writeFileSync(path.join(root,'progress.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({collectionValid:report.collectionValid,status:report.status,build:report.build,npmBuild:report.npmBuild,playback:report.office.playback}));
