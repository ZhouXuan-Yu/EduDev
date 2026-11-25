import { contiguousChoiceRange, printedChoiceCount, printedChoiceRanges, type ChoiceRange } from './material-choice-rubric';
import { bookSectionAt } from './material-book-answer-content';
import { nonQuestionPagePurpose } from './material-page-purpose';

export type NumberedChoiceWitness = { marker: string; choiceRange: ChoiceRange };
export type NumberedChoiceRow = {
  section: string; range: ChoiceRange; sample: string; letters: string; numbered: NumberedChoiceWitness;
};

const ordinal = /^[一二三四五六七八九十]+[、.．]/u;
const choiceHeading = /^(?:[一二三四五六七八九十]+[、.]\s*)?(?:单项选择题|单选题|选择题)(?=\s*\(|$)/u;
const examBoundary = /^\d{4}(?:届|年)[^。！？?]{3,65}(?:[一二三四1-4]模|试卷|参考答案|解析)$/u;
const number = '([1-9][0-9]{0,4})';
const parent = new RegExp('^(?:【\\s*'+number+'\\s*】|〖\\s*'+number+'\\s*〗|〔\\s*'+number+'\\s*〕|'+
  '\\[\\s*'+number+'\\s*\\]|第\\s*'+number+'\\s*题\\s*[:：]?|'+number+'[.、](?![0-9]))', 'u');
const normalized = (line: string) => line.normalize('NFKC').trim();
const literal = (line: string) => normalized(line).replace(/\s/gu,'');

export function numberedChoiceParent(line: string) {
  return parent.exec(normalized(line))?.slice(1).find(Boolean);
}

export function numberedChoiceLetter(line: string) {
  const text = literal(line);
  const answer = /^(?:【(?:参考答案|答案|解答|解|答)】|〖(?:参考答案|答案|解答|解|答)〗|〔(?:参考答案|答案|解答|解|答)〕|\[(?:参考答案|答案|解答|解|答)\]|(?:参考答案|答案):):?([A-H])[。.!！]?$/iu.exec(text)?.[1]
    ?? /^[，,。]?(?:选|故选|因此选)([A-H])[。.!！]?$/iu.exec(text)?.[1]
    ?? /^[^。！？]{1,40}[，,。](?:故选|选)([A-H])[。.!！]?$/iu.exec(text)?.[1];
  return answer?.toUpperCase();
}

/** Carry a printed number range over adjacent complete pages. A gap or a new group breaks the run. */
export function numberedChoiceRows(pages: string[]): NumberedChoiceRow[] {
  let section = '', choiceRange: ChoiceRange | undefined, expected = 0;
  let last: NumberedChoiceRow[] = [];
  for (const text of pages) {
    const rows: NumberedChoiceRow[] = [];
    last = rows;
    if (!text || Buffer.byteLength(text) > 64_000 || nonQuestionPagePurpose(text)) {
      section = ''; choiceRange = undefined; continue;
    }
    let open: { index: number; marker: string; extracts: { sample: string; answer: string }[] } | undefined;
    const finish = () => {
      if (open && choiceRange && open.extracts.length === 1) {
        const entry = open.extracts[0];
        rows.push({section, range: [open.index,open.index], sample: entry.sample, letters: entry.answer,
          numbered: {marker: open.marker, choiceRange}});
      }
      open = undefined;
    };
    const seen = new Set<number>();
    let offset = 0, titleStart = 0;
    for (const raw of text.split('\n')) {
      const at = offset;
      offset += raw.length + 1;
      const line = normalized(raw);
      if (choiceHeading.test(line)) {
        finish();
        section = bookSectionAt(text.slice(titleStart,at),at-titleStart,true) ?? section;
        choiceRange = contiguousChoiceRange(printedChoiceRanges(line), printedChoiceCount(line));
        expected = choiceRange?.[0] ?? 0;
        continue;
      }
      if (ordinal.test(line) || examBoundary.test(line) || bookSectionAt(line, line.length, true) !== undefined) {
        finish();
        if (examBoundary.test(line)) {
          titleStart = at;
          section = bookSectionAt(line,line.length,true) ?? '';
        }
        choiceRange = undefined;
        continue;
      }
      if (!choiceRange) continue;
      const token = numberedChoiceParent(line);
      if (token) {
        finish();
        const index = Number(token);
        if (index !== expected || index > choiceRange[1] || seen.has(index)) {
          rows.splice(0);
          choiceRange = undefined;
          continue;
        }
        seen.add(index);
        expected++;
        if (raw.trim().length <= 200) open = {index,marker:raw.trim(),extracts:[]};
      } else if (open) {
        const answer = numberedChoiceLetter(line);
        if (answer && raw.trim().length <= 200) open.extracts.push({sample:raw.trim(),answer});
      }
    }
    finish();
    if (choiceRange && expected > choiceRange[1]) choiceRange = undefined;
    const remaining = text.slice(titleStart);
    section = bookSectionAt(remaining,remaining.length,true) ?? section;
  }
  return last;
}
