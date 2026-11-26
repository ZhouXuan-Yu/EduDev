// Curate evidence only. Does not call application services or change acceptance assertions.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fingerprint,sha256} from '../../apps/desktop/scripts/acceptance/evidence.mjs';

const root=import.meta.dirname,repo=path.resolve(root,'../..'),desktop=path.join(repo,'apps/desktop');
const dest=path.join(root,'delivery-evidence');fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'.gitattributes'),'* -text\n');
const read=p=>fs.readFileSync(path.resolve(repo,p),'utf8');
const json=p=>JSON.parse(read(p));
const artifacts=[];
function copy(source,label){
 const bytes=fs.readFileSync(path.resolve(repo,source));
 const published=/\.(log|json|txt)$/.test(source)?Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n').split('\n').map(l=>l.replace(/[\t ]+$/,'')).join('\n').replace(/\n+$/,'')+'\n'):bytes;
 const target=path.join(dest,label);fs.writeFileSync(target,published);
 artifacts.push({path:path.relative(repo,target).replaceAll('\\','/'),sha256:sha256(published),source,originalSha256:sha256(bytes),textWhitespaceNormalized:!bytes.equals(published)});
 return path.relative(repo,target).replaceAll('\\','/');
}
const base='acceptance/ux-followup-20261126/';
const logs=['build-resumed.log','renderer-resumed.log','contracts-resumed.log','isolation-resumed.log','source-guard-resumed.log','pi-boundary-attributed.log','geometry-resumed.log','interaction-resumed.log','audit-resumed.json','ci-peer.log','npm-ls-peer.json','dependency-peer.log','mcp-peer.log','attachment-peer.log','composer-context.log','states-context.log','full-smoke-accepted.log','invalidated-smoke.txt'];
for(const file of logs)copy(base+file,file);
const currentHead=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const source=fingerprint(path.join(desktop,'src')).sha256,build=fingerprint(path.join(desktop,'out')).sha256;
assert.equal(build,fingerprint(path.join(desktop,'test-results/ux-followup-context-final')).sha256);
const interactionLog=read(base+'interaction-resumed.log').trim().split('\n').at(-1),interaction=json(path.join(JSON.parse(interactionLog).output,'report.json'));
assert(interaction.success);assert.equal(interaction.checks.length,10);assert.equal(interaction.source,source);assert.equal(interaction.build,build);
const states=json(base+'read-states-bf27UF/report.json'),geometry=json(base+'read-states-8pnNED/report.json');
for(const report of [states,geometry]){assert(report.success);assert.equal(report.source,source);assert.equal(report.build,build);assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);}
const composer=json(base+'composer-e8Kyof/report.json');assert(composer.ok);assert.equal(composer.checks.length,5);
assert.equal(composer.mainSha256,sha256(fs.readFileSync(path.join(desktop,'out/main/index.js'))));
const audit=json(base+'audit-resumed.json');assert.equal(audit.metadata.vulnerabilities.total,0);
const piLog=read(base+'pi-boundary-attributed.log'),pi=JSON.parse(piLog.trim().split('\n').at(-1));
assert(pi.success);assert.equal(pi.checks.length,9);
const cases=[['interaction',path.relative(repo,path.join(JSON.parse(interactionLog).output,'report.json'))],['read-states',base+'read-states-bf27UF/report.json'],['geometry',base+'read-states-8pnNED/report.json'],['composer',base+'composer-e8Kyof/report.json'],['pi-boundary',path.join('apps/desktop',pi.reportPath)],['review-window',base+'review-window.json']];
for(const [label,p]of cases)copy(p,label+'.json');
for(const [label,p]of [['home',base+'review-window.png'],['context-1366',base+'read-states-bf27UF/context-aligned-1366.png'],['context-390',base+'read-states-bf27UF/context-aligned-390.png'],['knowledge-failed-1366',base+'read-states-bf27UF/knowledge-read-failed-1366.png']])if(fs.existsSync(path.join(repo,p)))copy(p,label+'.png');
const old=json('acceptance/ui-ux-r1-20261124/delivery.json');assert.equal(old.checks.length,28);
const map=read('acceptance/ui-ux-r1-20261124/records/LEGACY_GATE_MAP.csv');
assert.equal(new Set(map.split(/\r?\n/).slice(1).filter(Boolean).map(l=>l.split(',')[0])).size,36);
const commands=[
 ['npm.cmd run test:xiaozhi-pi','pi-boundary-attributed.log','9/9; actual SDK, controlled protocol'],
 ['npm.cmd run build','build-resumed.log','tsc and production build; exact out/isolate fingerprint match'],
 ['npm.cmd run test:renderer-components','renderer-resumed.log','261/261'],
 ['npm.cmd run test:ui-contracts','contracts-resumed.log','29/29'],
 ['npm.cmd run test:ui-style-isolation','isolation-resumed.log','9/9'],
 ['node scripts/acceptance/frozen-component-sources-test.mjs','source-guard-resumed.log','11 original +5 production;16 drift +5 rollback rejected'],
 ['node scripts/ux-followup-read-states.mjs --header-only','geometry-resumed.log','4 alignments +4 panel resize geometries; NOT five-directory rerun'],
 ['node scripts/ux-motion-electron.mjs','interaction-resumed.log','10/10 production local interactions and SQLite restart'],
 ['npx.cmd --yes --package=npm@11.21.3 --prefer-offline npm audit --noproxy=registry.npmjs.org --fetch-retries=0 --fetch-timeout=20000 --json','audit-resumed.json','0 vulnerabilities'],
].map(([command,log,result])=>({command,cwd:desktop,exitCode:0,result,evidence:base+'delivery-evidence/'+log}));
const report={schemaVersion:1,packageId:'XIAOZHI_UI_UX_R1_20261124',round:'ux-followup-20261126',state:'BLOCKED',headAtCollection:currentHead,sourceRoot:repo,sourceFingerprint:source,buildFingerprint:build,buildRoot:path.join(desktop,'test-results/ux-followup-context-final'),commands,
 checks:[{id:'R01',status:'PASS',evidence:['audit-resumed.json','ci-peer.log','npm-ls-peer.json','dependency-peer.log','mcp-peer.log']},{id:'R02',status:'PASS',evidence:['contracts-resumed.log','source-guard-resumed.log'],boundary:'Deployed source snapshot, not official artifact identity certification'},{id:'R03',status:'PARTIAL',reason:'Initial DOM reduced; cold max66.7-84.8ms remains. GPU attribution is not root-cause certification.'},{id:'R04',status:'PARTIAL',reason:'5 readonly failures/recovery +4 geometries +10 interactions +5 controlled Pi composer checks. Full page/business-state matrix remains open.'},{id:'R05',status:'BLOCKED',reason:'Actual native DPR1.5; real125% environment unavailable. No forced-DPR substitution.'},{id:'R06',status:'PARTIAL',reason:'Verified window open; main push must be proven by final-delivery-receipt.json'}],
 historical28:{artifact:'acceptance/ui-ux-r1-20261124/delivery.json',sha256:sha256(fs.readFileSync(path.join(repo,'acceptance/ui-ux-r1-20261124/delivery.json'))),checks:old.checks.map(c=>({id:c.id,historicalStatus:c.status})),boundary:'Historical statuses unchanged; no wholesale current-build re-certification'},legacy36:{artifact:'acceptance/ui-ux-r1-20261124/records/LEGACY_GATE_MAP.csv',count:36,boundary:'Preserved influence map, not36 PASS claims'},
 remaining:['native125%','cold first-navigation frame','full actual business state matrix; see STATE_COVERAGE.md','real provider/teacher quality and physical IME','official licensed component artifact identity','Office/WPS comprehensive output and installer/platform validation by original owners'],
 teacherReview:'NOT_RUN',network:'No new provider call in this continuation. npm/Git read operations only until authorized push.',artifacts};
const receiptFile=path.join(root,'final-delivery-receipt.json');
if(fs.existsSync(receiptFile)){
 const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
 assert(receipt.pushedAndVerified);assert.equal(receipt.sourceFingerprint,source);assert.equal(receipt.buildFingerprint,build);
 execFileSync('git',['merge-base','--is-ancestor',receipt.deliveredCommit,currentHead],{cwd:repo});
 const item=report.checks.find(c=>c.id==='R06');item.status='PASS';item.reason='Code delivery and actual window verified; full UI goal remains BLOCKED';item.evidence='acceptance/ux-followup-20261126/final-delivery-receipt.json';
}
fs.writeFileSync(path.join(root,'delivery.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({state:report.state,source,build,artifacts:artifacts.length,commands:commands.length}));
