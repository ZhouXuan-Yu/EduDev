import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fingerprint,sha256} from '../../apps/desktop/scripts/acceptance/evidence.mjs';

const root=import.meta.dirname,repo=path.resolve(root,'../..'),desktop=path.join(repo,'apps/desktop');
const run=process.argv[2];assert(/^product-[A-Za-z0-9]+$/.test(run),'Provide the exact owned product run basename');
const product=JSON.parse(fs.readFileSync(path.join(root,run,'report.json'),'utf8'));
assert(product.success&&product.buildUnchanged);assert.equal(product.checks.length,8);assert.deepEqual(product.errors,[]);
assert.equal(product.build.sha256,fingerprint(path.join(desktop,'out')).sha256,'Actual tested build must still match');
const lastJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8').trim().split('\n').at(-1));
assert.equal(lastJson('controller-integration.log').passed,9);assert.equal(lastJson('scope-integration.log').passed,10);
assert.equal(lastJson('ipc-final.log').passed,12);assert.equal(lastJson('ipc-final.log').failed,0);
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'audit-integration.json'))).metadata.vulnerabilities.total,0);
const smokeText=fs.readFileSync(path.join(root,'smoke-integration.log'),'utf8').replace(/\r\n/g,'\n');
const smokeStart=smokeText.lastIndexOf('\n{\n');assert(smokeStart>=0,'Complete smoke result required');
const smoke=JSON.parse(smokeText.slice(smokeStart+1));assert.equal(smoke.ok,true);assert.equal(smoke.frontendAcceptance.passed,207);assert.equal(smoke.frontendAcceptance.total,207);
const dest=path.join(root,'checkpoint-w2-integration');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'.gitattributes'),'* -text\n');
const rows=[];
for(const file of ['ipc-red.log','ipc-parity.log','ipc-original-channel-red.log','ipc-final.log','controller-integration.log','scope-integration.log','scope-revocation-red.log','renderer-integration.log','pi-integration.log','audit-integration.json','audit-precommit.json','smoke-integration.log','build-integration-1.log','build-integration-2.log','build-integration-3.log','build-integration-4.log','build-integration-final.log','product-first.log','product-second.log','product-final.log',`${run}/report.json`,'product-FZEYpH/report.json']){
 const raw=fs.readFileSync(path.join(root,file));assert(!/sk-[A-Za-z0-9]{16,}/.test(raw.toString('utf8')),'Potential secret in evidence');
 const published=Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n').split('\n').map(line=>line.replace(/[\t ]+$/,'')).join('\n').trimEnd()+'\n');
 const name=file.replaceAll('/','--');fs.writeFileSync(path.join(dest,name),published);rows.push({original:file,originalSha256:sha256(raw),published:name,sha256:sha256(published)});
}
for(const [source,name] of [['product-FZEYpH/settings-failure.png','before-layout-fix.png'],[`${run}/settings-models.png`,'settings-models.png'],[`${run}/settings-teacher-memory.png`,'settings-teacher-memory.png'],[`${run}/settings-tools.png`,'settings-tools.png']]){
 const bytes=fs.readFileSync(path.join(root,source));fs.writeFileSync(path.join(dest,name),bytes);rows.push({original:source,published:name,sha256:sha256(bytes)});
}
const evidence={state:'IMPLEMENTING',headBeforeCheckpoint:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),requirements:['REQ-17','REQ-18'],attempts:{'W2-A':3,'W2-B':1,'W2-C':5,'W2-D':2,'W2-E':0,'W2-F':0,'W10':0},
 results:{controllerUnit:9,scopeUnit:10,ipcContract:12,productWindowChecks:8,rendererComponents:261,piBoundary:9,audit:0,legacySmoke:207},
 legacySmokeBoundary:'Successful npm run test:smoke built and tested the protected legacy entry before the final settings-only stale notice cleanup and unused API removal. It is not full V3 or final Pi settings acceptance.',
 build:product.build,productReport:`checkpoint-w2-integration/${run}--report.json`,rows,
 formalAcceptance:'90 AC and 36 LG not passed by these partial tests. SET-P0/MG/FG are not PASS.',mergeAllowed:false,
 next:'W2-C remaining session/frame/navigation/await boundaries, then W2-E real configuration/history/undo/conflict, memory/permissions/tools/backup readback; W2-B/F system interaction and performance. RUNTIME_INTEGRATION.md is the resume entry.'};
fs.writeFileSync(path.join(root,'CHECKPOINT_W2_INTEGRATION.json'),JSON.stringify(evidence,null,2)+'\n');
const matrixPath=path.join(root,'acceptance-matrix.json'),matrix=JSON.parse(fs.readFileSync(matrixPath,'utf8'));
assert.equal(matrix.ac.length,90);assert.equal(matrix.legacy.length,36);
assert.equal(sha256(fs.readFileSync(path.join(root,'contract/06_ATDD_ACCEPTANCE.md'))),matrix.sourceSha256);
for(const row of matrix.ac.filter(row=>['AC-075','AC-076','AC-077','AC-080','AC-083','AC-084','AC-085','AC-089'].includes(row.id))){
 row.moduleEvidence=['CHECKPOINT_W2_INTEGRATION.json',evidence.productReport,'RUNTIME_INTEGRATION.md'];
 row.coverageNote='Only module subconditions exercised; full contract scenario remains NOT_RUN, not PASS.';
}
fs.writeFileSync(matrixPath,JSON.stringify(matrix,null,2)+'\n');
console.log(JSON.stringify({state:evidence.state,results:evidence.results,buildSha256:evidence.build.sha256,mergeAllowed:false}));
