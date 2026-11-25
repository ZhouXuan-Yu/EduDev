import { MATERIAL_PDF_MAX_PAGES, pageSha } from './material-page-preview';
import { materialId } from './materials';
import { plainStudentInput } from './student-context';

export const LOCAL_BOOK_ANSWERS_SCHEMA = 'xiaozhi.material-local-book-answers.v1' as const;
export const LOCAL_BOOK_ANSWERS_PAGE_COUNT = 12;
export const LOCAL_BOOK_RECHECK_SCHEMA = 'xiaozhi.material-local-book-recheck.v1' as const;

export type LocalBookAnswersQuery = {
  schemaVersion: typeof LOCAL_BOOK_ANSWERS_SCHEMA;
  resourceId: string;
  version: string;
  start: number;
};

export type LocalBookAnswer = { section: string; number: string; answer: string };
export type LocalBookRecheckQuery = {
  schemaVersion: typeof LOCAL_BOOK_RECHECK_SCHEMA;
  resourceId: string;
  version: string;
  page: number;
};
export type LocalBookRecheck = { checked: number; agreeing: number; different: number; unreadable: number };
export type LocalBookAnswersView = {
  schemaVersion: typeof LOCAL_BOOK_ANSWERS_SCHEMA;
  start: number;
  end: number;
  total: number;
  pending: number;
  review: number;
  pages: { page: number; answers: LocalBookAnswer[]; recheck?: LocalBookRecheck }[];
};

export function validLocalBookAnswersQuery(value: unknown): value is LocalBookAnswersQuery {
  return plainStudentInput(value, ['schemaVersion', 'resourceId', 'version', 'start']) &&
    Object.keys(value).length === 4 && value.schemaVersion === LOCAL_BOOK_ANSWERS_SCHEMA &&
    materialId(value.resourceId) && pageSha(value.version) && typeof value.start === 'number' &&
    Number.isInteger(value.start) && value.start >= 1 && value.start <= MATERIAL_PDF_MAX_PAGES;
}

export function validLocalBookRecheckQuery(value: unknown): value is LocalBookRecheckQuery {
  return plainStudentInput(value, ['schemaVersion', 'resourceId', 'version', 'page']) &&
    Object.keys(value).length === 4 && value.schemaVersion === LOCAL_BOOK_RECHECK_SCHEMA &&
    materialId(value.resourceId) && pageSha(value.version) && typeof value.page === 'number' &&
    Number.isInteger(value.page) && value.page >= 1 && value.page <= MATERIAL_PDF_MAX_PAGES;
}
