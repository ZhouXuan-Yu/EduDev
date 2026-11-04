import {CLASSROOM_OFFICE_SCHEMA,CLASSROOM_DOCUMENT_OFFICE_SCHEMA,isClassroomOfficeSchema,validClassroomOfficeSource,type ClassroomOfficeSource} from './classroom-export';
import {PAPER_OFFICE_SCHEMA,PAPER_RICH_OFFICE_SCHEMA,PAPER_MATH_OFFICE_SCHEMA,PAPER_TABLE_OFFICE_SCHEMA,PAPER_ANSWER_SHEET_OFFICE_SCHEMA,isRichPaperOfficeSchema,isPaperOfficeSchema,validPaperOfficeSource,validPaperOfficeFigure,type PaperOfficeSource,type PaperOfficeFigure} from './paper-export';
import {PAPER_PRINT_LAYOUT} from './paper-print-layout';
import {TEACHING_LESSON_OFFICE_SCHEMA,validTeachingLessonOfficeSource,type TeachingLessonOfficeSource} from './teaching-lesson-export';
export const OFFICE_DRAFT_SCHEMA = 'xiaozhi.office-draft.v1' as const;
export const PRESENTATION_DRAFT_SCHEMA = 'xiaozhi.presentation-draft.v1' as const;
export const MATH_OFFICE_DRAFT_SCHEMA = 'xiaozhi.office-draft.v2' as const;
export const MATH_PRESENTATION_DRAFT_SCHEMA = 'xiaozhi.presentation-draft.v2' as const;
export const isPresentationSchema=(schema:unknown)=>schema===PRESENTATION_DRAFT_SCHEMA||schema===MATH_PRESENTATION_DRAFT_SCHEMA;
export const isOrdinaryOfficeSchema=(schema:unknown)=>schema===OFFICE_DRAFT_SCHEMA||schema===MATH_OFFICE_DRAFT_SCHEMA||isPresentationSchema(schema);
export const isMathOfficeSchema=(schema:unknown)=>schema===MATH_OFFICE_DRAFT_SCHEMA||schema===MATH_PRESENTATION_DRAFT_SCHEMA;
export const validOfficeDraftFormat=(schema:unknown,format:unknown)=>isPresentationSchema(schema)?format==='pptx':schema===MATH_OFFICE_DRAFT_SCHEMA||schema===TEACHING_LESSON_OFFICE_SCHEMA?format==='docx'||format==='pdf':true;
export const OFFICE_DRAFT_MAX_BYTES = 256 * 1024;
export const OFFICE_OUTPUT_MAX_BYTES = 16 * 1024 * 1024;
export type OfficeOutputFormat = 'docx' | 'pdf' | 'xlsx' | 'pptx';
export type OfficeCell = string | number;
export type OfficeTable = { columns: string[]; rows: OfficeCell[][] };
export type PresentationNote={kind:'script'|'answer';text:string};
export type OfficeSection = { heading: string; paragraphs: string[]; table?: OfficeTable; figures?:PaperOfficeFigure[];pageId?:string;speakerNotes?:PresentationNote[];printKind?:'heading'|'answer_area' };
export type PresentationSection=OfficeSection&{pageId:string;speakerNotes:PresentationNote[]};
export type PresentationDraft={schemaVersion:typeof PRESENTATION_DRAFT_SCHEMA|typeof MATH_PRESENTATION_DRAFT_SCHEMA;title:string;sections:PresentationSection[]};
export type OfficeDraft = PresentationDraft | ({title:string;sections:OfficeSection[]} & ({schemaVersion:typeof OFFICE_DRAFT_SCHEMA|typeof MATH_OFFICE_DRAFT_SCHEMA}|{schemaVersion:typeof TEACHING_LESSON_OFFICE_SCHEMA;lessonSource:TeachingLessonOfficeSource}|{schemaVersion:typeof CLASSROOM_OFFICE_SCHEMA|typeof CLASSROOM_DOCUMENT_OFFICE_SCHEMA;classroomSource:ClassroomOfficeSource}|{schemaVersion:typeof PAPER_OFFICE_SCHEMA|typeof PAPER_RICH_OFFICE_SCHEMA|typeof PAPER_MATH_OFFICE_SCHEMA|typeof PAPER_TABLE_OFFICE_SCHEMA|typeof PAPER_ANSWER_SHEET_OFFICE_SCHEMA;paperSource:PaperOfficeSource}));
export const isPresentationDraft=(draft:OfficeDraft):draft is PresentationDraft=>isPresentationSchema(draft.schemaVersion);
export const isPaperOfficeDraft=(draft:OfficeDraft):draft is Extract<OfficeDraft,{paperSource:PaperOfficeSource}>=>isPaperOfficeSchema(draft.schemaVersion);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key));
const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string'
  && (empty || !!v.trim()) && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff]/u.test(v);
