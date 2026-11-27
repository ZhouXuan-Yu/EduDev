import type {
  PersonalMemoryAdoptInput, PersonalMemoryCancelJobReceipt, PersonalMemoryCandidate, PersonalMemoryCandidateInput, PersonalMemoryEditInput,
  PersonalMemoryError, PersonalMemoryPolicy, PersonalMemoryQueue, PersonalMemoryResult, PersonalMemoryReview, PersonalMemorySourcePermission,
  PersonalMemorySummary, PersonalMemoryView,
} from '../../../shared/xiaozhi-personal-memory';
import {personalMemoryCategory} from '../../../shared/xiaozhi-personal-memory';
import {currentTeachingTarget} from '../../xiaozhi-agent/memory-scope-state';
import {readTeacherMemoryPolicy} from '../teacher-memory-policy';
import {validHistoryRef} from '../../xiaozhi-agent/history/source';
import {historyId} from '../../xiaozhi-agent/history/state';
import {validMemorySession} from '../../xiaozhi-agent/memory-selection';
import type { Sql } from '../../xiaozhi-agent/session-state';
import {createPersonalMemoryJobs} from './background-jobs';
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

type StoredRecord = NonNullable<Awaited<ReturnType<ReturnType<typeof createPersonalMemoryRecordState>['read']>>>;
function recordView(record:StoredRecord):PersonalMemorySummary {
  const {id,revision,kind,scope,term,value,witness,sourceOccurredAt,recordedAt,sourceCurrent,contentRestricted,state,cleanupPending}=record;
  return {id,revision,kind,category:personalMemoryCategory(kind),evidence:'teacher_confirmed',scope,term,value,
    sourceVersion:witness.sourceVersion,sourceOccurredAt,recordedAt,sourceCurrent,contentRestricted,state,cleanupPending};
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
export function createPersonalMemoryOperations(sql:Sql, sanitize:(text:string)=>Promise<string>,
  options:{stopBackground?:()=>void;invalidateUse?:()=>Promise<void>;mutate?:<T>(work:()=>Promise<T>)=>Promise<T>;
    workerAvailable?:()=>Promise<boolean>}={}) {
  const sources = createPersonalMemorySourceAuthority(sql,sanitize);
  const candidates = createPersonalMemoryCandidateState(sql,sources.witnessCurrent);
  const records = createPersonalMemoryRecordState(sql,sources);
  const jobs=createPersonalMemoryJobs(sql);
  const mutate=options.mutate ?? (async<T>(work:()=>Promise<T>)=>work());
  async function visibleCandidates(open:Awaited<ReturnType<typeof candidates.list>>):Promise<PersonalMemoryCandidate[]> {
    const pending:PersonalMemoryCandidate[]=[];
    for (const {draft,state,revision,recordedAt} of open) {
      if (state !== 'pending' && state !== 'conflict') continue;
      const reviewed = await sources.reviewQuote(sql, draft, 'candidate');
      if (!reviewed) continue;
      pending.push({key:draft.key,revision,kind:draft.kind,scope:draft.scope,term:draft.term,state,
        category:personalMemoryCategory(draft.kind),evidence:'ai_inferred',recordedAt,sourceOccurredAt:reviewed.occurredAt,
        value:reviewed.quote,targetRevision:draft.replaces?.revision ?? 0});
    }
    return pending;
  }
  return {
    view:()=>respond<PersonalMemoryView>(async()=>{
      const [policy,saved,open,background,workerAvailable] = await Promise.all([
        candidates.processing(),records.list(40),candidates.list(40,true),jobs.list(),options.workerAvailable?.() ?? true]);
      return {policy:policyView(policy),records:saved.map(recordView),
        candidates:await visibleCandidates(open),jobs:background,workerAvailable};
    }),
    catalog:(sessionId:unknown)=>respond<PersonalMemorySummary[]>(async()=>{
      if (!validMemorySession(sessionId)) throw Error('invalid_input');
      const read=async(db:Sql)=>{
        const [session]=await db.all('SELECT student_id,archived_at FROM ai_conversation_sessions WHERE id=?',[sessionId]);
        if (!session || session.student_id || session.archived_at) throw Error('permission_denied');
        if (Object.keys((await readTeacherMemoryPolicy(db)).use).length) return [];
        const target=await currentTeachingTarget(db,sessionId);
        const saved=await createPersonalMemoryRecordState(db,sources).list(40,target??{});
        return saved.filter(record=>record.sourceCurrent && record.value).map(recordView);
      };
      return sql.readTransaction ? sql.readTransaction(read) : read(sql);
    }),
    queue:(sessionId:unknown)=>respond<PersonalMemoryQueue>(async()=>{
      if (!validMemorySession(sessionId)) throw Error('invalid_input');
      const [session]=await sql.all('SELECT student_id,archived_at FROM ai_conversation_sessions WHERE id=?',[sessionId]);
      if (!session || session.student_id || session.archived_at) throw Error('permission_denied');
      const [policy,open]=await Promise.all([candidates.processing(),candidates.listForSession(sessionId)]);
      return {policy:policyView(policy),candidates:await visibleCandidates(open)};
    }),
    setEnabled:(value:unknown)=>respond(()=>mutate(async()=>{
      if (!inputObject(value) || typeof value.enabled !== 'boolean' ||
          (value.revision !== 0 && !safeRevision(value.revision))) throw Error('invalid_input');
      const updated=await candidates.setEnabled(value.enabled,value.revision);
      if (!updated.enabled) options.stopBackground?.();
      return policyView(updated);
    })),
    preview:(value:unknown)=>respond<PersonalMemoryReview>(async()=>{
      if (!candidateInput(value)) throw Error('invalid_input');
      const {quote,quoteSha256,occurredAt} = await records.preview(value.key,value.revision);
      return {quote,quoteSha256,occurredAt};
    }),
    previewRecord:(value:unknown)=>respond<PersonalMemoryReview>(async()=>{
      if (!inputObject(value) || !safeId(value.id) || !safeRevision(value.revision)) throw Error('invalid_input');
      return records.previewRecord(value.id,value.revision);
    }),
    adopt:(value:unknown)=>respond(()=>mutate(async()=>{
      if (!adoptInput(value)) throw Error('invalid_input');
      const receipt=await records.accept(value);
      await options.invalidateUse?.();
      return receipt;
    })),
    reject:(value:unknown)=>respond(()=>mutate(async()=>{
      if (!candidateInput(value)) throw Error('invalid_input');
      const rejected = await candidates.reject(value.key,value.revision);
      return {revision:rejected.revision};
    })),
    edit:(value:unknown)=>respond(()=>mutate(async()=>{
      if (!editInput(value)) throw Error('invalid_input');
      const receipt=await records.edit(value);
      if (value.action==='forget' || value.action==='disable') options.stopBackground?.();
      await options.invalidateUse?.();
      return receipt;
    })),
    cancelJob:(value:unknown)=>respond<PersonalMemoryCancelJobReceipt>(()=>mutate(async()=>{
      if (!inputObject(value) || typeof value.id!=='string' || !/^memorytask_[a-f0-9]{64}$/.test(value.id) ||
          !safeId(value.revision)) throw Error('invalid_input');
      const {wasRunning,...receipt}=await jobs.cancel({id:value.id,revision:value.revision});
      if (wasRunning) options.stopBackground?.();
      return receipt;
    })),
    sourceStatus:(ref:unknown)=>respond<PersonalMemorySourcePermission>(async()=>{
      if (!validHistoryRef(ref)) throw Error('invalid_input');
      const grant=await sources.permission(historyId(ref));
      const target=await currentTeachingTarget(sql,ref.sessionId);
      return {allowed:grant?.allowed===true && grant.ref.sourceVersion===ref.sourceVersion,revision:grant?.revision ?? 0,
        ...(target?{teachingTarget:{term:target.term,version:target.version}}:{})};
    }),
    setSource:(value:unknown)=>respond<PersonalMemorySourcePermission>(()=>mutate(async()=>{
      if (!inputObject(value) || !validHistoryRef(value.ref) || typeof value.enabled!=='boolean' ||
          (value.revision!==0 && !safeRevision(value.revision))) throw Error('invalid_input');
      if (value.teachingTargetVersion!==undefined && (!value.enabled || !safeRevision(value.teachingTargetVersion))) throw Error('invalid_input');
      const grant=await sources.change(value.ref,value.revision,value.enabled?{scope:{kind:'teacher',id:'self'},term:'unknown'}:null,
        value.teachingTargetVersion as number|undefined);
      if (!grant?.allowed) {
        options.stopBackground?.();
        await options.invalidateUse?.();
      }
      return {allowed:grant?.allowed ?? false,revision:grant?.revision ?? 0};
    })),
  };
}
