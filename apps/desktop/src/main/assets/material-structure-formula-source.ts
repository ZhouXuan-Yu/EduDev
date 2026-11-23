import type { StructureFormulaSource, StructureLine, StructurePage, StructureParagraph } from "../../shared/material-document-structure";

const equationLead = /\p{Script=Han}[^=＝≡]{0,16}[\p{Script=Latin}\p{Script=Greek}][\da-z_]{0,5}\s*[=＝≡]\s*$/u;
const formulaGlyphs = /^[\p{Script=Latin}\p{Script=Greek}\p{N}+−\-*/×÷^().,[\]{}_\s]{1,32}$/u;
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
  const laneByLine = new Map(paragraphs.filter(part => ["body", "question", "subquestion", "formula"].includes(part.role))
    .flatMap(part => part.lineIds.map(id => [id, part.column] as const)));
  const lines = page.lines.filter(line => (laneByLine.get(line.id) ?? -1) >= 0 && !line.origin);
  const textRegions = new Map(page.regions.filter(region => region.kind === "text" && region.score >= 0.5)
    .map(region => [region.id, region]));
  const sources: StructureFormulaSource[] = [];
  const usedParts = new Set<string>();
  for (const lead of lines) {
    if (sources.length >= 8) break;
    if (!equationLead.test(lead.text)) continue;
    const [,, end] = lead.box;
    const height = lead.box[3] - lead.box[1];
    if (height < 0.006 || height > 0.045) continue;
    const lane = page.columns[laneByLine.get(lead.id)!];
    const region = lead.regionIds.map(id => textRegions.get(id)).find(r => r && r.box[2] >= end + height);
    if (!lane || !region) continue;
    const nearby = lines.filter(line => line !== lead && laneByLine.get(line.id) === laneByLine.get(lead.id) &&
      line.regionIds.includes(region.id) && isFormulaGlyphs(line.text));
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
    usedParts.add(top.id);
    usedParts.add(bottom.id);
    sources.push({ page: page.page, box: [left, y0, right, y1], rasterSha256: page.rasterSha256,
      lineIds: [lead.id, top.id, bottom.id, ...(side ? [side.id] : [])] });
  }
  return sources;
}