export function validOfficeDraft(value: unknown): value is OfficeDraft {
  if (!object(value)) return false;
  const presentation=isPresentationSchema(value.schemaVersion);
  const lesson=value.schemaVersion===TEACHING_LESSON_OFFICE_SCHEMA;
  if(lesson&&!validTeachingLessonOfficeSource(value.lessonSource))return false;
  const paper=isPaperOfficeSchema(value.schemaVersion),rich=isRichPaperOfficeSchema(value.schemaVersion),classroom=isClassroomOfficeSchema(value.schemaVersion);
  if(classroom&&(!validClassroomOfficeSource(value.classroomSource)||(value.schemaVersion===CLASSROOM_DOCUMENT_OFFICE_SCHEMA?!value.classroomSource.purpose:value.classroomSource.purpose!==undefined)))return false;
  const paperTemplate=paper?(value.paperSource as PaperOfficeSource|undefined)?.template??'paper':undefined;
  const printed=paper&&(value.paperSource as PaperOfficeSource|undefined)?.printLayout===PAPER_PRINT_LAYOUT;
  if(paper&&(value.schemaVersion===PAPER_ANSWER_SHEET_OFFICE_SCHEMA)!==(paperTemplate==='answer_sheet'))return false;
  if (!keys(value, lesson?['schemaVersion','title','sections','lessonSource']:classroom?['schemaVersion','title','sections','classroomSource']:paper?['schemaVersion','title','sections','paperSource']:['schemaVersion', 'title', 'sections']) || (lesson?!validTeachingLessonOfficeSource(value.lessonSource):classroom?!validClassroomOfficeSource(value.classroomSource):paper?!validPaperOfficeSource(value.paperSource):!isOrdinaryOfficeSchema(value.schemaVersion))
    || !text(value.title, 120) || !Array.isArray(value.sections) || !value.sections.length || value.sections.length > (rich?121:20)) return false;
  const imageIds=new Set<string>(),pageIds=new Set<string>();let imageCount=0;
  for (const section of value.sections) {
    if (!object(section) || !keys(section, [...(presentation?['heading','paragraphs','table','pageId','speakerNotes']:value.schemaVersion===PAPER_TABLE_OFFICE_SCHEMA?['heading','paragraphs','figures','table']:rich?['heading','paragraphs','figures']:['heading', 'paragraphs', 'table']),...(printed?['printKind']:[])]) || !text(section.heading, 120)
      || !Array.isArray(section.paragraphs) || section.paragraphs.length > (classroom||lesson?200:rich?128:20) || !Array.from(section.paragraphs).every(p => text(p, 1000))) return false;
    if(presentation){
      if(typeof section.pageId!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(section.pageId)||pageIds.has(section.pageId)
        ||!Array.isArray(section.speakerNotes)||!section.speakerNotes.length||section.speakerNotes.length>16
        ||!Array.from(section.speakerNotes).every(n=>object(n)&&keys(n,['kind','text'])&&['script','answer'].includes(String(n.kind))&&text(n.text,4000)))return false;
      pageIds.add(section.pageId);
    }
    if(section.figures!==undefined){
      if(!rich||!Array.isArray(section.figures)||!section.figures.length||section.figures.length>8||!Array.from(section.figures).every(f=>validPaperOfficeFigure(f,(section.paragraphs as unknown[]).length)))return false;
      let position=-1;for(const f of section.figures as PaperOfficeFigure[]){const id=f.questionId+':'+f.blockId;if(imageIds.has(id)||f.afterParagraph<position||++imageCount>800)return false;imageIds.add(id);position=f.afterParagraph;}
    }
    if(section.printKind!==undefined&&(!printed||!['heading','answer_area'].includes(String(section.printKind))||section.table||section.figures
      ||(section.printKind==='heading'?section.paragraphs.length!==0:value.schemaVersion!==PAPER_ANSWER_SHEET_OFFICE_SCHEMA||section.paragraphs.length<1||section.paragraphs.length>4)))return false;
    if (!section.paragraphs.length && !section.table && !section.figures && section.printKind!=='heading') return false;
    if (section.table !== undefined) {
      const table = section.table;
      if (!object(table) || !keys(table, ['columns', 'rows']) || !Array.isArray(table.columns)
        || !table.columns.length || table.columns.length > 8 || !Array.from(table.columns).every(c => text(c, 120))
        || !Array.isArray(table.rows) || !table.rows.length || table.rows.length > (presentation?12:200)
        || !Array.from(table.rows).every(row => Array.isArray(row) && row.length === (table.columns as unknown[]).length
          && Array.from(row).every(cell => text(cell, 120, true) || typeof cell === 'number' && Number.isFinite(cell)))) return false;
    }
  }
  if(value.schemaVersion===PAPER_RICH_OFFICE_SCHEMA&&!imageCount)return false;
  try { return new TextEncoder().encode(JSON.stringify(value)).length <= (classroom?512*1024:OFFICE_DRAFT_MAX_BYTES); } catch { return false; }
}
export const officeOutputFormat = (v: unknown): v is OfficeOutputFormat => typeof v === 'string' && ['docx', 'pdf', 'xlsx', 'pptx'].includes(v);
