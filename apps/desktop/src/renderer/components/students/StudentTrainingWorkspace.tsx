import {StudentPracticeResult,PracticeResultDetails} from './StudentPracticeResult';
import {practiceOutcome,PRACTICE_OUTCOMES,type PracticeResultInput} from '../../../shared/practice-result';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button,Input,TextArea} from '@heroui/react';
import {BookOpen,CalendarDays} from 'lucide-react';
import type {Student} from '../../../shared/contracts';
import {STUDENT_CONTEXT_SCHEMA} from '../../../shared/student-context';
import {STUDENT_TRAINING_SCHEMA,TRAINING_RESULT_SCHEMA_V2,validStudentTrainingResult,type StudentTrainingView,type StudentTrainingResultInput,type StudentTrainingEvidence,type StudentTrainingSource} from '../../../shared/student-training';
import type {LearningReviewError} from '../../../shared/learning-review';
import {EmptyState} from '../../heroui-pro/components/empty-state';
import {PiTrainingPlan} from '../office/PiTrainingPlan';
import {MasteryPathWorkspace} from '../MasteryPathWorkspace';
import {StudentEvidencePanel} from './StudentSourceNavigation';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {StudentTrainingNext} from './StudentTrainingNext';
import {trainingTutorDraft,trainingResultTutorDraft,type TrainingTutorMode} from '../../../shared/training-progress';
import './student-training.css';
import {PaperSelect} from '../paper-ui/PaperSelect';
import styles from '../../ui-system/student-training.module.css';
const outcomes=PRACTICE_OUTCOMES;
const message:Record<LearningReviewError,string>={invalid_input:'请核对日期、表现与说明；发生时间不能晚于当前时间。',permission_denied:'学生已归档或不可用，无法读取或保存。',source_changed:'学习证据或计划已变化，请刷新后核对。',conflict:'已有新的计划或本次内容已变化，请刷新后重试。',unavailable:'本地操作未完成，请重试。',cancelled:'操作已取消。',no_evidence:'请先补充实际学习结果。'};
export function StudentTrainingState({student,value,loading,error,onRefresh,onContinue,children,nextStep}:{student?:Student;value?:StudentTrainingView;loading:boolean;error:string;onRefresh:()=>void;onContinue:()=>void;children?:React.ReactNode;nextStep?:React.ReactNode}){
 return <section className={styles.workspace} data-testid="student-training-workspace"><header className={styles.actions}><div><h2><CalendarDays size={22}/>{student?`${student.displayName}的学习计划`:'学习计划'}</h2><p>查看教师已确认的安排，并记录实际学习结果。</p></div><div className={styles.actions}><Button variant="ghost" data-testid="student-training-refresh" isDisabled={loading||!student} onPress={onRefresh}>刷新</Button><Button variant="primary" data-testid="student-training-continue" isDisabled={loading||!student||student.status!=='active'} onPress={onContinue}>{value?.plan?'请小智重新分析':'请小智安排训练'}</Button></div></header>
  {loading?<p role="status" data-testid="student-training-loading">正在读取学习计划…</p>:error?<div role="alert" data-testid="student-training-error"><p>{error}</p><Button variant="ghost" onPress={onRefresh}>重试</Button></div>:!student||!value?.plan?<EmptyState data-testid="student-training-empty"><EmptyState.Header><EmptyState.Media variant="icon"><CalendarDays size={24}/></EmptyState.Media><EmptyState.Title>{student?'还没有已确认的训练计划':'请先选择学生'}</EmptyState.Title><EmptyState.Description>{student?'可以请小智根据已有学习结果提出安排，核对后会出现在这里。':'从学生档案选择需要安排训练的学生。'}</EmptyState.Description></EmptyState.Header></EmptyState>:<><p data-testid="student-training-version">版本 {value.plan.version} · 教师确认于 {new Date(value.plan.confirmedAt).toLocaleString('zh-CN')}</p>{(!value.plan.sourceCurrent||!value.plan.strategyCurrent)&&<p role="status" className="student-training-warning" data-testid="student-training-stale">这份安排所依据的学习结果或复习策略已有变化。可以请小智重新分析，也可以继续按当前确认版本如实记录。</p>}{nextStep}<PiTrainingPlan plan={value.plan.plan}/><p>{value.plan.reason}</p></>}
  {children}
 </section>;
}
function localTime(){const date=new Date();return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
/** Reads existing confirmed strategies; actual results remain ordinary local learning records. */
export function StudentTrainingWorkspace({activeStudent,setStatus}:{activeStudent?:Student;setStatus:(message:string)=>void}){
 const navigation=useDesktopNavigation(),[value,setValue]=useState<StudentTrainingView>(),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[resultOpen,setResultOpen]=useState(false),[legacy,setLegacy]=useState(false),[evidence,setEvidence]=useState<StudentTrainingEvidence>(),[notice,setNotice]=useState('');
 const [day,setDay]=useState(1),[result,setResult]=useState<StudentTrainingResultInput['result']|''>(''),[occurredAt,setOccurredAt]=useState(localTime),[notes,setNotes]=useState(''),[allowHistorical,setAllowHistorical]=useState(false);
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
 async function tutorDay(selectedDay:number,mode:TrainingTutorMode,selectedResult?:StudentTrainingView['results'][number]){
  if(!activeStudent||!value?.plan||lock.current||resultOpen)return;
  const stamp=generation.current,owner=Symbol(),expected=value.plan;lock.current=owner;setBusy(true);setNotice('');
  try{
   const response=await window.omniEdu?.getStudentTraining({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId:activeStudent.id});
   if(stamp!==generation.current)return;
   if(!response?.ok){setNotice(response?message[response.error]:'学习计划未读取，请重试。');return;}
   const current=response.value.plan;
   if(!current||current.id!==expected.id||current.version!==expected.version||!selectedResult&&!current.plan.days.some(d=>d.day===selectedDay&&d.activity!=='rest')){setNotice('学习计划已变化，请刷新后选择当天安排。');return;}
   const actual=selectedResult?response.value.results.find(entry=>entry.recordId===selectedResult.recordId&&entry.tutorReference===selectedResult.tutorReference):undefined;
   if(selectedResult&&(!actual?.tutorReference||actual.planVersion!==selectedResult.planVersion||actual.day!==selectedDay)){setNotice('这次学习结果已变化或不在当前列表，请刷新后重新选择。');return;}
   const sessions=await window.omniEdu?.listAiConversations();if(stamp!==generation.current)return;
   const remembered=localStorage.getItem('xiaozhi.current-session.v1');
   const candidates=sessions?.sessions.filter(s=>s.studentId===activeStudent.id&&!s.archivedAt)||[];
   const existing=candidates.find(s=>s.id===remembered)||candidates[0];
   const detail=existing?{session:existing}:await window.omniEdu?.createStudentConversation({schemaVersion:STUDENT_CONTEXT_SCHEMA,studentId:activeStudent.id});
   if(stamp!==generation.current)return;if(!detail)throw new Error();
   navigation.navigate({view:'ai',sessionId:detail.session.id,draft:actual?.tutorReference?trainingResultTutorDraft({...actual,tutorReference:actual.tutorReference},mode==='explain'?'explain':'reflect'):trainingTutorDraft(current.version,selectedDay,mode)});
  }catch{if(stamp===generation.current)setNotice('未能继续当天辅导，请重试。');}
  finally{if(lock.current===owner){lock.current=null;setBusy(false);}}
 }
 function beginResult(selectedDay?:number){setPractice(undefined);setPracticeError('');const first=value?.plan?.plan.days.find(d=>d.activity!=='rest');setDay(selectedDay??value?.progress?.nextDay??value?.progress?.reviewDays[0]??first?.day??1);setResult('');setOccurredAt(localTime());setNotes('');setAllowHistorical(false);attempt.current=undefined;setNotice('');setResultOpen(true);}
 async function save(){
  if(!activeStudent||!value?.plan||lock.current)return;
  if(practiceError){setNotice(practiceError);return;}
  const date=new Date(occurredAt);if(!Number.isFinite(date.getTime())){setNotice(message.invalid_input);return;}
  const fields={schemaVersion:TRAINING_RESULT_SCHEMA_V2,studentId:activeStudent.id,planId:value.plan.id,planVersion:value.plan.version,day,result:practice?practiceOutcome(practice.answers):result,occurredAt:date.toISOString(),notes,allowHistorical,...(practice?{practice}:{})};
  const raw={...fields,requestId:attempt.current&&Object.entries(fields).every(([k,v])=>JSON.stringify(attempt.current![k as keyof StudentTrainingResultInput])===JSON.stringify(v))?attempt.current.requestId:crypto.randomUUID()};
  if(!validStudentTrainingResult(raw)){setNotice(message.invalid_input);return;}
  if((!value.plan.sourceCurrent||!value.plan.strategyCurrent)&&!allowHistorical){setNotice('请确认仍按这份安排记录，或让小智重新分析。');return;}
  attempt.current=raw;const stamp=generation.current,owner=Symbol();lock.current=owner;setBusy(true);setNotice('');
  try{const response=await window.omniEdu?.recordStudentTrainingResult(raw);if(stamp!==generation.current)return;if(!response?.ok){setNotice(response?message[response.error]:'结果未保存，请重试。');return;}setResultOpen(false);attempt.current=undefined;setStatus('实际学习结果已保存，可以请小智重新分析。');setNotice('实际学习结果已保存。');await load();}
  catch{if(stamp===generation.current)setNotice('结果未确认保存，请重试；重复请求不会重复记入。');}finally{if(lock.current===owner){lock.current=null;setBusy(false);}}
 }
 return <StudentTrainingState student={activeStudent} value={value} loading={loading} error={error} onRefresh={()=>{if(!lock.current)void load();}} onContinue={()=>void continueLearning()} nextStep={value&&!loading&&!error?<StudentTrainingNext value={value} disabled={busy||resultOpen||activeStudent?.status!=='active'} onTutor={(day,mode)=>void tutorDay(day,mode)} onRecord={beginResult}/>:undefined}>
  {notice&&<p role="alert" data-testid="student-training-notice">{notice}</p>}
  {value?.plan&&!loading&&!error&&<>
   <div className="student-training-sources" data-testid="student-training-sources">{value.plan.sources.map(source=><Button key={source.reference.recordId} variant="ghost" data-testid="student-training-source" isDisabled={busy} onPress={()=>void openSource(source.reference)}><BookOpen size={16}/>{source.title}</Button>)}</div>
   {evidence&&<StudentEvidencePanel view={evidence} onClose={()=>setEvidence(undefined)}/>}
   {!resultOpen?<Button variant="secondary" data-testid="student-training-record" isDisabled={busy||activeStudent?.status!=='active'} onPress={()=>beginResult()}>记录实际学习结果</Button>:<form className={styles.form} data-testid="student-training-result-form" onSubmit={e=>{e.preventDefault();void save();}}><h3>记录实际学习结果</h3><p>如实选择本次表现；未答不会算答错或练习次数，之后补测另记一次。关联逐题作答时，整体表现只概括已答题。</p><fieldset disabled={busy}><div className={styles.fields}><PaperSelect label="对应安排" testId="training-result-day" value={String(day)} disabled={busy} onChange={day=>setDay(Number(day))} options={value.plan.plan.days.filter(d=>d.activity!=='rest').map(d=>({id:String(d.day),label:`第 ${d.day} 天 · ${value.plan!.plan.topics.find(t=>t.id===d.pointId)?.name}`}))}/><PaperSelect label="本次表现" testId="training-result-outcome" value={practice?practiceOutcome(practice.answers):result} disabled={busy||Boolean(practice)||Boolean(practiceError)} onChange={result=>setResult(result as StudentTrainingResultInput['result'])} options={[{id:'',label:'请选择本次表现'},...Object.entries(outcomes).map(([id,label])=>({id,label}))]}/><label>实际发生时间<Input data-testid="training-result-time" type="datetime-local" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)}/></label><label>观察与说明<TextArea rows={3} data-testid="training-result-notes" maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="记录实际表现，例如解释中仍遗漏了适用前提。"/></label></div><StudentPracticeResult key={activeStudent!.id+':'+day} studentId={activeStudent!.id} topic={value.plan.plan.topics.find(t=>t.id===value.plan!.plan.days.find(d=>d.day===day)?.pointId)!} disabled={busy} onChange={practiceChanged}/>{(!value.plan.sourceCurrent||!value.plan.strategyCurrent)&&<label className="student-training-historical"><input data-testid="training-result-historical" type="checkbox" checked={allowHistorical} onChange={e=>setAllowHistorical(e.target.checked)}/>我确认仍按这份安排记录本次实际结果</label>}<div className={styles.actions}><Button type="submit" variant="primary" data-testid="training-result-save" isPending={busy}>保存结果</Button><Button type="button" variant="ghost" data-testid="training-result-cancel" onPress={()=>{setResultOpen(false);attempt.current=undefined;setNotice('');}}>取消</Button></div></fieldset></form>}
   <section className={styles.section} data-testid="student-training-results"><h3>已记录的实际结果</h3><p>共 {value.totalResults} 次记录，显示最近 {value.results.length} 次。</p>{value.results.length?value.results.map(entry=><article key={entry.recordId} className={styles.entry} data-testid="training-result-entry"><strong>计划版本 {entry.planVersion} · 第 {entry.day} 天 · {outcomes[entry.result]}</strong><p>{new Date(entry.occurredAt).toLocaleString('zh-CN')}</p><p>{entry.notes||'未填写补充说明'}</p>{entry.practice&&<PracticeResultDetails value={entry.practice} studentId={activeStudent!.id}/>}<div className={styles.actions}><Button variant="secondary" data-testid="training-result-reflect" isDisabled={busy||resultOpen||!entry.tutorReference||activeStudent?.status!=='active'} onPress={()=>void tutorDay(entry.day,'reflect',entry)}>复盘这次作答</Button><Button variant="ghost" data-testid="training-result-explain" isDisabled={busy||resultOpen||!entry.tutorReference||activeStudent?.status!=='active'} onPress={()=>void tutorDay(entry.day,'explain',entry)}>继续讲解</Button></div></article>):<p>尚未记录实际结果；安排本身不会计入学习记录。</p>}</section>
  </>}
  {activeStudent&&<div className="student-training-legacy"><Button variant="ghost" data-testid="student-training-legacy" onPress={()=>setLegacy(v=>!v)}>{legacy?'收起此前学习路径':'查看此前学习路径'}</Button>{legacy&&<MasteryPathWorkspace activeStudent={activeStudent} setStatus={setStatus} onOpenAi={()=>void continueLearning()}/>}</div>}
 </StudentTrainingState>;
}
