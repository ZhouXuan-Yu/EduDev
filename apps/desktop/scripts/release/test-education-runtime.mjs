import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {equationCases} from '../education/math-equation-fixtures.mjs';
import {quantityCases} from '../education/math-quantity-fixtures.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const exe=path.join(desktop,'.local-education/dist/omni-edu-education/omni-edu-education.exe');
const cases=[
 ['math',{schemaVersion:'xiaozhi.education.math-check.v2',kind:'linear_system',variables:['x'],equations:[{coefficients:[{numerator:'1',denominator:'1'}],constant:{numerator:'2',denominator:'1'},sourceText:'x = 2'}],targets:[{variable:'x',expected:{numerator:'2',denominator:'1'},answerText:'x = 2'}]},v=>v.state==='matched'&&v.systemStatus==='unique_targets'],
 ['reading',{schemaVersion:'xiaozhi.education.quote.v1',text:'一元一次方程的解。',quote:'一元一次方程'},v=>v.found===true],
 ['reading',{schemaVersion:'xiaozhi.education.search.v1',units:['一元一次方程。','二次函数最值。'],query:'二次函数'},v=>v.hits.length===1&&v.hits[0].locator===1],
 ['learning',{schemaVersion:'xiaozhi.education.learning.v1',operation:'grade',userAnswer:'A',expectedAnswer:'A',questionType:'choice'},v=>v.isCorrect===true],
 ['question',{schemaVersion:'xiaozhi.education.question-draft.v1',operation:'normalize',questionType:'short_answer',raw:JSON.stringify({question:'计算一加一的结果。',correct_answer:'2',explanation:'根据加法运算，一加一等于二。',options:{}})},v=>v.question.answer==='2'],
 ['math',{schemaVersion:'xiaozhi.education.math-check.v1',kind:'expression',left:{op:'number',numerator:'2',denominator:'1'},right:{op:'number',numerator:'2',denominator:'1'}},v=>v.state==='matched'],
];
const report={scope:'Frozen EXE only; PATH and Python configuration removed',checks:[],failures:[]};
for(const id of ['fx04-original-denominator','fx04-squaring-extraneous','fx04-radical-original']){
 const item=equationCases.find(c=>c.id===id);
 cases.push(['math',{schemaVersion:'xiaozhi.education.math-check.v3',...item.input},value=>value.state===item.state&&value.solutionStatus==='finite'&&JSON.stringify(value.solutions)===JSON.stringify(item.solutions)]);
}
for(const id of ['fx04-pressure-original-cm2','fx04-speed','mass-is-not-weight','si-prefix-frequency']){
 const item=quantityCases.find(c=>c.id===id);
 cases.push(['math',{schemaVersion:'xiaozhi.education.math-check.v4',...item.input},value=>value.state===item.state&&(!item.exact||value.actual?.exact===item.exact)]);
}
for(const [worker,input,valid] of cases){
 const request={...input,requestId:randomUUID()};
 const result=spawnSync(exe,['--worker',worker,'--parent-pid',String(process.pid)],{
  input:JSON.stringify(request),encoding:'utf8',timeout:30000,maxBuffer:1024*1024,windowsHide:true,
  env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP,PATH:'',PYTHONNOUSERSITE:'1'},
 });
 let value;try{value=JSON.parse(result.stdout||'');}catch{}
 const passed=result.status===0&&value?.requestId===request.requestId&&value?.ok===true&&valid(value);
 report.checks.push({worker,schema:input.schemaVersion,passed,status:result.status});
 if(!passed)report.failures.push({worker,error:result.error?.message,stderr:result.stderr?.slice(0,1500),response:value});
}
const invalid=spawnSync(exe,['--worker','../reading','--parent-pid',String(process.pid)],{encoding:'utf8',windowsHide:true,timeout:10000});
report.checks.push({worker:'invalid-selector',passed:invalid.status!==0});
const output=path.join(desktop,'test-results/goal/kb-s0');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'frozen-education.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));assert(report.checks.every(c=>c.passed),'Frozen education runtime checks failed');
