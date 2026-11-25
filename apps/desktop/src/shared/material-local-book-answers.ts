import { MATERIAL_PDF_MAX_PAGES, pageSha } from './material-page-preview';
import { materialId } from './materials';
import { plainStudentInput } from './student-context';

export const LOCAL_BOOK_ANSWERS_SCHEMA = 'xiaozhi.material-local-book-answers.v1' as const;
export const LOCAL_BOOK_ANSWERS_PAGE_COUNT = 12;

export type LocalBookAnswersQuery = {
  schemaVersion: typeof LOCAL_BOOK_ANSWERS_SCHEMA;
  resourceId: string;
  version: string;
  start: number;
};

export type LocalBookAnswer = { section: string; number: string; answer: string };
export type LocalBookAnswersView = {
  schemaVersion: typeof LOCAL_BOOK_ANSWERS_SCHEMA;
  start: number;
  end: number;
  total: number;
  pending: number;
  review: number;
  pages: { page: number; answers: LocalBookAnswer[] }[];
};

export function validLocalBookAnswersQuery(value: unknown): value is LocalBookAnswersQuery {
  return plainStudentInput(value, ['schemaVersion', 'resourceId', 'version', 'start']) &&
    Object.keys(value).length === 4 && value.schemaVersion === LOCAL_BOOK_ANSWERS_SCHEMA &&
    materialId(value.resourceId) && pageSha(value.version) && typeof value.start === 'number' &&
    Number.isInteger(value.start) && value.start >= 1 && value.start <= MATERIAL_PDF_MAX_PAGES;
}
