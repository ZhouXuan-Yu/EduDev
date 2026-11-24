import type { StructureLine } from "../../shared/material-document-structure";
import { validPageBox, type PageBox } from "../../shared/material-page-preview";

type Raster = { width: number; height: number; pixels: Buffer };
const centerY = (box: PageBox) => (box[1] + box[3]) / 2;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

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
  const groups: PageBox[][] = [];
  for (const { box } of [...lines].sort((left, right) => centerY(left.box) - centerY(right.box))) {
    const last = groups.at(-1);
    if (last && centerY(box) - centerY(last[0]) <= textHeight * 0.42) last.push(box);
    else groups.push([box]);
  }
  return groups.map(row => row.sort((left, right) => left[0] - right[0]));
}

/** Infer slots inside an independently detected table from stable text lines and clear gutters. */
export function borderlessTableGrid(region: PageBox, lines: StructureLine[], raster: Raster): PageBox[][] | undefined {
  if (!validPageBox(region) || lines.length < 6 || lines.length > 96 || lines.some(({ box, text, score }) =>
    !text.trim() || score < 0.70 || box[0] < region[0] - 0.008 || box[1] < region[1] - 0.008 ||
    box[2] > region[2] + 0.008 || box[3] > region[3] + 0.008)) return;
  const choices = new Set(lines.flatMap(({ text }) => /^([A-F])[.、．)）]\s*\S/u.exec(text.trim())?.[1] ?? []));
  if (choices.size >= 2) return;
  const textHeight = median(lines.map(({ box }) => box[3] - box[1]));
  if (textHeight <= 0 || lines.some(({ box }) => box[3] - box[1] > textHeight * 1.7)) return;
  const rows = textRows(lines, textHeight);
  const columnCount = rows[0].length;
  if (rows.length < 3 || rows.length > 12 || columnCount < 2 || columnCount > 16 ||
      rows.some(row => row.length !== columnCount)) return;

  const rowSpans = rows.map(row => [Math.min(...row.map(box => box[1])), Math.max(...row.map(box => box[3]))]);
  const rowGaps = rowSpans.slice(1).map(([top, bottom], i) => (top + bottom - rowSpans[i][0] - rowSpans[i][1]) / 2);
  if (Math.max(...rowGaps) > Math.min(...rowGaps) * 2.05 ||
      rowSpans.slice(1).some(([top], i) => top - rowSpans[i][1] < textHeight * 0.22)) return;

  const columns = rows[0].map((_, i) => rows.map(row => row[i]));
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
  return rows.map((row, y) => row.map((_, x): PageBox => [xs[x], ys[y], xs[x + 1], ys[y + 1]]));
}
