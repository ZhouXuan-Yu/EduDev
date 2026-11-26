import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fingerprint,sha256} from '../../apps/desktop/scripts/acceptance/evidence.mjs';
const root=import.meta.dirname,repo=path.resolve(root,'../..'),external=path.join(tmpdir(),'edudev-v31-settings-final-20261126');
const run=process.argv[2];assert(/^product-[A-Za-z0-9]+$/.test(run));
const report=JSON.parse(fs.readFileSync(path.join(external,run,'report.json'),'utf8'));
assert(report.success&&report.buildUnchanged);assert.equal(report.checks.length,13);assert.deepEqual(report.errors,[]);
assert(report.permissionSqlite?.aUnchanged&&report.permissionSqlite.bMatchesHost);
assert.equal(report.untrustedEndpointDenials,17);assert(report.contexts.oldWriteRejected&&report.contexts.oldProfileUnchanged);
assert(report.frameSurface.parentBlocked);assert.notEqual(report.navigationRevocation.oldId,report.navigationRevocation.newId);
assert.equal(report.build.sha256,fingerprint(path.join(repo,'apps/desktop/out')).sha256);
const dest=path.join(root,'checkpoint-context-followup');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'.gitattributes'),'* -text\n');
const rows=[];
const copy=(base,file,name)=>{
 const raw=fs.readFileSync(path.join(base,file));let bytes=raw;
 if(!file.endsWith('.png')){assert(!/sk-[A-Za-z0-9]{16,}/.test(raw.toString('utf8')));bytes=Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n').trimEnd()+'\n');}
 fs.writeFileSync(path.join(dest,name),bytes);rows.push({source:file,rawSha256:sha256(raw),file:name,sha256:sha256(bytes)});
};
for(const [file,name] of [[`${run}/report.json`,'product-report.json'],['product-jFVFMx/report.json','permission-sync-failed.json'],['product-jFVFMx/main-failure.png','permission-main-before.png'],['product-jFVFMx/settings-failure.png','permission-settings-before.png'],['product-fxCIkf/report.json','frame-fixture-failed.json'],['context-security-first.log','permission-sync-red.log'],['context-security-complete.log','frame-fixture-red.log'],['context-security-final.log','context-green.log']])copy(external,file,name);
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'audit-context.json'))).metadata.vulnerabilities.total,0);
for(const file of ['build-context-sync.log','renderer-context-sync.log','audit-context.json'])copy(root,file,file);
const sourceFiles=['apps/desktop/src/renderer/components/office/usePermissionMode.ts','apps/desktop/scripts/settings-window-product-test.mjs','apps/desktop/scripts/settings-window-cases/context-security.mjs'].map(file=>({file,sha256:sha256(fs.readFileSync(path.join(repo,file)))}));
const state={state:'IMPLEMENTING',headBeforeCheckpoint:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),attempts:{'W2-A':3,'W2-B':1,'W2-C':7,'W2-D':2,'W2-E':0,'W2-F':0,'W10':0},results:{formalWindowChecks:13,invalidEndpointDenials:17,permissionSqliteReadback:true,rendererComponents:261,buildPass:true,audit:0},buildSha256:report.build.sha256,rows,sourceFiles,mergeAllowed:false,
 coverage:'Actual A-to-B-to-A UI navigation, old-request denial, original permission UI save, main composer display, post-close SQLite readback, document replacement/reopen. The sandbox frame probe proves absence of preload/parent access, not a raw IPC request from an incapable frame. Full90 AC/36 LG and SET-P0/MG/FG are not PASS.',
 next:'W2-E configuration/credential/history/undo/conflict using original services and permitted isolated transport fixtures. Before the final W2-C repair round, collect remaining await-dialog and global-vs-session stale-request cases together. Do not reset the accumulated budget.'};
fs.writeFileSync(path.join(root,'CHECKPOINT_CONTEXT_FOLLOWUP.json'),JSON.stringify(state,null,2)+'\n');
const matrixFile=path.join(root,'acceptance-matrix.json'),matrix=JSON.parse(fs.readFileSync(matrixFile,'utf8'));
assert.equal(matrix.ac.length,90);assert.equal(matrix.legacy.length,36);
for(const row of matrix.ac.filter(row=>['AC-078','AC-083','AC-085','AC-087','AC-089'].includes(row.id))){row.moduleEvidence=[...new Set([...(row.moduleEvidence??[]),'CHECKPOINT_CONTEXT_FOLLOWUP.json','checkpoint-context-followup/product-report.json'])];row.coverageNote='Partial module evidence only; complete the authoritative contract scenario before assigning PASS.';}
fs.writeFileSync(matrixFile,JSON.stringify(matrix,null,2)+'\n');console.log(JSON.stringify({state:state.state,results:state.results,buildSha256:state.buildSha256,mergeAllowed:false}));
