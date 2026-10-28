import {useState} from 'react';
import type {QuestionBankItem} from '../../shared/contracts';
import {archiveIssueLabels,type ArchiveFields} from '../../shared/question-archive';
import {MaterialSourceLink} from './product/MaterialSourceNavigation';
import './question-archive.css';
import {NATIVE_IMAGE_SCHEMA} from '../../shared/native-question-image';
export function QuestionArchiveEditor({question,onSaved}:{question:QuestionBankItem;onSaved:()=>Promise<void>}){
 const [fields,setFields]=useState<ArchiveFields>(),[version,setVersion]=useState(''),[difficultyChosen,setDifficultyChosen]=useState(false),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!question.archive)return null;const archive=question.archive;
 async function edit(){setBusy(true);setError('');try{const result=await window.omniEdu!.getArchivedQuestionVersion(question.id);const q=result.question;setFields({stem:q.stem,answer:q.answer,analysis:q.analysis,subject:q.subject,grade:q.grade,knowledgePoint:q.knowledgePoint,questionType:q.questionType,difficulty:q.difficulty});setVersion(result.version);setDifficultyChosen(!q.archive?.issues.includes('missing_difficulty'));setChecked(q.archive?.sourceChecked||false);}catch{setError('题目暂不可编辑，请刷新后重试。');}finally{setBusy(false);}}
 async function save(){if(!fields||busy)return;setBusy(true);setError('');try{await window.omniEdu!.editArchivedQuestion({questionId:question.id,version,fields,sourceChecked:checked});setFields(undefined);await onSaved();}catch(error){setError(error instanceof Error&&error.message.includes('web_answer_question_changed')?'题面已改变，请同时核对修改或清空原联网答案与解析后再保存；旧来源记录会保留。':'保存失败：题目或原资料可能已变化。请取消编辑并重新打开，检查原件后重试。');}finally{setBusy(false);}}
 return <section data-testid={'question-archive-'+question.id} className="question-archive">
  <p><strong>{archive.state==='teacher_edited'?'教师已编辑':archive.web?'联网补答':archive.ai?archive.state==='ai_final'?'AI自动定稿':'AI整理待补全':'自动文本抽题'} · 原题号 {archive.number==='0'?'未编号':archive.number}</strong>　{archive.issues.length?'待整理，暂不用于组卷':'可作为组卷候选，正式试卷集中确认'}</p>
  {archive.web&&<p data-testid="question-web-provenance">已保留独立网页题解记录；已有原资料和教师内容不被自动覆盖，来源不代表答案正确。</p>}
  {archive.ai&&<p data-testid="question-ai-provenance">{archive.ai.provider} · {archive.ai.model} · 两次整理记录保存在本机。AI定稿未经教师逐题确认，答案和解析仍需在正式组卷时核对。</p>}
  {archive.issues.length>0&&<p role="note" data-testid="question-archive-issues">{archive.issues.map(i=>archiveIssueLabels[i]).join('；')}</p>}
  <ul>{archive.sources.map((source,i)=><MaterialSourceLink key={source.chunkId} source={{title:`打开原资料 · 第${source.offset+1}段${archive.sources.length>1?`（${i+1}/${archive.sources.length}）`:''}`,material:source}}/>)}</ul>
  {!fields?<button className="secondary-action" disabled={busy} onClick={()=>void edit()} data-testid={'question-archive-edit-'+question.id}>编辑题目与分类</button>:<div className="question-notebook-form" data-testid="question-archive-form">
   {([['subject','学科'],['grade','年级'],['knowledgePoint','知识点'],['questionType','题型']] as const).map(([key,label])=><label key={key}>{label}<input value={fields[key]} maxLength={128} onChange={e=>setFields({...fields,[key]:e.target.value})} data-testid={'question-archive-'+key}/></label>)}
   <label>难度<select value={difficultyChosen?fields.difficulty:''} onChange={e=>{setFields({...fields,difficulty:e.target.value as ArchiveFields['difficulty']});setDifficultyChosen(true);}}><option value='' disabled>请选择难度</option><option value="easy">基础</option><option value="medium">中等</option><option value="hard">困难</option></select></label>
   {([['stem','题干'],['answer','答案'],['analysis','解析']] as const).map(([key,label])=><label key={key}>{label}<textarea value={fields[key]} maxLength={12000} onChange={e=>{setFields({...fields,[key]:e.target.value});if(key==='stem')setChecked(false);}} data-testid={'question-archive-'+key}/></label>)}
   {archive.native&&<><p>修改题干会撤销旧题面图与图义资格。纯文字题可在核对后保存；图文题可恢复原AI题干，或回资料页重新按题整理。</p><button className="secondary-action" disabled={busy} data-testid="question-native-restore-stem" onClick={()=>{setBusy(true);setError('');void window.omniEdu!.getNativeQuestionOriginal({schemaVersion:NATIVE_IMAGE_SCHEMA,questionId:question.id,version}).then(result=>{setFields({...fields,stem:result.stem});setChecked(false);}).catch(()=>setError('原始AI题干暂不可读取，请刷新题本后重试。')).finally(()=>setBusy(false));}}>恢复原AI题干（保存后生效）</button></>}
   <label className="question-archive-source-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} data-testid="question-archive-source-checked"/><span>已对照原资料核对题面完整性（含图表、题号及跨段衔接）</span></label>
   <p>缺失字段仍会保留待整理提示。跨段或题号不明需补齐题干后核对；图像与超长题需完整切题整理，勾选不能解除限制。保存不代表答案正确或正式试卷已确认。</p>
   <div className="toolbar-row"><button className="primary-action" disabled={busy||!difficultyChosen||!fields.stem.trim()} onClick={()=>void save()} data-testid="question-archive-save">{busy?'保存中…':'保存补正'}</button><button className="secondary-action" disabled={busy} onClick={()=>{setFields(undefined);setError('');}}>取消编辑</button></div>
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
