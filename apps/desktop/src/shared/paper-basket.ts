import type {QuestionBankItem} from './contracts';
import {
  validPaperBlueprint, validPaperSession,
  type PaperBasketBinding, type PaperBlueprint, type PaperError, type PaperGeneration, type PaperView,
} from './paper-blueprint';
import {plainStudentInput} from './student-context';
export type {PaperBasketBinding} from './paper-blueprint';

export const PAPER_BASKET_SCHEMA = 'xiaozhi.paper-basket.v1' as const;
export const PAPER_BASKET_SNAPSHOT_SCHEMA = 'xiaozhi.paper-basket-snapshot.v1' as const;

export type PaperBasketResult<T> = {ok: true; value: T} | {ok: false; error: PaperError};
export type PaperBasketReason =
  | 'source_changed' | 'source_unavailable' | 'unsupported' | 'missing_answer'
  | 'section_mismatch' | 'generation_unavailable' | 'duplicate';
export type PaperBasketAvailability = {available: true} | {available: false; reason: PaperBasketReason};

export type PaperBasketEntry = {
  entryId: string;
  questionId: string;
  contentVersion: string;
  sectionId: string;
  position: number;
  question: QuestionBankItem;
  generation?: PaperGeneration;
};
export type PaperBasketEntryView = PaperBasketEntry & {availability: PaperBasketAvailability};
export type PaperBasketUiState = {
  stage: 'select' | 'organize' | 'preview';
  filters: {
    query?: string;
    knowledgePoint?: string;
    questionType?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    sourceKind?: 'local_bank' | 'teacher_resource' | 'generated';
    categoryId?: string;
  };
  offset: number;
  scrollTop: number;
};
export type PaperBasketSummary = {
  id: string;
  sessionId: string;
  revision: number;
  title: string;
  state: 'active' | 'archived';
  count: number;
  createdAt: string;
  updatedAt: string;
};
export type PaperBasketGap = {
  sectionId: string;
  sourceKind: 'original' | 'generated';
  required: number;
  selected: number;
  missing: number;
  excess: number;
};
export type PaperBasketView = PaperBasketSummary & {
  schemaVersion: typeof PAPER_BASKET_SCHEMA;
  blueprint: PaperBlueprint;
  entries: PaperBasketEntryView[];
  gaps: PaperBasketGap[];
  complete: boolean;
  uiState?: PaperBasketUiState;
};
export type PaperBasketCandidate = {
  question: QuestionBankItem;
  contentVersion: string;
  eligibility: PaperBasketAvailability;
  matchingSectionIds: string[];
  generation?: PaperGeneration;
};
export type PaperBasketListInput = {
  schemaVersion: typeof PAPER_BASKET_SCHEMA;
  sessionId: string;
  offset?: number;
  limit?: number;
};
export type PaperBasketPage = {
  items: PaperBasketSummary[];
  total: number;
  offset: number;
  limit: number;
};
export type PaperBasketReadInput = {
  schemaVersion: typeof PAPER_BASKET_SCHEMA;
  sessionId: string;
  basketId: string;
};
export type PaperBasketCandidateInput = PaperBasketReadInput & {questionId: string};
export type PaperBasketCreateInput = {
  schemaVersion: typeof PAPER_BASKET_SCHEMA;
  sessionId: string;
  requestId: string;
  blueprint: PaperBlueprint;
};
export type PaperBasketOperation =
  | {type: 'add'; questionId: string; sectionId: string; expectedSourceVersion: string}
  | {type: 'remove'; entryId: string}
  | {type: 'reorderSection'; sectionId: string; entryIds: string[]}
  | {type: 'moveEntry'; entryId: string; sectionId: string; index: number}
  | {type: 'updateBlueprint'; blueprint: PaperBlueprint}
  | {type: 'archive'}
  | {type: 'updateUiState'; uiState: PaperBasketUiState};
export type PaperBasketSnapshotInput = PaperBasketReadInput & {
  expectedRevision: number;
  requestId: string;
};
export type PaperBasketMutationInput = PaperBasketSnapshotInput & {operation: PaperBasketOperation};
export type PaperBasketApi = {
  listPaperBaskets: (input: PaperBasketListInput) => Promise<PaperBasketResult<PaperBasketPage>>;
  readPaperBasket: (input: PaperBasketReadInput) => Promise<PaperBasketResult<PaperBasketView>>;
  readPaperBasketCandidate: (input: PaperBasketCandidateInput) => Promise<PaperBasketResult<PaperBasketCandidate>>;
  createPaperBasket: (input: PaperBasketCreateInput) => Promise<PaperBasketResult<PaperBasketView>>;
  mutatePaperBasket: (input: PaperBasketMutationInput) => Promise<PaperBasketResult<PaperBasketView>>;
  createPaperFromBasket: (input: PaperBasketSnapshotInput) => Promise<PaperBasketResult<PaperView>>;
};

