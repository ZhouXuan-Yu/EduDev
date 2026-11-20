import type { StructurePage, StructureParagraph, StructureQuestion } from "../../shared/material-document-structure";
import { validNativeTextResult, type NativeTextLine } from "../../shared/material-native-text";
import { validPageBox, type PageBox } from "../../shared/material-page-preview";
import type { PdfFilePage } from "../../shared/material-pdf-file";
import type { QuestionAnchor } from "../../shared/question-document";
import { printedChoiceSection, printedChoiceTokens, type PrintedChoiceSection } from "./word-booklet";

const compact = (value: string) => value.normalize("NFC").replace(/\s/gu, "");
const title = (value: string) => compact(value).normalize("NFKC").replace(/^(?:【|\[)|(?:】|\]):?$|:$/gu, "");
export const isPrintedAnswerCover = (value: string) =>
  /^(?:参考答案(?:(?:与|及|和)?解析)?|标准答案|答案解析|答案详解|答案速查)$/u.test(title(value));
export const isPrintedAnswerCoverPart = (part: StructureParagraph) =>
  ["answer", "heading", "body"].includes(part.role) && isPrintedAnswerCover(part.rawText);

type AnswerCell = { number: string; letters: string; anchor?: QuestionAnchor };
type AnswerSection = { scope: PrintedChoiceSection; cells: AnswerCell[] };
export type PdfPrintedAnswers = { cover: StructureParagraph; sections: AnswerSection[] };
export type PdfChoiceHeading = { page: number; text: string; scope: PrintedChoiceSection };

const overlap = (from: number, to: number, otherFrom: number, otherTo: number) =>
  Math.max(0, Math.min(to, otherTo) - Math.max(from, otherFrom));
const sameRow = (a: PageBox, b: PageBox) =>
  overlap(a[1], a[3], b[1], b[3]) >= Math.min(a[3] - a[1], b[3] - b[1]) * .65 &&
  overlap(a[0], a[2], b[0], b[2]) >= Math.max(a[2] - a[0], b[2] - b[0]) * .8;

/** Cross-check exact local rows even when unrelated columns on the page disagree. */
export function pdfPrintedAnswers(page: StructurePage, receipt: PdfFilePage): PdfPrintedAnswers | undefined {
  const recovery = page.nativeRecovery, native = recovery?.native;
  if (!recovery || recovery.rasterSha256 !== page.rasterSha256 ||
      !validNativeTextResult(native) || !native.ok || native.version !== page.version ||
      native.page !== page.page || native.total !== page.totalPages ||
      !["complete", "needs_review"].includes(receipt.status) ||
      receipt.status === "needs_review" && receipt.error !== "text_conflict" ||
      !receipt.nativeText.trim() || receipt.ocrText && receipt.ocrText !== page.rawText) return;
  const covers = page.paragraphs.filter(isPrintedAnswerCoverPart);
  if (covers.length !== 1) return;
  const cover = covers[0], start = page.paragraphs.indexOf(cover);
  const nativeItems = new Map(native.items.map(item => [item.id, item]));
  const rawLines = new Map(page.lines.map(line => [line.id, line]));
  const nativeTranscript = receipt.nativeText.split(/\r?\n/u).map(compact);
  const ocrTranscript = page.rawText.split(/\r?\n/u).map(compact);
  const nativeLine = (part: StructureParagraph, score: number): NativeTextLine | undefined => {
    const line = part.lineIds.length === 1 ? rawLines.get(part.lineIds[0]) : undefined;
    if (!line || line.origin || line.score < score || !validPageBox(line.box)) return;
    const literal = compact(line.text);
    if (literal !== compact(part.rawText) || !ocrTranscript.includes(literal) || !nativeTranscript.includes(literal)) return;
    const found = native.lines.filter(row => compact(row.text) === literal && sameRow(row.box, line.box));
    if (found.length === 1) return found[0];
  };
  const coverLine = nativeLine(cover, .90);
  if (!coverLine) return;
  const relevant = page.paragraphs.slice(start + 1).filter(part => !["header","footer","note"].includes(part.role));
  const sections: AnswerSection[] = [];
  let priorEnd = coverLine.box[3];
  for (let index = 0; index < relevant.length; index++) {
    const heading = relevant[index], scope = printedChoiceSection(heading.rawText);
    if (!scope || !scope.ordinal || heading.role !== "heading") break;
    const headingLine = nativeLine(heading, .90);
    if (!headingLine || headingLine.box[1] < priorEnd || sections.length >= 12 ||
        native.lines.some(line => line.box[1] >= priorEnd && line.box[3] <= headingLine.box[1])) return;
    const cells: AnswerCell[] = [], claimed = new Set<string>();
    let end = headingLine.box[3];
    let next = index + 1;
    for (; next < relevant.length && printedChoiceSection(relevant[next].rawText) === undefined; next++) {
      const part = relevant[next], line = nativeLine(part, .93);
      if (!line || line.box[1] < end || Math.abs(line.box[0] - headingLine.box[0]) > .12) return;
      const { items, complete } = printedChoiceTokens(line.text);
      if (!complete || !items.length || cells.length + items.length > 200) return;
      const positioned = line.itemIds.map(id => nativeItems.get(id)!);
      if (new Set(line.itemIds).size !== positioned.length ||
          positioned.some((item, i) => item.box[0] < line.box[0] - .002 ||
            item.box[2] > line.box[2] + .002 ||
            overlap(item.box[1], item.box[3], line.box[1], line.box[3]) < (item.box[3] - item.box[1]) * .7 ||
            i > 0 && (item.box[0] <= positioned[i - 1].box[0] || positioned[i - 1].box[2] - item.box[0] > .001))) return;
      let offset = 0;
      const ranges = positioned.map(item => {
        const from = offset;
        offset += compact(item.text).length;
        return { from, to: offset, box: item.box };
      });
      if (compact(positioned.map(item => item.text).join("")) !== compact(line.text)) return;
      for (const item of items) {
        if (!item.letters || cells.length && Number(item.number) !== Number(cells.at(-1)!.number) + 1) return;
        const from = compact(line.text.slice(0, item.start)).length;
        const to = compact(line.text.slice(0, item.to)).length;
        const group = ranges.filter(range => range.from >= from && range.to <= to);
        const cell = { number: item.number, letters: item.letters };
        if (group[0]?.from === from && group.at(-1)?.to === to) {
          const box: PageBox = [Math.min(...group.map(r => r.box[0])), Math.min(...group.map(r => r.box[1])),
            Math.max(...group.map(r => r.box[2])), Math.max(...group.map(r => r.box[3]))];
          if (!validPageBox(box)) return;
          cells.push({ ...cell, anchor: { page: page.page, box } });
        } else cells.push(cell);
      }
      claimed.add(line.id);
      end = line.box[3];
    }
    const closing = relevant[next];
    const closingLine = closing && nativeLine(closing, .90);
    if (!closingLine && (closing || page.page !== page.totalPages) ||
        closingLine && closingLine.box[1] < end || !cells.length) return;
    const bottom = closingLine?.box[1] ?? Math.max(...native.lines.map(line => line.box[3]));
    if (native.lines.some(line => line.box[1] >= headingLine.box[3] && line.box[3] <= bottom && !claimed.has(line.id))) return;
    if (sections.some(section => section.scope.ordinal === scope.ordinal)) return;
    sections.push({ scope, cells });
    priorEnd = end;
    index = next - 1;
  }
  if (sections.length) return { cover, sections };
}

