export const OFFICE_DRAFT_SCHEMA = 'xiaozhi.office-draft.v1' as const;
export const OFFICE_DRAFT_MAX_BYTES = 256 * 1024;
export const OFFICE_OUTPUT_MAX_BYTES = 16 * 1024 * 1024;
export type OfficeOutputFormat = 'docx' | 'pdf' | 'xlsx' | 'pptx';
export type OfficeCell = string | number;
export type OfficeTable = { columns: string[]; rows: OfficeCell[][] };
export type OfficeSection = { heading: string; paragraphs: string[]; table?: OfficeTable };
export type OfficeDraft = { schemaVersion: typeof OFFICE_DRAFT_SCHEMA; title: string; sections: OfficeSection[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key));
const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string'
  && (empty || !!v.trim()) && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff]/u.test(v);
export function validOfficeDraft(value: unknown): value is OfficeDraft {
  if (!object(value) || !keys(value, ['schemaVersion', 'title', 'sections']) || value.schemaVersion !== OFFICE_DRAFT_SCHEMA
    || !text(value.title, 120) || !Array.isArray(value.sections) || !value.sections.length || value.sections.length > 20) return false;
  for (const section of value.sections) {
    if (!object(section) || !keys(section, ['heading', 'paragraphs', 'table']) || !text(section.heading, 120)
      || !Array.isArray(section.paragraphs) || section.paragraphs.length > 20 || !Array.from(section.paragraphs).every(p => text(p, 1000))) return false;
    if (!section.paragraphs.length && !section.table) return false;
    if (section.table !== undefined) {
      const table = section.table;
      if (!object(table) || !keys(table, ['columns', 'rows']) || !Array.isArray(table.columns)
        || !table.columns.length || table.columns.length > 8 || !Array.from(table.columns).every(c => text(c, 120))
        || !Array.isArray(table.rows) || !table.rows.length || table.rows.length > 200
        || !Array.from(table.rows).every(row => Array.isArray(row) && row.length === (table.columns as unknown[]).length
          && Array.from(row).every(cell => text(cell, 120, true) || typeof cell === 'number' && Number.isFinite(cell)))) return false;
    }
  }
  try { return new TextEncoder().encode(JSON.stringify(value)).length <= OFFICE_DRAFT_MAX_BYTES; } catch { return false; }
}
export const officeOutputFormat = (v: unknown): v is OfficeOutputFormat => typeof v === 'string' && ['docx', 'pdf', 'xlsx', 'pptx'].includes(v);
