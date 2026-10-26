import type {Sql} from '../xiaozhi-agent/session-state';
import type {TeacherCandidateInput,TeacherCandidateSummary} from '../../shared/teacher-candidates';
import {readTeacherCandidate,teacherCandidateSources,teacherPresentationMetrics,type TeacherCandidate} from './teacher-preference-learning';
import {teacherLearningResponse} from './teacher-preference-sources';
import {createTeacherPreferenceState,teacherPreferenceAt} from './teacher-preference-state';
const prefix='xiaozhi.teacher-preference.v1:learning:';
const validSession=(id:unknown):id is string=>typeof id==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(id);
export function createTeacherCandidateCatalog(sql:Sql){
 async function authorize(work:Sql,id:string){if(!validSession(id))throw Error('invalid_input');if(!(await work.all('SELECT id FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL',[id])).length)throw Error('permission_denied');}
 async function summary(work:Sql,c:TeacherCandidate):Promise<TeacherCandidateSummary>{
  const snapshot=await createTeacherPreferenceState(work).snapshot(),baseline=await teacherPreferenceAt(work,c.baselineRevision),reason=await teacherCandidateSources(work,c);
  let evaluated=0,passed=0;for(const sample of c.samples){const before=await teacherLearningResponse(work,sample.sessionId,sample.taskRunId),after=await teacherLearningResponse(work,sample.sessionId,sample.runId);
   if(!before||!after)continue;evaluated++;const a=teacherPresentationMetrics(after.content,c.patch),b=teacherPresentationMetrics(before.content,c.patch);
   if(a.passed&&(c.patch.length==='concise'?a.characters<=b.characters*.8:c.patch.length==='detailed'?a.characters>=b.characters*1.2:true))passed++;
  }
  const holdout=c.trial?await teacherLearningResponse(work,c.trial.sessionId,c.trial.runId):undefined;
  const row=snapshot.revision?(await work.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.teacher-preference.v1:version:'+snapshot.revision]))[0]:undefined;
  const activeVersion=row&&JSON.parse(String(row.value_json)).learning?.candidateId===c.id?snapshot.revision:undefined;
  return{id:c.id,revision:c.revision||0,status:c.status,...(c.reason||reason?{reason:c.reason||reason}:{}),patch:{...c.patch},baselineRevision:c.baselineRevision,sourceCurrent:!reason,baselineCurrent:snapshot.revision===c.baselineRevision,training:{total:c.samples.length,evaluated,passed},holdout:!c.trial?'not_started':!holdout?'waiting':teacherPresentationMetrics(holdout.content,{...baseline.values,...c.patch}).passed?'passed':'failed',metric:'presentation_only',...(activeVersion?{activeVersion}:{})};
 }
 async function transaction<T>(action:(work:Sql)=>Promise<T>){if(!sql.transaction)throw Error('configuration');return sql.transaction(action);}
 async function load(work:Sql,input:TeacherCandidateInput){
  if(!input||typeof input!=='object'||Object.keys(input).sort().join(',')!=='id,revision,sessionId'||!Number.isSafeInteger(input.revision)||input.revision<0)throw Error('invalid_input');await authorize(work,input.sessionId);
  const candidate=await readTeacherCandidate(work,input.id);if((candidate.revision||0)!==input.revision)throw Error('conflict');return candidate;
 }
 return{
  list:(sessionId:string)=>transaction(async work=>{await authorize(work,sessionId);const rows=await work.all('SELECT key FROM app_settings WHERE key LIKE ? ORDER BY updated_at DESC,key DESC LIMIT 20',[prefix+'run_%']);const items=[];for(const row of rows)items.push(await summary(work,await readTeacherCandidate(work,String(row.key).slice(prefix.length))));return items;}),
  evaluate:(input:TeacherCandidateInput)=>transaction(async work=>summary(work,await load(work,input))),
  reject:(input:TeacherCandidateInput)=>transaction(async work=>{const candidate=await load(work,input);if(!['collecting','trial'].includes(candidate.status))throw Error('conflict');const key=prefix+candidate.id,raw=String((await work.all('SELECT value_json FROM app_settings WHERE key=?',[key]))[0]?.value_json);
   const next={...candidate,revision:(candidate.revision||0)+1,status:'superseded' as const,reason:'teacher_rejected' as const};
   await work.run('UPDATE app_settings SET value_json=?,updated_at=? WHERE key=? AND value_json=?',[JSON.stringify(next),new Date().toISOString(),key,raw]);if(Number((await work.all('SELECT changes() AS n'))[0]?.n)!==1)throw Error('conflict');
   await work.run('UPDATE app_settings SET value_json=?,updated_at=? WHERE key=? AND value_json=?',['null',new Date().toISOString(),prefix+'pending',JSON.stringify(candidate.id)]);return summary(work,next);
  })
 };
}
