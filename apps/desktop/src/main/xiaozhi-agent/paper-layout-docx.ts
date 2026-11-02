import {SectionType, type ISectionOptions, type IStylesOptions} from 'docx';
import {paperLayoutGeometry, PAPER_LAYOUT_FONT_PT} from '../../shared/paper-layout';

/** Host-owned docx nodes only, after existing content/image/source/answer-isolation checks.
 * This helper does not accept renderer Office drafts or grant file authority. */
export function paperLayoutDocxSections(input: unknown, header: ISectionOptions['children'], body: ISectionOptions['children']): ISectionOptions[] {
  const g = paperLayoutGeometry(input);
  // docx 9.8 swaps width/height itself for landscape; pass unswapped physical A4.
  const size = {width: Math.min(g.pageWidth.twip, g.pageHeight.twip), height: Math.max(g.pageWidth.twip, g.pageHeight.twip), orientation: g.layout.orientation};
  const margin = {top: g.margins.top.twip, right: g.margins.right.twip, bottom: g.margins.bottom.twip, left: g.margins.left.twip, header: 0, footer: 0, gutter: 0};
  return [
    {properties: {page: {size: {...size}, margin: {...margin}}, column: {count: 1, space: 0, equalWidth: true}}, children: [...header]},
    {properties: {type: SectionType.CONTINUOUS, page: {size: {...size}, margin: {...margin}}, column: {count: g.layout.columns, space: g.columnGap.twip, equalWidth: true}}, children: [...body]},
  ];
}
/** Same fixed body font as the existing generator. Caller combines with host-owned styles. */
export function paperLayoutDocxStyles(): IStylesOptions {
  return {default: {document: {run: {font: 'SimSun', size: PAPER_LAYOUT_FONT_PT * 2}, paragraph: {spacing: {after: 120}}}}};
}
