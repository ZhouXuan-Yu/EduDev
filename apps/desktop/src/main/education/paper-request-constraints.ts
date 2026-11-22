import type {PaperBlueprint} from '../../shared/paper-blueprint';
import {PAPER_DIFFICULTIES, paperPlannedDifficulty, paperQuestionType} from '../../shared/paper-section-fit';
import {equivalentQuestionGradeLabels} from '../../shared/question-grade';
import {questionTypeLabels} from '../../shared/question-type';

const numeral = String.raw`([0-9]{1,5}|[零〇一二两三四五六七八九十百千万]{1,12})`;
const rule = (prefix: string, unit: string) => new RegExp('^' + prefix + '\\s*' + numeral + '\\s*' + unit + '$', 'u');
const numberRules = {
  count: rule('(?:(?:全卷|整卷)?(?:题量|一共|共计|总共|合计|共)|(?:全卷|整卷)(?:有|含|包含)?)\\s*(?:[:为]|是|设为)?', '(?:道(?:题)?|题)'),
  points: rule('(?:全卷|整卷)?(?:总分|满分|合计|总计)\\s*(?:[:为]|是|设为)?', '分'),
  minutes: rule('(?:考试时长|考试时间|答题时间|限时|用时|时长|时间)\\s*(?:[:为]|是|设为)?', '分钟'),
} as const;
const digits = '零一二三四五六七八九';
const units: Readonly<Record<string, number>> = {十: 10, 百: 100, 千: 1000, 万: 10000};

function integer(text: string): number | undefined {
  if (/^\d+$/u.test(text)) return Number(text);
  const value = text.replaceAll('两','二').replaceAll('〇','零');
  if (value.length === 1 && digits.includes(value)) return digits.indexOf(value);
  let total = 0, pending = 0, place = Infinity, zero = false;
  for (const [index, char] of [...value].entries()) {
    const unit = Object.hasOwn(units,char) ? units[char] : 0;
    if (unit) {
      if (unit >= place || (!pending && !(index === 0 && char === '十'))) return undefined;
      total += (pending || 1) * unit;
      pending = 0;
      zero = false;
      place = unit;
    } else {
      if (pending || (char === '零' && (!total || zero))) return undefined;
      zero = zero || char === '零';
      pending = digits.indexOf(char);
    }
  }
  if (!total || (pending && place > 10 && !zero) || (zero && !pending)) return undefined;
  return total + pending;
}

const ratio = /^(?:难度比例|难度分布)\s*[:=]?\s*(?:易|简单)\s*[:/、]?\s*(?:中|中等)\s*[:/、]?\s*(?:难|困难)\s*[:=为]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(%)?\s*[:/]\s*(\d{1,3}(?:\.\d{1,2})?)\s*(%)?\s*[:/]\s*(\d{1,3}(?:\.\d{1,2})?)\s*(%)?$/u;
const knowledgeList = /^必选知识点\s*(?:[:=为]|包括)\s*([\p{L}\p{N}、/+\s·（）()]{1,150})$/u;
const typeQuota = new RegExp('^(单项选择题|多项选择题|不定项选择题|选择题|单选题|多选题|填空题|简答题|解答题|计算题|判断题|编程题)\\s*(?:[:为]|共|各)?\\s*'+numeral+'\\s*(?:道(?:题)?|题)$','u');
const subjectLabel = /^学科\s*[:为]\s*([\p{L}\p{N}·()]{1,18})$/u;
const gradeLabel = /^年级\s*[:为]\s*([\p{L}\p{N}·()]{1,18})$/u;
const originalOnly = /^(?:只|仅)(?:使用|从|用)(?:本地)?题库(?:选题|抽题|组卷)?$|^不(?:使用|采用)生成题$/u;

