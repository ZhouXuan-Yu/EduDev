import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

// Summarize every recorded attempt, including failures before the target reached the provider.
const [fixturePath,...roots]=process.argv.slice(2);
assert(fixturePath && roots.length,'Pass the frozen teacher task list and one or more archived evidence roots');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/u,''));
const fixture=read(fixturePath);
const cases=fixture.tasks.map(item=>item.caseId);
const contentHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(new Set(cases).size,24);
function duration(intervals) {
  if (!intervals.length) return 0;
  const sorted=intervals.toSorted((a,b)=>a.start-b.start);
  let start=sorted[0].start,end=sorted[0].end,total=0;
  for(const next of sorted.slice(1)){
    if(next.start>end){total+=end-start;start=next.start;}
    end=Math.max(next.end,end);
  }
  return total+end-start;
}

function readTiming(roots, folder, arm, run, targetRequests) {
  if(!run) return {state:'NO_TARGET_RUN'};
  const database=roots.map(root=>path.join(root,folder,arm,'data','app.db')).find(file=>fs.existsSync(file));
  if(!database) return {state:'RAW_JOURNAL_NOT_AVAILABLE'};
  const db=new DatabaseSync(database,{readOnly:true});
  let rows;
  try{
    const table=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='xiaozhi_event_journal'").get();
    if(!table)return {state:'LEGACY_JOURNAL_UNAVAILABLE',database};
    rows=db.prepare('SELECT sequence,event_json,event_hash,created_at FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence').all(run);
  }finally{db.close();}
  if(!rows.length)return {state:'RAW_RUN_NOT_AVAILABLE',database};
  const digest=createHash('sha256');
  const starts=new Map(), intervals={provider:[],teacher:[],tool:[],presentation:[]};
  const missing=new Set();
  function begin(kind,key,start,sequence) {
    if(!starts.has(key))starts.set(key,{kind,start,sequence});
  }
  function finish(key,end,endSequence) {
    const entry=starts.get(key);
    if(!entry)return;
    starts.delete(key);
    if(!Number.isFinite(entry.start)||!Number.isFinite(end)||end<entry.start){missing.add(entry.kind);return;}
    intervals[entry.kind].push({start:entry.start,end,firstSequence:entry.sequence,lastSequence:endSequence});
  }
  for(const row of rows){
    const hash=createHash('sha256').update(row.event_json).digest('hex');
    assert.equal(hash,row.event_hash,'Archived event hash differs from the recorded host hash');
    digest.update(hash);
    const event=JSON.parse(row.event_json);
    const at=event.capturedAt??Date.parse(row.created_at);
    if(event.kind==='model_request'){
      const {request,attempt,state,at}=event.request;
      const key='http:'+request+':'+attempt;
      if(state==='sending')begin('provider',key,at,row.sequence);
      if(['accepted','rejected','interrupted','retry_wait'].includes(state))finish(key,at,row.sequence);
    } else if(event.kind==='tool_start') {
      begin('tool','tool:'+event.callId,at,row.sequence);
    } else if(event.kind==='tool_end') {
      finish('tool:'+event.callId,at,row.sequence);
    } else if(event.kind==='assistant_start') {
      begin('presentation','assistant:'+event.segment,at,row.sequence);
    } else if(event.kind==='assistant_end') {
      finish('assistant:'+event.segment,at,row.sequence);
    } else {
      const decision=event.kind==='approval'?event.approval:
        event.kind==='control'&&event.control.kind==='question'?event.control:undefined;
      if(!decision)continue;
      const key=event.kind+':'+decision.id;
      if(decision.state==='pending')begin('teacher',key,at,row.sequence);
      else finish(key,at,row.sequence);
    }
  }
  for(const {kind} of starts.values())missing.add(kind);
  if(targetRequests && !intervals.provider.length)missing.add('provider');
  const totals=Object.fromEntries(Object.entries(intervals).map(([kind,items])=>[
    kind+'Ms',missing.has(kind)?null:duration(items)
  ]));
  return {state:missing.size?'INCOMPLETE_INTERVALS':'MEASURED',database,eventCount:rows.length,
    eventDigest:digest.digest('hex'),missing:[...missing].sort(),...totals,intervals};
}

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
        fixtureHash:report.fixtureHash??null,
        teacherInputHash:Array.isArray(row.teacherPrompts)?contentHash(row.teacherPrompts):null,
        recordedScope:row.scope?{classRef:row.scope.classRef??null,term:row.scope.term??null,
          subject:row.scope.subject??null,grade:row.scope.grade??null,textbook:row.scope.textbook??null,
          selections:row.scope.selections??null}:null,
        targetRequests:target.length,meteredRequests:metered.length,
        tokens:target.length&&metered.length===target.length?metered.reduce((sum,item)=>sum+item.usage.total_tokens,0):null,
        elapsedMs:row.elapsedMs??null,clarifications:row.clarifications??null,restatements:row.teacherRestatements??null,
        humanRework:null,cost:row.cost??'UNKNOWN',artifactState:row.artifact?.status??null,
        timing:folder?readTiming(roots,entry.name,row.arm,row.terminal?.runId,target.length):{state:'RAW_JOURNAL_NOT_AVAILABLE'}});
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
const invocations=new Map();
for(const attempt of attempts){
  if(!invocations.has(attempt.report))invocations.set(attempt.report,[]);
  invocations.get(attempt.report).push(attempt);
}
// Compare contemporaneous arms within their own source invocation. A delivery
// count or a matching model name alone cannot establish a comparable quality pair.
const pairInputs=[...invocations].flatMap(([report,rows])=>{
  const first=rows.find(row=>row.arm==='A'),second=rows.find(row=>row.arm==='B');
  if(!first||!second)return [];
  const check=(left,right)=>left===null||right===null?'UNVERIFIED':JSON.stringify(left)===JSON.stringify(right)?'MATCH':'DIFFERENT';
  const compare={
    teacherInput:check(first.teacherInputHash,second.teacherInputHash),
    scopeSummary:check(first.recordedScope,second.recordedScope),
    effectiveParameters:check(first.targetDelivered?first.targetConfiguration:null,second.targetDelivered?second.targetConfiguration:null),
  };
  const arms=[first,second].map(row=>({source:row.source,build:row.build,run:row.run,status:row.status,fixtureHash:row.fixtureHash}));
  return [{case:first.case,report,arms,compare,usableForManualReview:Object.values(compare).every(value=>value==='MATCH')}];
});
console.log(JSON.stringify({coverage,byBuild,pairInputs,measurement:{
  denominator:'Every recorded case-arm attempt in this build cohort, including incomplete attempts.',
  restatements:'An observed teacher follow-up indicator from the frozen scenario; this is not measured human editing time.',
  clarifications:'Counts the recorded clarification event and the final pending question indicator. These are harness observations.',
  elapsedMs:'Recorded target elapsed time only. Setup, unknown measurements and actual billing are not imputed.',
  timing:'Provider request admitted to recorded HTTP outcome, teacher pending decision to settled event, tool start to end, and assistant presentation start to end. Durations are per-category interval unions; categories can overlap. Uses committed events and their capture timestamps, with journal write time for events without capture times. Missing endpoints stay null; a quiet category is zero only within an available journal. Presentation is the host display phase, not measured renderer paint. Evidence points to the original database, run and event sequences.',
  humanRework:'Unknown unless independently observed. No inference from a lack of complaints or clicks.',
  pairInputs:'Checks whether both arms in one invocation recorded the same teacher text, effective model settings and scope summary. A scope summary is not a full authorization/readback audit. A matching pair is eligible for manual evidence review, not evidence of a product gain.',
  effect:'No aggregate A/B gain is claimed across different builds or unmatched input and authorization.'
},attempts},null,2));
