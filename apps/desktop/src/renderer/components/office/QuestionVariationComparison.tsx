import type {QuestionReviewDraft,QuestionReviewView} from '../../../shared/question-review';
import {DisclosureCard} from '../ui/DisclosureCard';
import {QuestionMathText} from '../QuestionMathText';
import {QuestionSourceLink} from './PiQuestionSource';

/** Compare the current displayed draft with frozen, authorized parent facts. */
export function QuestionVariationComparison({variation,draft}:{variation:NonNullable<QuestionReviewView['variation']>;draft:QuestionReviewDraft}){
 return <DisclosureCard title="逐题变式与父题版本对照" data-testid="question-variation-comparison">
  <p>{variation.assignment==='single_parent'?'每道变式均基于以下实读父题。':'以下为本批实读来源集合，尚未指定各题的唯一父题，不能据此断言一一对应。'}难度为估计，知识点沿当前题目组标注。</p>
  {variation.parents.map(parent=><section key={parent.question.questionId} data-testid="question-variation-parent">
   <QuestionSourceLink source={parent}/><p>父题版本：<code>{parent.question.version}</code></p>
   <QuestionMathText text={parent.stem}/><p>父题参考答案：{parent.answer||'未填写'}</p>
  </section>)}
  {draft.items.map((q,i)=><section key={i} data-testid="question-variation-change">
   <strong>第{i+1}题 · 当前变式</strong><QuestionMathText text={q.stem}/>
   <p>当前参考答案：{q.answer||'未填写'}</p>
   {variation.assignment==='single_parent'&&<p>题干{q.stem===variation.parents[0].stem?'未改变':'已改变'}；参考答案{q.answer===variation.parents[0].answer?'与父题相同，仍须逐题复算':'已改变'}。</p>}
   <p>知识点：{draft.knowledgePoint||'未标注'}；难度估计：{{easy:'基础',medium:'标准',hard:'提高'}[q.difficulty]}。</p>
  </section>)}
 </DisclosureCard>;
}
