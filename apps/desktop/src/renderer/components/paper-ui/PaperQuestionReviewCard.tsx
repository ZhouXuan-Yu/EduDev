import type {PaperItem} from '../../../shared/paper-blueprint';
import {QUESTION_PROJECTION_FIELDS} from '../../../shared/question-projection';
import {DisclosureCard} from '../ui/DisclosureCard';
import {QuestionMathText} from '../QuestionMathText';
import {QuestionAnswerEvidence} from '../QuestionAnswerEvidence';
import {QuestionOriginalPicture} from '../QuestionOriginalPicture';
import {QuestionSourceLink} from '../office/PiQuestionSource';

/** Presentation of the host's saved whole-question item; no local confirmation state. */
export function PaperQuestionReviewCard({item}:{item:PaperItem}){
 const document=item.question.document;
 return <DisclosureCard className="edu-paper-question-card" data-testid="paper-question"
  title={`第 ${item.number} 题 · ${item.points} 分 · ${item.question.knowledgePoint||'知识点未标注'}`}>
  <QuestionMathText testId="paper-question-stem" text={item.question.stem}/>
  {document?.schemaVersion==='xiaozhi.question-document.v2'&&QUESTION_PROJECTION_FIELDS.filter(field=>field!=='statement').map(field=><div key={field}>
   <strong>{{formulas:'公式',tables:'表格',figures:'图形条件',choices:'选项',subquestions:'小问'}[field]}</strong>
   <QuestionMathText className="paper-source-text" text={document.context.projection[field].text}/>
  </div>)}
  <DisclosureCard className="edu-paper-evidence-card" title="参考答案与解析" data-testid="paper-question-answer">
   <QuestionAnswerEvidence question={item.question} generation={item.generation}/>
  </DisclosureCard>
  <DisclosureCard className="edu-paper-evidence-card" title="题目来源与版本" data-testid="paper-question-source">
   {item.generation&&<p data-testid="paper-generation-provenance">{item.generation.generationKind==='ai_original'?'AI原创 · 无教材原题来源':'AI变式 · 保留原题谱系'} · 已经教师确认，当前版本仍须核对。</p>}
   {(item.question.document||item.question.archive?.native)&&<QuestionOriginalPicture question={item.question}/>}
   <ul><QuestionSourceLink source={{title:'查看本题保存来源',question:item.source}}/></ul>
  </DisclosureCard>
 </DisclosureCard>;
}
