import type { StructureLine, StructureTableSource } from "../../shared/material-document-structure";
import { validPageBox, type PageBox } from "../../shared/material-page-preview";
import type { LocalOcrReceipt } from "../../shared/xiaozhi-ocr";

type Raster = { width: number; height: number; pixels: Buffer };
const centerY = (box: PageBox) => (box[1] + box[3]) / 2;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const normalize = (text: string) => text.normalize("NFKC").replace(/\u2212/gu, "-").replace(/\s+/gu, "");
const numericCell = (text: string) => /^[+-]?\d+(?:\.\d+)?%?$/u.test(normalize(text));
export type NumericTableSplit = { line: StructureLine; row: number; leftColumn: number; crops: [PageBox, PageBox] };

function hasVerticalRules(raster: Raster, region: PageBox, textHeight: number) {
  const { width, height, pixels } = raster;
  const [left, top, right, bottom] = region.map((coordinate, index) =>
    Math.round(coordinate * (index % 2 === 0 ? width : height)));
  const maxArea = 1_200_000;
  if (pixels.length !== width * height * 4 || (right - left) * (bottom - top) > maxArea) return true;

  // Rules interrupted by scanning defects may still leave runs that are taller than a text box.
  const minRun = Math.max(14, Math.ceil(textHeight * height * 1.42));
  const runs = new Uint16Array(right - left);
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const offset = (y * width + x) * 4;
      const neutralDark = pixels[offset + 3] >= 200 && Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 155;
      const run = neutralDark ? runs[x - left] + 1 : 0;
      if (run >= minRun) return true;
      runs[x - left] = run;
    }
  }
  return false;
}

function textRows(lines: StructureLine[], textHeight: number) {
  const groups: StructureLine[][] = [];
  for (const line of [...lines].sort((left, right) => centerY(left.box) - centerY(right.box))) {
    const last = groups.at(-1);
    if (last && centerY(line.box) - centerY(last[0].box) <= textHeight * 0.42) last.push(line);
    else groups.push([line]);
  }
  return groups.map(row => row.sort((left, right) => left.box[0] - right.box[0]));
}

function clearColumnGap(raster: Raster, box: PageBox, left: number, right: number) {
  const top = Math.ceil(box[1] * raster.height), bottom = Math.floor(box[3] * raster.height);
  const minimum = Math.max(4, Math.round((bottom - top) * .085));
  const gaps: number[] = [];
  let start: number | undefined;
  const first = Math.ceil(left * raster.width), last = Math.floor(right * raster.width);
  for (let x = first; x <= last; x++) {
    let clear = x < last;
    for (let y = top; clear && y < bottom; y++) {
      const at = (y * raster.width + x) * 4;
      clear = raster.pixels[at + 3] < 200 || Math.min(raster.pixels[at], raster.pixels[at + 1], raster.pixels[at + 2]) >= 175;
    }
    if (clear) start ??= x;
    else if (start !== undefined) {
      // The gap must have ink on both sides inside the inferred gutter.
      if (start > first && x < last && x - start >= minimum) gaps.push((start + x) / (2 * raster.width));
      start = undefined;
    }
  }
  return gaps.length === 1 ? gaps[0] : undefined;
}

function numericSplit(rows: StructureLine[][], row: number, columnCount: number, xs: number[],
  spans: number[][], grid: PageBox[][], raster: Raster): NumericTableSplit | undefined {
  const affected = rows[row].map(line => {
    const columns = xs.slice(1).flatMap((right, i) =>
      Math.min(line.box[2], right) - Math.max(line.box[0], xs[i]) > .003 ? [i] : []);
    return { line, columns };
  });
  const candidates = affected.filter(item => item.columns.length === 2);
  if (candidates.length !== 1 || affected.flatMap(item => item.columns).join(",") !==
      Array.from({ length: columnCount }, (_, i) => i).join(",")) return;
  const { line, columns: [leftColumn, rightColumn] } = candidates[0];
  const body = rows.filter((_, i) => i !== 0 && i !== row);
  if (line.score < .92 || !/^[+\-\d.%]+$/u.test(normalize(line.text)) ||
      body.some(parts => [leftColumn, rightColumn].some(column => parts[column].score < .92 || !numericCell(parts[column].text)))) return;

  const split = clearColumnGap(raster, line.box, spans[leftColumn][1], spans[rightColumn][0]);
  if (split === undefined) return;
  const [x0, y0, x1, y1] = line.box;
  const yPad = (y1 - y0) * .18;
  const [left, top] = grid[row][leftColumn];
  const [, , right, bottom] = grid[row][rightColumn];
  const cutTop = Math.max(top, y0 - yPad), cutBottom = Math.min(bottom, y1 + yPad);
  const crops: [PageBox, PageBox] = [
    [Math.max(left, x0 - .004), cutTop, split, cutBottom],
    [split, cutTop, Math.min(right, x1 + .004), cutBottom],
  ];
  return crops.every(validPageBox) ? { line, row, leftColumn, crops } : undefined;
}

