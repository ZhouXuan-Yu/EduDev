/** Frozen print template. Omitted version keeps the original document renderer. */
export const PAPER_PRINT_LAYOUT = 'xiaozhi.paper-print.a4.v1' as const;
export const PAPER_A4 = Object.freeze({width:11906,height:16838,margin:1134,header:567,footer:567,
  fontSize:22,line:330,after:120,cellMargin:100});
export const paperContentWidthTwips = PAPER_A4.width - 2 * PAPER_A4.margin;
export const paperContentHeightPx = (PAPER_A4.height - 2 * PAPER_A4.margin) / 15;
/** Formula capture uses the same inner cell width as Word, at twice its CSS resolution. */
export const paperMathCellWidth = (columns:number) => Math.floor((paperContentWidthTwips / columns - 2 * PAPER_A4.cellMargin) / 15) * 2;
export const paperPrintRole = (source:{audience:'student'|'teacher';template?:string}) =>
  source.template === 'answer_sheet' ? '答题卡' : source.audience === 'teacher' ? '教师解析卷' : '学生卷';
export const paperAnswerNumber = (text:string) => /^\d+\.（\d+(?:\.\d+)? 分）$/.test(text);
