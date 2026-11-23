import { validPageBox, type PageBox } from "./material-page-preview";
import { validStructureReference, type StructureTableSource, type DocumentStructureReference } from "./material-document-structure";

export const TABLE_VISION_SCHEMA = "xiaozhi.material-table-vision.v2" as const;
export type TableVisionCell = {
  reference: DocumentStructureReference;
  page: number;
  regionId: string;
  row: number;
  column: number;
};
export type TableVisionQuery = TableVisionCell & { action: "read" | "run" | "cancel" };
export type TableVisionReading = {
  state: "read" | "partial" | "unreadable" | "conflict";
  text: string | null;
  columnLabel: string | null;
  unit: string | null;
};
export type TableVisionCandidate = TableVisionReading & {
  schemaVersion: typeof TABLE_VISION_SCHEMA;
  model: "deepseek-flash";
  targetSha256: string;
  contextSha256: string;
};
export type TableVisionResult =
  | { status: "candidate"; candidate: TableVisionCandidate }
  | { status: "empty" | "cancelled" };

export function validTableVisionQuery(value: unknown): value is TableVisionQuery {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const q = value as TableVisionQuery;
  return Object.keys(q).length === 6 && validStructureReference(q.reference) &&
    typeof q.regionId === "string" && /^[a-z0-9_:-]{1,128}$/i.test(q.regionId) &&
    Number.isSafeInteger(q.page) && q.page >= 1 && q.page <= 10000 &&
    Number.isSafeInteger(q.row) && q.row >= 0 && q.row < 12 &&
    Number.isSafeInteger(q.column) && q.column >= 0 && q.column < 16 &&
    (q.action === "read" || q.action === "run" || q.action === "cancel");
}

/** Include the first row and the selected row. Bounded tall tables use a local window. */
export function tableVisionPlan(table: StructureTableSource, row: number, column: number) {
  const cell = table.rows[row]?.[column];
  if (!cell?.needsReview || !validPageBox(cell.box)) throw Error("source_incomplete");
  const firstRow = table.rows[row <= 3 ? 0 : row - 1];
  const lowerRow = table.rows[row === 0 ? 1 : row] ?? table.rows[row];
  const firstColumn = Math.max(0, column - 1);
  const lastColumn = Math.min(table.rows[row].length - 1, column + 1);
  const top = firstRow[firstColumn]?.box;
  const bottom = lowerRow[lastColumn]?.box;
  if (!validPageBox(top) || !validPageBox(bottom)) throw Error("source_incomplete");
  const context: PageBox = [top[0], top[1], bottom[2], bottom[3]];
  if (!validPageBox(context) || context[0] > cell.box[0] || context[1] > cell.box[1] ||
      context[2] < cell.box[2] || context[3] < cell.box[3]) throw Error("source_incomplete");
  const header = row > 3 ? table.rows[0]?.[column]?.box : undefined;
  if (row > 3 && !validPageBox(header)) throw Error("source_incomplete");
  const suspectedOverprint = cell.suspectedOverprint === true;
  const rowLabel = firstColumn > 0 ? table.rows[row]?.[0]?.box : undefined;
  if (firstColumn > 0 && !validPageBox(rowLabel)) throw Error("source_incomplete");
  return { target: cell.box, context, header, rowLabel, suspectedOverprint, relativeRow: row - (row <= 3 ? 0 : row - 1), relativeColumn: column - firstColumn };
}

/** An optional contrast view. Never replace the original pixels or use the transformation on clean cells. */
export function neutralizePaleOverprint(pixels: Uint8Array | Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const high = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    const low = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    const gray = high >= 165 && high - low >= 14 ? 255 : Math.max(0, Math.min(255, (high - 155) * 3));
    pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
  }
}

/** Focus on neutral strokes inside the cell, ignoring its enclosing rules. */
export function overprintFocus(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number) {
  const marginX = Math.max(4, Math.round(width * .025)), marginY = Math.max(4, Math.round(height * .06));
  const rows = new Uint32Array(height), columns = new Uint32Array(width);
  for (let y = marginY; y < height - marginY; y++) for (let x = marginX; x < width - marginX; x++) {
    if (pixels[(y * width + x) * 4] <= 133) {
      rows[y]++;
      columns[x]++;
    }
  }
  const x1 = columns.findIndex(count => count >= 3), y1 = rows.findIndex(count => count >= 3);
  const x2 = columns.findLastIndex(count => count >= 3), y2 = rows.findLastIndex(count => count >= 3);
  if (x1 < 0 || y1 < 0 || x2 - x1 < 3 || y2 - y1 < 3) return { x: 0, y: 0, width, height };
  const x = Math.max(0, x1 - 12), y = Math.max(0, y1 - 12);
  return { x, y, width: Math.min(width, x2 + 13) - x, height: Math.min(height, y2 + 13) - y };
}
