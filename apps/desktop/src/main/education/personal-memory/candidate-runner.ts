import type { Sql } from '../../xiaozhi-agent/session-state';
import {
  bindPersonalMemoryProposals, preparePersonalMemoryExtraction, sameCandidatePolicy,
  type ExistingMemoryWitness, type PersonalMemoryManifest, type PersonalMemorySource,
} from './candidate-admission';
import type { CandidateWriteReceipt, createPersonalMemoryCandidateState } from './candidate-state';
import { runPersonalMemoryCandidateWorker, type CandidateWorkerSuccess } from './candidate-worker-client';

type Worker = typeof runPersonalMemoryCandidateWorker;
type CandidateState = ReturnType<typeof createPersonalMemoryCandidateState>;
type MemorySnapshot = Readonly<{
  sources: readonly PersonalMemorySource[];
  existing: readonly Readonly<{ witness: ExistingMemoryWitness; proposal: unknown }>[];
}>;

/** The existing task owner supplies the durable lease check and canonical, authorized source snapshot. */
export type PersonalMemoryTask = Readonly<{
  read: () => Promise<MemorySnapshot>;
  isCurrent: (transaction: Sql) => Promise<boolean>;
  beforeModel?: (manifest: PersonalMemoryManifest) => Promise<void>;
  complete?: (db:Sql, receipt:CandidateWriteReceipt, processor:CandidateWorkerSuccess, rejections:readonly string[]) => Promise<void>;
}>;

const noModel = (): CandidateWorkerSuccess => ({status:'success_empty', proposals:[], modelCalls:0, usage:[]});

export function createPersonalMemoryCandidateRunner(state: CandidateState, options: Parameters<Worker>[0],
  worker: Worker = runPersonalMemoryCandidateWorker) {
  return async (task: PersonalMemoryTask, signal?: AbortSignal) => {
    if (signal?.aborted) throw Error('cancelled');
    const frozenPolicy = await state.processing();
    if (!frozenPolicy.enabled || frozenPolicy.pausedByUsePolicy) return {state:'disabled' as const, processor:noModel()};
    const initial = await task.read();
    const manifest = preparePersonalMemoryExtraction(initial.sources, frozenPolicy, initial.existing.map(row=>row.witness));
    if (!manifest.sources.length) return {state:'no_change' as const, processor:noModel()};
    if (signal?.aborted) throw Error('cancelled');
    const startedPolicy = await state.processing();
    if (!startedPolicy.enabled || startedPolicy.pausedByUsePolicy || startedPolicy.cancelGeneration !== frozenPolicy.cancelGeneration)
      throw Error('cancelled');
    if (!sameCandidatePolicy(startedPolicy,frozenPolicy)) throw Error('stale_policy');
    await task.beforeModel?.(manifest);
    const processed = await worker(options, manifest,
      initial.existing.map(row=>({id:row.witness.id,proposal:row.proposal})), signal);
    const latest = await task.read();
    const current = await state.processing();
    if (signal?.aborted || !current.enabled || current.pausedByUsePolicy || current.cancelGeneration!==frozenPolicy.cancelGeneration)
      throw Error('cancelled');
    if (!sameCandidatePolicy(current,frozenPolicy)) throw Error('stale_policy');
    const admission = bindPersonalMemoryProposals(processed.proposals, manifest, latest.sources, current, latest.existing.map(row=>row.witness));
    const committed = await state.savePending(admission.candidates, frozenPolicy, async db=>!signal?.aborted&&await task.isCurrent(db),
      async (db, receipt)=>task.complete?.(db,receipt,processed,admission.rejections));
    return {state: admission.rejections.length || committed.stale.length || committed.conflicted.length ? 'partial' as const :
      committed.saved.length ? 'processed' as const : 'no_change' as const,
      processor:{status:processed.status, modelCalls:processed.modelCalls, usage:processed.usage},
      rejections:admission.rejections, committed};
  };
}
