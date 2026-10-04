import assert from 'node:assert/strict';
import {gradeAttempt,summarize} from './evidence.mjs';
const valid={exitCode:0,report:{success:true,checks:[{name:'Actual read',pass:true}]},artifactsVerified:true,buildUnchanged:true,layer:'isolated_formal_ui'};
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('Valid isolated UI evidence passes only its own layer',()=>assert.equal(gradeAttempt(valid).status,'PASS'));
for(const[name,change]of[
  ['exit 0 with failed report',{report:{...valid.report,success:false}}],
  ['nonzero with green report',{exitCode:1}],['missing report',{report:null}],
  ['empty assertions',{report:{success:true,checks:[]}}],
  ['partial failure',{report:{success:true,checks:[{name:'a',pass:true},{name:'b',pass:false}]}}],
  ['skipped assertion',{report:{success:true,checks:[{name:'a',pass:true,skipped:true}]}}],
  ['missing artifact',{artifactsVerified:false}],['build drift',{buildUnchanged:false}],
  ['mock promoted to formal',{layer:'mock'}],['API probe promoted to formal',{layer:'api_probe'}],['timeout',{timedOut:true}],
  ['test code drift',{scriptUnchanged:false}],['fewer checks than case contract',{requiredAssertions:19}],
  ['duplicate assertion padding',{report:{success:true,checks:[{name:'a',pass:true},{name:'a',pass:true}]}}],
])test('Reject '+name,()=>assert.equal(gradeAttempt({...valid,...change}).status,'FAIL'));
const passed={caseId:'web',attempt:2,grade:gradeAttempt(valid)};
test('Successful retry cannot erase first failure',()=>{const result=summarize([{caseId:'web',attempt:1,output:'first',grade:gradeAttempt({...valid,exitCode:1})},passed],{requiredCases:['web'],humanAccepted:true,sameDailyConfiguration:true});assert.equal(result.automation,'FAIL_OR_INCOMPLETE');assert.equal(result.firstFailures.length,1);});
test('Selected subset cannot satisfy omitted required case',()=>assert.equal(summarize([passed]).automation,'FAIL_OR_INCOMPLETE'));
test('New profile success cannot certify daily configuration',()=>assert.equal(summarize([passed],{requiredCases:['web'],humanAccepted:true}).status,'NOT_ACCEPTED'));
test('Human receipt absent cannot be auto-accepted',()=>assert.equal(summarize([passed],{requiredCases:['web'],sameDailyConfiguration:true}).status,'NOT_ACCEPTED'));
test('User failure remains open after automation passes',()=>assert.equal(summarize([passed],{requiredCases:['web'],sameDailyConfiguration:true,humanAccepted:true,openFeedback:['NET-USER-001']}).status,'NOT_ACCEPTED'));
test('One success is not repeated stability proof',()=>assert.equal(summarize([passed],{requiredCases:['web']}).repeatStatus,'STABILITY_UNVERIFIED'));
test('Three green runs cannot satisfy requested fourth',()=>assert.equal(summarize([passed,passed,passed],{requiredCases:['web'],requiredRepeats:4}).automation,'FAIL_OR_INCOMPLETE'));
console.log(JSON.stringify({success:true,checks:count,scope:'Evidence grading only; no product capability proven'}));