const UUID_PATTERN = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
function identifier(prefix: string, value: unknown): value is string {
  return typeof value === 'string' && new RegExp('^' + prefix + UUID_PATTERN + '$', 'i').test(value);
}
export function validBasketId(value: unknown): value is string {
  return identifier('xibasket_', value);
}
export function validBasketEntryId(value: unknown): value is string {
  return identifier('xibasketentry_', value);
}
export function validBasketRevision(value: unknown): value is number {
  return integer(value, 1000000) && Number(value) >= 1;
}
function integer(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}
function section(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value);
}
function version(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}
export function basketArray(value: unknown, maximum = 100): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) return false;
  return Array.from({length: value.length}, (_, index) => Object.getOwnPropertyDescriptor(value, String(index)))
    .every(descriptor => descriptor && 'value' in descriptor);
}
export function validBasketUiState(value: unknown): value is PaperBasketUiState {
  if (!plainStudentInput(value, ['stage', 'filters', 'offset', 'scrollTop'])
    || typeof value.stage !== 'string' || !['select', 'organize', 'preview'].includes(value.stage)
    || !integer(value.offset, 1000000) || !integer(value.scrollTop, 10000000)
    || !plainStudentInput(value.filters, ['query', 'knowledgePoint', 'questionType', 'difficulty', 'sourceKind', 'categoryId'])) {
    return false;
  }
  const filters = value.filters;
  const validText = ['query', 'knowledgePoint', 'questionType', 'categoryId'].every(key =>
    filters[key] === undefined || typeof filters[key] === 'string'
    && String(filters[key]).length <= 240 && !/[\x00-\x1f]/.test(String(filters[key])));
  return validText
    && (filters.difficulty === undefined || typeof filters.difficulty === 'string' && ['easy', 'medium', 'hard'].includes(filters.difficulty))
    && (filters.sourceKind === undefined || typeof filters.sourceKind === 'string' && ['local_bank', 'teacher_resource', 'generated'].includes(filters.sourceKind));
}
function validBasketBlueprint(value: unknown): value is PaperBlueprint {
  if (!plainStudentInput(value, ['title', 'subject', 'grade', 'durationMinutes', 'totalPoints', 'mode', 'sections'])
    || typeof value.mode !== 'string' || !basketArray(value.sections, 20)) return false;
  for (const section of value.sections) {
    if (!plainStudentInput(section, ['id', 'label', 'questionType', 'count', 'points', 'difficulty', 'knowledgePoint', 'generatedCount'])
      || section.difficulty !== undefined && typeof section.difficulty !== 'string') return false;
  }
  return validPaperBlueprint(value);
}
function base(value: unknown, keys: string[]): value is Record<string, unknown> {
  return plainStudentInput(value, keys)
    && value.schemaVersion === PAPER_BASKET_SCHEMA && validPaperSession(value.sessionId);
}
export function validPaperBasketList(value: unknown): value is PaperBasketListInput {
  return base(value, ['schemaVersion', 'sessionId', 'offset', 'limit'])
    && (value.offset === undefined || integer(value.offset, 1000000))
    && (value.limit === undefined || integer(value.limit, 50) && value.limit > 0);
}
export function validPaperBasketRead(value: unknown): value is PaperBasketReadInput {
  return base(value, ['schemaVersion', 'sessionId', 'basketId']) && validBasketId(value.basketId);
}
export function validPaperBasketCandidate(value: unknown): value is PaperBasketCandidateInput {
  return base(value, ['schemaVersion', 'sessionId', 'basketId', 'questionId'])
    && validBasketId(value.basketId) && identifier('question_', value.questionId);
}
export function validPaperBasketCreate(value: unknown): value is PaperBasketCreateInput {
  return base(value, ['schemaVersion', 'sessionId', 'requestId', 'blueprint'])
    && identifier('', value.requestId) && validBasketBlueprint(value.blueprint);
}
export function validPaperBasketSnapshot(value: unknown): value is PaperBasketSnapshotInput {
  return base(value, ['schemaVersion', 'sessionId', 'basketId', 'requestId', 'expectedRevision'])
    && validBasketId(value.basketId) && identifier('', value.requestId) && validBasketRevision(value.expectedRevision);
}
export function validPaperBasketOperation(value: unknown): value is PaperBasketOperation {
  if (!plainStudentInput(value, ['type', 'questionId', 'sectionId', 'expectedSourceVersion', 'entryId', 'entryIds', 'index', 'blueprint', 'uiState'])) {
    return false;
  }
  switch (value.type) {
    case 'add':
      return plainStudentInput(value, ['type', 'questionId', 'sectionId', 'expectedSourceVersion'])
        && identifier('question_', value.questionId) && section(value.sectionId) && version(value.expectedSourceVersion);
    case 'remove':
      return plainStudentInput(value, ['type', 'entryId']) && validBasketEntryId(value.entryId);
    case 'reorderSection':
      return plainStudentInput(value, ['type', 'sectionId', 'entryIds']) && section(value.sectionId)
        && basketArray(value.entryIds) && value.entryIds.every(validBasketEntryId)
        && new Set(value.entryIds).size === value.entryIds.length;
    case 'moveEntry':
      return plainStudentInput(value, ['type', 'entryId', 'sectionId', 'index'])
        && validBasketEntryId(value.entryId) && section(value.sectionId) && integer(value.index, 100);
    case 'updateBlueprint':
      return plainStudentInput(value, ['type', 'blueprint']) && validBasketBlueprint(value.blueprint);
    case 'archive':
      return plainStudentInput(value, ['type']);
    case 'updateUiState':
      return plainStudentInput(value, ['type', 'uiState']) && validBasketUiState(value.uiState);
    default:
      return false;
  }
}
export function validPaperBasketMutation(value: unknown): value is PaperBasketMutationInput {
  return base(value, ['schemaVersion', 'sessionId', 'basketId', 'requestId', 'expectedRevision', 'operation'])
    && validBasketId(value.basketId) && identifier('', value.requestId)
    && validBasketRevision(value.expectedRevision) && validPaperBasketOperation(value.operation);
}
export function validPaperBasketBinding(value: unknown): value is PaperBasketBinding {
  return plainStudentInput(value, ['basketId', 'basketRevision', 'entryIds'])
    && validBasketId(value.basketId) && validBasketRevision(value.basketRevision)
    && basketArray(value.entryIds) && value.entryIds.length > 0 && value.entryIds.every(validBasketEntryId)
    && new Set(value.entryIds).size === value.entryIds.length;
}
