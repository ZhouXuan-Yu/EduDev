import type { PrintedStructureRecovery, StructurePage, StructureParagraph } from "../../shared/material-document-structure";
import type { PageBox } from "../../shared/material-page-preview";
import type { LocalOcrReceipt } from "../../shared/xiaozhi-ocr";

type ParentProbe = { number: number; crop: PageBox };
type Blank = PrintedStructureRecovery["blanks"][number];
type Raster = { width: number; height: number; pixels: Buffer };

function options(parts: StructureParagraph[], column: number) {
  return parts.length === 4 && parts.every((part, i) => part.column === column &&
    part.marker?.kind === "option" && part.marker.label === "ABCD"[i]);
}

/** A complete second choice group in a distinct text block can warrant one local retry. */
export function printedParentProbes(page: StructurePage): ParentProbe[] {
  if (page.issues.length) return [];
  const paragraphs = page.paragraphs.filter(p => !["header", "footer", "figure", "note"].includes(p.role));
  const lines = new Map(page.lines.map(line => [line.id, line]));
  const regions = new Map(page.regions.map(region => [region.id, region]));
  const probes: ParentProbe[] = [];
  for (let i = 4; i + 4 < paragraphs.length && probes.length < 3; i++) {
    const body = paragraphs[i];
    if (body.role !== "body" || body.column < 0 || !options(paragraphs.slice(i - 4, i), body.column) ||
        !options(paragraphs.slice(i + 1, i + 5), body.column)) continue;
    const before = paragraphs.slice(0, i).findLast(p => p.column === body.column && p.marker?.kind === "parent");
    const after = paragraphs.slice(i + 5).find(p => p.column === body.column && p.marker?.kind === "parent");
    if (!before || !after) continue;
    const number = Number(before.marker!.label) + 1;
    if (Number(after.marker!.label) !== number + 1 ||
        paragraphs.some(p => p.marker?.kind === "parent" && Number(p.marker.label) === number)) continue;
    const firstLine = lines.get(body.lineIds[0])!;
    const height = firstLine.box[3] - firstLine.box[1];
    const region = body.regionIds.map(id => regions.get(id)).find(block => block?.kind === "text" &&
      paragraphs.slice(i + 1, i + 5).every(p => p.regionIds.includes(block.id)) &&
      paragraphs.slice(i - 4, i).every(p => !p.regionIds.includes(block.id)));
    if (!region || region.score < 0.75) continue;
    const gap = firstLine.box[1] - region.box[1];
    if (gap < height * 0.65 || gap > height * 2.2) continue;
    const column = page.columns[body.column];
    const top = Math.max(paragraphs[i - 1].anchor.box[3], region.box[1] - height * 0.3);
    const bottom = firstLine.box[1] - height * 0.05;
    const left = Math.max(column[0], region.box[0] - height * 0.45);
    const right = Math.min(column[2], region.box[2], ...page.regions.filter(block =>
      ["image", "chart", "table"].includes(block.kind) && block.box[0] > firstLine.box[0] &&
      block.box[1] < bottom && block.box[3] > top).map(block => block.box[0]));
    if (bottom - top >= height * 0.65 && right - left > 0.08) probes.push({ number, crop: [left, top, right, bottom] });
  }
  return probes.filter(probe => probes.filter(other => other.number === probe.number).length === 1);
}

type Recognized = Extract<LocalOcrReceipt, { ok: true }>;
export function readPrintedParent(receipt: Recognized, number: number) {
  const readings = receipt.text.split(/\r?\n/u).map(text => text.trim()).filter(Boolean);
  const match = /^(\d{1,5})[.．、](?!\d)\s*(.*)$/u.exec(readings[0] ?? "");
  if (!match || Number(match[1]) !== number || readings.length !== receipt.scores.length ||
      receipt.scores[0] < 0.9 || readings.length > 8) return;
  const textRuns = readings.slice(1).map((text, i) => ({ text, score: receipt.scores[i + 1] }))
    .filter(run => run.text.length >= 10);
  if (match[2] && textRuns.length || !match[2] && textRuns.length !== 1) return;
  const body = match[2] ? { text: match[2], score: receipt.scores[0] } : textRuns[0];
  if (body.score < 0.9 || body.text.length < 4 || body.text.length > 160) return;
  return {
    text: match[1] + ". " + body.text,
    score: Math.min(body.score, receipt.scores[0]),
    readings,
    ...(readings.length > (match[2] ? 1 : 2) && { uncertain: true as const }),
  };
}

/** A fill slot must have a thin printed rule spanning the gap on an otherwise light background. */
export function printedBlankStripe(raster: Raster, box: PageBox): PageBox | undefined {
  const { width, height, pixels } = raster;
  const left = Math.ceil(box[0] * width), right = Math.floor(box[2] * width);
  const top = Math.ceil(box[1] * height), bottom = Math.floor(box[3] * height);
  if (right - left < 16 || bottom - top < 5) return;
  const rows: number[] = [];
  let whiteRows = 0, noisyRows = 0;
  for (let y = top; y < bottom; y++) {
    let ink = 0, light = 0;
    for (let x = left; x < right; x++) {
      const at = (y * width + x) * 4;
      const luma = (pixels[at] + pixels[at + 1] + pixels[at + 2]) / 3;
      if (luma <= 205) ink++;
      if (luma >= 225) light++;
    }
    const length = right - left;
    if (ink >= length * 0.8) rows.push(y);
    else if (light >= length * 0.85) whiteRows++;
    else noisyRows++;
  }
  if (!rows.length || rows.length > Math.max(3, (bottom - top) * 0.22) ||
      rows.at(-1)! - rows[0] + 1 !== rows.length || noisyRows > 2 || whiteRows < (bottom - top) * 0.52) return;
  return [box[0], rows[0] / height, box[2], (rows.at(-1)! + 1) / height];
}

export function printedBlanks(page: StructurePage, readStripe: (box: PageBox) => PageBox | undefined): Blank[] {
  if (page.issues.length) return [];
  const lines = new Map(page.lines.map(line => [line.id, line]));
  const blanks: Blank[] = [];
  let fill = false, numbered = false;
  for (const paragraph of page.paragraphs) {
    if (paragraph.role === "heading") {
      fill = /填空题|填空练习/u.test(paragraph.text);
      numbered = false;
    } else if (paragraph.role === "question") numbered = true;
    if (!fill || !numbered || !["question", "body"].includes(paragraph.role) || blanks.length >= 32) continue;
    for (let i = 1; i < paragraph.lineIds.length && blanks.length < 32; i++) {
      const a = lines.get(paragraph.lineIds[i - 1])!, b = lines.get(paragraph.lineIds[i])!;
      const height = Math.min(a.box[3] - a.box[1], b.box[3] - b.box[1]);
      const gap = b.box[0] - a.box[2];
      if (Math.abs(a.box[3] - b.box[3]) > height * 0.3 || gap < height * 0.75 || gap > height * 4 ||
          /[_＿]$/u.test(a.text.trim()) || /^[_＿]/u.test(b.text.trim()) ||
          /[0-9０-９]$/u.test(a.text.trim()) && /^[0-9０-９]/u.test(b.text.trim()) ||
          !a.regionIds.some(id => b.regionIds.includes(id))) continue;
      const bottom = (a.box[3] + b.box[3]) / 2;
      const box = readStripe([a.box[2] + gap * 0.04, bottom - height * 0.2, b.box[0] - gap * 0.04, Math.min(1, bottom + height * 0.22)]);
      if (box) blanks.push({ beforeId: a.id, afterId: b.id, box });
    }
  }
  return blanks;
}
