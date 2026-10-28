/** Read-only reconciliation. Never calls a model or modifies the evaluation database. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {randomInt} from 'node:crypto';
const root=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Pass the isolated live evaluation output directory');
const original=JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8'));
const ledger=JSON.parse(fs.readFileSync(path.join(root,'request-ledger.json'),'utf8'));
const cases=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'answer-quality-cases.json'),'utf8')).cases;
const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});
let answers;
try{
 const runs=db.prepare('SELECT id,session_id,prompt,status,error_message FROM ai_agent_runs ORDER BY created_at,id').all();
 const messages=db.prepare("SELECT content,metadata_json FROM ai_conversation_messages WHERE role='assistant'").all().map(m=>({...m,metadata:JSON.parse(m.metadata_json)}));
 answers=runs.map(run=>{
   const item=cases.find(c=>c.prompt===run.prompt);assert(item,'Unknown prompt in isolated evaluation');
   const matching=messages.filter(m=>m.metadata.agentRunId===run.id);assert.equal(matching.length,1,'Each run needs its own persisted assistant message');
   const m=matching[0],mode=m.metadata.answerQuality?.mode;assert(['legacy','optimized'].includes(mode));
   return {caseId:item.id,mode,prompt:run.prompt,rubric:item.rubric,runId:run.id,status:run.status,error:run.error_message,answer:m.content,metrics:m.metadata.answerQuality,traceElapsedMs:m.metadata.traceElapsedMs};
 });
}finally{db.close();}
assert.equal(new Set(answers.map(a=>a.runId)).size,answers.length);assert(ledger.requests<=original.requestLimit);
for(const id of new Set(answers.map(a=>a.caseId)))assert.deepEqual(answers.filter(a=>a.caseId===id).map(a=>a.mode).sort(),['legacy','optimized']);
const median=values=>{const v=[...values].sort((a,b)=>a-b),i=Math.floor(v.length/2);return v.length%2?v[i]:(v[i-1]+v[i])/2;};
const metrics=Object.fromEntries(['legacy','optimized'].map(mode=>{const a=answers.filter(a=>a.mode===mode);return [mode,{count:a.length,preparationMedianMs:median(a.map(a=>a.metrics.preparationMs)),firstAnswerAfterPromptMedianMs:median(a.map(a=>a.metrics.firstAnswerTextMs)),sdkEndMedianMs:median(a.map(a=>a.metrics.sdkEndedMs)),traceElapsedMedianMs:median(a.map(a=>a.traceElapsedMs)),meanRequestBytes:a.reduce((s,a)=>s+a.metrics.requestBytes,0)/a.length}];}));
const shuffled=[...answers];for(let i=shuffled.length-1;i>0;i--){const j=randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
const report={...original,ok:answers.every(a=>a.status==='succeeded'),requests:ledger.requests,answers,metrics,reconciliation:'Matched each assistant by metadata.agentRunId to actual SQLite run prompt/mode; original report retained. No new network requests.',blindKey:shuffled.map((a,i)=>({sampleId:`sample-${i+1}`,caseId:a.caseId,mode:a.mode,runId:a.runId}))};
fs.writeFileSync(path.join(root,'reconciled-report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(root,'reconciled-blind-review.json'),JSON.stringify(shuffled.map((a,i)=>({sampleId:`sample-${i+1}`,caseId:a.caseId,prompt:a.prompt,rubric:a.rubric,answer:a.answer,correctness:null,requirements:null,evidence:null,teachingFit:null,clarity:null,notes:''})),null,2));
console.log(JSON.stringify({ok:report.ok,answers:answers.length,requests:report.requests,metrics,output:root},null,2));
