import {useState} from 'react';
import {useQuestionEditGuard} from './paper-ui/QuestionEditGuard';
import type {QuestionBankItem} from '../../shared/contracts';
import {archiveIssueLabels,archiveEligible,archiveNeedsVerification,type ArchiveFields} from '../../shared/question-archive';
import {MaterialSourceLink} from './product/MaterialSourceNavigation';
import './question-archive.css';
import {NATIVE_IMAGE_SCHEMA} from '../../shared/native-question-image';
export function QuestionArchiveEditor({question,onSaved,openDisabled=false}:{question:QuestionBankItem;onSaved:()=>Promise<void>;openDisabled?:boolean}){
 const [fields,setFields]=useState<ArchiveFields>(),[version,setVersion]=useState(''),[difficultyChosen,setDifficultyChosen]=useState(false),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [committed,setCommitted]=useState(false);
 const editRoot = useQuestionEditGuard(!!fields || busy);
 if(!question.archive)return null;const archive=question.archive;
 async function edit(){if(openDisabled||busy)return;setBusy(true);setError('');try{const result=await window.omniEdu!.getArchivedQuestionVersion(question.id);const q=result.question;setFields({stem:q.stem,answer:q.answer,analysis:q.analysis,subject:q.subject,grade:q.grade,knowledgePoint:q.knowledgePoint,questionType:q.questionType,difficulty:q.difficulty});setVersion(result.version);setDifficultyChosen(!q.archive?.issues.includes('missing_difficulty'));setChecked(q.archive?.sourceChecked||false);}catch{setError('题目暂不可编辑，请刷新后重试。');}finally{setBusy(false);}}
 async function save(){
  if(!fields||busy)return;
  setBusy(true);setError('');
  let written=committed;
  try{
   if(!written){
    await window.omniEdu!.editArchivedQuestion({questionId:question.id,version,fields,sourceChecked:checked});
    written=true;setCommitted(true);
   }
   // Retrying a failed readback must not issue another edit with the old source version.
   await onSaved();setFields(undefined);setCommitted(false);
  }catch(error){
   setError(written?'补正已提交，但重新读取题本失败。输入仍保留，请重新读取保存结果，或取消编辑后稍后查看。':
    error instanceof Error&&/web_answer_question_changed|book_answer_question_changed/.test(error.message)?'题面已改变，请同时核对修改或清空原来源答案与解析后再保存；旧来源记录会保留。':'保存失败：题目或原资料可能已变化。请取消编辑并重新打开，检查原件后重试。');
  }finally{setBusy(false);}
 }
 return <section ref={editRoot} data-testid={'question-archive-'+question.id} className="question-archive">
  <p data-testid="question-archive-eligibility"><strong>{archive.state==='teacher_edited'?'教师已编辑':archive.web?'联网补答':archive.ai?archive.state==='ai_final'?'AI自动定稿':'AI整理待补全':'自动文本抽题'} · 原题号 {archive.number==='0'?'未编号':archive.number}</strong>　{archiveEligible(question)?'可作为组卷候选，正式试卷集中确认':'待整理或核验，暂不用于组卷'}</p>
  {archiveNeedsVerification(archive)&&<p role="note" data-testid="question-archive-verification-pending">题面尚未经AI整理或老师对照核验。可回资料页开启AI整理，或打开原资料、核对题目后在编辑中勾选核验；仅保存分类和答案不会解除此状态。</p>}
  {archive.web&&<p data-testid="question-web-provenance">已保留独立网页题解记录；已有原资料和教师内容不被自动覆盖，来源不代表答案正确。</p>}
  {archive.ai&&<p data-testid="question-ai-provenance">{archive.ai.provider} · {archive.ai.model} · 整理与复核记录保存在本机。AI定稿未经教师逐题确认，答案和解析仍需在正式组卷时核对。</p>}
  {archive.issues.length>0&&<p role="note" data-testid="question-archive-issues">{archive.issues.map(i=>archiveIssueLabels[i]).join('；')}</p>}
  <ul>{archive.sources.map((source,i)=><MaterialSourceLink key={source.chunkId} source={{title:`打开原资料 · 第${source.offset+1}段${archive.sources.length>1?`（${i+1}/${archive.sources.length}）`:''}`,material:source}}/>)}</ul>
  {!fields?<button className="secondary-action" disabled={openDisabled||busy||committed} onClick={()=>void edit()} data-testid={'question-archive-edit-'+question.id}>编辑题目与分类</button>:<div className="question-notebook-form" data-testid="question-archive-form">
   {([['subject','学科'],['grade','年级'],['knowledgePoint','知识点'],['questionType','题型']] as const).map(([key,label])=><label key={key}>{label}<input disabled={busy||committed} value={fields[key]} maxLength={128} onChange={e=>setFields({...fields,[key]:e.target.value})} data-testid={'question-archive-'+key}/></label>)}
   <label>难度<select disabled={busy||committed} value={difficultyChosen?fields.difficulty:''} onChange={e=>{setFields({...fields,difficulty:e.target.value as ArchiveFields['difficulty']});setDifficultyChosen(true);}}><option value='' disabled>请选择难度</option><option value="easy">基础</option><option value="medium">中等</option><option value="hard">困难</option></select></label>
   {([['stem','题干'],['answer','答案'],['analysis','解析']] as const).map(([key,label])=><label key={key}>{label}<textarea disabled={busy||committed} value={fields[key]} maxLength={12000} onChange={e=>{setFields({...fields,[key]:e.target.value});if(key==='stem')setChecked(false);}} data-testid={'question-archive-'+key}/></label>)}
   {archive.native&&<><p>修改题干会撤销旧题面图与图义资格。纯文字题可在核对后保存；图文题可恢复原AI题干，或回资料页重新按题整理。</p><button className="secondary-action" disabled={busy||committed} data-testid="question-native-restore-stem" onClick={()=>{setBusy(true);setError('');void window.omniEdu!.getNativeQuestionOriginal({schemaVersion:NATIVE_IMAGE_SCHEMA,questionId:question.id,version}).then(result=>{setFields({...fields,stem:result.stem});setChecked(false);}).catch(()=>setError('原始AI题干暂不可读取，请刷新题本后重试。')).finally(()=>setBusy(false));}}>恢复原AI题干（保存后生效）</button></>}
   <label className="question-archive-source-check"><input disabled={busy||committed} type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} data-testid="question-archive-source-checked"/><span>已对照原资料核对题面完整性（含图表、题号及跨段衔接）</span></label>
   <p>缺失字段仍会保留待整理提示。跨段或题号不明需补齐题干后核对；图像与超长题需完整切题整理，勾选不能解除限制。保存不代表答案正确或正式试卷已确认。</p>
   <div className="toolbar-row"><button className="primary-action" disabled={busy||(!committed&&(!difficultyChosen||!fields.stem.trim()))} onClick={()=>void save()} data-testid="question-archive-save">{busy?'保存中…':committed?'重新读取保存结果':'保存补正'}</button><button className="secondary-action" disabled={busy} onClick={()=>{setFields(undefined);setCommitted(false);setError('');}}>取消编辑</button></div>
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
