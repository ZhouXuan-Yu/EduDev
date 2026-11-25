import {createHash} from 'node:crypto';
import {validPdfFilePage} from '../../shared/material-pdf-file';
import type {QuestionBankItem} from '../../shared/contracts';

export const COMPACT_CHOICE_POLICY = 'printed-compact-choice.v1' as const;
export type ChoiceRange = [number, number];
type Line = {raw: string; value: string; at: number; heading?: string};
export type CompactChoiceProof = {policy: typeof COMPACT_CHOICE_POLICY; resourceId: string; version: string;
  generation: string; page: number; receiptSha: string; range: ChoiceRange};

const digits = '[1-9][0-9]{0,4}';
const dash = '[-–—~～至到]';
const ordinal = '^[一二三四五六七八九十]+[、.．]\\s*';
const choice = '(?:单项选择题|单选题|选择题(?:答案)?)';
const questionHeading = new RegExp(ordinal + choice + '(?=\\s*[（(]|\\s*$)', 'u');
const answerHeading = new RegExp(`^[ \\t]*(?:[一二三四五六七八九十]+[、.．]\\s*)?${choice}\\s*(?:[(（]第?\\s*([0-9０-９]+)\\s*${dash}\\s*([0-9０-９]+)\\s*题?[)）])?\\s*[:：](?=\\s*\\S)`, 'u');
const beforeHeading = new RegExp(ordinal + '(?:填空题|判断题|听力题)\\s*$', 'u');
const afterHeading = new RegExp(ordinal + '(?:解答题|计算题|简答题|实验题|非选择题)\\s*$', 'u');
const numberedHeading = new RegExp(ordinal, 'u');
const itemStart = new RegExp(`^(${digits})[.、．](?![0-9])`, 'u');
const singleChoice = /单项选择题|单选题|每题(?:有且只有|只有|仅有)一个正确答案/u;
const normalize = (text: string) => text.normalize('NFKC');

export function compactChoiceCandidate(line: Line): boolean {
  return answerHeading.test(line.value);
}

/** The unnumbered format needs visible neighboring groups and question markers.
 * Their values are later checked independently against the original question page. */
export function readCompactChoiceRow(lines: Line[], index: number, sectionStart: number) {
  const line = lines[index];
  const start = answerHeading.exec(line.raw.trimEnd());
  if (!start) return;
  const rest = line.raw.slice(start[0].length).trimEnd();
  if (!/^[ \t\u3000]*[A-HＡ-Ｈ](?:[ \t\u3000、,，]*[A-HＡ-Ｈ]){1,31}$/u.test(rest)) return;
  const letters = [...rest.matchAll(/[A-HＡ-Ｈ]/gu)];
  let range: ChoiceRange;
  if (start[1]) range = [Number(normalize(start[1])), Number(normalize(start[2]))];
  else {
    let previous = 0, foundGroup = false;
    for (let i = index - 1; i > sectionStart; i--) {
      const candidate = lines[i];
      if (beforeHeading.test(candidate.value)) {foundGroup = true;break;}
      if (candidate.heading !== undefined || compactChoiceCandidate(candidate) || afterHeading.test(candidate.value)) return;
      if (!previous) previous = Number(itemStart.exec(normalize(candidate.value))?.[1] ?? 0);
    }
    if (!foundGroup) return;
    // A scanned watermark may be split into stray one-character OCR lines.
    const [heading, first] = lines.slice(index + 1,index + 7).filter(candidate=>!/^\p{L}$/u.test(candidate.value));
    if (!heading || !first || !afterHeading.test(heading.value)) return;
    const next = Number(itemStart.exec(normalize(first.value))?.[1] ?? 0);
    if (!previous || !next) return;
    range = [previous + 1, next - 1];
  }
  if (range[0] < 1 || range[1] > 99999 || range[1] - range[0] + 1 !== letters.length) return;
  return {range, entries: letters.map((letter, index) => ({number: String(range[0] + index), answer: normalize(letter[0]),
    start: line.at + start[0].length + letter.index!, quote: letter[0]}))};
}

export function printedSingleChoiceRange(text: string, number: string): ChoiceRange | undefined {
  const lines = normalize(text).split('\n').map(line => line.trim());
  const marker = lines.findIndex(line => itemStart.exec(line)?.[1] === number);
  if (marker < 0 || lines.slice(marker + 1).some(line => itemStart.exec(line)?.[1] === number)) return;
  const start = lines.slice(0, marker).findLastIndex(line => numberedHeading.test(line));
  if (start < 0 || !questionHeading.test(lines[start]) || !lines.slice(start, Math.min(start + 5, marker)).some(line => singleChoice.test(line))) return;
  const heading = lines[start];
  const count = /(?:共有|共计|共)\s*([1-9][0-9]?)\s*(?:小)?题/u.exec(heading);
  let ranges = [...heading.matchAll(new RegExp(`第\\s*(${digits})(?:\\s*${dash}\\s*(${digits}))?\\s*题`, 'gu'))]
    .map(match => [Number(match[1]), Number(match[2] ?? match[1])] as ChoiceRange);
  if (!ranges.length) {
    const end = lines.findIndex((line,index) => index > start && numberedHeading.test(line));
    ranges = lines.slice(start+1,end < 0 ? undefined : end).flatMap(line=>{
      const item=itemStart.exec(line);
      return item?[[Number(item[1]),Number(item[1])] as ChoiceRange]:[];
    });
  }
  if (!count || !ranges.length || ranges.some(([from, through], index) => through < from || index > 0 && from !== ranges[index - 1][1] + 1)) return;
  const range: ChoiceRange = [ranges[0][0], ranges.at(-1)![1]];
  if (range[1] - range[0] + 1 === Number(count[1]) && Number(number) >= range[0] && Number(number) <= range[1]) return range;
}

type Read = (sql: string, values: (string|number|null)[]) => Promise<Record<string,unknown>[]>;
export async function verifyCompactChoice(read: Read, q: QuestionBankItem, source: {resourceId:string;version:string;page:number}, range: ChoiceRange, answer: string) {
  if (!/^(?:单项选择题|单选题|选择题)$/u.test(q.questionType) || !q.archive?.number) return;
  const choices = q.document?.blocks.flatMap(block => block.kind === 'choices' ? block.options : []) ?? [];
  if (choices.filter(option => normalize(option.label) === answer).length !== 1) return;
  const [row] = await read(`SELECT j.generation,p.result_json FROM material_pdf_jobs j JOIN material_pdf_pages p ON p.generation=j.generation
    WHERE j.resource_id=? AND j.version=? AND p.page=? AND p.status='complete'`, [source.resourceId,source.version,source.page]);
  if (!row || typeof row.result_json !== 'string') return;
  let receipt: unknown;
  try { receipt = JSON.parse(row.result_json); } catch { return; }
  if (!validPdfFilePage(receipt) || receipt.status !== 'complete') return;
  const printed = printedSingleChoiceRange(receipt.text, q.archive.number);
  if (!printed || printed[0] !== range[0] || printed[1] !== range[1]) return;
  return {policy:COMPACT_CHOICE_POLICY,...source,generation:String(row.generation),
    receiptSha:createHash('sha256').update(row.result_json).digest('hex'),range} satisfies CompactChoiceProof;
}
