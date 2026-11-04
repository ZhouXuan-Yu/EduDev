import type {QuestionReviewDraft,QuestionReviewView} from '../../../shared/question-review';
import {DisclosureCard} from '../ui/DisclosureCard';
import {QuestionMathText} from '../QuestionMathText';
import {QuestionSourceLink} from './PiQuestionSource';
import styles from '../../ui-system/question-review.module.css';

/** Compare the current displayed draft with frozen, authorized parent facts. */
export function QuestionVariationComparison({variation,draft}:{variation:NonNullable<QuestionReviewView['variation']>;draft:QuestionReviewDraft}){
 return <DisclosureCard title="逐题变式与父题版本对照" data-testid="question-variation-comparison">
  <div className={styles.comparison}>
  <p>{variation.assignment==='source_set'?'以下为旧记录的实读来源集合，未指定各题父题，不能据此断言一一对应。':'每道变式的实际父题及版本如下，可一题对应多道父题。'}难度为估计，知识点沿当前题目组标注。</p>
  {variation.parents.map(parent=><section className={styles.comparisonItem} key={parent.question.questionId} data-testid="question-variation-parent">
   <QuestionSourceLink source={parent}/><p>父题版本：<code className={styles.version}>{parent.question.version}</code></p>
   <QuestionMathText text={parent.stem}/><p>父题参考答案：{parent.answer||'未填写'}</p>
  </section>)}
  {draft.items.map((q,i)=><section className={styles.comparisonItem} key={i} data-testid="question-variation-change">
   <strong>第{i+1}题 · 当前变式</strong><QuestionMathText text={q.stem}/>
   <p>当前参考答案：{q.answer||'未填写'}</p>
   {(variation.itemParents?.[i]??(variation.assignment==='single_parent'?[0]:[])).map(index=>{
    const parent=variation.parents[index];
    return <div className={styles.comparisonItem} key={index} data-testid="question-variation-item-parent" data-parent-id={parent.question.questionId}>
     <QuestionSourceLink source={parent}/><p>本题父题版本：<code className={styles.version}>{parent.question.version}</code></p>
     <p>相对此父题：题干{q.stem===parent.stem?'未改变':'已改变'}；参考答案{q.answer===parent.answer?'相同，仍须逐题复算':'已改变'}。</p>
    </div>;
   })}
   <p>知识点：{draft.knowledgePoint||'未标注'}；难度估计：{{easy:'基础',medium:'标准',hard:'提高'}[q.difficulty]}。</p>
  </section>)}
  </div>
 </DisclosureCard>;
}
