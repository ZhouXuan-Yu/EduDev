import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {HARNESS_CASES,validateHarnessReport,appendAttempt} from './harness-evidence.mjs';
const hash='a'.repeat(64),checks=[];
const good=()=>({schema:'xiaozhi.harness-baseline.v1',build:{sha256:hash,unchanged:true},overall:'NOT_ACCEPTED',dailyAccepted:false,vpnOffAccepted:false,userFailuresClosed:false,
 cases:HARNESS_CASES.map(id=>({id,status:'PASS',layer:'C',synthetic:true,modelJudged:false,buildSha256:hash,scriptSha256:hash,assertions:[{name:'deterministic actual result',pass:true}],artifacts:[{file:'owned',sha256:hash,bytes:1}]}))});
function test(name,fn){fn();checks.push({name,pass:true});}
test('Complete C evidence validates without claiming D/E',()=>assert.equal(validateHarnessReport(good()).valid,true));
for(const [name,mutate] of [
 ['missing report',()=>null],['missing case',r=>{r.cases.pop();return r;}],
 ['duplicate case',r=>{r.cases[0]=r.cases[1];return r;}],
 ['API precheck promoted',r=>{r.cases[0].layer='B';return r;}],
 ['model self grading',r=>{r.cases[0].modelJudged=true;return r;}],
 ['empty checks / exit zero alone',r=>{r.cases[0].assertions=[];return r;}],
 ['skipped checks',r=>{r.cases[0].assertions[0].skipped=true;return r;}],
 ['padded duplicate checks',r=>{r.cases[0].assertions.push(r.cases[0].assertions[0]);return r;}],
 ['different build',r=>{r.cases[0].buildSha256='b'.repeat(64);return r;}],
 ['changed build',r=>{r.build.unchanged=false;return r;}],
 ['missing file evidence',r=>{r.cases[0].artifacts=[];return r;}],
 ['daily acceptance promoted',r=>{r.dailyAccepted=true;return r;}],
 ['user feedback silently closed',r=>{r.userFailuresClosed=true;return r;}],
 ['whole product accepted',r=>{r.overall='ACCEPTED';return r;}],
])test('Reject '+name,()=>assert.equal(validateHarnessReport(mutate(good())).valid,false));
test('Blocked and unverified are legitimate evidence states, not passes',()=>{const r=good();r.cases.forEach(c=>c.status='BLOCKED');assert.deepEqual(validateHarnessReport(r).counts,{PASS:0,FAIL:0,BLOCKED:4,UNVERIFIED:0});});
const parent=path.resolve('test-results/acceptance');fs.mkdirSync(parent,{recursive:true});const output=fs.mkdtempSync(path.join(parent,'harness-evidence-'));
test('False artifact is rejected on independent readback',()=>assert.equal(validateHarnessReport(good(),{readArtifacts:true,evidenceRoot:output}).valid,false));
test('Success append preserves original failure byte prefix',()=>{const file=appendAttempt(output,{id:'IMG-04',status:'FAIL'}),before=fs.readFileSync(file);appendAttempt(output,{id:'IMG-04',status:'PASS'});const after=fs.readFileSync(file);assert(after.subarray(0,before.length).equals(before));assert.equal(after.toString().trim().split('\n').length,2);});
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({success:true,checks,scope:'report validator only; no product capability proven'},null,2));
console.log(JSON.stringify({success:true,checks:checks.length,output}));
