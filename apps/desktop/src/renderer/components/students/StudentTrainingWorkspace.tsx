import {StudentPracticeResult,PracticeResultDetails} from './StudentPracticeResult';
import {practiceOutcome,type PracticeResultInput} from '../../../shared/practice-result';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {BookOpen,CalendarDays} from 'lucide-react';
import type {Student} from '../../../shared/contracts';
import {STUDENT_CONTEXT_SCHEMA} from '../../../shared/student-context';
import {STUDENT_TRAINING_SCHEMA,validStudentTrainingResult,type StudentTrainingView,type StudentTrainingResultInput,type StudentTrainingEvidence,type StudentTrainingSource} from '../../../shared/student-training';
import type {LearningReviewError} from '../../../shared/learning-review';
import {EmptyState} from '../../heroui-pro/components/empty-state';
import {PiTrainingPlan} from '../office/PiTrainingPlan';
import {MasteryPathWorkspace} from '../MasteryPathWorkspace';
import {StudentEvidencePanel} from './StudentSourceNavigation';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import './student-training.css';
const outcomes={correct:'正确',incorrect:'错误',partial:'部分正确'};
const message:Record<LearningReviewError,string>={invalid_input:'请核对日期、表现与说明；发生时间不能晚于当前时间。',permission_denied:'学生已归档或不可用，无法读取或保存。',source_changed:'学习证据或计划已变化，请刷新后核对。',conflict:'已有新的计划或本次内容已变化，请刷新后重试。',unavailable:'本地操作未完成，请重试。',cancelled:'操作已取消。',no_evidence:'请先补充实际学习结果。'};
export function StudentTrainingState({student,value,loading,error,onRefresh,onContinue,children}:{student?:Student;value?:StudentTrainingView;loading:boolean;error:string;onRefresh:()=>void;onContinue:()=>void;children?:React.ReactNode}){
 return <section className="student-training" data-testid="student-training-workspace"><header className="student-training-header"><div><h2><CalendarDays size={22}/>{student?`${student.displayName}的学习计划`:'学习计划'}</h2><p>查看教师已确认的安排，并记录实际学习结果。</p></div><div className="student-training-actions"><Button variant="ghost" data-testid="student-training-refresh" isDisabled={loading||!student} onPress={onRefresh}>刷新</Button><Button variant="primary" data-testid="student-training-continue" isDisabled={loading||!student||student.status!=='active'} onPress={onContinue}>{value?.plan?'请小智重新分析':'请小智安排训练'}</Button></div></header>
  {loading?<p role="status" data-testid="student-training-loading">正在读取学习计划…</p>:error?<div role="alert" data-testid="student-training-error"><p>{error}</p><Button variant="ghost" onPress={onRefresh}>重试</Button></div>:!student||!value?.plan?<EmptyState data-testid="student-training-empty"><EmptyState.Header><EmptyState.Media variant="icon"><CalendarDays size={24}/></EmptyState.Media><EmptyState.Title>{student?'还没有已确认的训练计划':'请先选择学生'}</EmptyState.Title><EmptyState.Description>{student?'可以请小智根据已有学习结果提出安排，核对后会出现在这里。':'从学生档案选择需要安排训练的学生。'}</EmptyState.Description></EmptyState.Header></EmptyState>:<><p data-testid="student-training-version">版本 {value.plan.version} · 教师确认于 {new Date(value.plan.confirmedAt).toLocaleString('zh-CN')}</p>{(!value.plan.sourceCurrent||!value.plan.strategyCurrent)&&<p role="status" className="student-training-warning" data-testid="student-training-stale">这份安排是历史计划：学习结果或复习策略已有变化。可以请小智重新分析，实际学习结果仍应如实记录。</p>}<PiTrainingPlan plan={value.plan.plan}/><p>{value.plan.reason}</p></>}
  {children}
 </section>;
}
function localTime(){const date=new Date();return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
/** Reads existing confirmed strategies; actual results remain ordinary local learning records. */
export function StudentTrainingWorkspace({activeStudent,setStatus}:{activeStudent?:Student;setStatus:(message:string)=>void}){
 const navigation=useDesktopNavigation(),[value,setValue]=useState<StudentTrainingView>(),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[resultOpen,setResultOpen]=useState(false),[legacy,setLegacy]=useState(false),[evidence,setEvidence]=useState<StudentTrainingEvidence>(),[notice,setNotice]=useState('');
 const [day,setDay]=useState(1),[result,setResult]=useState<StudentTrainingResultInput['result']>('partial'),[occurredAt,setOccurredAt]=useState(localTime),[notes,setNotes]=useState(''),[allowHistorical,setAllowHistorical]=useState(false);
 const [practice,setPractice]=useState<PracticeResultInput>(),[practiceError,setPracticeError]=useState('');
 const practiceChanged=useCallback((value?:PracticeResultInput,error?:string)=>{setPractice(value);setPracticeError(error||'');},[]);
 const generation=useRef(0),lock=useRef<symbol|null>(null),attempt=useRef<StudentTrainingResultInput|undefined>(undefined);
 const load=useCallback(async()=>{
  const stamp=++generation.current;setLoading(true);setError('');setValue(undefined);setEvidence(undefined);
  if(!activeStudent){setLoading(false);return;}
  try{const response=await window.omniEdu?.getStudentTraining({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId:activeStudent.id});if(stamp!==generation.current)return;if(!response?.ok){setError(response?message[response.error]:'本地计划未读取，请重试。');return;}setValue(response.value);}
  catch{if(stamp===generation.current)setError('本地计划未读取，请重试。');}finally{if(stamp===generation.current)setLoading(false);}
 },[activeStudent?.id,activeStudent?.status]);
 useEffect(()=>{setResultOpen(false);setLegacy(false);setNotice('');setBusy(false);lock.current=null;attempt.current=undefined;void load();return()=>{generation.current++;lock.current=null;};},[load]);
 async function continueLearning(){
  if(!activeStudent||lock.current)return;const stamp=generation.current,owner=Symbol();lock.current=owner;setBusy(true);setNotice('');
  try{const detail=await window.omniEdu?.createStudentConversation({schemaVersion:STUDENT_CONTEXT_SCHEMA,studentId:activeStudent.id});if(stamp!==generation.current)return;if(!detail)throw new Error();navigation.navigate({view:'ai',sessionId:detail.session.id,draft:value?.plan?'请实际读取当前学生的最新学习结果，核对训练计划与来源，解释变化，再为接下来两周调整安排，等待我编辑确认。':'请根据当前学生实际保存的错题和学习结果安排接下来两周训练，先读取证据；证据不足时说明需要补充什么，提出安排后等待我编辑确认。'});}
  catch{if(stamp===generation.current)setNotice('未能发起学习对话，请重试。');}finally{if(lock.current===owner){lock.current=null;setBusy(false);}}
 }
 async function openSource(source:StudentTrainingSource){const stamp=generation.current;setNotice('');try{const response=await window.omniEdu?.getStudentTrainingSource(source);if(stamp!==generation.current)return;if(!response?.ok){setNotice(response?message[response.error]:'来源未读取，请重试。');return;}setEvidence(response.value);}catch{if(stamp===generation.current)setNotice('来源未读取，请重试。');}}
 function beginResult(){setPractice(undefined);setPracticeError('');const first=value?.plan?.plan.days.find(d=>d.activity!=='rest');setDay(first?.day||1);setResult('partial');setOccurredAt(localTime());setNotes('');setAllowHistorical(false);attempt.current=undefined;setNotice('');setResultOpen(true);}
 async function save(){
  if(!activeStudent||!value?.plan||lock.current)return;
  if(practiceError){setNotice(practiceError);return;}
  const date=new Date(occurredAt);if(!Number.isFinite(date.getTime())){setNotice(message.invalid_input);return;}
  const fields={schemaVersion:STUDENT_TRAINING_SCHEMA,studentId:activeStudent.id,planId:value.plan.id,planVersion:value.plan.version,day,result:practice?practiceOutcome(practice.answers):result,occurredAt:date.toISOString(),notes,allowHistorical,...(practice?{practice}:{})};
  const raw={...fields,requestId:attempt.current&&Object.entries(fields).every(([k,v])=>JSON.stringify(attempt.current![k as keyof StudentTrainingResultInput])===JSON.stringify(v))?attempt.current.requestId:crypto.randomUUID()};
  if(!validStudentTrainingResult(raw)){setNotice(message.invalid_input);return;}
  if((!value.plan.sourceCurrent||!value.plan.strategyCurrent)&&!allowHistorical){setNotice('请先确认仍按这份历史安排记录，或让小智重新分析。');return;}
  attempt.current=raw;const stamp=generation.current,owner=Symbol();lock.current=owner;setBusy(true);setNotice('');
  try{const response=await window.omniEdu?.recordStudentTrainingResult(raw);if(stamp!==generation.current)return;if(!response?.ok){setNotice(response?message[response.error]:'结果未保存，请重试。');return;}setResultOpen(false);attempt.current=undefined;setStatus('实际学习结果已保存，可以请小智重新分析。');setNotice('实际学习结果已保存。');await load();}
  catch{if(stamp===generation.current)setNotice('结果未确认保存，请重试；重复请求不会重复记入。');}finally{if(lock.current===owner){lock.current=null;setBusy(false);}}
 }
 return <StudentTrainingState student={activeStudent} value={value} loading={loading} error={error} onRefresh={()=>{if(!lock.current)void load();}} onContinue={()=>void continueLearning()}>
  {notice&&<p role="alert" data-testid="student-training-notice">{notice}</p>}
  {value?.plan&&!loading&&!error&&<>
   <div className="student-training-sources" data-testid="student-training-sources">{value.plan.sources.map(source=><Button key={source.reference.recordId} variant="ghost" data-testid="student-training-source" isDisabled={busy} onPress={()=>void openSource(source.reference)}><BookOpen size={16}/>{source.title}</Button>)}</div>
   {evidence&&<StudentEvidencePanel view={evidence} onClose={()=>setEvidence(undefined)}/>}
   {!resultOpen?<Button variant="secondary" data-testid="student-training-record" isDisabled={busy||activeStudent?.status!=='active'} onPress={beginResult}>记录实际学习结果</Button>:<form className="student-training-form" data-testid="student-training-result-form" onSubmit={e=>{e.preventDefault();void save();}}><h3>记录实际学习结果</h3><p>填写本次学习的整体表现。概念理解与迁移表现还需核对具体依据。</p><fieldset disabled={busy}><div className="student-training-fields"><label>对应安排<select data-testid="training-result-day" value={day} onChange={e=>setDay(Number(e.target.value))}>{value.plan.plan.days.filter(d=>d.activity!=='rest').map(d=><option key={d.day} value={d.day}>第 {d.day} 天 · {value.plan!.plan.topics.find(t=>t.id===d.pointId)?.name}</option>)}</select></label><label>本次表现<select data-testid="training-result-outcome" value={practice?practiceOutcome(practice.answers):result} disabled={Boolean(practice)||Boolean(practiceError)} onChange={e=>setResult(e.target.value as StudentTrainingResultInput['result'])}>{Object.entries(outcomes).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>实际发生时间<input data-testid="training-result-time" type="datetime-local" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)}/></label><label>观察与说明<textarea data-testid="training-result-notes" maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="记录实际表现，例如解释中仍遗漏了适用前提。"/></label></div><StudentPracticeResult key={activeStudent!.id+':'+day} studentId={activeStudent!.id} topic={value.plan.plan.topics.find(t=>t.id===value.plan!.plan.days.find(d=>d.day===day)?.pointId)!} disabled={busy} onChange={practiceChanged}/>{(!value.plan.sourceCurrent||!value.plan.strategyCurrent)&&<label className="student-training-historical"><input data-testid="training-result-historical" type="checkbox" checked={allowHistorical} onChange={e=>setAllowHistorical(e.target.checked)}/>我确认仍按这份历史安排记录本次实际结果</label>}<div className="student-training-actions"><Button type="submit" variant="primary" data-testid="training-result-save" isPending={busy}>保存结果</Button><Button type="button" variant="ghost" data-testid="training-result-cancel" onPress={()=>{setResultOpen(false);attempt.current=undefined;setNotice('');}}>取消</Button></div></fieldset></form>}
   <section className="student-training-results" data-testid="student-training-results"><h3>已记录的实际结果</h3><p>共 {value.totalResults} 次记录，显示最近 {value.results.length} 次。</p>{value.results.length?value.results.map(entry=><article key={entry.recordId}><strong>计划版本 {entry.planVersion} · 第 {entry.day} 天 · {outcomes[entry.result]}</strong><p>{new Date(entry.occurredAt).toLocaleString('zh-CN')}</p><p>{entry.notes||'未填写补充说明'}</p>{entry.practice&&<PracticeResultDetails value={entry.practice} studentId={activeStudent!.id}/>}</article>):<p>尚未记录实际结果；安排本身不会计入学习记录。</p>}</section>
  </>}
  {activeStudent&&<div className="student-training-legacy"><Button variant="ghost" data-testid="student-training-legacy" onPress={()=>setLegacy(v=>!v)}>{legacy?'收起此前学习路径':'查看此前学习路径'}</Button>{legacy&&<MasteryPathWorkspace activeStudent={activeStudent} setStatus={setStatus} onOpenAi={()=>void continueLearning()}/>}</div>}
 </StudentTrainingState>;
}
