import type {QuestionBankItem} from '../../../shared/contracts';
import type {PaperGeneration} from '../../../shared/paper-blueprint';
import {QuestionAnswerEvidence, questionSourceLabel} from '../QuestionAnswerEvidence';
import {QuestionOriginalPicture} from '../QuestionOriginalPicture';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperQuestionDisclosure} from './PaperQuestionDisclosure';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

export function PaperQuestionDetails({question, contentVersion, generation, compact}: {
  question: QuestionBankItem;
  contentVersion: string;
  generation?: PaperGeneration;
  compact: boolean;
}) {
  const Detail = compact ? PaperQuestionDisclosure : DisclosureCard;
  return <div className={compact ? styles.questionDetails : styles.fullQuestionDetails}>
    <Detail title="参考答案与解析" data-testid="paper-basket-answer">
      <QuestionAnswerEvidence question={question} generation={generation}/>
    </Detail>
    <Detail title="题目来源与保存版本" data-testid="paper-basket-source">
      <p>{questionSourceLabel(question.sourceKind)} · {question.sourceTitle || '来源未标注'}</p>
      {question.archive && question.archive.number !== '0' && <p data-testid="paper-basket-original-number">原题号 {question.archive.number}</p>}
      <p>保存内容版本：<code>{contentVersion}</code></p>
      {generation && <p>{generation.generationKind === 'ai_original' ? '教师确认原创题，不标为教材原题。' : '教师确认变式题，保留原题谱系。'}</p>}
      {(question.document || question.archive?.native || question.archive?.pageSource) && <QuestionOriginalPicture question={question}/>}
    </Detail>
  </div>;
}
