import type { Sql } from '../../xiaozhi-agent/session-state';
import type { ExistingMemoryWitness } from './candidate-admission';
import { createPersonalMemoryJobs, type PersonalMemoryJobLease } from './background-jobs';
import { createPersonalMemoryCandidateRunner } from './candidate-runner';
import { createPersonalMemoryCandidateState } from './candidate-state';
import type { createPersonalMemorySourceAuthority } from './source-authority';
import { runPersonalMemoryCandidateWorker } from './candidate-worker-client';

type TargetRecord = { witness: ExistingMemoryWitness; proposal: unknown };
type Worker = typeof runPersonalMemoryCandidateWorker;
type Options = {
  sources: ReturnType<typeof createPersonalMemorySourceAuthority>;
  provider: Parameters<Worker>[0];
  targets: (pins: PersonalMemoryJobLease['job']['targets']) => Promise<TargetRecord[]>;
};

function errorCode(error: unknown) {
  const code=error instanceof Error ? error.message : '';
  return /^[a-z_]{1,48}$/.test(code) ? code : 'worker_failed';
}

/** Consumes an existing ai_tasks claim under a host-issued idle/resource signal. */
export function createPersonalMemoryBackgroundConsumer(sql: Sql, options: Options, worker: Worker = runPersonalMemoryCandidateWorker) {
  const jobs = createPersonalMemoryJobs(sql);
  const state = createPersonalMemoryCandidateState(sql, options.sources.witnessCurrent);
  const run = createPersonalMemoryCandidateRunner(state,options.provider,worker);
  async function write<T>(operation:(db:Sql)=>Promise<T>) {
    if (!sql.transaction) throw Error('configuration');
    return sql.transaction(operation);
  }

  return {
    state,
    jobs,
    async advance(admission: AbortSignal) {
      if (admission.aborted) return {state:'resource_wait' as const};
      await jobs.recoverExpired();
      let lease = await jobs.claim();
      if (!lease) return {state:'idle' as const};
      const identity = lease.id;
      const currentLease = () => lease!;
      let terminal = false;
      let unavailableSources = 0;
      try {
        const read = async () => {
          const current = currentLease().job;
          const byId = new Map(current.sources.map(pin=>[pin.id,pin]));
          const sources = (await options.sources.snapshot([...byId.keys()],current.authority)).filter(source=>{
            const pin=byId.get(source.id);
            return pin?.version===source.sourceVersion && pin.revision===source.generation;
          });
          unavailableSources = Math.max(unavailableSources, current.sources.length-sources.length);
          const existing = current.targets.length ? await options.targets(current.targets) : [];
          const targetPins = new Map(current.targets.map(pin=>[pin.id,pin.revision]));
          const exactTargets = new Map(existing.map(row=>[row.witness.id,row.witness.revision]));
          if (existing.length!==targetPins.size || exactTargets.size!==targetPins.size
              || [...targetPins].some(([id,revision])=>exactTargets.get(id)!==revision)) throw Error('source_changed');
          return {sources,existing};
        };
        const result = await run({
          read,
          isCurrent:db=>jobs.isCurrent(db,currentLease()),
          beforeModel:async manifest=>{
            if (admission.aborted) throw Error('cancelled');
            const current=currentLease();
            const dispatched=new Set(manifest.sources.map(source=>source.id));
            lease=await jobs.reserve(current,async db=>{
              for (const pin of current.job.sources) {
                if (dispatched.has(pin.id) && !await options.sources.dispatchCurrent(db,pin.id,pin.version,pin.revision)) return false;
              }
              if (admission.aborted) throw Error('cancelled');
              return true;
            });
          },
          complete:async(db, counts, processor, rejections)=>{
            if (admission.aborted) throw Error('cancelled');
            const notSaved=unavailableSources+counts.stale.length+counts.conflicted.length+rejections.length;
            await jobs.finish(db,currentLease(),{status:notSaved?'partial':'succeeded',code:notSaved?'partial':undefined,
              saved:counts.saved.length,notSaved,modelCalls:processor.modelCalls,usage:processor.usage});
          },
        },admission);
        terminal = 'committed' in result;
        if (!terminal) {
          await write(db=>jobs.finish(db,currentLease(),{
            status:result.state==='disabled'?'cancelled':unavailableSources?'partial':'succeeded',
            code:result.state==='disabled'?'cancelled':unavailableSources?'source_changed':'no_change',modelCalls:0,
            notSaved:unavailableSources}));
        }
        return {id:identity,...result,state:result.state!=='disabled'&&unavailableSources ? 'partial' as const : result.state};
      } catch(error) {
        const code = errorCode(error);
        if (terminal) throw error;
        const budgetWait=code==='budget_exhausted' && !currentLease().job.dispatch;
        const rescheduled=await write(async db=>{
          if (budgetWait) {
            await jobs.deferBudget(db,currentLease());
            return false;
          }
          if (code==='cancelled' && await jobs.deferBeforeDispatch(db,currentLease())) return true;
          await jobs.finish(db,currentLease(),{status:code==='cancelled'?'cancelled':'failed',code});
          return false;
        }).catch(failure=>{
          if (errorCode(failure)!=='stale_task') throw failure;
          return false;
        });
        return {id:identity,state:budgetWait?'budget_wait' as const:rescheduled?'resource_wait' as const:'stopped' as const,code};
      }
    },
  };
}
