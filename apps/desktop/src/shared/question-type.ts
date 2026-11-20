const genericChoice = ['选择题', 'choice'];
const singleChoice = ['单项选择题', '单选题', 'single_choice'];
const multipleChoice = ['多项选择题', '多选题', 'multiple_choice'];
const indeterminateChoice = ['不定项选择题', '不定项', 'indeterminate_choice'];

const choiceLabels = new Map<string, readonly string[]>();
for (const labels of [singleChoice, multipleChoice, indeterminateChoice]) {
  for (const label of labels) choiceLabels.set(label, labels);
}
const allChoice = [...genericChoice, ...singleChoice, ...multipleChoice, ...indeterminateChoice];
for (const label of genericChoice) choiceLabels.set(label, allChoice);

/** A general choice filter includes known subtypes. A specific subtype requires an explicit label. */
export function questionTypeLabels(filter: string): readonly string[] {
  return choiceLabels.get(filter) ?? [filter];
}
