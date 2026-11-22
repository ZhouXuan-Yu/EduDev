import type {QuestionBankItem} from './contracts';
import type {PaperBlueprint, PaperSection} from './paper-blueprint';
import {equivalentQuestionGradeLabels} from './question-grade';
import {questionTypeLabels} from './question-type';

const types: Readonly<Record<string, string>> = {
  选择题: 'choice', 填空题: 'fill_in_blank', 简答题: 'short_answer', 解答题: 'written',
  计算题: 'written', 综合计算题: 'written', 判断题: 'concept', 编程题: 'coding',
};
export const paperQuestionType = (type: string) => Object.hasOwn(types, type) ? types[type] : type;

type SectionQuestion = Pick<QuestionBankItem, 'subject' | 'grade' | 'questionType' | 'difficulty' | 'knowledgePoint' | 'sourceKind'>;

/** Match the same saved labels when selecting live questions and reading a frozen paper. */
export function paperSectionFit(question: SectionQuestion, blueprint: PaperBlueprint, section: PaperSection) {
  const original = question.sourceKind === 'local_bank' || question.sourceKind === 'teacher_resource';
  const grade = original
    ? equivalentQuestionGradeLabels(blueprint.grade).includes(question.grade)
    : blueprint.mode !== 'source_only' && question.sourceKind === 'generated' && question.grade === blueprint.grade;
  return {
    scope: grade && question.subject === blueprint.subject,
    type: paperQuestionType(question.questionType) === paperQuestionType(section.questionType)
      || original && questionTypeLabels(section.questionType).includes(question.questionType),
    difficulty: !section.difficulty || question.difficulty === section.difficulty,
    knowledge: !section.knowledgePoint || question.knowledgePoint.includes(section.knowledgePoint),
  };
}

export function paperSectionMatches(question: SectionQuestion, blueprint: PaperBlueprint, section: PaperSection): boolean {
  const fit = paperSectionFit(question, blueprint, section);
  return fit.scope && fit.type && fit.difficulty && fit.knowledge;
}

export const PAPER_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type PaperDifficultyCounts = Record<typeof PAPER_DIFFICULTIES[number] | 'unspecified', number>;
export const emptyPaperDifficultyCounts = (): PaperDifficultyCounts => ({easy: 0, medium: 0, hard: 0, unspecified: 0});

export function paperPlannedDifficulty(blueprint: PaperBlueprint): PaperDifficultyCounts {
  const counts = emptyPaperDifficultyCounts();
  for (const section of blueprint.sections) counts[section.difficulty || 'unspecified'] += section.count;
  return counts;
}
