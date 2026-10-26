import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {assertWeeklyPlan} from './weekly-plan-readback.mjs';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/weekly-plan-boundaries-')),checks=[],report={success:false,checks,scope:'Independent weekly user requirement fixtures; no production/provider claim'};
const columns=['周次','目标','任务','负责人'],rows=[1,2,3,4].map(i=>['第'+i+'周','真实目标'+i,'真实任务'+i,'']);
const one=()=>({sections:[{heading:'四周',paragraphs:[],table:{columns,rows:structuredClone(rows)}}]});
const many=()=>({sections:rows.map(row=>({heading:row[0],paragraphs:[],table:{columns,rows:[structuredClone(row)]}}))});
const paragraphs=()=>({sections:rows.map(row=>({heading:row[0],paragraphs:['本周目标：明确该周目标'],table:{columns:['序号','任务','负责人'],rows:[[1,'完整任务一',''],[2,'完整任务二','']]}}))});
const prose=()=>({sections:[{heading:'四周总览',paragraphs:[],table:{columns:['周次','目标','负责人'],rows:rows.map(row=>[row[0],row[1],''])}},...rows.map(row=>({heading:row[0],paragraphs:['周目标：明确目标','任务一：完整行动','任务二：完整安排','负责人：________']}))]});
const check=(name,fn)=>{fn();checks.push({name,pass:true});};
try{
 check('One four-row table covers exact four weeks',()=>assert.equal(assertWeeklyPlan(one()).tables,1));
 check('Four independently located one-week tables cover same requirements',()=>assert.equal(assertWeeklyPlan(many()).tables,4));
 check('Explicit weekly goal paragraphs and multiple task rows preserve all user requirements',()=>{const v=assertWeeklyPlan(paragraphs());assert.equal(v.rows,8);assert.deepEqual(v.weeks,[1,2,3,4]);});
 check('Paragraph-based plan with missing goal fails',()=>{const d=paragraphs();d.sections[1].paragraphs=[];assert.throws(()=>assertWeeklyPlan(d));});
 check('Paragraph-based plan with duplicate section week fails',()=>{const d=paragraphs();d.sections[3].heading='第1周';assert.throws(()=>assertWeeklyPlan(d));});
 check('Weekly explicit goal/task paragraphs and blank placeholders coexist with a summary table',()=>assert.equal(assertWeeklyPlan(prose()).weeks.length,4));
 check('Goal-only summary cannot replace missing weekly tasks',()=>{const d=prose();d.sections[2].paragraphs=d.sections[2].paragraphs.filter(p=>!p.startsWith('任务'));assert.throws(()=>assertWeeklyPlan(d));});
 check('Named owner in weekly paragraph is not a blank field',()=>{const d=prose();d.sections[2].paragraphs[3]='负责人：指定姓名';assert.throws(()=>assertWeeklyPlan(d));});
 for(const [name,change]of[['missing week',d=>d.sections[0].table.rows.pop()],['duplicate week',d=>d.sections[0].table.rows[3][0]='第1周'],['empty goal',d=>d.sections[0].table.rows[2][1]=''],['empty task',d=>d.sections[0].table.rows[2][2]=''],['filled owner',d=>d.sections[0].table.rows[2][3]='负责人已指定'],['unlocated week',d=>d.sections[0].table.rows[2][0]='某周']])check('Reject '+name,()=>{const d=one();change(d);assert.throws(()=>assertWeeklyPlan(d));});
 report.success=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,output,error:report.error}));}
