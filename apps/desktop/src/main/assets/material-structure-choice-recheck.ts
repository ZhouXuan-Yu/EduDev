import { choiceLabelsForReview, hasPrintedChoiceText, type StructureChoiceRecheck, type StructurePage, type StructureQuestion } from "../../shared/material-document-structure";
import type { PageBox } from "../../shared/material-page-preview";
import type { LocalOcrReceipt } from "../../shared/xiaozhi-ocr";

type Known = { label: string; text: string };
export type ChoiceRecheckPlan = { box: PageBox; labels: string[]; known: Known[] };
const position = (label: string) => label.charCodeAt(0) - 65;
const tokens = (text: string) => text.normalize("NFKC").matchAll(/(?:^|\s)(?:\(([A-H])\)|([A-H])[.、])\s*/gu);
const body = (text: string) => text.normalize("NFKC").trim().replace(/^(?:\([A-H]\)|[A-H][.、])\s*/u, "")
  .replace(/\s+/gu, "");

/** Plan one original row. Independent paragraph boxes are required because a merged OCR line has no option coordinates. */
export function planChoiceRecheck(question: StructureQuestion, page: StructurePage): ChoiceRecheckPlan | undefined {
  if (question.pageRange[0] !== page.page || question.pageRange[1] !== page.page || page.issues.length ||
      !question.issues.includes("missing_choice_options") || question.subquestions.length || question.assets.some(asset => asset.choiceLabel)) return;
  const labels = choiceLabelsForReview(question);
  const known = question.options.filter(option => !labels.includes(option.label) && hasPrintedChoiceText(option.text));
  if (known.length < 2 || labels.length > 4 || !labels.length) return;
  const byId = new Map(page.paragraphs.map(part => [part.id, part]));
  const parts = known.map(option => option.paragraphIds.length === 1 ? byId.get(option.paragraphIds[0]) : undefined);
  const first = parts[0], last = parts.at(-1);
  if (!first || !last || first.column < 0 || parts.some((part, index) => !part || part.role !== "option" ||
      part.marker?.label !== known[index].label || part.column !== first.column || part.lineIds.length !== 1 || part.confidence < .78)) return;
  const boxes = parts.map(part => part!.anchor.box);
  const upper = Math.max(...boxes.map(box => box[1]));
  const lower = Math.min(...boxes.map(box => box[3]));
  const height = Math.max(...boxes.map(box => box[3] - box[1]));
  if (lower - upper < height * .48 || height < .006 || height > .05) return;
  const spacing = (last.anchor.box[0] - first.anchor.box[0]) / (position(known.at(-1)!.label) - position(known[0].label));
  if (!Number.isFinite(spacing) || spacing < height * 2.5 || spacing > .35 || boxes.some((box, index) =>
      Math.abs(box[0] - first.anchor.box[0] - spacing * (position(known[index].label) - position(known[0].label))) > spacing * .18 ||
      box[2] - box[0] > spacing * .8)) return;
  const lane = page.columns[first.column];
  if (!lane) return;
  const included = [...known.map(option => option.label), ...labels].sort();
  const start = first.anchor.box[0] + spacing * (position(included[0]) - position(known[0].label));
  const end = first.anchor.box[0] + spacing * (position(included.at(-1)!) - position(known[0].label));
  const box: PageBox = [Math.max(lane[0], start - height * .39), Math.max(0, Math.min(...boxes.map(box => box[1])) - height * .45),
    Math.min(lane[2], end + Math.max(spacing * .48, last.anchor.box[2] - last.anchor.box[0]) + height * .25),
    Math.min(1, Math.max(...boxes.map(box => box[3])) + height * .43)];
  const owned = new Set(question.paragraphIds);
  if (box[0] > start + height * .65 || box[2] < end + height || page.paragraphs.some(part => {
    const other = part.anchor.box;
    return !owned.has(part.id) && part.column === first.column && Math.min(other[2], box[2]) > Math.max(other[0], box[0]) &&
      Math.min(other[3], box[3]) - Math.max(other[1], box[1]) > height * .2;
  })) return;
  return { box, labels, known };
}

/** Require the same original row to reappear before retaining any additional reading. */
export function matchChoiceRecheck(plan: ChoiceRecheckPlan, receipt: Extract<LocalOcrReceipt,{ok:true}>) {
  const lines = receipt.text.split(/\r?\n/u).filter(line => line.trim());
  if (lines.length !== receipt.scores.length || lines.length > 16) return new Map<string, string>();
  const options = new Map<string, string>();
  for (const [index, line] of lines.entries()) {
    if (receipt.scores[index] < .8) continue;
    const normalized = line.normalize("NFKC").trim();
    const markers = [...tokens(normalized)];
    for (const [at, marker] of markers.entries()) {
      const label = marker[1] || marker[2];
      const text = normalized.slice(marker.index! + marker[0].length, markers[at + 1]?.index).trim();
      if (!text || text.length > 140) continue;
      if (options.has(label)) return new Map<string, string>();
      options.set(label, text);
    }
  }
  if (!plan.known.every(option => body(option.text) === body(options.get(option.label) ?? ""))) return new Map<string, string>();
  const order = [...options.keys()];
  if (order.some((label, index) => index > 0 && label <= order[index - 1])) return new Map<string, string>();
  return options;
}

export function choiceRecheckReadings(plan: ChoiceRecheckPlan, runs: Map<string, string>[]): StructureChoiceRecheck["choices"] {
  return plan.labels.map(label => {
    const candidates = runs.flatMap(run => run.has(label) ? [run.get(label)!] : []);
    const readings = [...new Map(candidates.map(text => [body(text), text])).values()];
    return { label, readings, status: readings.length > 1 ? "conflicting" : !readings.length ? "unreadable"
      : candidates.length > 1 ? "consistent" : "single_read" };
  });
}
