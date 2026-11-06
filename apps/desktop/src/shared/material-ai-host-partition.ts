import { questionNumberPrefix } from './material-ai-image';
import type { SourceCropKind } from './material-ai-owned-crops';
import { publicationPrefix, type SourcePart } from './question-source-content';

const closingBrackets: Record<string, string> = { '[': ']', '(': ')', '（': '）', '「': '」', '【': '】' };

/** Partition the exact received characters. A layout conflict may hold a
 * question, but cannot remove its conditions or supply missing source text. */
export function partitionLiteralCrop(text: string, kind: SourceCropKind, number: string, firstBody: boolean, publication: boolean) {
  if (kind === 'figure') return { parts: text ? [{ role: 'figure' as const, text }] : [], metadataIssue: publication };
  if (!text) return { parts: [], metadataIssue: true };
  const parts: SourcePart[] = [];
  const marker = firstBody ? questionNumberPrefix(text, number)?.[0] : undefined;
  let remaining = marker ? text.slice(marker.length) : text;
  // An isolated parent marker cannot become an empty, apparently complete body.
  if (!remaining.trim()) return { parts: [{ role: 'body' as const, text }], metadataIssue: true };
  if (marker) parts.push({ role: 'marker', text: marker });
  const printedParent = firstBody ? text.match(/^(?:第(\d{1,5})题[ \t]*[:：]?|(\d{1,5})[.、．](?!\d))/u) : null;
  let metadataIssue = !!printedParent && (printedParent[1] || printedParent[2]) !== number;
  if (publication) {
    const close = closingBrackets[remaining[0]], end = close ? remaining.indexOf(close) : -1;
    const candidate = end >= 0 && end < 112 ? remaining.slice(0, end + 1) : '';
    const citation = candidate.slice(1, -1), exam = citation.match(/中考|高考|期中(?:考试)?|期末(?:考试)?|月考|联考|模拟|检测|竞赛|真题|教材|练习|训练|调研|适应性/u);
    const endsAtExam = !!exam && /^[\s,，、★☆*]*$/u.test(citation.slice(exam.index! + exam[0].length));
    if (firstBody && publicationPrefix(candidate) && endsAtExam && remaining.slice(candidate.length).trim()) {
      parts.push({ role: 'publication', text: candidate });
      remaining = remaining.slice(candidate.length);
    } else metadataIssue = true;
  }
  parts.push({ role: 'body', text: remaining });
  return { parts, metadataIssue };
}