/** Only literal whole-paper clauses from the teacher may constrain a model-submitted blueprint. */
function clauses(request: string): string[] {
  return request.normalize('NFKC').replace(/\r\n?/gu, '\n')
    .replace(/\x60{3}[\s\S]*?(?:\x60{3}|$)|\{[\s\S]*$/gu, '')
    .replace(/["“「『][^"”」』\n]*["”」』]/gu,'')
    .replace(/(?:示例|例子|例如|参考蓝图)\s*[:：].*$/gmu,'')
    .split(/[。！？!?；;，,\n]/u)
    .map(clause => clause.trim().replace(/^(?:要求|约束)\s*:\s*/u, ''))
    .filter(clause => clause.length > 0 && clause.length <= 180 && !/[{}]/u.test(clause));
}

type PaperConstraintFailure = 'count' | 'points' | 'minutes' | 'subject' | 'grade' | 'type' | 'source' | 'knowledge' | 'difficulty' | 'ambiguous';

export function compareTeacherPaperConstraints(request: string, blueprint: PaperBlueprint): PaperConstraintFailure | undefined {
  const terms = clauses(request);
  const actual = {
    count: blueprint.sections.reduce((count, section) => count + section.count,0),
    points: blueprint.totalPoints,
    minutes: blueprint.durationMinutes,
  };
  for (const field of Object.keys(numberRules) as (keyof typeof numberRules)[]) {
    const expected = new Set<number>();
    for (const clause of terms) {
      const match = numberRules[field].exec(clause);
      const value = match && integer(match[1]);
      if (typeof value === 'number' && value > 0) expected.add(value);
    }
    if (expected.size > 1) return 'ambiguous';
    if (expected.size === 1 && !expected.has(actual[field])) return field;
  }
  const subjects = new Set(terms.flatMap(clause => subjectLabel.exec(clause)?.[1] ?? []));
  if (subjects.size > 1) return 'ambiguous';
  if (subjects.size === 1 && !subjects.has(blueprint.subject.normalize('NFKC'))) return 'subject';
  const grades = terms.flatMap(clause => gradeLabel.exec(clause)?.[1] ?? []);
  if (grades.some(grade => !equivalentQuestionGradeLabels(grades[0]).includes(grade))) return 'ambiguous';
  if (grades.length && !equivalentQuestionGradeLabels(grades[0]).includes(blueprint.grade)) return 'grade';
  if (blueprint.mode !== 'source_only' && terms.some(clause => originalOnly.test(clause))) return 'source';

  const quotas = new Map<string, number>();
  for (const clause of terms) {
    const match = typeQuota.exec(clause);
    if (!match) continue;
    const count = integer(match[2]);
    if (count === undefined) continue;
    const key = paperQuestionType(questionTypeLabels(match[1])[0]);
    if (quotas.has(key) && quotas.get(key) !== count) return 'ambiguous';
    quotas.set(key, count);
  }
  for (const [type, count] of quotas) {
    const labels = questionTypeLabels(type);
    const selected = blueprint.sections.filter(section =>
      labels.includes(section.questionType) || paperQuestionType(questionTypeLabels(section.questionType)[0]) === type);
    if (selected.reduce((sum, section) => sum + section.count, 0) !== count) return 'type';
  }
  const requiredLabels = terms.flatMap(clause => {
    const match = knowledgeList.exec(clause);
    const labels = match?.[1].split(/[、/+]/u).map(label=>label.trim()).filter(Boolean) || [];
    return labels.every(label => !/可选|或者|任选|不限|不要求|仅作参考/u.test(label)) ? labels : [];
  });
  if (requiredLabels.some(label => !blueprint.sections.some(section => section.knowledgePoint?.trim().normalize('NFKC') === label))) return 'knowledge';

  const ratios = new Map<string, number[]>();
  for (const clause of terms) {
    const match = ratio.exec(clause);
    if (!match) continue;
    const values = [Number(match[1]), Number(match[3]), Number(match[5])];
    const total = values.reduce((sum, value) => sum + value, 0);
    const percentCount = [match[2], match[4], match[6]].filter(Boolean).length;
    if (!total || (percentCount && (percentCount !== 3 || Math.abs(total - 100) > 0.001))) continue;
    const proportions = values.map(value => value / total);
    ratios.set(proportions.map(value => value.toFixed(6)).join(':'), proportions);
  }
  if (ratios.size > 1) return 'ambiguous';
  if (ratios.size === 1) {
    const planned = paperPlannedDifficulty(blueprint), [expected] = ratios.values();
    if (planned.unspecified || PAPER_DIFFICULTIES.some((level,index) =>
      Math.abs(planned[level] / actual.count - expected[index]) > 0.0500001)) return 'difficulty';
  }
}
