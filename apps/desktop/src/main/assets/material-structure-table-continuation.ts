import type { StructurePage, StructureTableSource } from "../../shared/material-document-structure";

const continuationLabel = /^(?:续表|\(续表\)|表(\d{1,3})\(续\))$/u;
const normalizeLabel = (text: string) => text.normalize("NFKC").replace(/\s+/gu, "");

function captionsAbove(page: StructurePage, table: StructureTableSource, pattern: RegExp) {
  return page.lines.flatMap(line => {
    const gap = table.box[1] - line.box[3];
    if (line.score < 0.85 || gap < -0.005 || gap > 0.075 ||
        Math.min(line.box[2], table.box[2]) <= Math.max(line.box[0], table.box[0])) return [];
    const match = pattern.exec(normalizeLabel(line.text));
    return match ? [{ line, number: match[1] }] : [];
  });
}

type TableCell = StructureTableSource["rows"][number][number];

function repeatedReading(cell: TableCell, source: StructureTableSource, page: StructurePage) {
  if (!cell.needsReview) return cell.lineIds.length ? normalizeLabel(cell.text) : "";
  if (cell.suspectedOverprint || cell.lineIds.length !== 1) return "";
  const line = page.lines.find(line => line.id === cell.lineIds[0]);
  if (!line || line.origin || line.score < 0.88 || !line.regionIds.includes(source.regionId)) return "";
  const [x0, y0, x1, y1] = line.box;
  const [left, top, right, bottom] = cell.box;
  if (x0 < left || y0 < top || x1 > right || y1 > bottom) return "";
  return normalizeLabel(line.text);
}

function headersMatch(previous: StructureTableSource, next: StructureTableSource, previousPage: StructurePage, nextPage: StructurePage) {
  const left = previous.rows[0], right = next.rows[0];
  if (previous.rows.length < 2 || next.rows.length < 2 || !left || !right || left.length !== right.length ||
      left.filter(cell => !cell.covered).length < 2) return false;

  // A confirmed heading can corroborate its original reading on the opposite page without changing a reviewed cell.
  return left.every((cell, index) => {
    const other = right[index];
    const aligned = Math.abs(cell.box[0] - other.box[0]) <= 0.018 &&
      Math.abs(cell.box[2] - other.box[2]) <= 0.018;
    if (!aligned || cell.covered !== other.covered) return false;
    if (cell.covered) return true;
    if (cell.needsReview && other.needsReview) return false;
    const label = repeatedReading(cell, previous, previousPage);
    return Boolean(label) && label === repeatedReading(other, next, nextPage) && cell.columnSpan === other.columnSpan &&
      (cell.rowSpan ?? 1) === 1 && (other.rowSpan ?? 1) === 1;
  });
}

/** Only table sources already owned by the same question enter this check. */
export function linkStructureTableContinuations(sources: StructureTableSource[], pages: ReadonlyMap<number, StructurePage>) {
  const candidates = new Map<StructureTableSource, StructureTableSource>();
  const counts = new Map<StructureTableSource, number>();
  for (const next of sources) {
    const page = pages.get(next.page);
    const previousPage = pages.get(next.page - 1);
    if (!page || !previousPage || next.box[1] > 0.55) continue;
    const markers = captionsAbove(page, next, continuationLabel);
    if (markers.length !== 1) continue;
    const [marker] = markers;
    if (page.paragraphs.some(part => (part.marker?.kind === "parent" || part.role === "heading") &&
        part.anchor.box[1] > marker.line.box[1] && part.anchor.box[1] < next.box[1])) continue;

    const matches = sources.filter(previous => {
      if (previous.page !== previousPage.page || !headersMatch(previous, next, previousPage, page)) return false;
      if (!marker.number) return true;
      const captions = captionsAbove(previousPage, previous, /^表(\d{1,3})(?!\d)/u);
      return captions.length === 1 && captions[0].number === marker.number;
    });
    if (matches.length !== 1) continue;
    const [previous] = matches;
    candidates.set(next, previous);
    counts.set(previous, (counts.get(previous) ?? 0) + 1);
  }
  return sources.map(source => {
    const previous = candidates.get(source);
    if (!previous || counts.get(previous) !== 1) return source;
    return { ...source, continuesFrom: { page: previous.page, regionId: previous.regionId } };
  });
}
