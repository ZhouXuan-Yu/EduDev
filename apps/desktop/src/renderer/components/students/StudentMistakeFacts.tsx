import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {MistakeImageAnalysis} from '../../../shared/contracts';
import {MISTAKE_FACTS_SCHEMA,MISTAKE_FACTS_ERRORS,validMistakeFacts,mistakePracticePrompt,type MistakeFacts,type MistakeFactsInput} from '../../../shared/mistake-facts';
import {MISTAKE_OCR_SCHEMA} from '../../../shared/mistake-ocr';

export function MistakeFactsSummary({analysis,onSend,busy=false}:{analysis:MistakeImageAnalysis;onSend:()=>void;busy?:boolean}){
 const value=analysis.confirmedFacts;if(!value)return null;const f=value.facts;
 return <div data-testid="mistake-facts-confirmed"><p role="status">题目与实际作答已保存，照片来源保留在本机。</p><dl className="detail-list"><dt>题目</dt><dd>{f.title}</dd><dt>知识点</dt><dd>{f.subject} · {f.knowledgePoint}</dd><dt>实际作答</dt><dd>{f.actualAnswer||'未作答'}</dd><dt>实际表现</dt><dd>{{correct:'正确',incorrect:'错误',partial:'部分正确'}[f.result]}</dd><dt>教师核对的错因</dt><dd>{f.errorCause}</dd><dt>难度</dt><dd>{{easy:'基础',medium:'中等',hard:'较难'}[f.difficulty]}</dd></dl><Button isDisabled={busy} onPress={onSend} data-testid="mistake-facts-ask">请小智准备5道练习</Button></div>;
}
export function StudentMistakeFacts({analysis,title,onAnalysis,onBusy,onSendAi,onFactsSaved}:{analysis:MistakeImageAnalysis;title:string;onAnalysis:(v:MistakeImageAnalysis)=>void;onBusy:(v:boolean)=>void;onSendAi:(prompt:string)=>Promise<void>;onFactsSaved?:(studentId:string)=>Promise<void>}){
 const initial=():MistakeFacts=>({title,subject:'',knowledgePoint:'',knowledgeType:'procedure',difficulty:'medium',stem:analysis.teacherCorrectedText,expectedAnswer:'',analysis:'',actualAnswer:'',result:'' as MistakeFacts['result'],errorCause:'',occurredAt:new Date().toISOString()});
 const [editing,setEditing]=useState(false),[facts,setFacts]=useState<MistakeFacts>(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef<MistakeFactsInput|undefined>(undefined),epoch=useRef(0);
 useEffect(()=>()=>{epoch.current++;if(pending.current)void window.omniEdu?.cancelMistakeOcr(pending.current.source);onBusy(false);},[analysis.id,onBusy]);
 const edit=<K extends keyof MistakeFacts>(key:K,value:MistakeFacts[K])=>{pending.current=undefined;setFacts(current=>({...current,[key]:value}));setError('');};
 async function confirm(){
  if(!analysis.version||!validMistakeFacts(facts)){setError(MISTAKE_FACTS_ERRORS.invalid_input);return;}
  const input=pending.current||{schemaVersion:MISTAKE_FACTS_SCHEMA,source:{schemaVersion:MISTAKE_OCR_SCHEMA,studentId:analysis.studentId,analysisId:analysis.id,version:analysis.version,requestId:crypto.randomUUID()},facts};pending.current=input;const current=epoch.current;setBusy(true);onBusy(true);setError('');
  try{const result=await window.omniEdu?.confirmMistakeFacts(input);if(current!==epoch.current)return;if(!result?.ok)throw new Error(result?MISTAKE_FACTS_ERRORS[result.error]:'未完成保存，请重试。');onAnalysis(result.analysis);setEditing(false);pending.current=undefined;try{await onFactsSaved?.(analysis.studentId);}catch{setError('题目与实际作答已保存，列表刷新失败，请重新进入学生页面。');}}catch(cause){if(current===epoch.current)setError(cause instanceof Error?cause.message:'未完成保存，请重试。');}finally{if(current===epoch.current){setBusy(false);onBusy(false);}}
 }
 async function ask(){
  const receipt=analysis.confirmedFacts;if(!receipt)return;setBusy(true);setError('');
  try{const clean=await window.omniEdu?.sanitizeProblemText(receipt.facts.title,analysis.studentId);if(!clean)throw new Error('题目来源暂时无法读取。');await onSendAi(mistakePracticePrompt(clean.sanitizedText));}catch(cause){setError(cause instanceof Error?cause.message:'没有完成交接，请重试。');}finally{setBusy(false);}
 }
 if(analysis.ocrStatus!=='teacher_corrected'||!analysis.localOcr)return null;
 if(analysis.confirmedFacts)return <section className="work-panel span-2" data-testid="student-mistake-facts"><h3>已确认的错题与学习事实</h3><MistakeFactsSummary analysis={analysis} busy={busy} onSend={()=>void ask()}/>{error&&<p role="alert">{error}</p>}</section>;
 return <section className="work-panel span-2" data-testid="student-mistake-facts"><div className="panel-heading"><div><h3>核对题目与实际作答</h3><p className="muted">请根据真实记录填写；校正图片文字不会自动判断成绩。</p></div>{!editing&&<Button onPress={()=>{setFacts(initial());setEditing(true);}} data-testid="mistake-facts-edit">填写学习事实</Button>}</div>{editing&&<>
  <div className="form-grid">
   <label>题目名称<input value={facts.title} disabled={busy} onChange={e=>edit('title',e.target.value)} data-testid="mistake-facts-title"/></label>
   <label>科目<input value={facts.subject} disabled={busy} onChange={e=>edit('subject',e.target.value)} data-testid="mistake-facts-subject"/></label>
   <label>知识点<input value={facts.knowledgePoint} disabled={busy} onChange={e=>edit('knowledgePoint',e.target.value)} data-testid="mistake-facts-point"/></label>
   <label>知识类型<select value={facts.knowledgeType} disabled={busy} onChange={e=>edit('knowledgeType',e.target.value as MistakeFacts['knowledgeType'])} data-testid="mistake-facts-type"><option value="procedure">方法与步骤</option><option value="concept">概念理解</option><option value="memory">记忆</option><option value="design">设计与应用</option></select></label>
   <label>难度<select value={facts.difficulty} disabled={busy} onChange={e=>edit('difficulty',e.target.value as MistakeFacts['difficulty'])} data-testid="mistake-facts-difficulty"><option value="easy">基础</option><option value="medium">中等</option><option value="hard">较难</option></select></label>
   <label>发生时间<input type="datetime-local" value={new Date(Date.parse(facts.occurredAt)-new Date(facts.occurredAt).getTimezoneOffset()*60000).toISOString().slice(0,16)} disabled={busy} onChange={e=>{const d=new Date(e.target.value);if(Number.isFinite(d.getTime()))edit('occurredAt',d.toISOString());}} data-testid="mistake-facts-time"/></label>
  </div>
  <label>题干<textarea value={facts.stem} disabled={busy} onChange={e=>edit('stem',e.target.value)} data-testid="mistake-facts-stem"/></label>
  <div className="form-grid"><label>标准答案<textarea value={facts.expectedAnswer} disabled={busy} onChange={e=>edit('expectedAnswer',e.target.value)} data-testid="mistake-facts-answer"/></label><label>解析<textarea value={facts.analysis} disabled={busy} onChange={e=>edit('analysis',e.target.value)} data-testid="mistake-facts-analysis"/></label></div>
  <label>学生实际作答（未作答可留空）<textarea value={facts.actualAnswer} disabled={busy} onChange={e=>edit('actualAnswer',e.target.value)} data-testid="mistake-facts-actual"/></label>
  <label>实际表现<select value={facts.result} disabled={busy} onChange={e=>edit('result',e.target.value as MistakeFacts['result'])} data-testid="mistake-facts-result"><option value="">请选择实际表现</option><option value="incorrect">错误</option><option value="partial">部分正确</option><option value="correct">正确</option></select></label>
  <label>教师核对的错因与观察<textarea value={facts.errorCause} disabled={busy} onChange={e=>edit('errorCause',e.target.value)} data-testid="mistake-facts-cause"/></label>
  {error&&<p role="alert" data-testid="mistake-facts-error">{error}</p>}
  <div className="toolbar-row"><Button isDisabled={busy} onPress={()=>void confirm()} data-testid="mistake-facts-confirm">{busy?'保存中…':'确认保存题目与实际作答'}</Button><Button variant="secondary" onPress={()=>{if(busy&&pending.current)void window.omniEdu?.cancelMistakeOcr(pending.current.source);else{setEditing(false);setFacts(initial());setError('');}}} data-testid="mistake-facts-cancel">{busy?'取消保存':'放弃填写'}</Button></div>
 </>}</section>;
}
