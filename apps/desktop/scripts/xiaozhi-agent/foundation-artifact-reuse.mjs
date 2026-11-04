/** Re-read retained synthetic evidence; never regenerate passing teacher flows. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const repo=path.resolve(import.meta.dirname,'../../../..'),sha=b=>createHash('sha256').update(b).digest('hex'),root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-foundation-b04-reuse-')),checks=[];
const record=name=>JSON.parse(fs.readFileSync(path.join(repo,'docs/research',name)));
const source=record('AGENT_LESSON_SOURCE_S06_20261103.json'),recovery=record('AGENT_LESSON_RECOVERY_S06_20261103.json'),verified=[];
for(const [name,record]of [['partialRepair',recovery],['questionSourceRefresh',source]]){
 const file=record.checks.formal.report;assert(path.basename(path.dirname(file)).startsWith(name==='partialRepair'?'xiaozhi-lesson-recovery-ui-':'xiaozhi-lesson-source-ui-'));
 const report=JSON.parse(fs.readFileSync(file));assert(report.ok);assert.equal(report.errors.length,0);assert.equal(report.paidRequests,0);assert.equal(sha(fs.readFileSync(report.nativeFile)),report.nativeHash);
 for(const actual of report.files){assert.equal(sha(fs.readFileSync(actual.file)),actual.sha256);assert.equal(fs.statSync(actual.file).mtimeMs,actual.mtime);}
 if(name==='partialRepair'){
  assert.equal(report.before.length,4);assert.equal(report.files.length,5);
  for(const before of report.before){const after=report.files.find(f=>f.file===before.file);assert(after);assert.equal(after.sha256,before.sha256);assert.equal(after.mtime,before.mtime);}
  assert(report.checks.some(c=>c.includes('writes')||c.includes('repairs')));
 }else{assert.notEqual(report.oldVersion,report.newVersion);assert.equal(report.files.length,5);assert(report.checks.some(c=>c.includes('zero old file writes')));assert(report.checks.some(c=>c.includes('exact same question current version')));}
 verified.push({name,report:file,reportSha256:sha(fs.readFileSync(file)),nativeFile:report.nativeFile,nativeSha256:report.nativeHash,files:report.files,checks:report.checks,originalMainSha256:report.bundleSha});
}
checks.push({id:'FAT-B04-04',detail:'Reuse two actual original Pi/Electron flows: five-role HTML-only failure/one repair preserves four hashes+mtimes, and same-question4N→5N invalidates old publish and explicitly rereads/binds new source. Raw reports/native/files reread intact; fresh current-source recovery7/source6/bundle13 regression recorded separately. This is composed existing evidence, not a newly regenerated combined journey.'});
const result={ok:true,root,checks,verified,paidRequests:0};fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,root,checks:checks.length}));
