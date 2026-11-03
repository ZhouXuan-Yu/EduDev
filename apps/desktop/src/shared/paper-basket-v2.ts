import {PAPER_SCHEMA,validPaperReview,type PaperView} from './paper-blueprint';
import {PAPER_BASKET_C2_SCHEMA,type PaperBasketC2Binding} from './paper-basket-c2';
import {plainStudentInput} from './student-context';
import {PAPER_BASKET_SCHEMA, validPaperBasketRead, validPaperBasketList, validPaperBasketCandidate, validPaperBasketSnapshot, validPaperBasketCreate, validPaperBasketOperation,
  type PaperBasketReadInput, type PaperBasketListInput, type PaperBasketCandidateInput, type PaperBasketCreateInput, type PaperBasketSnapshotInput,
  type PaperBasketOperation, type PaperBasketView, type PaperBasketEntryView, type PaperBasketCandidate, type PaperBasketPage, type PaperBasketResult} from './paper-basket';
import {validBasketEntryId, validBasketRevision} from './paper-basket';
import {validPaperInstanceContent, validInstanceDigest, type PaperInstance, type PaperInstanceContent} from './paper-instance';
export const PAPER_BASKET_V2_SCHEMA = 'xiaozhi.paper-basket.v2' as const;
export const PAPER_BASKET_SNAPSHOT_V2_SCHEMA = 'xiaozhi.paper-basket-snapshot.v2' as const;
type V2<T extends {schemaVersion: string}> = Omit<T, 'schemaVersion'> & {schemaVersion: typeof PAPER_BASKET_V2_SCHEMA};
export type PaperBasketV2ReadInput = V2<PaperBasketReadInput>;
export type PaperBasketV2ListInput = V2<PaperBasketListInput>;
export type PaperBasketV2CandidateInput = V2<PaperBasketCandidateInput>;
export type PaperBasketV2CreateInput = V2<PaperBasketCreateInput>;
export type PaperBasketV2SnapshotInput = V2<PaperBasketSnapshotInput>;
export type PaperBasketV2ImportInput = {schemaVersion:typeof PAPER_BASKET_V2_SCHEMA;sessionId:string;requestId:string;paperId:string;paperRevision:number};
export type PaperBasketV2Confirmation = {basket:PaperBasketV2View;paper:PaperView;replacedPaperIds:string[]};
export type PaperBasketV2Operation = PaperBasketOperation
  | {type:'setEntryPoints';entryId:string;points:number}
  | {type: 'editEntry'; entryId: string; expectedInstanceRevision: number; content: PaperInstanceContent}
  | {type: 'replaceEntry'; entryId: string; expectedInstanceRevision: number; questionId: string; expectedSourceVersion: string}
  | {type: 'restoreEntrySource'; entryId: string; expectedInstanceRevision: number}
  | {type: 'reviewEntry'; entryId: string; expectedInstanceRevision: number; expectedContentDigest: string; action: 'confirm' | 'reject'};
