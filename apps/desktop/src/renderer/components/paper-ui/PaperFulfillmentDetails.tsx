import type {PaperFulfillment} from '../../../shared/paper-fulfillment';
import {DisclosureCard} from '../ui/DisclosureCard';

/** Quotas describe saved selection facts; source/answer review remains in the original panel. */
export function PaperFulfillmentDetails({value}:{value:PaperFulfillment}){
 return <DisclosureCard title="蓝图配额与实际选题" data-testid="paper-fulfillment-details">
  <p data-testid="paper-fulfillment-sources">原题 {value.originalCount} / {value.originalRequired} 道 · 生成题 {value.generatedCount} / {value.generatedRequired} 道（AI原创 {value.aiOriginalCount}、变式 {value.variationCount}）</p>
  <p>预计用时 {value.duration.minutes} 分钟，来自蓝图设定，非学生实测。知识点覆盖按保存标签匹配，题目难度仍需教师判断。</p>
  <ul>{value.sections.map(s=><li key={s.sectionId} data-testid="paper-fulfillment-section" data-section-id={s.sectionId}>
   <strong>{s.label}</strong> · {s.knowledgePoint||'知识点不限'}：{s.selectedCount} / {s.requiredCount} 题，{s.selectedPoints} / {s.requiredPoints} 分；原题 {s.originalCount} / {s.originalRequired}，生成题 {s.generatedCount} / {s.generatedRequired}。{{satisfied:'配额满足',shortage:'尚有缺额',conflict:'与蓝图不符'}[s.state]}
  </li>)}</ul>
  {value.state==='conflict'&&<p role="alert" data-testid="paper-fulfillment-conflict">当前选题与蓝图配额不一致，请重新生成或修正候选后核对。</p>}
 </DisclosureCard>;
}
