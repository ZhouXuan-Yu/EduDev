import {useEffect,useState} from 'react';
import {MATERIAL_BOOK_MATCH_SCHEMA,bookMatchReasons,type BookMatchView} from '../../../shared/question-book-answer';
import {DisclosureCard} from '../ui/DisclosureCard';
/** Local-only alignment uses saved receipts. Matching does not authorize another cloud request. */
export function MaterialBookMatches({batchId,ordinal,revision}:{batchId:string;ordinal:number;revision:number}){
 const [view,setView]=useState<BookMatchView>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const input={schemaVersion:MATERIAL_BOOK_MATCH_SCHEMA,batchId,ordinal,revision};
 useEffect(()=>{let current=true,inFlight=false;setView(undefined);setError('');const load=async()=>{if(inFlight)return;inFlight=true;try{const v=await window.omniEdu!.getMaterialBookMatches(input);if(current)setView(v);}catch{if(current)setError('无法读取已知答案匹配记录，请重试。');}finally{inFlight=false;}};void load();const timer=setInterval(()=>void load(),3000);return()=>{current=false;clearInterval(timer);};},[batchId,ordinal,revision]);
 async function match(){setBusy(true);setError('');try{setView(await window.omniEdu!.matchMaterialBookAnswers(input));}catch{setError('匹配未完成，原件、关联或题目可能已变化。已保存结果保留，可刷新资料后重试。');}finally{setBusy(false);}}
 return <section data-testid="material-book-matches"><h4>匹配独立答案册</h4><p>按关联书目、试卷标题和题号核对。后台会自动核对；来源完整时补齐答案解析，教师和原资料内容受到保护；有疑点保留候选。以下显示匹配记录；查看题目时会重新核对原资料。这里不调用云端模型。</p>
  <button data-testid="material-book-match" disabled={busy} onClick={()=>void match()}>{busy?'正在核对来源与匹配…':'匹配本页题目的已知答案'}</button>
  {busy&&<p role="status">正在核对题面与答案原页，保存后可以继续查看题本。</p>}{error&&<p role="alert" data-testid="material-book-match-error">{error}</p>}
  {view?.indexPending&&<p role="status" data-testid="material-book-match-index">答案目录正在后台建立，完成后会自动匹配。</p>}
  {view?.automaticPending&&<p role="status" data-testid="material-book-match-pending">本页正在等待后台匹配，完成后自动更新。</p>}
  {view?.automaticError&&<p role="alert" data-testid="material-book-match-auto-error">后台匹配未完成，已保留原题。请核对原件和关联后重试。</p>}
  {view&&!view.rows.length&&!view.indexPending&&<p>尚无匹配记录。请先完成答案册的AI原页整理，再匹配本页。</p>}
  {view?.rows.map(row=><article key={row.id} data-testid="material-book-match-row" data-state={row.state} data-number={row.number}>
   <strong>{row.section||'试卷标题待定位'} · 第{row.number}题 · {row.state==='applied'?'已写入题本（历史记录）':row.state==='conflict'?'版本冲突':'候选待核'}</strong>
   {row.reason&&<p>{bookMatchReasons[row.reason]||'尚未满足自动写回条件'}</p>}
   {row.source&&<p>{row.source.title} · 第{row.source.page}页</p>}
   {row.answer&&<p>已知答案：{row.answer}</p>}{row.analysis&&<DisclosureCard title="已知解析" headingLevel={5}><p>{row.analysis}</p></DisclosureCard>}
  </article>)}
 </section>;
}
