import {plainStudentInput} from './student-context';
import {materialId, type MaterialSource} from './materials';
import {validPaperSession} from './paper-blueprint';

export const PAPER_REFERENCE_SCHEMA = 'xiaozhi.paper-reference.v1' as const;
export const PAPER_REFERENCE_PARSER = 'reference-rules.v1' as const;
export type ReferenceStatus = 'known' | 'unknown' | 'ambiguous' | 'unsupported';
/** Teacher input never replaces the extracted value or its evidence. Not a PaperBlueprint. */
export type ReferenceField = {value: string | null; status: ReferenceStatus; evidenceIds: string[];
  teacherValue?: string; confirmed: boolean};
export type ReferenceEvidence = {id: string; text: string; source?: MaterialSource;
  line?: number; part?: string; path?: string};
export type ReferenceSection = {id: string; label: ReferenceField; questionType: ReferenceField;
  count: ReferenceField; points: ReferenceField; difficulty: ReferenceField; knowledgePoint: ReferenceField};
export const referenceLayoutKeys = ['paper', 'orientation', 'columns', 'top', 'right', 'bottom', 'left', 'columnGap'] as const;
export type ReferenceLayoutKey = typeof referenceLayoutKeys[number];
export type PaperReferenceCandidate = {schemaVersion: typeof PAPER_REFERENCE_SCHEMA; parser: typeof PAPER_REFERENCE_PARSER;
  source: {resourceId: string; version: string; filename?: string; bodyDigest: string; structureDigest?: string; parseEngine: string;
    readChunks: number; totalChunks: number; complete: boolean; units: MaterialSource[]};
  digest: string; title: ReferenceField; subject: ReferenceField; grade: ReferenceField;
  durationMinutes: ReferenceField; totalPoints: ReferenceField; sections: ReferenceSection[];
  layout: Record<ReferenceLayoutKey, ReferenceField>; evidence: ReferenceEvidence[]; warnings: string[]};
export type PaperReferenceTarget = {schemaVersion: typeof PAPER_REFERENCE_SCHEMA; sessionId: string; basketId: string; basketRevision: number};
export type PaperReferenceListInput = PaperReferenceTarget & {query: string; offset: number};
export type PaperReferenceExtractInput = PaperReferenceTarget & {requestId: string; resourceId: string; version: string};
export type PaperReferenceCancelInput = PaperReferenceTarget & {requestId: string};
export type PaperReferenceSource = {resourceId: string; version: string; title: string; filename: string;
  parseStatus: string; chunkCount: number};
export type PaperReferenceSourcePage = {items: PaperReferenceSource[]; offset: number; hasMore: boolean};
export type PaperReferenceError = 'invalid_input' | 'permission_denied' | 'source_changed' | 'conflict' | 'unavailable' | 'too_large' | 'cancelled' | 'parse_failed' | 'busy';
export type PaperReferenceResult<T> = {ok: true; value: T} | {ok: false; error: PaperReferenceError};
export type PaperReferenceApi = {
  listPaperReferenceSources(input: PaperReferenceListInput): Promise<PaperReferenceResult<PaperReferenceSourcePage>>;
  extractPaperReference(input: PaperReferenceExtractInput): Promise<PaperReferenceResult<PaperReferenceCandidate>>;
  cancelPaperReferenceExtraction(input: PaperReferenceCancelInput): Promise<PaperReferenceResult<boolean>>;
};
const targetKeys = ['schemaVersion', 'sessionId', 'basketId', 'basketRevision'];
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const request = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(v);
const target = (v: Record<string, unknown>) => v.schemaVersion === PAPER_REFERENCE_SCHEMA && validPaperSession(v.sessionId)
  && typeof v.basketId === 'string' && /^xibasket_[a-f0-9-]{36}$/i.test(v.basketId) && integer(v.basketRevision, 1, 1000000);
export function validReferenceList(v: unknown): v is PaperReferenceListInput {
  return plainStudentInput(v, [...targetKeys, 'query', 'offset']) && target(v) && typeof v.query === 'string'
    && v.query.length <= 128 && !/[\x00-\x1f]/.test(v.query) && integer(v.offset, 0, 10000000);
}
export function validReferenceExtract(v: unknown): v is PaperReferenceExtractInput {
  return plainStudentInput(v, [...targetKeys, 'requestId', 'resourceId', 'version']) && target(v) && request(v.requestId)
    && materialId(v.resourceId) && typeof v.version === 'string' && /^[a-f0-9]{64}$/i.test(v.version);
}
export function validReferenceCancel(v: unknown): v is PaperReferenceCancelInput {
  return plainStudentInput(v, [...targetKeys, 'requestId']) && target(v) && request(v.requestId);
}
export const unknownReferenceField = (): ReferenceField => ({value: null, status: 'unknown', evidenceIds: [], confirmed: false});
