import type {QuestionBankItemInput} from './contracts';
import {plainStudentInput} from './student-context';

export const MATERIAL_PASTE_SCHEMA = 'xiaozhi.material-paste.v1' as const;
export const MATERIAL_PASTE_MAX_TEXT = 40000;
export const MATERIAL_PASTE_MAX_QUESTIONS = 20;
export type MaterialPasteInput = {schemaVersion: typeof MATERIAL_PASTE_SCHEMA; text: string};
export type MaterialPasteImport = MaterialPasteInput & {expectedDigest: string};
export type MaterialPastePreview = {
  schemaVersion: typeof MATERIAL_PASTE_SCHEMA;
  digest: string;
  questions: {number: string; fields: QuestionBankItemInput; issues: string[]}[];
};
export function validMaterialPaste(value: unknown): value is MaterialPasteInput;
export function validMaterialPaste(value: unknown, importing: true): value is MaterialPasteImport;
export function validMaterialPaste(value: unknown, importing = false): value is MaterialPasteInput {
  return plainStudentInput(value, importing ? ['schemaVersion', 'text', 'expectedDigest'] : ['schemaVersion', 'text'])
    && Object.keys(value).length === (importing ? 3 : 2)
    && value.schemaVersion === MATERIAL_PASTE_SCHEMA && typeof value.text === 'string'
    && value.text.trim().length > 0 && value.text.length <= MATERIAL_PASTE_MAX_TEXT
    && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.text)
    && (!importing || typeof value.expectedDigest === 'string' && /^[a-f0-9]{64}$/.test(value.expectedDigest));
}
