import {bookAnswerIssueLabels,type BookAnswerPage} from '../../../shared/material-book-answer';
import {DisclosureCard} from '../ui/DisclosureCard';
/** Saved evidence only; opening this view never starts a model request or writes a question. */
export function MaterialBookAnswers({page}:{page:BookAnswerPage}){
 const groups=new Map<string,typeof page.entries>();for(const entry of page.entries){const key=entry.sectionKey;groups.set(key,[...(groups.get(key)||[]),entry]);}
 return <section data-testid="material-book-answers">
  <h4>已知答案条目 · {page.entries.length} 条</h4>
  <p>按所属试卷和题号分开保留。两遍一致不代表答案正确；题册匹配及实际写回状态请在对应题册查看，原文与原页仍可核对。</p>
  {page.policy==='section-number-two-pass.v2'&&!page.pageUncertain&&<p role="status" data-testid="material-book-answer-scope">疑点按条目保留；有疑点的条目不能自动写回，其他条目仍须通过题面、来源及答案冲突检查。</p>}
  {page.pageUncertain&&<p role="note">本页转录仍有疑点，以下条目保留待核，不能自动写回。</p>}
  {page.status==='too_large'&&<p role="alert">本页答案条目过多或文本超限，未显示部分结果，请对照原页处理。</p>}
  {page.status==='unstructured'&&<p role="status">尚未识别出明确的编号答案。请查看下方原文及原页；未猜测题号或答案。</p>}
  {page.firstOnly.length>0&&<p role="alert" data-testid="material-book-answer-omissions">第二遍未找到：{page.firstOnly.map(e=>(e.section||'缺少标题')+' 第'+e.number+'题').join('；')}</p>}
  {[...groups].map(([key,entries])=><DisclosureCard key={key} data-testid="material-book-answer-section" defaultExpanded headingLevel={5} title={`${entries[0].section||'所属试卷缺失'} · ${entries.length} 条`}>
   {entries.map(entry=><article key={entry.start} data-testid="material-book-answer-entry" data-section={entry.sectionKey} data-number={entry.number}>
    <strong>第 {entry.number} 题 · {entry.agrees?'两遍条目一致':'两遍条目待核'}</strong>
    <p>答案：<span data-testid="material-book-answer-value">{entry.answer||'原文未明确提供'}</span></p>
    {entry.issues.length>0&&<p role="note" data-testid="material-book-answer-issues">{entry.issues.map(code=>bookAnswerIssueLabels[code]).join('；')}</p>}
    <DisclosureCard title="解析与两遍原文" headingLevel={6} bodyClassName="material-evidence-fields"><dl><div><dt>解析</dt><dd>{entry.analysis||'原文未明确提供解析'}</dd></div><div><dt>第二遍原文</dt><dd><pre className="material-ai-page-text">{entry.quote}</pre></dd></div>{entry.first&&<div><dt>第一遍原文</dt><dd><pre className="material-ai-page-text">{entry.first.quote}</pre></dd></div>}</dl></DisclosureCard>
   </article>)}
  </DisclosureCard>)}
 </section>;
}
