const numbers = ['一二三四五六七八九', '123456789', '１２３４５６７８９'];

function numberedLabels(number: number, prefix: string, suffix: string) {
  return numbers.map(digits => prefix + digits[number - 1] + suffix);
}

const primary = Array.from({length: 6}, (_, index) => [
  ...numberedLabels(index + 1, '小学', '年级'),
  // Unqualified grade six can also belong to junior middle school (五四学制).
  ...(index === 5 ? [] : numberedLabels(index + 1, '', '年级')),
]);
const junior = Array.from({length: 3}, (_, index) => [
  ...numberedLabels(index + 1, '初', ''),
  ...numberedLabels(index + 1, '初中', '年级'),
  ...numberedLabels(index + 7, '初中', '年级'),
  ...numberedLabels(index + 7, '', '年级'),
]);
const senior = Array.from({length: 3}, (_, index) => [
  ...numberedLabels(index + 1, '高', ''),
  ...numberedLabels(index + 1, '高中', '年级'),
]);
const unqualifiedSix = numberedLabels(6, '', '年级');
const juniorSix = [...numberedLabels(6, '初中', '年级'), '初中预备年级', '预初'];
const byLabel = new Map<string, readonly string[]>();
for (const labels of [...primary, ...junior, ...senior, unqualifiedSix, juniorSix]) {
  for (const label of labels) byLabel.set(label, labels);
}

for (const {stage, grades} of [
  {stage: ['小学'], grades: primary},
  {stage: ['初中', '初级中学'], grades: [...junior, juniorSix]},
  {stage: ['高中', '高级中学'], grades: senior},
]) {
  const labels = [...stage, ...grades.flat()];
  for (const label of stage) byLabel.set(label, labels);
}

/** Expand an exact user filter to stored labels. Never change the saved evidence or guess from free text. */
export function questionGradeLabels(filter: string): readonly string[] {
  return byLabel.get(filter) ?? [filter];
}
