import {QuestionMathText} from './QuestionMathText';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {PAPER_SCHEMA,PAPER_ERRORS,type PaperView} from '../../shared/paper-blueprint';
import {QUESTION_PROJECTION_FIELDS} from '../../shared/question-projection';
import {QuestionAnswerEvidence} from './QuestionAnswerEvidence';
import {QuestionOriginalPicture} from './QuestionOriginalPicture';
import {QuestionSourceLink} from './office/PiQuestionSource';
export function PaperReviewPanel({view,onChanged,allowConfirm=true}:{view:PaperView;onChanged:(view:PaperView)=>void;allowConfirm?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),generation=useRef(0),lock=useRef(false);
 useEffect(()=>{generation.current++;setError('');return()=>{generation.current++;};},[view.id]);
 async function decide(action:'confirm'|'reject'){
  if(lock.current)return;lock.current=true;const owner=generation.current;setBusy(true);setError('');
  try{const result=await window.omniEdu?.decidePaper({schemaVersion:PAPER_SCHEMA,sessionId:view.sessionId,id:view.id,revision:view.revision,action});if(owner!==generation.current)return;if(result?.ok)onChanged(result.value);else setError(result?PAPER_ERRORS[result.error]:'保存未完成，请重试。');}
  catch{if(owner===generation.current)setError('保存未完成，请重试。');}finally{lock.current=false;if(owner===generation.current)setBusy(false);}
 }
 return <section className="paper-review" data-testid="paper-review">
  <header><h2>{view.title}</h2><p data-testid="paper-summary">{view.count} 题 · {view.totalPoints} 分 · {view.blueprint.durationMinutes} 分钟 · {{pending:'待教师核对',confirmed:'已确认保存',rejected:'已拒绝'}[view.state]}</p></header>
  <p data-testid="paper-mode-summary">{{source_only:'纯题库组卷，保留原题保存版本。',hybrid:'混合组卷，原题和教师已确认生成题分别满足配额。',ai_original:'AI原创组卷，不标为教材原题。'}[view.blueprint.mode]}参考答案未独立核验；确认试卷不代表答案已经正确，也不代表已导出文件。</p>{view.blueprint.mode!=='source_only'&&<p data-testid="paper-source-counts">原题 {view.selection.items.filter(i=>!i.generation).length} 道 · 已确认生成题 {view.selection.items.filter(i=>!!i.generation).length} 道；保存审批来源和当前版本。</p>}
  <p data-testid="paper-scan-scope">本次查看 {view.selection.scanned} 条候选，{view.selection.scanComplete?'已到达当前筛选范围末尾':'配额已满足，未声称扫描全部题库'}；同题候选保守去重。</p>
  {!allowConfirm&&<p role="alert" data-testid="paper-blueprint-dirty">蓝图已修改，请重新生成后核对；旧预览不能直接确认。</p>}
  {!view.sourceCurrent&&<p role="alert" data-testid="paper-source-changed">题目或原件已变化，请重新生成并核对。</p>}
  {view.selection.shortages.length>0&&<div role="alert" data-testid="paper-shortages"><strong>题库不足，不能确认</strong>{view.selection.shortages.map(s=><p key={s.sectionId+(s.sourceKind||'')}>{s.label}{s.sourceKind?' · '+(s.sourceKind==='original'?'原题':'生成题'):''}：需要 {s.required} 题，找到 {s.selected} 题，缺 {s.missing} 题。</p>)}</div>}
  {Object.values(view.selection.excluded).some(Boolean)&&<p data-testid="paper-exclusions">已跳过：题面未完整核对 {view.selection.excluded.unsupported} 条、缺答案或解析 {view.selection.excluded.missing_answer} 条、来源不可读 {view.selection.excluded.source_unavailable} 条。</p>}
  {view.state==='pending'&&<div className="paper-review-actions"><Button data-testid="paper-confirm" isDisabled={busy||!allowConfirm||!view.complete||!view.sourceCurrent} isPending={busy} onPress={()=>void decide('confirm')}>确认并保存试卷</Button><Button variant="secondary" data-testid="paper-reject" isDisabled={busy} onPress={()=>void decide('reject')}>拒绝</Button></div>}
  {view.state==='confirmed'&&<p role="status" data-testid="paper-confirmed">已保存整卷快照；可重启后继续查看。参考答案仍需核对。</p>}
  {error&&<p role="alert" data-testid="paper-decision-error">{error}</p>}
  {view.blueprint.sections.map(section=><section className="paper-section-preview" key={section.id}><h3>{section.label} · {section.count} 题 × {section.points} 分</h3>{view.selection.items.filter(q=>q.sectionId===section.id).map(item=><details className="paper-question" data-testid="paper-question" key={item.question.id}><summary>第 {item.number} 题 · {item.points} 分 · {item.question.knowledgePoint||'知识点未标注'}</summary><QuestionMathText testId="paper-question-stem" text={item.question.stem}/>{item.question.document?.schemaVersion==='xiaozhi.question-document.v2'&&QUESTION_PROJECTION_FIELDS.filter(f=>f!=='statement').map(field=><div key={field}><strong>{{formulas:'公式',tables:'表格',figures:'图形条件',choices:'选项',subquestions:'小问'}[field]}</strong><QuestionMathText className="paper-source-text" text={item.question.document!.schemaVersion==='xiaozhi.question-document.v2'?item.question.document!.context.projection[field].text:''}/></div>)}{item.generation&&<p data-testid="paper-generation-provenance">{item.generation.generationKind==='ai_original'?'AI原创 · 无教材原题来源':'AI变式 · 保留原题谱系'} · 已经教师确认，当前版本仍须核对。</p>}<QuestionAnswerEvidence question={item.question} generation={item.generation}/>{item.question.document&&<QuestionOriginalPicture question={item.question}/>}<ul><QuestionSourceLink source={{title:'查看本题保存来源',question:item.source}}/></ul></details>)}</section>)}
 </section>;
}