export function verifiedNumericTableRow(plan: NumericTableSplit, readings: {
  receipt: Extract<LocalOcrReceipt, { ok: true }>; cropSha256: string;
}[]): StructureTableSource["numericRecheck"] {
  if (readings.length !== plan.crops.length || readings.some(({ receipt }) =>
    receipt.lines !== 1 || receipt.scores[0] < .92 || !numericCell(receipt.text))) return;
  const parts = readings.map(({ receipt, cropSha256 }, index) => ({
    text: receipt.text.trim(), score: receipt.scores[0], cropSha256, box: plan.crops[index],
  }));
  if (normalize(parts.map(part => part.text).join("")) !== normalize(plan.line.text)) return;
  return { lineId: plan.line.id, engine: readings[0].receipt.engine, parts };
}

/** Infer slots inside an independently detected table from stable text lines and clear gutters. */
export function planBorderlessTable(region: PageBox, lines: StructureLine[], raster: Raster): { grid: PageBox[][]; split?: NumericTableSplit } | undefined {
  if (!validPageBox(region) || lines.length < 6 || lines.length > 96 || lines.some(({ box, text, score }) =>
    !text.trim() || score < 0.70 || box[0] < region[0] - 0.008 || box[1] < region[1] - 0.008 ||
    box[2] > region[2] + 0.008 || box[3] > region[3] + 0.008)) return;
  const choices = new Set(lines.flatMap(({ text }) => /^([A-F])[.、．)）]\s*\S/u.exec(text.trim())?.[1] ?? []));
  if (choices.size >= 2) return;
  const textHeight = median(lines.map(({ box }) => box[3] - box[1]));
  if (textHeight <= 0 || lines.some(({ box }) => box[3] - box[1] > textHeight * 1.7)) return;
  const text = textRows(lines, textHeight);
  const rows = text.map(row => row.map(line => line.box));
  const columnCount = rows[0].length;
  const incomplete = rows.flatMap((row, i) => row.length === columnCount ? [] : [i]);
  const incompleteRow = incomplete[0];
  if (rows.length < 3 || rows.length > 12 || columnCount < 2 || columnCount > 16 ||
      incomplete.length > 1 || (incomplete.length === 1 && (rows.length < 4 || rows[incompleteRow].length !== columnCount - 1))) return;

  const rowSpans = rows.map(row => [Math.min(...row.map(box => box[1])), Math.max(...row.map(box => box[3]))]);
  const rowGaps = rowSpans.slice(1).map(([top, bottom], i) => (top + bottom - rowSpans[i][0] - rowSpans[i][1]) / 2);
  if (Math.max(...rowGaps) > Math.min(...rowGaps) * 2.05 ||
      rowSpans.slice(1).some(([top], i) => top - rowSpans[i][1] < textHeight * 0.22)) return;

  const fullRows = rows.filter((_, i) => i !== incompleteRow);
  const columns = rows[0].map((_, i) => fullRows.map(row => row[i]));
  const spans = columns.map(column => [Math.min(...column.map(box => box[0])), Math.max(...column.map(box => box[2]))]);
  const width = region[2] - region[0];
  if (spans.slice(1).some(([left], i) => left - spans[i][1] < Math.max(0.008, width * 0.025))) return;
  for (const column of columns) {
    const anchors = [column.map(box => box[0]), column.map(box => (box[0] + box[2]) / 2), column.map(box => box[2])];
    const aligned = anchors.some(positions => {
      return Math.max(...positions) - Math.min(...positions) <= Math.min(0.025, width * 0.04);
    });
    if (!aligned) return;
  }
  if (hasVerticalRules(raster, region, textHeight)) return;

  const xs = [Math.min(region[0], spans[0][0]), ...spans.slice(1).map(([left], i) => (left + spans[i][1]) / 2),
    Math.max(region[2], spans.at(-1)![1])];
  const ys = [Math.min(region[1], rowSpans[0][0]), ...rowSpans.slice(1).map(([top], i) => (top + rowSpans[i][1]) / 2),
    Math.max(region[3], rowSpans.at(-1)![1])];
  const grid = rows.map((_, y) => columns.map((_, x): PageBox => [xs[x], ys[y], xs[x + 1], ys[y + 1]]));
  if (incompleteRow === undefined) return { grid };
  const split = numericSplit(text, incompleteRow, columnCount, xs, spans, grid, raster);
  return split ? { grid, split } : undefined;
}
