import type {
  PersonalMemoryAdoptInput, PersonalMemoryCandidate, PersonalMemoryCandidateInput, PersonalMemoryEditInput,
  PersonalMemoryError, PersonalMemoryPolicy, PersonalMemoryResult, PersonalMemoryReview, PersonalMemorySourcePermission,
  PersonalMemorySummary, PersonalMemoryView,
} from '../../../shared/xiaozhi-personal-memory';
import {validHistoryRef} from '../../xiaozhi-agent/history/source';
import {historyId} from '../../xiaozhi-agent/history/state';
import type { Sql } from '../../xiaozhi-agent/session-state';
import { createPersonalMemoryCandidateState } from './candidate-state';
import { createPersonalMemoryRecordState } from './record-state';
import { createPersonalMemorySourceAuthority } from './source-authority';

const errors = new Set<PersonalMemoryError>(['invalid_input','permission_denied','revision_conflict','command_conflict',
  'source_changed','stale_policy','cancelled','busy','configuration']);
const safeId = (value:unknown):value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const safeRevision = (value:unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const safeOperation = (value:unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{16,120}$/.test(value);
const inputObject = (value:unknown):value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

async function respond<T>(work:()=>Promise<T>):Promise<PersonalMemoryResult<T>> {
  try { return {ok:true,value:await work()}; }
  catch (error) {
    const code = (error instanceof Error ? error.message : '') as PersonalMemoryError;
    return {ok:false,error:errors.has(code) ? code : 'configuration'};
  }
}

function policyView({enabled,pausedByUsePolicy,policyRevision}:PersonalMemoryPolicy):PersonalMemoryPolicy {
  return {enabled,pausedByUsePolicy,policyRevision};
}

function recordView({id,revision,kind,scope,term,value,sourceOccurredAt,sourceCurrent,state,cleanupPending}:PersonalMemorySummary):PersonalMemorySummary {
  return {id,revision,kind,scope,term,value,sourceOccurredAt,sourceCurrent,state,cleanupPending};
}

function candidateInput(value:unknown):value is PersonalMemoryCandidateInput & Record<string,unknown> {
  return inputObject(value) && safeId(value.key) && safeRevision(value.revision);
}

function adoptInput(value:unknown):value is PersonalMemoryAdoptInput {
  return candidateInput(value) && safeOperation(value.operationId) &&
    (value.targetRevision === 0 || safeRevision(value.targetRevision)) && safeId(value.reviewedQuoteSha256);
}

function editInput(value:unknown):value is PersonalMemoryEditInput {
  return inputObject(value) && safeId(value.id) && safeRevision(value.revision) && safeOperation(value.operationId) &&
    (value.action === 'edit' ? typeof value.value === 'string' : ['disable','restore','forget'].includes(String(value.action)));
}

/** Renderer requests are evidence review and teacher mutations, with no renderer control of job dispatch. */
export function createPersonalMemoryOperations(sql:Sql, sanitize:(text:string)=>Promise<string>, stopBackground?:()=>void) {
  const sources = createPersonalMemorySourceAuthority(sql,sanitize);
  const candidates = createPersonalMemoryCandidateState(sql,sources.witnessCurrent);
  const records = createPersonalMemoryRecordState(sql,sources);
  return {
    view:()=>respond<PersonalMemoryView>(async()=>{
      const [policy,saved,open] = await Promise.all([candidates.processing(),records.list(40),candidates.list(40,true)]);
      const pending:PersonalMemoryCandidate[]=[];
      for (const {draft,state,revision} of open) {
        if ((state === 'pending' || state === 'conflict') && await sources.witnessCurrent(sql,draft)) {
          pending.push({key:draft.key,revision,kind:draft.kind,scope:draft.scope,term:draft.term,state,
            value:draft.proposedValue,targetRevision:draft.replaces?.revision ?? 0});
        }
      }
      return {policy:policyView(policy),records:saved.map(recordView),candidates:pending};
    }),
    setEnabled:(value:unknown)=>respond(async()=>{
      if (!inputObject(value) || typeof value.enabled !== 'boolean' ||
          (value.revision !== 0 && !safeRevision(value.revision))) throw Error('invalid_input');
      const updated=await candidates.setEnabled(value.enabled,value.revision);
      if (!updated.enabled) stopBackground?.();
      return policyView(updated);
    }),
    preview:(value:unknown)=>respond<PersonalMemoryReview>(async()=>{
      if (!candidateInput(value)) throw Error('invalid_input');
      const {quote,quoteSha256,occurredAt} = await records.preview(value.key,value.revision);
      return {quote,quoteSha256,occurredAt};
    }),
    previewRecord:(value:unknown)=>respond<PersonalMemoryReview>(async()=>{
      if (!inputObject(value) || !safeId(value.id) || !safeRevision(value.revision)) throw Error('invalid_input');
      return records.previewRecord(value.id,value.revision);
    }),
    adopt:(value:unknown)=>respond(async()=>{
      if (!adoptInput(value)) throw Error('invalid_input');
      return records.accept(value);
    }),
    reject:(value:unknown)=>respond(async()=>{
      if (!candidateInput(value)) throw Error('invalid_input');
      const rejected = await candidates.reject(value.key,value.revision);
      return {revision:rejected.revision};
    }),
    edit:(value:unknown)=>respond(async()=>{
      if (!editInput(value)) throw Error('invalid_input');
      const receipt=await records.edit(value);
      if (value.action==='forget' || value.action==='disable') stopBackground?.();
      return receipt;
    }),
    sourceStatus:(ref:unknown)=>respond<PersonalMemorySourcePermission>(async()=>{
      if (!validHistoryRef(ref)) throw Error('invalid_input');
      const grant=await sources.permission(historyId(ref));
      return {allowed:grant?.allowed===true && grant.ref.sourceVersion===ref.sourceVersion,revision:grant?.revision ?? 0};
    }),
    setSource:(value:unknown)=>respond<PersonalMemorySourcePermission>(async()=>{
      if (!inputObject(value) || !validHistoryRef(value.ref) || typeof value.enabled!=='boolean' ||
          (value.revision!==0 && !safeRevision(value.revision))) throw Error('invalid_input');
      const grant=await sources.change(value.ref,value.revision,value.enabled?{scope:{kind:'teacher',id:'self'},term:'unknown'}:null);
      if (!grant?.allowed) stopBackground?.();
      return {allowed:grant?.allowed ?? false,revision:grant?.revision ?? 0};
    }),
  };
}
