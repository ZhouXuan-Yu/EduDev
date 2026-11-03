import type {PaperPurpose,PaperPracticeSetup,PaperRequirements} from '../../../shared/paper-purpose';
import type {PaperFulfillmentPlan} from '../../../shared/paper-fulfillment-plan';
import {validPaperBasketOperation} from '../../../shared/paper-basket';
import {PAPER_BASKET_SCHEMA, type PaperBasketApi, type PaperBasketView,
  type PaperBasketEntryView, type PaperBasketMutationInput, type PaperBasketOperation} from '../../../shared/paper-basket';
import {PAPER_BASKET_V2_SCHEMA, type PaperBasketV2Api, type PaperBasketV2Operation,
  type PaperBasketV2EntryView} from '../../../shared/paper-basket-v2';
import {validPaperInstance} from '../../../shared/paper-instance';
import type {PaperBasketC2Binding} from '../../../shared/paper-basket-c2';

export type PaperWorkspaceEntry = PaperBasketEntryView & Partial<Pick<PaperBasketV2EntryView, 'instance' | 'reviewCurrent' | 'deliveryBlock'>>;
export type PaperWorkspaceBasket = Omit<PaperBasketView, 'schemaVersion' | 'entries'> & {
  schemaVersion: typeof PAPER_BASKET_SCHEMA | typeof PAPER_BASKET_V2_SCHEMA;
  entries: PaperWorkspaceEntry[];
  confirmedPaperId?: string;
  studentId?:string;purpose?:PaperPurpose;paperRequirements?:PaperRequirements;fulfillment?:PaperFulfillmentPlan;
  c2?:PaperBasketC2Binding;
  c2Digest?:string;
  templateSourceCurrent?:boolean;
};
export type PaperWorkspaceOperation = PaperBasketV2Operation;
type Mutation = Omit<PaperBasketMutationInput, 'operation'> & {operation: PaperWorkspaceOperation};
const legacyOperation = (op:PaperWorkspaceOperation):op is PaperBasketOperation=>validPaperBasketOperation(op);
type CreateInput=Parameters<PaperBasketApi['createPaperBasket']>[0]&{purpose?:'paper'}|{schemaVersion:typeof PAPER_BASKET_SCHEMA;sessionId:string;requestId:string;purpose:'practice';practice:PaperPracticeSetup};

/** Select the installed protocol once per call. A failed V2 reply never falls back to V1 writes. */
export function paperBasketClient(api: PaperBasketApi & Partial<PaperBasketV2Api>) {
  const v2 = typeof api.readPaperBasketV2 === 'function';
  const checked = async (reply: Promise<import('../../../shared/paper-basket').PaperBasketResult<PaperWorkspaceBasket>>) => {
    const result = await reply;
    if (result.ok && v2 && (result.value.schemaVersion !== PAPER_BASKET_V2_SCHEMA ||
      result.value.entries.some(entry => !validPaperInstance(entry.instance) || entry.instance.entryId !== entry.entryId ||
        entry.instance.sourceBinding.questionId !== entry.questionId || entry.instance.sourceBinding.sourceVersion !== entry.contentVersion))) return {ok: false as const, error: 'unavailable' as const};
    return result;
  };
  return {
    v2,
    confirmAll:(input:Parameters<PaperBasketApi['createPaperFromBasket']>[0])=>api.confirmPaperBasketV2
      ?api.confirmPaperBasketV2({...input,schemaVersion:PAPER_BASKET_V2_SCHEMA}):Promise.resolve({ok:false as const,error:'unavailable' as const}),
    list: (input: Parameters<PaperBasketApi['listPaperBaskets']>[0]) => v2
      ? api.listPaperBasketsV2!({...input, schemaVersion: PAPER_BASKET_V2_SCHEMA}) : api.listPaperBaskets(input),
    read: (input: Parameters<PaperBasketApi['readPaperBasket']>[0]) => checked(v2
      ? api.readPaperBasketV2!({...input, schemaVersion: PAPER_BASKET_V2_SCHEMA}) : api.readPaperBasket(input)),
    candidate: (input: Parameters<PaperBasketApi['readPaperBasketCandidate']>[0]) => v2
      ? api.readPaperBasketCandidateV2!({...input, schemaVersion: PAPER_BASKET_V2_SCHEMA}) : api.readPaperBasketCandidate(input),
    create: (input: CreateInput) => checked(v2
      ? api.createPaperBasketV2!({...input, schemaVersion: PAPER_BASKET_V2_SCHEMA}) : input.purpose==='practice'?Promise.resolve({ok:false as const,error:'unavailable' as const}):api.createPaperBasket({schemaVersion:input.schemaVersion,sessionId:input.sessionId,requestId:input.requestId,blueprint:input.blueprint})),
    mutate: (input: Mutation) => checked(v2
      ? api.mutatePaperBasketV2!({...input, schemaVersion: PAPER_BASKET_V2_SCHEMA})
      : legacyOperation(input.operation) ? api.mutatePaperBasket({...input, operation: input.operation})
        : Promise.resolve({ok: false as const, error: 'unavailable' as const})),
    snapshot: (input: Parameters<PaperBasketApi['createPaperFromBasket']>[0]) => v2
      ? api.createPaperFromBasketV2!({...input, schemaVersion: PAPER_BASKET_V2_SCHEMA}) : api.createPaperFromBasket(input),
  };
}
