const genericChoice = ['选择题', 'choice'];
const singleChoice = ['单项选择题', '单选题', 'single_choice'];
const multipleChoice = ['多项选择题', '多选题', 'multiple_choice'];
const indeterminateChoice = ['不定项选择题', '不定项', 'indeterminate_choice'];
const nonChoiceLabels = [
  ['填空题', 'fill_in_blank'],
  ['简答题', 'short_answer'],
  ['解答题', '计算题', '综合计算题', 'written'],
  ['判断题', 'concept'],
  ['编程题', 'coding'],
];

const typeLabels = new Map<string, readonly string[]>();
for (const labels of [singleChoice, multipleChoice, indeterminateChoice]) {
  for (const label of labels) typeLabels.set(label, labels);
}
const allChoice = [...genericChoice, ...singleChoice, ...multipleChoice, ...indeterminateChoice];
for (const label of genericChoice) typeLabels.set(label, allChoice);
for (const labels of nonChoiceLabels) {
  for (const label of labels) typeLabels.set(label, labels);
}

/** A general choice filter includes known subtypes. A specific subtype requires an explicit label. */
export function questionTypeLabels(filter: string): readonly string[] {
  return typeLabels.get(filter) ?? [filter];
}
