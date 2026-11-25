import { choiceLabelsForReview, type StructureParagraph, type StructurePart, type StructureQuestion } from "../../shared/material-document-structure";
import { questionSection } from "./material-structure-numbering";

export function paragraphOptions(paragraph: StructureParagraph): StructurePart[] {
  const markers = [...paragraph.text.matchAll(
    /(?:^|\s|[、，])(?:[（(]([A-H])[）)]|([A-H])[.．、])/gu,
  )];
  const first = markers.findIndex(marker => (marker[1] || marker[2]) === "A");
  const options = paragraph.role === "option" ? markers
    : first >= 0 && markers.length - first >= 2 ? markers.slice(first) : [];
  return options.map((marker, index) => ({
    label: marker[1] || marker[2],
    paragraphIds: [paragraph.id],
    text: paragraph.text.slice(marker.index, options[index + 1]?.index).trim(),
  }));
}

const circled = Array.from("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳");
const choicePrompt = /(?:这些|上述|以上|前述|其中)[^。！？；\n]{0,36}(?:(?:正确|合理|错误|成立|符合题意)的(?:个数|数量|有|是)|(?:个数|数量)为)|(?:以下|下列|上述)(?:选项|说法|判断|结论)(?:中)?[，, ]*(?:正确|错误|合理|符合题意)的(?:是|有)/u;
const labelOnly = /^[、，]?\s*(?:[（(][A-D][）)]|[A-D][.．、])$/u;
const printedChoiceCount = /(?:每(?:小)?题|各(?:小)?题)(?:均|都)?(?:的|给出|给了|提供|所给(?:出)?(?:的)?|设有|有)?\s*([二三四五六七八2-8])\s*(?:个|项)?\s*选项/u;

export function checkWholeQuestionChoices(question: StructureQuestion) {
  if (question.kind !== "question" || question.subquestions.length ||
      !questionSection.exec(question.section.trim())?.[1].endsWith("选择题")) return;
  const printed = printedChoiceCount.exec(question.section.normalize("NFKC"))?.[1];
  const expected = printed ? Number(printed) || "一二三四五六七八".indexOf(printed) + 1 : 0;
  if (!choiceLabelsForReview({...question, expectedChoiceCount: expected}).length) return;
  if (expected) question.expectedChoiceCount = expected;
  question.issues.push("missing_choice_options");
}

function horizontalChoiceRow(row: StructureParagraph[]) {
  return Math.max(...row.map(p => p.anchor.box[1])) < Math.min(...row.map(p => p.anchor.box[3])) &&
    row.every((p, index) => !index || p.anchor.box[0] > row[index - 1].anchor.box[0]);
}

function twoByTwoChoiceGrid(row: StructureParagraph[]) {
  if (row.length !== 4) return false;
  const [a, b, c, d] = row;
  return horizontalChoiceRow([a, b]) && horizontalChoiceRow([c, d]) &&
    Math.max(a.anchor.box[3], b.anchor.box[3]) <= Math.min(c.anchor.box[1], d.anchor.box[1]) &&
    Math.abs(a.anchor.box[0] - c.anchor.box[0]) <= 0.04 &&
    Math.abs(b.anchor.box[0] - d.anchor.box[0]) <= 0.04;
}

/** Circled statements stay in the stem when the printed choice prompt owns the trailing options. */
export function choiceStatementIds(section: string, paragraphs: StructureParagraph[]): Set<string> | undefined {
  if (!questionSection.exec(section.trim())?.[1].endsWith("选择题")) return;
  const children = paragraphs.filter(p => p.marker?.kind === "child");
  if (children.length < 2 || children.some((p, index) => p.marker?.label !== circled[index])) return;
  const lastChild = children.at(-1)!;
  const firstOption = paragraphs.findIndex(p => p.role === "option");
  const lastChildIndex = paragraphs.indexOf(lastChild);
  if (firstOption <= lastChildIndex || paragraphs.slice(0, firstOption).some(p => paragraphOptions(p).length)) return;
  const prompt = paragraphs.slice(lastChildIndex, firstOption);
  const row = paragraphs.slice(firstOption);
  if (row.some(p => p.role !== "option") ||
      [...children, ...prompt, ...row].some(p => p.anchor.page !== lastChild.anchor.page || p.column !== lastChild.column) ||
      !prompt.some(p => ["subquestion", "body"].includes(p.role) && choicePrompt.test(p.text))) return;
  if (row[0].anchor.box[1] <= lastChild.anchor.box[1]) return;
  const options = row.flatMap(paragraphOptions);
  if (options.length < 2 || options.some((option, index) => !/^[A-D]$/u.test(option.label) || labelOnly.test(option.text) ||
      (index > 0 && option.label <= options[index - 1].label))) return;
  if (!horizontalChoiceRow(row) &&
      !(options.map(option => option.label).join("") === "ABCD" && row.every(p => paragraphOptions(p).length === 1) && twoByTwoChoiceGrid(row))) return;
  return new Set(children.map(p => p.id));
}
