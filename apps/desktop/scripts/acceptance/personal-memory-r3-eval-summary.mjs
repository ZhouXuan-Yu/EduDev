import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Summarize every recorded attempt, including failures before the target reached the provider.
const [fixturePath,...roots]=process.argv.slice(2);
assert(fixturePath && roots.length,'Pass the frozen teacher task list and one or more archived evidence roots');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/u,''));
const cases=read(fixturePath).tasks.map(item=>item.caseId);
assert.equal(new Set(cases).size,24);
const attempts=[];
const visited=new Set();
for(const root of roots){
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const folder=entry.isDirectory()&&entry.name.startsWith('r3-fixed-ab-');
    const namedFile=entry.isFile()&&/^R3-EVAL-\d{3}\.json$/u.test(entry.name);
    if(!folder&&!namedFile)continue;
    const file=folder?path.join(root,entry.name,'report.json'):path.join(root,entry.name);
    if(!fs.existsSync(file))continue;
    const report=read(file);
    assert(cases.includes(report.caseId)&&report.caseCount===24);
    for(const row of report.results){
      assert(['A','B'].includes(row.arm));
      const attemptId=[report.caseId,row.arm,row.terminal?.runId||entry.name,row.source].join('/');
      if(visited.has(attemptId))continue;
      visited.add(attemptId);
      const all=row.realModel?.length?row.realModel:(row.observedRequests??[]);
      const target=all.filter(item=>item.phase==='target'||item.phase===undefined&&row.realModel?.includes(item)&&item.hasSubmittedPrompt);
      const delivered=target.filter(item=>item.status===200&&item.hasSubmittedPrompt);
      const metered=target.filter(item=>Number.isSafeInteger(item.usage?.total_tokens));
      attempts.push({case:report.caseId,arm:row.arm,source:row.source,build:row.buildSha256,
        targetConfiguration: [...new Set(target.map(item=>JSON.stringify([item.model??null,item.reasoning??null,item.maxTokens??null])))].sort().map(value=>JSON.parse(value)),
        report:file,status:row.status,targetDelivered:delivered.length>0,run:row.terminal?.runId??null,
        targetRequests:target.length,meteredRequests:metered.length,
        tokens:target.length&&metered.length===target.length?metered.reduce((sum,item)=>sum+item.usage.total_tokens,0):null,
        elapsedMs:row.elapsedMs??null,clarifications:row.clarifications??null,restatements:row.teacherRestatements??null,
        humanRework:null,cost:row.cost??'UNKNOWN',artifactState:row.artifact?.status??null});
    }
  }
}
const measured=cases.filter(id=>['A','B'].every(arm=>attempts.some(row=>row.case===id&&row.arm===arm&&row.targetDelivered)));
const coverage={planned:cases.length,bothArmsReceivedTarget:measured.length,
  unpaired:cases.filter(id=>!measured.includes(id)),attempts:attempts.length};
// Different feature builds and retries are distinct observations. Do not pool them as an A/B lift.
function summarizeRuns(rows) {
  const summary={attempts:rows.length,delivered:rows.filter(row=>row.targetDelivered).length};
  for(const field of ['elapsedMs','tokens','clarifications','restatements','humanRework','cost']){
    const values=rows.map(row=>row[field]).filter(value=>typeof value==='number'&&Number.isFinite(value));
    values.sort((a,b)=>a-b);
    const quantile=q=>values.length?values[Math.ceil(q*values.length)-1]:null;
    summary[field]={measured:values.length,missing:rows.length-values.length,
      total:values.length?values.reduce((sum,value)=>sum+value,0):null,p50:quantile(.5),p95:quantile(.95)};
  }
  return summary;
}
const cohorts=new Map();
for(const attempt of attempts){
  const key=JSON.stringify([attempt.arm,attempt.source,attempt.build]);
  if(!cohorts.has(key))cohorts.set(key,[]);
  cohorts.get(key).push(attempt);
}
const byBuild=[...cohorts.entries()].map(([key,rows])=>{
  const configurations=new Map();
  for(const row of rows){
    const signature=JSON.stringify(row.targetConfiguration);
    if(!configurations.has(signature))configurations.set(signature,[]);
    configurations.get(signature).push(row);
  }
  return {
    identity:JSON.parse(key),
    cases:[...new Set(rows.map(row=>row.case))].sort(),
    ...summarizeRuns(rows),
    configurations:[...configurations].map(([signature,members])=>({
      target:JSON.parse(signature),
      ...summarizeRuns(members)
    }))
  };
});
console.log(JSON.stringify({coverage,byBuild,measurement:{
  denominator:'Every recorded case-arm attempt in this build cohort, including incomplete attempts.',
  restatements:'An observed teacher follow-up indicator from the frozen scenario; this is not measured human editing time.',
  clarifications:'Counts the recorded clarification event and the final pending question indicator. These are harness observations.',
  elapsedMs:'Recorded target elapsed time only. Setup, unknown measurements and actual billing are not imputed.',
  humanRework:'Unknown unless independently observed. No inference from a lack of complaints or clicks.',
  effect:'No aggregate A/B gain is claimed across different builds or unmatched input and authorization.'
},attempts},null,2));
