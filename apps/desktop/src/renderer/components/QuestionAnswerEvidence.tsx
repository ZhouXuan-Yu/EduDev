import {QuestionMathText} from './QuestionMathText';
import type { QuestionNotebookEntry } from '../../shared/contracts';
import { questionFactConflicts } from '../../shared/question-facts';
import type { PaperGeneration } from '../../shared/paper-blueprint';

export function questionSourceLabel(kind: string): string {
  switch (kind) {
    case 'local_bank': return '本地题库';
    case 'teacher_resource': return '教师资料';
    case 'generated': return '小智生成内容';
    default: return '来源待确认';
  }
}

export function questionUsageLabel(kind: string): string {
  switch (kind) {
    case 'exercise_set': return '练习使用';
    case 'learning_record': return '学习记录';
    case 'manual': return '课堂使用';
    default: return '历史使用';
  }
}

function evidenceLabel(origin: string | undefined): string {
  switch (origin) {
    case 'source': return '原资料提供';
    case 'teacher': return '教师补充';
    case 'ai_generated': return '小智生成';
    case 'missing': return '尚未提供';
    default: return '历史记录，来源待确认';
  }
}

/** Origin is a recorded attribution, never mathematical verification or authority to change facts. */
export function QuestionAnswerEvidence({ question, generation }: {
  question: Pick<QuestionNotebookEntry, 'id' | 'stem' | 'answer' | 'analysis' | 'document'>;
  /** Host-validated paper receipt, never inferred from a display tag or sourceKind. */
  generation?: PaperGeneration;
}) {
  if (questionFactConflicts(question).length) return <div className="question-notebook-answer" role="alert" data-testid="question-fact-conflict">
    本地题目与原图核对记录不一致，暂不显示答案与解析。请检查题本或恢复资料后重试。
  </div>;
  return <div className="question-notebook-answer" data-testid={`question-notebook-answer-${question.id}`}>
    <strong>参考答案</strong>
    <p data-testid="question-answer-origin">标注来源：{!question.document&&generation?'AI起草，教师核对保存版本':evidenceLabel(question.document?.answer.origin)}</p>
    <QuestionMathText testId="question-answer-text" text={question.answer || '暂无答案，请核对原资料或由教师补充。'}/>
    <strong>解析</strong>
    <p data-testid="question-analysis-origin">标注来源：{!question.document&&generation?'AI起草，教师核对保存版本':evidenceLabel(question.document?.analysis.origin)}</p>
    <QuestionMathText testId="question-analysis-text" text={question.analysis || '暂无解析，需教师补充。'}/>
    <p role="note" data-testid="question-answer-verification">答案与解析尚未独立核对正确性，请在教学使用前核实。题面核对与来源确认不代表答案正确。</p>
  </div>;
}
