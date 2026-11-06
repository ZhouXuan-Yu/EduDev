import type {BookFinalReferences} from '../../../shared/material-ai-book-reference';
import {DisclosureCard} from '../ui/DisclosureCard';
const labels={available:'已用于最后整理，仍需核对适用条件',unscoped:'章节或题号不能唯一对应',not_found:'尚未找到对应答案',ambiguous:'有多个候选，未使用',unchecked:'来源或题面有疑点，未使用',outside_authorization:'答案资料未在本批授权范围，未发送'};
export function MaterialFinalBookReferences({references}:{references:BookFinalReferences}){
 return <DisclosureCard title="最后整理参考的答案册" headingLevel={4} data-testid="material-final-book-references">
  <p>首次独立解题和来源转录未提供这些答案。最后整理可对照书册，仍保留独立解答的分歧；正式组卷时请集中核对。</p>
  {references.entries.map(e=><section key={e.number} data-testid="material-final-book-reference" data-number={e.number} data-state={e.state}>
   <h5>第{e.number}题 · {labels[e.state]}</h5>
   {e.section&&<p>{e.section}{e.page?' · 答案第'+e.page+'页':''}</p>}
   {e.state==='available'&&<><p style={{whiteSpace:'pre-wrap'}}>{e.answer}</p><p style={{whiteSpace:'pre-wrap'}}>{e.analysis||'答案册未提供解析。'}</p></>}
  </section>)}
 </DisclosureCard>;
}