export type PaperBasketV2MutationInput = PaperBasketV2SnapshotInput & {operation: PaperBasketV2Operation};
export type PaperBasketV2EntryView = PaperBasketEntryView & {
  instance: PaperInstance;
  reviewCurrent: boolean;
  deliveryBlock?: 'needs_review' | 'image_dependency' | 'options_required';
};
/** question is always the pinned parent for original comparison; instance.content is the only editable truth. */
export type PaperBasketV2View = Omit<PaperBasketView, 'schemaVersion' | 'entries'> & {
  schemaVersion: typeof PAPER_BASKET_V2_SCHEMA;
  persistedSchemaVersion: typeof PAPER_BASKET_SCHEMA | typeof PAPER_BASKET_V2_SCHEMA | typeof PAPER_BASKET_C2_SCHEMA;
  c2?:PaperBasketC2Binding;
  c2Digest?:string;
  templateSourceCurrent?:boolean;
  operationReceipt?:{requestId:string;basketId:string;basketRevision:number};
  entries: PaperBasketV2EntryView[];
  confirmedPaperId?: string;
};
export type PaperBasketV2Api = {
  listPaperBasketsV2: (input: PaperBasketV2ListInput) => Promise<PaperBasketResult<PaperBasketPage>>;
  readPaperBasketV2: (input: PaperBasketV2ReadInput) => Promise<PaperBasketResult<PaperBasketV2View>>;
  readPaperBasketCandidateV2: (input: PaperBasketV2CandidateInput) => Promise<PaperBasketResult<PaperBasketCandidate>>;
  createPaperBasketV2: (input: PaperBasketV2CreateInput) => Promise<PaperBasketResult<PaperBasketV2View>>;
  mutatePaperBasketV2: (input: PaperBasketV2MutationInput) => Promise<PaperBasketResult<PaperBasketV2View>>;
  createPaperFromBasketV2: (input: PaperBasketV2SnapshotInput) => Promise<PaperBasketResult<PaperView>>;
  importPaperToBasketV2: (input:PaperBasketV2ImportInput) => Promise<PaperBasketResult<PaperBasketV2View>>;
  confirmPaperBasketV2: (input:PaperBasketV2SnapshotInput) => Promise<PaperBasketResult<PaperBasketV2Confirmation>>;
};
function safeIntentTree(v: unknown, seen = new Set<object>(), budget = {nodes: 0}, depth = 0): boolean {
  if (++budget.nodes > 16000 || depth > 16) return false;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return typeof v !== 'string' || v.length <= 131072;
  if (typeof v === 'number') return Number.isFinite(v);
  if (!v || typeof v !== 'object' || seen.has(v)) return false;
  const array = Array.isArray(v), prototype = Object.getPrototypeOf(v), descriptors = Object.getOwnPropertyDescriptors(v);
  const keys = Reflect.ownKeys(descriptors);
  if (array ? prototype !== Array.prototype || v.length > 200 || keys.length !== v.length + 1 : prototype !== Object.prototype && prototype !== null) return false;
  seen.add(v);
  for (const key of keys) {
    if (array && key === 'length') continue;
    if (typeof key !== 'string') return false;
    const d = descriptors[key];
    if (!('value' in d) || !d.enumerable || !safeIntentTree(d.value, seen, budget, depth + 1)) return false;
  }
  seen.delete(v); return true;
}
function adapt(v: unknown, keys: string[]): Record<string, unknown> | undefined {
  if (!safeIntentTree(v) || !plainStudentInput(v, keys) || v.schemaVersion !== PAPER_BASKET_V2_SCHEMA) return undefined;
  return {...v, schemaVersion: PAPER_BASKET_SCHEMA};
}
export const validPaperBasketV2Read = (v: unknown): v is PaperBasketV2ReadInput => validPaperBasketRead(adapt(v, ['schemaVersion','sessionId','basketId']));
export const validPaperBasketV2List = (v: unknown): v is PaperBasketV2ListInput => validPaperBasketList(adapt(v, ['schemaVersion','sessionId','offset','limit']));
export const validPaperBasketV2Candidate = (v: unknown): v is PaperBasketV2CandidateInput => validPaperBasketCandidate(adapt(v, ['schemaVersion','sessionId','basketId','questionId']));
export const validPaperBasketV2Create = (v: unknown): v is PaperBasketV2CreateInput => validPaperBasketCreate(adapt(v, ['schemaVersion','sessionId','requestId','blueprint']));
export const validPaperBasketV2Snapshot = (v: unknown): v is PaperBasketV2SnapshotInput => validPaperBasketSnapshot(adapt(v, ['schemaVersion','sessionId','basketId','requestId','expectedRevision']));
export function validPaperBasketV2Import(v:unknown):v is PaperBasketV2ImportInput {
 return !!adapt(v,['schemaVersion','sessionId','requestId','paperId','paperRevision']) && plainStudentInput(v,['schemaVersion','sessionId','requestId','paperId','paperRevision'])
  && validPaperReview({schemaVersion:PAPER_SCHEMA,sessionId:v.sessionId,id:v.paperId,revision:v.paperRevision,action:'confirm'},true)
  && typeof v.requestId==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v.requestId);
}
export function validPaperBasketV2Mutation(v: unknown): v is PaperBasketV2MutationInput {
  const a = adapt(v, ['schemaVersion','sessionId','basketId','requestId','expectedRevision','operation']);
  if (!a) return false;
  const {operation: op, ...base} = a;
  if (!validPaperBasketSnapshot(base)) return false;
  if (validPaperBasketOperation(op)) return true;
  if(plainStudentInput(op,['type','entryId','points']) && op.type==='setEntryPoints')return validBasketEntryId(op.entryId)&&typeof op.points==='number'&&Number.isSafeInteger(op.points)&&op.points>=1&&op.points<=1000;
  if (!plainStudentInput(op, ['type','entryId','expectedInstanceRevision','content','questionId','expectedSourceVersion','expectedContentDigest','action'])
    || !validBasketEntryId(op.entryId) || !validBasketRevision(op.expectedInstanceRevision)) return false;
  switch (op.type) {
    case 'editEntry': return plainStudentInput(op, ['type','entryId','expectedInstanceRevision','content']) && validPaperInstanceContent(op.content);
    case 'restoreEntrySource': return plainStudentInput(op, ['type','entryId','expectedInstanceRevision']);
    case 'replaceEntry': return plainStudentInput(op, ['type','entryId','expectedInstanceRevision','questionId','expectedSourceVersion'])
      && typeof op.questionId === 'string' && /^question_[a-f0-9-]{36}$/i.test(op.questionId) && validInstanceDigest(op.expectedSourceVersion);
    case 'reviewEntry': return plainStudentInput(op, ['type','entryId','expectedInstanceRevision','expectedContentDigest','action'])
      && validInstanceDigest(op.expectedContentDigest) && typeof op.action === 'string' && ['confirm','reject'].includes(op.action);
    default: return false;
  }
}
