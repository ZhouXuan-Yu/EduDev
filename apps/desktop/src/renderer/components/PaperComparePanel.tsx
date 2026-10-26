import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {PAPER_ERRORS,PAPER_SCHEMA,type PaperCompareInput,type PaperCompareItem,type PaperCompareSummary,type PaperCompareView,type PaperSummary} from '../../shared/paper-blueprint';

const FIELD_LABELS:Record<string,string>={number:'题号',sectionId:'所属部分',points:'分值',difficulty:'难度',knowledgePoint:'知识点',sourceKind:'来源类型','generation.effectDigest':'生成批次摘要'};
const fieldLabel=(field:string)=>FIELD_LABELS[field]??field;
const stateLabel=(state:PaperSummary['state'])=>({pending:'待核对',confirmed:'已确认',rejected:'已拒绝'}[state]);
const modeLabel=(mode:PaperCompareSummary['mode'])=>({source_only:'纯题库原题',hybrid:'原题与生成题混合',ai_original:'AI原创题'}[mode]);
const difficultyLabel=(value:PaperCompareItem['difficulty'])=>value?{easy:'基础',medium:'中等',hard:'困难'}[value]:'未标注';
const sourceLabel=(value:PaperCompareItem['sourceKind'])=>value?{local_bank:'题库原题',teacher_resource:'教师资料',generated:'生成题'}[value]:'未标注';
const valueLabel=(field:string,value:string|number|undefined)=>{
 if(value===undefined||value==='')return'未标注';
 if(field==='difficulty')return difficultyLabel(value as PaperCompareItem['difficulty']);
 if(field==='sourceKind')return sourceLabel(value as PaperCompareItem['sourceKind']);
 if(field==='generation.effectDigest')return String(value).slice(0,12)+'…';
 return String(value);
};

export function PaperCompareDiff({view}:{view:PaperCompareView}){
 return <div className="paper-compare" data-testid="paper-compare-diff">
  <div className="paper-layout">
   {[view.left,view.right].map((summary,index)=><section className="work-panel" key={index} data-testid={'paper-compare-summary-'+index}><h3>{index===0?'左侧':'右侧'}：{summary.title}</h3><p>{summary.count} 题 · {summary.totalPoints} 分 · {summary.durationMinutes} 分钟 · {modeLabel(summary.mode)} · {stateLabel(summary.state)}</p><p>快照摘要：{summary.digest?summary.digest.slice(0,16)+'…':'未确认，无摘要'}</p></section>)}
  </div>
  <section className="work-panel" data-testid="paper-compare-sections"><h3>部分差异</h3><p>新增 {view.sections.added.length} · 删除 {view.sections.removed.length} · 保留 {view.sections.kept.length} · 变化 {view.sections.changed.length}</p>{view.sections.changed.map(section=><p key={section.id} data-testid="paper-compare-section-changed">{section.left.label} → {section.right.label}：{section.fields.map(fieldLabel).join('、')}</p>)}</section>
  <section className="work-panel" data-testid="paper-compare-items"><h3>题目差异</h3><p>新增 {view.items.added.length} · 删除 {view.items.removed.length} · 保留 {view.items.kept.length} · 变化 {view.items.changed.length}</p>{view.items.changed.map(change=><div key={change.identity} data-testid="paper-compare-item-changed"><strong>第 {change.left.number} 题 → 第 {change.right.number} 题</strong>{change.changes.map(field=><p key={field.field}>{fieldLabel(field.field)}：{valueLabel(field.field,field.left)} → {valueLabel(field.field,field.right)}</p>)}</div>)}</section>
  {view.ambiguous&&<div role="alert" data-testid="paper-compare-ambiguous"><strong>存在重复题目标识，无法确定对应关系</strong><p>本页只标记歧义，不会猜测匹配，也不会合并题目。</p>{view.items.ambiguous.filter(entry=>entry.reason==='duplicate_identity').map((entry,index)=><p key={entry.identity??index}>重复标识的题目：左侧 {entry.left.length} 道，右侧 {entry.right.length} 道。</p>)}{view.items.ambiguous.some(entry=>entry.reason==='unsupported_identity')&&<p>另有题面无法计算内容标识，已跳过匹配。</p>}</div>}
  <p data-testid="paper-compare-writes">只读对比：writes=false；不会自动合并、改分、补题或写入确认记录。参考答案仍未独立核验（answerVerified=false）。</p>
 </div>;
}

