import {createHash} from 'node:crypto';
import type {Sql} from '../xiaozhi-agent/session-state';
import {validTeacherPreferenceValues,type TeacherPreferenceValues} from '../../shared/teacher-preferences';
import {teacherPreferenceSignal} from './teacher-preference-policy';
import type {TeacherCandidateReason,TeacherCandidateStatus} from '../../shared/teacher-candidates';
import {teacherLearningResponse as response,teacherLearningUser,teacherSampleSource} from './teacher-preference-sources';

const schema='xiaozhi.teacher-preference-learning.v1',prefix='xiaozhi.teacher-preference.v1:learning:',pendingKey=prefix+'pending';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const runId=(v:unknown)=>typeof v==='string'&&/^run_[a-f0-9-]{36}$/i.test(v);
const sessionId=(v:unknown)=>typeof v==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v);
type Source={id:string;sessionId:string;runId:string;text:string};
const presentationMetric='teacher_presentation_observed.v3' as const;
type Metrics={metric?:'teacher_presentation_observed.v2'|typeof presentationMetric;characters:number;steps:number;table:boolean;passed:boolean};
type Sample={sessionId:string;runId:string;messageId:string;sha256:string;taskRunId:string;taskHash:string;before:Metrics;after?:Metrics;sourceDigest?:string;afterDigest?:string};
export type TeacherCandidate={schemaVersion:typeof schema;sourceVersion?:1;revision?:number;reason?:TeacherCandidateReason;id:string;baselineRevision:number;patch:TeacherPreferenceValues;status:TeacherCandidateStatus;samples:Sample[];trial?:{sessionId:string;runId:string;messageId:string;sha256:string;metrics?:Metrics;sourceDigest?:string;resultDigest?:string}};
type Candidate=TeacherCandidate;
export type TeacherLearningEvidence={metric:'teacher_presentation_observed.v1'|'teacher_presentation_observed.v2'|typeof presentationMetric;candidateId:string;trainRuns:string[];holdoutRunId:string};
type Learning={candidateId?:string;patch?:TeacherPreferenceValues;trial?:TeacherPreferenceValues;rollback?:boolean;evidence?:TeacherLearningEvidence};
const taskText=(text:string)=>text.replace(/(?:不|不要)(?:生成|制作|导出)文件[。！!，,\s]*/g,'');
const override=(text:string)=>/这次|本次|仅|只要|只需|详细|简洁|简短|分步|提示|表格|段落|生成|制作|导出|文件|图片|资料|记录|搜索|联网|代码|翻译/.test(taskText(text));
/** Only an identifiable teaching request can test a presentation strategy.
 * Acknowledgements/thanks (including the promotion feedback itself) are not
 * explanations and must never trigger a formatting regression or a trial. */
