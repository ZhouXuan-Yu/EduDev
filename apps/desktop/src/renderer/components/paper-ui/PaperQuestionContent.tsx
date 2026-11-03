import {isCompleteQuestionDocument} from '../../../shared/question-document';
import type {QuestionBankItem} from '../../../shared/contracts';
import type {PaperGeneration} from '../../../shared/paper-blueprint';
import {QUESTION_PROJECTION_FIELDS, QUESTION_PROJECTION_LABELS} from '../../../shared/question-projection';
import {QuestionMathText} from '../QuestionMathText';
import {QuestionAnswerEvidence, questionSourceLabel} from '../QuestionAnswerEvidence';
import {QuestionOriginalPicture} from '../QuestionOriginalPicture';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperQuestionImages} from './PaperQuestionImages';

/** Shared full body for candidates, pinned basket entries and preview; never collapsed as a whole. */
export function PaperQuestionContent({question, contentVersion, generation, showAnswers = true, onImageReady}: {
  question: QuestionBankItem;
  contentVersion: string;
  generation?: PaperGeneration;
  showAnswers?: boolean;
  onImageReady?: (ready: boolean) => void;
}) {
  const document = question.document;
  return <div className="edu-paper-question-content">
    <QuestionMathText testId="paper-basket-question-stem" text={question.stem}/>
    {isCompleteQuestionDocument(document) && QUESTION_PROJECTION_FIELDS
      .filter(field => field !== 'statement' && document.context.projection[field].text.trim())
      .map(field => <section key={field} data-testid={`paper-basket-question-${field}`}>
        <h4>{QUESTION_PROJECTION_LABELS[field]}</h4>
        <QuestionMathText text={document.context.projection[field].text}/>
      </section>)}
    <PaperQuestionImages question={question} contentVersion={contentVersion} onReady={onImageReady}/>
    {showAnswers && <>
      <DisclosureCard title="参考答案与解析" data-testid="paper-basket-answer">
        <QuestionAnswerEvidence question={question} generation={generation}/>
      </DisclosureCard>
      <DisclosureCard title="题目来源与保存版本" data-testid="paper-basket-source">
        <p>{questionSourceLabel(question.sourceKind)} · {question.sourceTitle || '来源未标注'}</p>
        <p>保存内容版本：<code>{contentVersion}</code></p>
        {generation && <p>{generation.generationKind === 'ai_original' ? '教师确认原创题，不标为教材原题。' : '教师确认变式题，保留原题谱系。'}</p>}
        {(question.document || question.archive?.native || question.archive?.pageSource) && <QuestionOriginalPicture question={question}/>}
      </DisclosureCard>
    </>}
  </div>;
}
