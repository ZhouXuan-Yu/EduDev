import {hasTeacherTextPresentation,isCompleteQuestionDocument} from '../../../shared/question-document';
import type {QuestionBankItem} from '../../../shared/contracts';
import type {PaperGeneration} from '../../../shared/paper-blueprint';
import {QUESTION_PROJECTION_FIELDS, QUESTION_PROJECTION_LABELS} from '../../../shared/question-projection';
import {QuestionMathText} from '../QuestionMathText';
import {PaperQuestionDetails} from './PaperQuestionDetails';
import {PaperQuestionImages} from './PaperQuestionImages';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

/** Shared full body for candidates, pinned basket entries and preview; never collapsed as a whole. */
export function PaperQuestionContent({question, contentVersion, generation, showAnswers = true, compactDetails = false, onImageReady}: {
  question: QuestionBankItem;
  contentVersion: string;
  generation?: PaperGeneration;
  showAnswers?: boolean;
  compactDetails?: boolean;
  onImageReady?: (ready: boolean) => void;
}) {
  const document = question.document;
  return <div className={compactDetails ? styles.compactQuestion : 'edu-paper-question-content'}>
    <QuestionMathText testId="paper-basket-question-stem" text={question.stem}/>
    {isCompleteQuestionDocument(document) && !hasTeacherTextPresentation(document) && QUESTION_PROJECTION_FIELDS
      .filter(field => field !== 'statement' && document.context.projection[field].text.trim())
      .map(field => <section key={field} data-testid={`paper-basket-question-${field}`}>
        <h4>{QUESTION_PROJECTION_LABELS[field]}</h4>
        <QuestionMathText text={document.context.projection[field].text}/>
      </section>)}
    <PaperQuestionImages question={question} contentVersion={contentVersion} onReady={onImageReady}/>
    {showAnswers && <PaperQuestionDetails question={question} contentVersion={contentVersion} generation={generation} compact={compactDetails}/>}
  </div>;
}