export function pdfChoiceHeadings(page: StructurePage, before: number): PdfChoiceHeading[] {
  if (page.issues.length) return [];
  return page.paragraphs.slice(0, before).flatMap(part => {
    const scope = part.role === "heading" && !part.issues.length &&
      compact(part.rawText) === compact(part.text) && printedChoiceSection(part.rawText);
    return scope && scope.ordinal ? [{ page: page.page, text: part.text, scope }] : [];
  });
}

/** A structured projection may split the stem from its choices without changing either. */
export function literalPrintedChoiceProjection(question: StructureQuestion, statement: string, choices: string) {
  const print = (text: string) => text.normalize("NFC").replace(/[\p{Zs}\t\r\n]+/gu, " ").trim();
  return print(choices) === print(question.options.map(option => option.text).join(" ")) &&
    [statement, statement + " " + choices].some(text => print(text) === print(question.stem));
}

/** A whole, ordered section proves which occurrence the printed number refers to. */
export function alignPdfChoiceAnswers(
  heading: PdfChoiceHeading, section: AnswerSection, questions: StructureQuestion[],
) {
  const answers = new Map<string, { text: string; anchor: QuestionAnchor }>();
  const mode = heading.scope.mode === "generic" ? section.scope.mode : heading.scope.mode;
  if (heading.scope.ordinal !== section.scope.ordinal ||
      heading.scope.mode !== "generic" && section.scope.mode !== "generic" && heading.scope.mode !== section.scope.mode ||
      questions.length !== section.cells.length ||
      questions.filter(question => question.number === "0").length > 1 ||
      questions.some((question, index) => question.number !== "0" && question.number !== section.cells[index].number)) return answers;
  const count = /(?:本(?:大)?题|本节|本部分)?共([1-9]\d{0,2})(?:小)?题/u.exec(heading.text.normalize("NFKC"));
  if (count && Number(count[1]) !== questions.length) return answers;
  for (const [index, question] of questions.entries()) {
    const cell = section.cells[index];
    if (!cell.anchor || question.status !== "candidate" || question.kind !== "question" ||
        question.section !== heading.text || question.number !== cell.number || question.answer ||
        question.subquestions.length || question.options.length < 2 ||
        question.options.some((option, at) => option.label !== String.fromCharCode(65 + at)) ||
        [...cell.letters].some(letter => !question.options.some(option => option.label === letter)) ||
        mode === "single" && cell.letters.length !== 1 || mode === "multiple" && cell.letters.length < 2) continue;
    answers.set(question.id, { text: cell.letters, anchor: cell.anchor });
  }
  return answers;
}
