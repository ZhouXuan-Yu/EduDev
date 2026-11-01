import {useEffect,useRef,useState} from 'react';
import type {QuestionSearchFilters,SimilarQuestionMatch} from '../../shared/contracts';
import type {SemanticCoverage} from '../../shared/retrieval';
import {QuestionMathText} from './QuestionMathText';
import {QuestionOriginalPicture} from './QuestionOriginalPicture';
import {QuestionAnswerEvidence} from './QuestionAnswerEvidence';
import {MaterialSourceLink} from './product/MaterialSourceNavigation';
import {RerankNotice} from './product/RerankNotice';
import {DisclosureCard} from './ui/DisclosureCard';
export function QuestionSemanticSearch({filters}:{filters:QuestionSearchFilters}){
  const [query,setQuery]=useState(''),[questions,setQuestions]=useState<SimilarQuestionMatch[]>([]),[coverage,setCoverage]=useState<SemanticCoverage>(),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false),[error,setError]=useState('');const epoch=useRef(0);
  const scope=JSON.stringify(filters);useEffect(()=>{epoch.current++;setQuestions([]);setCoverage(undefined);setSearched(false);setBusy(false);},[scope]);
  async function search(){const stamp=++epoch.current;setBusy(true);setError('');try{const result=await window.omniEdu!.searchQuestionsByMeaning({...filters,query:query.trim(),limit:10});if(stamp===epoch.current){setQuestions(result.questions);setCoverage(result.semantic);setSearched(true);}}catch{if(stamp===epoch.current)setError('题意检索暂不可用，请稍后重试。');}finally{if(stamp===epoch.current)setBusy(false);}}
  return <section className="work-panel span-2" data-testid="question-semantic-search"><h2>按题意找相似题</h2><p>描述已知条件、解题方法或知识点，在全部题库中寻找线索。沿用题本的学科、年级等筛选条件；相似题还需对照完整题面与答案。</p>
    <RerankNotice value={coverage?.rerank}/>
    <form className="toolbar-row" onSubmit={e=>{e.preventDefault();void search();}}><input data-testid="question-semantic-query" aria-label="题意或方法" value={query} maxLength={128} onChange={e=>{setQuery(e.target.value);epoch.current++;setBusy(false);setSearched(false);setQuestions([]);}} placeholder="例如：已知两条直角边，寻找计算斜边的题"/><button data-testid="question-semantic-submit" className="primary-action" disabled={busy||!query.trim()}>{busy?'正在本机查找…':'按题意查找'}</button></form>
    {coverage&&<p role="note" data-testid="question-semantic-coverage">{coverage.available?'已结合本地题意与关键词检索。':'本地语义暂不可用，当前为关键词结果。'}{!coverage.complete?'部分内容仍在整理，不能据此判断整库缺题。':''}{coverage.exhausted?'本次候选有数量上限，请进一步限定条件。':''}</p>}{error&&<p role="alert">{error}</p>}
    {searched&&!questions.length&&<p>当前没有找到可用候选，请调整条件或等待整理完成。</p>}
    {questions.map(q=><article key={q.id} className="question-notebook-card" data-testid="question-semantic-hit">
      <p>{q.subject} · {q.grade} · {q.knowledgePoint} · {q.sourceTitle}</p>
      <QuestionMathText text={q.stem}/>
      <QuestionOriginalPicture question={q}/>
      {q.archive?.sources[0]&&<ul><MaterialSourceLink source={{title:'对照原资料',material:q.archive.sources[0]}}/></ul>}
      <DisclosureCard title="查看已保存答案和解析" data-testid={`question-semantic-answer-${q.id}`}>
        <QuestionAnswerEvidence question={q}/>
      </DisclosureCard>
    </article>)}
  </section>;
}
