import {useState} from 'react';
import type {QuestionBankItem} from '../../shared/contracts';
import type {WebAnswerCandidate} from '../../shared/question-web-answer';
export function QuestionWebAnswerEvidence({question}:{question:Pick<QuestionBankItem,'id'|'archive'>}){
 const [items,setItems]=useState<WebAnswerCandidate[]>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){if(busy)return;setBusy(true);setError('');try{const result=await window.omniEdu!.getQuestionWebAnswerEvidence(question.id);if(!result.ok)throw Error(result.error);setItems(result.items);}catch{setError('网页题解记录暂时无法读取，请重试。');}finally{setBusy(false);}}
 const current=question.archive?.web?.roles;
 const content=<section className="question-archive" data-testid={`question-web-evidence-${question.id}`}>
  <strong>联网补答记录</strong>
  {current&&(['answer','analysis'] as const).map(role=>current[role]&&<p key={role} data-testid={`question-web-source-${role}`}>{role==='answer'?'答案':'解析'}：{current[role]!.kind==='web_extracted'?'网页原文摘取':'AI参考网页推导'} · {current[role]!.title}<br/><span style={{overflowWrap:'anywhere'}}>{current[role]!.url}</span> · {new Date(current[role]!.observedAt).toLocaleString('zh-CN')}</p>)}
  <button className="secondary-action" data-testid="question-web-evidence-load" disabled={busy} onClick={()=>void load()}>{busy?'正在读取…':items?'刷新补答记录':'查看网页原文与补答记录'}</button>
  {error&&<p role="alert">{error}</p>}
  {items?.length===0&&<p>尚无联网补答记录。</p>}
  {items?.map(item=><details key={item.id} data-testid="question-web-candidate"><summary>{item.state==='applied'?'已补入该版本':item.state==='conflict'?'题目已变化，保留候选':'候选，未补写'} · {item.observation.title}</summary><p style={{overflowWrap:'anywhere'}}>来源：{item.observation.url} · {new Date(item.observation.observedAt).toLocaleString('zh-CN')}</p>{item.reason&&<p>此记录未自动补写的原因：{({existing_analysis_mismatch:'网页解析未与现有解析一致，只保留候选，未补写答案。',existing_answer_conflict:'网页答案与现有答案不同，未补写解析',question_or_role_mismatch:'题目或答案区不能唯一匹配',incomplete_web_evidence:'网页提取不完整或访问受限',visual_web_evidence:'含未核对图像',formula_web_evidence:'公式结构未保全',presentation_revision_required:'图文题原版本链尚未接通',derived_verification_required:'AI推导尚待独立核对',source_changed:'原题或来源已变化',no_missing_roles:'没有明确缺失角色'} as Record<string,string>)[item.reason]||'待进一步核对'}</p>}<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:320,overflow:'auto'}} data-testid="question-web-observed-text">{item.observation.text}</pre></details>)}
  <p role="note">网页出处是可追溯证据，不能保证答案正确；正式组卷仍须集中核对。</p>
 </section>;
 return current?content:<details data-testid={`question-web-evidence-fold-${question.id}`}><summary>联网补答记录</summary>{content}</details>;
}