export type PaperCompareStatus='idle'|'loading'|'error'|'ready';
export function PaperCompareState({papers,leftId,rightId,status,error,view,loading=false,disabled=false,onLeft,onRight,onCompare}:{papers:PaperSummary[];leftId:string;rightId:string;status:PaperCompareStatus;error:string;view?:PaperCompareView;loading?:boolean;disabled?:boolean;onLeft:(id:string)=>void;onRight:(id:string)=>void;onCompare:()=>void}){
 const left=papers.find(paper=>paper.id===leftId),candidates=left?papers.filter(paper=>paper.sessionId===left.sessionId&&paper.id!==left.id):[];
 return <section className="work-panel" data-testid="paper-compare">
  <h2>试卷对比</h2>
  <p data-testid="paper-compare-readonly">只读对比，不会自动合并、改分、补题或写入确认记录。</p>
  {loading?<p role="status" data-testid="paper-compare-list-loading">正在读取已保存试卷…</p>:!papers.length?<p data-testid="paper-compare-empty">暂无可对比的试卷。先完成一份组卷记录。</p>:<>
   <div className="paper-fields">
    <label>左侧试卷<select data-testid="paper-compare-left" value={leftId} disabled={disabled||status==='loading'} onChange={event=>onLeft(event.target.value)}><option value="">选择试卷</option>{papers.map(paper=><option key={paper.id} value={paper.id}>{paper.title} · {paper.count}题 · {stateLabel(paper.state)}</option>)}</select></label>
    <label>右侧试卷<select data-testid="paper-compare-right" value={rightId} disabled={disabled||status==='loading'||!left} onChange={event=>onRight(event.target.value)}><option value="">{left?'选择同一对话中的试卷':'请先选择左侧试卷'}</option>{candidates.map(paper=><option key={paper.id} value={paper.id}>{paper.title} · {paper.count}题 · {stateLabel(paper.state)}</option>)}</select></label>
   </div>
   <div className="paper-review-actions"><Button data-testid="paper-compare-run" isDisabled={disabled||status==='loading'||!left||!rightId||!candidates.some(paper=>paper.id===rightId)} isPending={status==='loading'} onPress={onCompare}>开始对比</Button></div>
   {status==='loading'&&<p role="status" data-testid="paper-compare-loading">正在读取两份试卷快照…</p>}
   {status==='error'&&<p role="alert" data-testid="paper-compare-error">{error}</p>}
   {status==='idle'&&!view&&<p data-testid="paper-compare-idle">选择两份试卷后开始对比；结果只展示差异，不会修改任何一份试卷。</p>}
   {view&&<PaperCompareDiff view={view}/>}
  </>}
 </section>;
}

export function PaperComparePanel({papers,loading=false}:{papers:PaperSummary[];loading?:boolean}){
 const [leftId,setLeftId]=useState(''),[rightId,setRightId]=useState(''),[status,setStatus]=useState<PaperCompareStatus>('idle'),[error,setError]=useState(''),[view,setView]=useState<PaperCompareView>();
 const owner=useRef(0);
 useEffect(()=>()=>{owner.current++;},[]);
 useEffect(()=>{if(leftId&&!papers.some(paper=>paper.id===leftId)){setLeftId('');setRightId('');setView(undefined);setStatus('idle');setError('');}else if(rightId&&!papers.some(paper=>paper.id===rightId))setRightId('');},[papers,leftId,rightId]);
 function chooseLeft(id:string){owner.current++;setLeftId(id);setRightId('');setView(undefined);setStatus('idle');setError('');}
 function chooseRight(id:string){setRightId(id);setView(undefined);setStatus('idle');setError('');}
 async function compare(){
  const left=papers.find(paper=>paper.id===leftId),right=papers.find(paper=>paper.id===rightId&&paper.sessionId===left?.sessionId);if(!left||!right)return;
  const run=++owner.current;setStatus('loading');setError('');setView(undefined);
  try{const input:PaperCompareInput={schemaVersion:PAPER_SCHEMA,sessionId:left.sessionId,leftId:left.id,rightId:right.id};const result=await window.omniEdu?.comparePapers(input);if(run!==owner.current)return;if(result?.ok){setView(result.value);setStatus('ready');}else{setStatus('error');setError(result?PAPER_ERRORS[result.error]:'对比未完成，请重试。');}}
  catch{if(run===owner.current){setStatus('error');setError('对比未完成，请重试。');}}
 }
 return <PaperCompareState papers={papers} leftId={leftId} rightId={rightId} status={status} error={error} view={view} loading={loading} onLeft={chooseLeft} onRight={chooseRight} onCompare={()=>void compare()}/>;
}
