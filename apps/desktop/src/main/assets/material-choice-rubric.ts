export type ChoiceRange = [number, number];
const digits = '[1-9][0-9]{0,4}';
const dash = '[-–—~～至到]';
const rangePattern = new RegExp(`第\\s*(${digits})(?:\\s*${dash}\\s*(${digits}))?\\s*题`, 'gu');

export function printedChoiceCount(heading: string): number {
  return Number(/(?:共有|共计|共)\s*([1-9][0-9]?)\s*(?:小)?题/u.exec(heading.normalize('NFKC'))?.[1] ?? 0);
}

export function printedChoiceRanges(heading: string): ChoiceRange[] {
  return [...heading.normalize('NFKC').matchAll(rangePattern)].map(match => [Number(match[1]), Number(match[2] ?? match[1])]);
}

export function contiguousChoiceRange(ranges: ChoiceRange[], count: number): ChoiceRange | undefined {
  if (!count || !ranges.length || ranges.some(([from, through], i) => through < from || i > 0 && from !== ranges[i - 1][1] + 1)) return;
  const range: ChoiceRange = [ranges[0][0], ranges.at(-1)![1]];
  if (range[1] - range[0] + 1 === count) return range;
}