export function teacherPresentationTask(text:string):boolean{
 const input=text.trim();
 if(!input||input.length>8000||override(input)||/^(?:这样讲正好|这样就很好|这样讲很好|这个讲解很好|这个回答很好|这样可以|好的|好|可以|明白了|知道了|收到|谢谢(?:你)?|感谢|继续)[。！!，,\s]*$/.test(input))return false;
 return /讲解|解答|解析|解释|分析|求解|计算|证明|推导|为什么|为何|怎么|如何|多少|几何|物理|化学|数学/.test(input);
}
/** Pure local presentation checks, explicitly not a mathematical/teaching grader. */
export function teacherPresentationMetrics(text:string,values:TeacherPreferenceValues):Metrics{
 const characters=text.replace(/\s/g,'').length;
 // Fenced examples and quoted source text are not the assistant's procedure.
 let fence:string|undefined;
 const lines=text.split(/\r?\n/).filter(line=>{
  const boundary=line.match(/^\s{0,3}(`{3,}|~{3,})/);
  if(boundary){if(!fence)fence=boundary[1];else if(boundary[1][0]===fence[0]&&boundary[1].length>=fence.length)fence=undefined;return false;}
  return !fence&&!/^\s*>/.test(line);
 });
 const numbered=/^(?:#{1,6}\s*)?(?:\*\*)?(?:步骤\s*)?(?:[一二三四五六七八九十]+[、.：:]|第\s*[一二三四五六七八九十0-9０-９]+\s*步|[0-9０-９]+[.．、：:）)]|[①②③④⑤⑥⑦⑧⑨⑩])/;
 const explicit=lines.filter(line=>numbered.test(line.trim())).length;
 let table=false,tableSteps=0;
 const cells=(line:string)=>/^\s*\|.*\|\s*$/.test(line)?line.trim().slice(1,-1).split(/(?<!\\)\|/).map(v=>v.trim()):undefined;
 for(let i=0;i<lines.length-2;i++){
  const header=cells(lines[i]),separator=cells(lines[i+1]);
  if(!header||header.length<2||!separator||separator.length!==header.length||!separator.every(v=>/^:?-{3,}:?$/.test(v)))continue;
  const rows:string[][]=[];
  while(i+2<lines.length){const row=cells(lines[i+2]);if(!row||row.length!==header.length)break;rows.push(row);i++;}
  if(!rows.length)continue;table=true;
  // Explicit procedure tables or distinct labelled calculations can express steps.
  // A table containing final values alone cannot; totals never inflate the count.
  const procedure=header.some(v=>/步骤|环节|顺序|过程/.test(v));
  const calculation=header.some(v=>/项目|计算|关系|阶段/.test(v));
  const labels=new Set<string>();
  for(const row of rows){const label=row[0].replace(/[*_`\s]/g,'');
   if(!label||/^(?:合计|总计|结论|答案|结果)/.test(label))continue;
   const content=row.slice(1).join(' ');
   if((procedure&&content.replace(/[*_`\s]/g,'').length>=4)||(calculation&&/[=＝→⇒]/.test(content)&&/\d/.test(content)))labels.add(label);
  }
  tableSteps+=labels.size;
 }
 // Avoid counting the same explanation twice when both representations appear.
 const steps=Math.max(explicit,tableSteps);
 const passed=characters>=20&&characters<=16000&&(values.length!=='concise'||characters<=800)&&(values.length!=='detailed'||characters>=350)
  &&(values.structure!=='step_by_step'||steps>=2)&&(values.structure!=='continuous'||steps===0)
  &&(values.presentation!=='table'||table)&&(values.presentation!=='paragraph'||!table);
 return{metric:presentationMetric,characters,steps,table,passed};
}
/** A short direct correction; quoted/source/per-task/factual requests never count. */
export function implicitTeacherCorrection(text:string):TeacherPreferenceValues|undefined{
 if(text.length>160||/[`“”「」『』"<>0-9a-z]/i.test(text)||/引用|资料|原文|例如|假设|如果|学生|同学|成绩|答案|隐私|权限|审批|密钥|这次|本次|只针对|以后|今后|下次|不要记|别记/.test(text))return;
 if(!/太长|太啰嗦|太简略|太短|刚才|这个回答|讲解/.test(text))return;
 const normalized=text.replace(/太长(?:了)?|太啰嗦(?:了)?/g,'简洁').replace(/太简略(?:了)?|太短(?:了)?/g,'详细些');
 const signal=teacherPreferenceSignal('以后'+normalized);
 if(signal.kind!=='candidate')return;
 const patch={...signal.patch};delete patch.exportFormat;delete patch.answerOrder;
 return Object.keys(patch).length?patch:undefined;
}
async function get(sql:Sql,key:string){const r=(await sql.all('SELECT value_json FROM app_settings WHERE key=?',[key]))[0];return r?String(r.value_json):undefined;}
async function put(sql:Sql,key:string,value:unknown){await sql.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',[key,JSON.stringify(value),new Date().toISOString()]);}
async function load(sql:Sql):Promise<Candidate|undefined>{
 const pointer=await get(sql,pendingKey);if(pointer===undefined)return;
 const id=JSON.parse(pointer);if(id===null)return;if(!runId(id))throw Error('configuration');
 return readTeacherCandidate(sql,id);
}
export async function readTeacherCandidate(sql:Sql,id:string):Promise<Candidate>{
 if(!runId(id))throw Error('invalid_input');const raw=await get(sql,prefix+id);if(!raw||raw.length>32768)throw Error('configuration');const c=JSON.parse(raw) as Candidate;
 if(c.schemaVersion!==schema||c.id!==id||!Number.isSafeInteger(c.baselineRevision)||c.baselineRevision<0||!validTeacherPreferenceValues(c.patch)||!Object.keys(c.patch).length||Object.keys(c.patch).some(k=>!['length','structure','presentation'].includes(k))||!['collecting','trial','accepted','failed','superseded'].includes(c.status)||!Array.isArray(c.samples)||c.samples.length>2
  ||c.samples.some(s=>!sessionId(s.sessionId)||!runId(s.runId)||!runId(s.taskRunId)||typeof s.messageId!=='string'||!/^[a-f0-9]{64}$/.test(s.sha256)||!/^[a-f0-9]{64}$/.test(s.taskHash)||!validMetrics(s.before)||s.after!==undefined&&!validMetrics(s.after))
  ||c.sourceVersion!==undefined&&c.sourceVersion!==1||c.revision!==undefined&&(!Number.isSafeInteger(c.revision)||c.revision<1)
  ||c.reason!==undefined&&!['source_changed','legacy_source','baseline_changed','teacher_rejected','quality_failed','metric_changed'].includes(c.reason)
  ||c.samples.some(s=>[s.sourceDigest,s.afterDigest].some(v=>v!==undefined&&!/^[a-f0-9]{64}$/.test(v)))
  ||c.trial&&(!sessionId(c.trial.sessionId)||!runId(c.trial.runId)||typeof c.trial.messageId!=='string'||!/^[a-f0-9]{64}$/.test(c.trial.sha256)||c.trial.metrics!==undefined&&!validMetrics(c.trial.metrics)||[c.trial.sourceDigest,c.trial.resultDigest].some(v=>v!==undefined&&!/^[a-f0-9]{64}$/.test(v))))throw Error('configuration');
 return c;
}
function validMetrics(m:Metrics){return !!m&&(m.metric===undefined||m.metric==='teacher_presentation_observed.v2'||m.metric===presentationMetric)&&Number.isSafeInteger(m.characters)&&m.characters>=0&&Number.isSafeInteger(m.steps)&&m.steps>=0&&typeof m.table==='boolean'&&typeof m.passed==='boolean';}
async function save(sql:Sql,c:Candidate){c.revision=(c.revision||0)+1;await put(sql,prefix+c.id,c);await put(sql,pendingKey,['failed','superseded','accepted'].includes(c.status)?null:c.id);}
export async function teacherCandidateSources(sql:Sql,c:Candidate):Promise<TeacherCandidateReason|undefined>{
 if(c.sourceVersion!==1||c.samples.some(s=>!s.sourceDigest)||c.trial&&!c.trial.sourceDigest)return'legacy_source';
 if(['collecting','trial'].includes(c.status)&&(c.samples.some(s=>s.before.metric!==presentationMetric||s.after&&s.after.metric!==presentationMetric)||c.trial?.metrics&&c.trial.metrics.metric!==presentationMetric))return'metric_changed';
 for(const sample of c.samples){
  if(await teacherSampleSource(sql,sample)!==sample.sourceDigest)return'source_changed';
  const result=await response(sql,sample.sessionId,sample.runId);if(sample.afterDigest&&result?.digest!==sample.afterDigest)return'source_changed';
 }
 if(c.trial){const user=await teacherLearningUser(sql,c.trial.sessionId,c.trial.runId);if(!user||user.id!==c.trial.messageId||hash(user.text)!==c.trial.sha256||user.digest!==c.trial.sourceDigest)return'source_changed';
  if(c.trial.resultDigest&&(await response(sql,c.trial.sessionId,c.trial.runId))?.digest!==c.trial.resultDigest)return'source_changed';}
}
async function previous(sql:Sql,s:Source){
 const rows=await sql.all(`SELECT json_extract(metadata_json,'$.agentRunId') AS runId FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND rowid<(SELECT rowid FROM ai_conversation_messages WHERE id=?) ORDER BY rowid DESC LIMIT 1`,[s.sessionId,s.id]);
 return rows.length&&runId(rows[0].runId)?response(sql,s.sessionId,String(rows[0].runId)):undefined;
}
export async function abandonTeacherLearning(sql:Sql){const c=await load(sql);if(c){c.status='superseded';await save(sql,c);}}
/** Called in the existing preference transaction, only with main-read current user evidence.
 * No model, arbitrary prompt, Office content, student facts, dependency or second AgentLoop. */
export async function observeTeacherLearning(sql:Sql,source:Source,baseline:{revision:number;values:TeacherPreferenceValues;learning?:TeacherLearningEvidence}):Promise<Learning>{
 let c=await load(sql);const correction=implicitTeacherCorrection(source.text),prior=await previous(sql,source);
 if(c){const reason=await teacherCandidateSources(sql,c);if(reason){c.status='superseded';c.reason=reason;await save(sql,c);c=undefined;}}
 // Regressions are measured only on a completed, actually applied pure explanation.
 if(baseline.learning&&prior&&teacherPresentationTask(prior.prompt)){
  const event=await get(sql,'xiaozhi.teacher-preference.v1:event:'+prior.runId);
  if(event&&JSON.parse(event).appliedRevision===baseline.revision&&!teacherPresentationMetrics(prior.content,baseline.values).passed)return{rollback:true};
 }
 if(baseline.learning&&correction&&Object.entries(correction).some(([k,v])=>baseline.values[k as keyof TeacherPreferenceValues]!==v))return{rollback:true};
 if(c&&c.baselineRevision!==baseline.revision){c.status='superseded';c.reason='baseline_changed';await save(sql,c);c=undefined;}
 if(c){
  for(const sample of c.samples){
   const task=await response(sql,sample.sessionId,sample.taskRunId);if(!task)throw Error('configuration');sample.before=teacherPresentationMetrics(task.content,c.patch);
   const result=await response(sql,sample.sessionId,sample.runId);
   if(result){sample.afterDigest=result.digest;sample.after=teacherPresentationMetrics(result.content,c.patch);
    const ratio=c.patch.length==='concise'?sample.after.characters<=sample.before.characters*.8:c.patch.length==='detailed'?sample.after.characters>=sample.before.characters*1.2:true;
    sample.after.passed&&=ratio;
   }
  }
  if(c.samples.some(s=>s.after&&!s.after.passed)){c.status='failed';c.reason='quality_failed';await save(sql,c);c=undefined;}
 }
 if(c?.trial){
  const result=await response(sql,c.trial.sessionId,c.trial.runId);
  if(result){
   c.trial.resultDigest=result.digest;c.trial.metrics=teacherPresentationMetrics(result.content,{...baseline.values,...c.patch});
   if(!c.trial.metrics.passed){c.status='failed';c.reason='quality_failed';await save(sql,c);return{};}
   // Ordinary positive feedback, bound to the exact held-out result, is evidence.
   if(prior?.runId===c.trial.runId&&/^(?:这样讲正好|这样就很好|这样讲很好|这个讲解很好|这个回答很好|这样可以)[。！!\s]*$/.test(source.text)){
    const feedback=await teacherLearningUser(sql,source.sessionId,source.runId),trial=await teacherLearningUser(sql,c.trial.sessionId,c.trial.runId);
    if(!feedback||!trial||feedback.scopeDigest!==trial.scopeDigest||feedback.goalId&&feedback.goalId!==trial.goalId){await save(sql,c);return{};}
    c.status='accepted';await save(sql,c);return{candidateId:c.id,patch:c.patch,evidence:{metric:presentationMetric,candidateId:c.id,trainRuns:c.samples.map(s=>s.runId),holdoutRunId:c.trial.runId}};
   }
  }
  await save(sql,c);return{};
 }
 if(correction&&prior){
  // Temporary formatting directives in the task are not evidence for a global style.
  if(/这次|本次|仅|只需|只要|生成|导出|文件|引用|资料|翻译/.test(taskText(prior.prompt)))return{};
  const before=teacherPresentationMetrics(prior.content,correction);if(before.passed)return{};
  if(c&&JSON.stringify(c.patch)!==JSON.stringify(correction)){c.status='superseded';await save(sql,c);c=undefined;}
  c??={schemaVersion:schema,sourceVersion:1,id:source.runId,baselineRevision:baseline.revision,patch:correction,status:'collecting',samples:[]};
  if(c.samples.length<2&&!c.samples.some(s=>s.sessionId===source.sessionId||s.taskHash===hash(prior.prompt)||s.runId===source.runId)){
   const sample:Sample={sessionId:source.sessionId,runId:source.runId,messageId:source.id,sha256:hash(source.text),taskRunId:prior.runId,taskHash:hash(prior.prompt),before};const digest=await teacherSampleSource(sql,sample);if(!digest)return{};sample.sourceDigest=digest;c.samples.push(sample);
  }
  await save(sql,c);return{candidateId:c.id};
 }
 if(c&&c.samples.length===2&&c.samples.every(s=>s.after?.passed)&&teacherPresentationTask(source.text)&&!c.samples.some(s=>s.taskHash===hash(source.text)||s.runId===source.runId)){
  const user=await teacherLearningUser(sql,source.sessionId,source.runId);if(!user||user.id!==source.id||user.text!==source.text)return{};
  c.trial={sessionId:source.sessionId,runId:source.runId,messageId:source.id,sha256:hash(source.text),sourceDigest:user.digest};c.status='trial';await save(sql,c);return{candidateId:c.id,trial:{...baseline.values,...c.patch}};
 }
 if(c)await save(sql,c);return{};
}
