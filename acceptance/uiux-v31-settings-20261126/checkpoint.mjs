import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=import.meta.dirname,repo=path.resolve(root,'../..'),dest=path.join(root,'checkpoint-w2a');
fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'.gitattributes'),'* -text\n');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const rows=[];
for(const file of ['controller-red.log','controller-green-1.log','controller-crash-red.log','controller-green-2.log','scope-green-1.log','scope-version-red.log','scope-green-2.log','controller-electron-2.log','build-w2a.log','renderer-w2a.log','audit-w2a.json','controller-electron-EOcbKR/report.json']){
 const raw=fs.readFileSync(path.join(root,file));const text=raw.toString('utf8').replace(/\r\n/g,'\n').split('\n').map(l=>l.replace(/[\t ]+$/,'')).join('\n').replace(/\n+$/,'');
 const published=Buffer.from(text?text+'\n':'');const name=file.includes('/')?'electron-report.json':file;
 fs.writeFileSync(path.join(dest,name),published);rows.push({original:file,originalSha:sha(raw),published:name,publishedSha:sha(published)});
}
const lastJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8').trim().split('\n').at(-1));
assert.equal(lastJson('controller-green-2.log').passed,9);assert.equal(lastJson('scope-green-2.log').passed,9);
const electron=JSON.parse(fs.readFileSync(path.join(root,'controller-electron-EOcbKR/report.json')));assert(electron.success);assert.equal(electron.checks.length,8);
assert.equal(electron.controllerSha256,sha(fs.readFileSync(path.join(repo,'apps/desktop/src/main/settings-window/controller.ts'))));
const audit=JSON.parse(fs.readFileSync(path.join(root,'audit-w2a.json')));assert.equal(audit.metadata.vulnerabilities.total,0);
const evidence={state:'IMPLEMENTING',headBeforeCheckpoint:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),requirements:['REQ-17','REQ-18'],tasks:['W2-A','W2-C'],attempts:{'W2-A':2,'W2-C':2,'W10':0},results:{controllerUnit:9,scopeUnit:9,electronLifecycleFixture:8,buildExit:0,rendererComponents:261,audit:0},rows,
 integrationStatus:'NOT_INTEGRATED_WITH_APPLICATION',formalAcceptance:'90 AC and36 LG remain NOT_RUN; module subconditions do not establish SET-P0 or MG-01',mergeAllowed:false,
 sourceFiles:['apps/desktop/src/main/settings-window/controller.ts','apps/desktop/src/main/settings-window/scope-authority.ts'].map(file=>({file,sha256:sha(fs.readFileSync(path.join(repo,file)))}))};
fs.writeFileSync(path.join(root,'CHECKPOINT_W2A.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:evidence.state,checks:evidence.results,mergeAllowed:false}));
