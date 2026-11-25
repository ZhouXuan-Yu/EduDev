import type { StructureFormulaSource, StructureLine, StructurePage, StructureParagraph } from "../../shared/material-document-structure";
import type { PageBox } from "../../shared/material-page-preview";

const equationLead = /\p{Script=Han}[^=＝≡]{0,16}[\p{Script=Latin}\p{Script=Greek}][\da-z_]{0,5}\s*[=＝≡]\s*$/u;
const optionEquation = /[\p{Script=Latin}\p{Script=Greek}\p{N})\]]\s*[=＝≡]\s*$/u;
const formulaGlyphs = /^[\p{Script=Latin}\p{Script=Greek}\p{N}+−\-*/×÷^().,[\]{}_√∛∑∫∞≤≥≠′″|\s]{1,32}$/u;
const isFormulaGlyphs = (text: string) => {
  const normalized = text.normalize("NFKC").trim();
  return formulaGlyphs.test(normalized) && /\p{L}|\p{N}/u.test(normalized);
};

const midpoint = (line: StructureLine) => (line.box[1] + line.box[3]) / 2;
const horizontalOverlap = (a: StructureLine, b: StructureLine) =>
  Math.min(a.box[2], b.box[2]) - Math.max(a.box[0], b.box[0]);

/** Recover the source pixels of an unclassified stacked equation, keeping the OCR literal. */
export function unconfirmedFormulaSources(page: StructurePage, paragraphs: StructureParagraph[]): StructureFormulaSource[] {
  if (page.issues.includes("ambiguous_columns")) return [];
  const owners = new Map(paragraphs.filter(part => ["body", "question", "subquestion", "formula", "option"].includes(part.role))
    .flatMap(part => part.lineIds.map(id => [id, part] as const)));
  const lines = page.lines.filter(line => (owners.get(line.id)?.column ?? -1) >= 0 && !line.origin);
  const textRegions = new Map(page.regions.filter(region => region.kind === "text" && region.score >= 0.5)
    .map(region => [region.id, region]));
  const sources: StructureFormulaSource[] = [];
  const usedParts = new Set<string>();
  for (const lead of lines) {
    if (sources.length >= 8) break;
    const owner = owners.get(lead.id)!;
    const optionLabel = owner.role === "option" && owner.marker?.kind === "option" ? owner.marker.label : undefined;
    if (!(optionLabel ? optionEquation : equationLead).test(lead.text)) continue;
    const [,, end] = lead.box;
    const height = lead.box[3] - lead.box[1];
    if (height < 0.006 || height > 0.045) continue;
    const lane = page.columns[owner.column];
    const region = lead.regionIds.map(id => textRegions.get(id)).find(r => r && r.box[2] >= end + height);
    if (!lane || !region) continue;
    const nearby = lines.filter(line => {
      const part = owners.get(line.id)!;
      return line !== lead && part.column === owner.column &&
        (part === owner || part.role === "body" || part.role === "formula") &&
        line.regionIds.includes(region.id) && isFormulaGlyphs(line.text);
    });
    const fractions = nearby.filter(line => {
      const distance = Math.abs(midpoint(line) - midpoint(lead));
      return Math.abs(line.box[0] - end) <= height * 1.65 &&
        line.box[2] - line.box[0] <= height * 4.5 && line.box[3] - line.box[1] <= height * 2 &&
        distance >= height * 0.26 && distance <= height * 1.35;
    });
    const upper = fractions.filter(line => midpoint(line) < midpoint(lead));
    const lower = fractions.filter(line => midpoint(line) > midpoint(lead));
    if (upper.length !== 1 || lower.length !== 1) continue;
    const [top, bottom] = [upper[0], lower[0]];
    if (usedParts.has(top.id) || usedParts.has(bottom.id) || horizontalOverlap(top, bottom) < height * 0.35) continue;
    const left = Math.max(lane[0], end - height * 2.35);
    const y0 = Math.max(0, Math.min(top.box[1], lead.box[1]) - height * 0.40);
    const y1 = Math.min(1, Math.max(bottom.box[3], lead.box[3]) + height * 0.52);
    const coreRight = Math.max(top.box[2], bottom.box[2]);
    // A companion on the baseline may locate the right edge even when its text was misread.
    const side = nearby.find(line => line.box[0] >= coreRight && line.box[0] - coreRight < height * 10 &&
      line.box[2] - line.box[0] < height * 7 && line.box[1] <= midpoint(lead) + height * 0.45 &&
      line.box[3] >= midpoint(lead) - height * 0.15);
    const right = Math.min(lane[2], region.box[2], (side?.box[2] ?? coreRight) + height * 1.2);
    if (left >= right || page.regions.some(r => ["inline_formula", "display_formula"].includes(r.kind) &&
        Math.min(right, r.box[2]) - Math.max(left, r.box[0]) >= (right - left) * 0.45 &&
        Math.min(y1, r.box[3]) > Math.max(y0, r.box[1]))) continue;
    const preview: PageBox = [left, y0, right, y1];
    const otherText = page.paragraphs.filter(part => part !== owner && ["question", "subquestion", "option", "table"].includes(part.role));
    const intersects = (box: PageBox) => otherText.some(({anchor:{box: other}}) =>
      Math.min(box[2], other[2]) > Math.max(box[0], other[0]) &&
      Math.min(box[3], other[3]) - Math.max(box[1], other[1]) > height * .15);
    if (optionLabel && intersects(preview)) continue;
    const recognitionBox: PageBox = [
      Math.max(left, Math.min(top.box[0], bottom.box[0]) - height * .35),
      Math.max(y0, top.box[1] - height * .12),
      Math.min(right, side?.box[0] ?? right, coreRight + height * .35),
      Math.min(y1, bottom.box[3] + height * .12),
    ];
    const [rx0, , rx1] = recognitionBox;
    const isolated = rx1 > rx0 && end <= rx0 + height * .65 && !intersects(recognitionBox);
    usedParts.add(top.id);
    usedParts.add(bottom.id);
    sources.push({ page: page.page, box: preview, rasterSha256: page.rasterSha256,
      lineIds: [lead.id, top.id, bottom.id, ...(side ? [side.id] : [])],
      ...(optionLabel && {optionLabel}), ...(isolated && {recognitionBox}) });
  }
  return sources;
}
