import type {PaperFulfillment} from '../../../shared/paper-fulfillment';
import {PAPER_DIFFICULTIES,type PaperDifficultyCounts} from '../../../shared/paper-section-fit';
import {questionTypeLabels} from '../../../shared/question-type';
import {DisclosureCard} from '../ui/DisclosureCard';

const difficultyLabels={easy:'基础',medium:'中等',hard:'困难'} as const;
function difficultySummary(counts:PaperDifficultyCounts){
 const values=PAPER_DIFFICULTIES.map(level=>difficultyLabels[level]+' '+counts[level]+' 题');
 if(counts.unspecified)values.push('未限定或未标注 '+counts.unspecified+' 题');
 return values.join(' · ');
}

/** Quotas describe saved selection facts; source/answer review remains in the original panel. */
export function PaperFulfillmentDetails({value}:{value:PaperFulfillment}){
 return <DisclosureCard title="蓝图配额与实际选题" data-testid="paper-fulfillment-details">
  <p data-testid="paper-fulfillment-sources">原题 {value.originalCount} / {value.originalRequired} 道 · 生成题 {value.generatedCount} / {value.generatedRequired} 道（AI原创 {value.aiOriginalCount}、变式 {value.variationCount}）</p>
  <p>预计用时 {value.duration.minutes} 分钟，来自蓝图设定。知识点与难度按题目保存标签核对。</p>
  <p data-testid="paper-fulfillment-difficulty">难度题数 · 蓝图 {difficultySummary(value.difficulty.planned)}<br/>实际 {difficultySummary(value.difficulty.selected)}</p>
  <ul>{value.sections.map(s=><li key={s.sectionId} data-testid="paper-fulfillment-section" data-section-id={s.sectionId}>
   <strong>{s.label}</strong> · {s.selectedCount} / {s.requiredCount} 题 · {s.selectedPoints} / {s.requiredPoints} 分 · {{satisfied:'符合蓝图',shortage:'尚有缺额',conflict:'与蓝图不符'}[s.state]}
   <br/>{/^[a-z_]+$/.test(s.questionType)?questionTypeLabels(s.questionType)[0]:s.questionType} {s.typeMatched} / {s.selectedCount} · {s.difficulty?difficultyLabels[s.difficulty]+' '+s.difficultyMatched+' / '+s.selectedCount:'难度不限'} · {s.knowledgePoint?s.knowledgePoint+' '+s.knowledgeMatched+' / '+s.selectedCount:'知识点不限'}
   <br/>原题 {s.originalCount} / {s.originalRequired} · 生成题 {s.generatedCount} / {s.generatedRequired}
   {s.scopeMatched<s.selectedCount&&<span> · 科目、年级或来源不符 {s.selectedCount-s.scopeMatched} 题</span>}
  </li>)}</ul>
 </DisclosureCard>;
}
