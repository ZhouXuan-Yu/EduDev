import {PAPER_OFFICE_SCHEMA,PAPER_RICH_OFFICE_SCHEMA,PAPER_MATH_OFFICE_SCHEMA,PAPER_TABLE_OFFICE_SCHEMA,isRichPaperOfficeSchema,isPaperOfficeSchema,validPaperOfficeSource,validPaperOfficeFigure,type PaperOfficeSource,type PaperOfficeFigure} from './paper-export';
export const OFFICE_DRAFT_SCHEMA = 'xiaozhi.office-draft.v1' as const;
export const OFFICE_DRAFT_MAX_BYTES = 256 * 1024;
export const OFFICE_OUTPUT_MAX_BYTES = 16 * 1024 * 1024;
export type OfficeOutputFormat = 'docx' | 'pdf' | 'xlsx' | 'pptx';
export type OfficeCell = string | number;
export type OfficeTable = { columns: string[]; rows: OfficeCell[][] };
export type OfficeSection = { heading: string; paragraphs: string[]; table?: OfficeTable; figures?:PaperOfficeFigure[] };
export type OfficeDraft = {title:string;sections:OfficeSection[]} & ({schemaVersion:typeof OFFICE_DRAFT_SCHEMA}|{schemaVersion:typeof PAPER_OFFICE_SCHEMA|typeof PAPER_RICH_OFFICE_SCHEMA|typeof PAPER_MATH_OFFICE_SCHEMA|typeof PAPER_TABLE_OFFICE_SCHEMA;paperSource:PaperOfficeSource});
export const isPaperOfficeDraft=(draft:OfficeDraft):draft is Extract<OfficeDraft,{paperSource:PaperOfficeSource}>=>isPaperOfficeSchema(draft.schemaVersion);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key));
const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string'
  && (empty || !!v.trim()) && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff]/u.test(v);
export function validOfficeDraft(value: unknown): value is OfficeDraft {
  if (!object(value)) return false;
  const paper=isPaperOfficeSchema(value.schemaVersion),rich=isRichPaperOfficeSchema(value.schemaVersion);
  if (!keys(value, paper?['schemaVersion','title','sections','paperSource']:['schemaVersion', 'title', 'sections']) || (paper?!validPaperOfficeSource(value.paperSource):value.schemaVersion !== OFFICE_DRAFT_SCHEMA)
    || !text(value.title, 120) || !Array.isArray(value.sections) || !value.sections.length || value.sections.length > (rich?121:20)) return false;
  const imageIds=new Set<string>();let imageCount=0;
  for (const section of value.sections) {
    if (!object(section) || !keys(section, value.schemaVersion===PAPER_TABLE_OFFICE_SCHEMA?['heading','paragraphs','figures','table']:rich?['heading','paragraphs','figures']:['heading', 'paragraphs', 'table']) || !text(section.heading, 120)
      || !Array.isArray(section.paragraphs) || section.paragraphs.length > (rich?128:20) || !Array.from(section.paragraphs).every(p => text(p, 1000))) return false;
    if(section.figures!==undefined){
      if(!rich||!Array.isArray(section.figures)||!section.figures.length||section.figures.length>8||!Array.from(section.figures).every(f=>validPaperOfficeFigure(f,(section.paragraphs as unknown[]).length)))return false;
      let position=-1;for(const f of section.figures as PaperOfficeFigure[]){const id=f.questionId+':'+f.blockId;if(imageIds.has(id)||f.afterParagraph<position||++imageCount>800)return false;imageIds.add(id);position=f.afterParagraph;}
    }
    if (!section.paragraphs.length && !section.table && !section.figures) return false;
    if (section.table !== undefined) {
      const table = section.table;
      if (!object(table) || !keys(table, ['columns', 'rows']) || !Array.isArray(table.columns)
        || !table.columns.length || table.columns.length > 8 || !Array.from(table.columns).every(c => text(c, 120))
        || !Array.isArray(table.rows) || !table.rows.length || table.rows.length > 200
        || !Array.from(table.rows).every(row => Array.isArray(row) && row.length === (table.columns as unknown[]).length
          && Array.from(row).every(cell => text(cell, 120, true) || typeof cell === 'number' && Number.isFinite(cell)))) return false;
    }
  }
  if(value.schemaVersion===PAPER_RICH_OFFICE_SCHEMA&&!imageCount)return false;
  try { return new TextEncoder().encode(JSON.stringify(value)).length <= OFFICE_DRAFT_MAX_BYTES; } catch { return false; }
}
export const officeOutputFormat = (v: unknown): v is OfficeOutputFormat => typeof v === 'string' && ['docx', 'pdf', 'xlsx', 'pptx'].includes(v);
