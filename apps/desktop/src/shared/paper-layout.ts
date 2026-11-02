/** Opt-in layout only. Missing layout must stay on the legacy export/digest branch. */
export const PAPER_LAYOUT_SCHEMA = 'xiaozhi.paper-layout.v1' as const;
export const PAPER_LAYOUT_FONT_PT = 11;
export const PAPER_LAYOUT_LIMITS = Object.freeze({margin: 1000, columnGap: 300, minColumnWidth: 400, minBodyHeight: 500});
export type PaperLayout = {
  schemaVersion: typeof PAPER_LAYOUT_SCHEMA;
  paper: 'A4'; orientation: 'portrait' | 'landscape'; columns: 1 | 2;
  /** All lengths in integer tenths of a millimetre. No defaults/coercion/extensions. */
  margins: {top: number; right: number; bottom: number; left: number}; columnGap: number;
};
const sides = ['top', 'right', 'bottom', 'left'] as const;
const keys = ['schemaVersion', 'paper', 'orientation', 'columns', 'margins', 'columnGap'];
/** Reject accessors (without invoking them), symbols, hidden keys and custom prototypes. */
function record(v: unknown, allowed: readonly string[]): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(v);
  return Reflect.ownKeys(v).length === allowed.length && allowed.every(key => {
    const d = descriptors[key]; return !!d && d.enumerable && 'value' in d;
  });
}
const integer = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max && !Object.is(v, -0);
export function validPaperLayout(v: unknown): v is PaperLayout {
  try {
    if (!record(v, keys) || v.schemaVersion !== PAPER_LAYOUT_SCHEMA || v.paper !== 'A4'
      || !['portrait', 'landscape'].includes(v.orientation as string) || (v.columns !== 1 && v.columns !== 2)
      || !record(v.margins, sides) || !sides.every(s => integer((v.margins as Record<string, unknown>)[s], PAPER_LAYOUT_LIMITS.margin))
      || !integer(v.columnGap, PAPER_LAYOUT_LIMITS.columnGap)) return false;
    const m = v.margins as PaperLayout['margins'];
    const width = v.orientation === 'portrait' ? 2100 : 2970, height = v.orientation === 'portrait' ? 2970 : 2100;
    return (width - m.left - m.right - (v.columns - 1) * v.columnGap) / v.columns >= PAPER_LAYOUT_LIMITS.minColumnWidth
      && height - m.top - m.bottom >= PAPER_LAYOUT_LIMITS.minBodyHeight;
  } catch { return false; }
}
/** Fresh frozen canonical plain snapshot; no JSON stringify or caller-owned object retained. */
export function parsePaperLayout(v: unknown): PaperLayout {
  if (!validPaperLayout(v)) throw Error('invalid_paper_layout');
  return Object.freeze({schemaVersion: PAPER_LAYOUT_SCHEMA, paper: 'A4', orientation: v.orientation, columns: v.columns,
    margins: Object.freeze({top: v.margins.top, right: v.margins.right, bottom: v.margins.bottom, left: v.margins.left}), columnGap: v.columnGap});
}
export type PaperLayoutMeasure = {mm: number; twip: number; px: number};
const measure = (mm: number): PaperLayoutMeasure => ({mm, twip: Math.round(mm * 1440 / 25.4), px: mm * 96 / 25.4});
/** 96dpi CSS/Word image pixels, 1440twip/in. Conservative width survives Word rounding. */
export function paperLayoutGeometry(input: unknown) {
  const layout = parsePaperLayout(input);
  const pageWidth = measure(layout.orientation === 'portrait' ? 210 : 297);
  const pageHeight = measure(layout.orientation === 'portrait' ? 297 : 210);
  const margins = {top: measure(layout.margins.top / 10), right: measure(layout.margins.right / 10),
    bottom: measure(layout.margins.bottom / 10), left: measure(layout.margins.left / 10)};
  const columnGap = measure(layout.columnGap / 10);
  const contentWidth = measure(pageWidth.mm - margins.left.mm - margins.right.mm);
  const contentHeight = measure(pageHeight.mm - margins.top.mm - margins.bottom.mm);
  const columnWidth = measure((contentWidth.mm - (layout.columns - 1) * columnGap.mm) / layout.columns);
  // Never let a rounded image/table width exceed the actual serialized section width.
  columnWidth.twip = Math.floor((pageWidth.twip - margins.left.twip - margins.right.twip - (layout.columns - 1) * columnGap.twip) / layout.columns);
  const safeColumnPx = Math.min(columnWidth.px, columnWidth.twip * 96 / 1440);
  return {layout, fontPt: PAPER_LAYOUT_FONT_PT, pageWidth, pageHeight, margins, columnGap, contentWidth, contentHeight, columnWidth, safeColumnPx};
}
function dimensions(width: number, height: number) {
  if (![width, height].every(v => Number.isFinite(v) && v > 0 && v <= 100000)) throw Error('invalid_paper_layout_block');
}
/** Atomic image: shrink to column width, never crop or shrink merely to conceal excess height.
 * availableHeightPx must subtract measured header/spacing where relevant in the future host. */
export function paperLayoutImageSize(input: unknown, width: number, height: number, availableHeightPx?: number) {
  const g = paperLayoutGeometry(input); dimensions(width, height);
  const limit = availableHeightPx ?? Math.min(g.contentHeight.px, (g.pageHeight.twip - g.margins.top.twip - g.margins.bottom.twip) / 15);
  if (!Number.isFinite(limit) || limit <= 0 || limit > g.contentHeight.px) throw Error('invalid_paper_layout_block');
  const scale = Math.min(1, g.safeColumnPx / width), result = {width: width * scale, height: height * scale};
  if (result.height > limit) throw Error('paper_layout_block_too_large');
  return result;
}
/** Math is measured at the fixed 11pt by the host; never silently reduce its font. */
export function paperLayoutMathSize(input: unknown, width: number, height: number, availableHeightPx?: number) {
  const size = paperLayoutImageSize(input, width, height, availableHeightPx);
  if (size.width !== width) throw Error('paper_layout_block_too_large');
  return size;
}
/** Equal cells with explicit inner width for math/images; widths sum to <= actual column. */
export function paperLayoutTableWidths(input: unknown, columns: number) {
  const g = paperLayoutGeometry(input), paddingTwip = 120;
  if (!Number.isSafeInteger(columns) || columns < 1 || columns > 12) throw Error('invalid_paper_layout_block');
  const cellTwip = Math.floor(g.columnWidth.twip / columns), innerTwip = cellTwip - 2 * paddingTwip - 20;
  if (innerTwip < 440) throw Error('paper_layout_block_too_large');
  return {widthTwip: cellTwip * columns, cellTwip, innerPx: innerTwip / 15, paddingTwip};
}
