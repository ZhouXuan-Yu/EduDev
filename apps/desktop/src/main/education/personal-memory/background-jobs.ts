import { createHash, randomUUID } from 'node:crypto';
import type { Sql } from '../../xiaozhi-agent/session-state';
import { sameCandidatePolicy, type CandidateAuthority } from './candidate-admission';
import { readPersonalMemoryProcessing } from './candidate-state';
import type { CandidateWorkerSuccess } from './candidate-worker-client';

const jobSchema = 'xiaozhi.personal-memory-task.v1';
const processorVersion = 'langmem-4beb9c36-deepseek-flash-v1';
const taskType = 'personal_memory';
const dayCalls = 30;
const jobCalls = 2;
const leaseMs = 240_000;
const organizeIntervalMs = 30 * 60_000;
const quietMs = 60_000;
const digestPattern = /^[a-f0-9]{64}$/;
const identityPattern = /^[a-z0-9][a-z0-9_-]{0,179}$/i;

type SourcePin = Readonly<{ id: string; version: string; revision: number }>;
type TargetPin = Readonly<{ id: string; revision: number }>;
type JobOwner = { token: string; expiresAt: number };
type Dispatch = { day: string; startedAt: number; reserved: number; actual: number | null };
type JobStatus = 'pending' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled';
type JobKind = 'extract' | 'organize';
type JobInput = Readonly<{
  kind: JobKind;
  sources: readonly SourcePin[];
  targets?: readonly TargetPin[];
  authority: CandidateAuthority;
  notBefore: number;
}>;
type Job = {
  schemaVersion: typeof jobSchema;
  processorVersion: typeof processorVersion;
  kind: JobKind;
  sources: SourcePin[];
  targets: TargetPin[];
  authority: CandidateAuthority;
  notBefore: number;
  owner: JobOwner | null;
  dispatch: Dispatch | null;
};
export type PersonalMemoryJobLease = { id: string; payload: string; job: Job };
type Writable = Sql & { change: NonNullable<Sql['change']> };

function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function validPins(input: JobInput) {
  const targets = input.targets ?? [];
  return (input.kind==='extract' || input.kind==='organize') && Array.isArray(input.sources)
    && input.sources.length > 0 && input.sources.length <= 12 && Array.isArray(targets) && targets.length <= 20
    && (input.kind==='extract' ? targets.length===0 : targets.length>0)
    && new Set(input.sources.map(s=>s.id)).size===input.sources.length
    && new Set(targets.map(s=>s.id)).size===targets.length
    && input.sources.every(s=>typeof s.id==='string' && digestPattern.test(s.id)
      && typeof s.version==='string' && digestPattern.test(s.version) && natural(s.revision) && s.revision>0)
    && targets.every(s=>typeof s.id==='string' && identityPattern.test(s.id) && natural(s.revision) && s.revision>0)
    && natural(input.authority?.policyRevision) && natural(input.authority?.cancelGeneration)
    && natural(input.authority.teacherPolicyRevision??0) && natural(input.notBefore);
}
const hash = (input:unknown) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const compareId = (a:{id:string},b:{id:string}) => a.id<b.id ? -1 : a.id>b.id ? 1 : 0;

function jobFromRow(row: Record<string, unknown>): Job {
  const job = JSON.parse(String(row.payload_json)) as Job;
  if (!job || job.schemaVersion!==jobSchema || job.processorVersion!==processorVersion || !validPins(job)
      || (job.owner!==null && (!job.owner || !/^[a-f0-9-]{36}$/i.test(job.owner.token) || !natural(job.owner.expiresAt)))
      || (job.dispatch!==null && (!job.dispatch || !/^\d{4}-\d{2}-\d{2}$/.test(job.dispatch.day)
          || !natural(job.dispatch.startedAt) || job.dispatch.reserved!==jobCalls
          || (job.dispatch.actual!==null && (!natural(job.dispatch.actual)||job.dispatch.actual>jobCalls))))) throw Error('invalid_task');
  return job;
}

function requireChanges(db: Sql): asserts db is Writable {
  if (!db.change) throw Error('configuration');
}

/** Durable consumer state on the app's existing ai_tasks table. The runtime owns wakeups and resource admission. */
export function createPersonalMemoryJobs(sql: Sql, clock: () => number = Date.now) {
  function write<T>(operation:(db:Writable)=>Promise<T>) {
    if (!sql.transaction) throw Error('configuration');
    return sql.transaction(db=>{requireChanges(db); return operation(db);});
  }
  async function cas(db: Sql, id: string, expected: JobStatus, payload: string, status: JobStatus, job: Job,
    error: string | null = null, result: unknown = null) {
    requireChanges(db);
    return db.change(`UPDATE ai_tasks SET status=?,payload_json=?,error_message=?,result_json=?,updated_at=?
      WHERE id=? AND task_type=? AND status=? AND payload_json=?`,
    [status,JSON.stringify(job),error,result===null?null:JSON.stringify(result),new Date(clock()).toISOString(),id,taskType,expected,payload]);
  }
  const processing = readPersonalMemoryProcessing;
  function matchesPolicy(job: Job, authority: Awaited<ReturnType<typeof processing>>) {
    return authority.enabled && !authority.pausedByUsePolicy && sameCandidatePolicy(job.authority,authority)
      && job.authority.cancelGeneration===authority.cancelGeneration;
  }
  async function current(db: Sql, lease: PersonalMemoryJobLease) {
    const [row] = await db.all("SELECT payload_json FROM ai_tasks WHERE id=? AND task_type=? AND status='running'",[lease.id,taskType]);
    if (row?.payload_json!==lease.payload) return null;
    const job = jobFromRow(row);
    return job.owner && job.owner.expiresAt>clock() ? job : null;
  }

  async function enqueue(db: Writable, input: JobInput) {
    if (!validPins(input)) throw Error('invalid_input');
    const sources = input.sources.map(s=>({id:s.id,version:s.version,revision:s.revision})).sort(compareId);
    const targets = (input.targets??[]).map(s=>({id:s.id,revision:s.revision})).sort(compareId);
    const authority = {policyRevision:input.authority.policyRevision,cancelGeneration:input.authority.cancelGeneration,
      teacherPolicyRevision:input.authority.teacherPolicyRevision??0};
    const identity = hash([jobSchema,processorVersion,input.kind,sources,targets]);
    const id = 'memorytask_'+identity;
    const job:Job={schemaVersion:jobSchema,processorVersion,kind:input.kind,sources,targets,authority,
      notBefore:input.notBefore,owner:null,dispatch:null};
    const policy=await processing(db);
    if (!matchesPolicy(job,policy)) throw Error('stale_policy');
    const time = new Date(clock()).toISOString();
    const inserted=await db.change(`INSERT OR IGNORE INTO ai_tasks(id,task_type,status,input_hash,payload_json,created_at,updated_at)
      VALUES(?,?,'pending',?,?,?,?)`,[id,taskType,identity,JSON.stringify(job),time,time]);
    if (inserted) return {id, created:true};
    const [prior] = await db.all('SELECT status,payload_json FROM ai_tasks WHERE id=? AND task_type=?',[id,taskType]);
    const old = jobFromRow(prior);
    // Only jobs that never started outbound work can be reopened without a new grant.
    if ((prior.status==='cancelled' || prior.status==='pending') && !old.dispatch && !matchesPolicy(old,policy)) {
      await cas(db,id,prior.status,String(prior.payload_json),'pending',job);
    }
    return {id, created:false};
  }

  return {
    enqueue:(input:JobInput)=>write(db=>enqueue(db,input)),

    async planExtraction() {
      return write(async db=>{
        const authority=await processing(db);
        if (!authority.enabled || authority.pausedByUsePolicy) return null;
        const now=clock();
        const rows=await db.all(`SELECT g.source_id,g.source_version,g.grant_revision
          FROM personal_memory_extract_grants g JOIN memory_source_access a ON a.source_id=g.source_id
          LEFT JOIN ai_tasks job ON job.id=g.extraction_job_id AND job.task_type='personal_memory'
          WHERE g.extract_allowed=1 AND g.updated_at<=? AND a.memory_state='active' AND a.generation=g.history_generation
          AND (g.extraction_job_id IS NULL OR (job.status='cancelled' AND json_valid(job.payload_json)
            AND json_extract(job.payload_json,'$.dispatch') IS NULL
            AND (json_extract(job.payload_json,'$.authority.cancelGeneration')<>?
              OR json_extract(job.payload_json,'$.authority.policyRevision')<>?
              OR json_extract(job.payload_json,'$.authority.teacherPolicyRevision')<>?)))
          ORDER BY g.updated_at,g.source_id LIMIT 12`,[now-quietMs,authority.cancelGeneration,authority.policyRevision,
            authority.teacherPolicyRevision??0]);
        if (!rows.length) return null;
        const sources=rows.map(row=>({id:String(row.source_id),version:String(row.source_version),revision:Number(row.grant_revision)}));
        const planned=await enqueue(db,{kind:'extract',sources,authority,notBefore:now});
        for (const pin of sources) {
          await db.change(`UPDATE personal_memory_extract_grants SET extraction_job_id=?
            WHERE source_id=? AND source_version=? AND grant_revision=?`,[planned.id,pin.id,pin.version,pin.revision]);
        }
        return planned;
      });
    },

    async claim(): Promise<PersonalMemoryJobLease | null> {
      return write(async db=>{
        const policy = await processing(db);
        if (!policy.enabled || policy.pausedByUsePolicy) return null;
        const active = await db.all("SELECT 1 FROM ai_tasks WHERE task_type=? AND status='running' LIMIT 1",[taskType]);
        if (active.length) return null;
        const now = clock();
        const rows=await db.all(`SELECT id,payload_json FROM ai_tasks WHERE task_type=? AND status='pending'
          AND json_valid(payload_json) AND json_extract(payload_json,'$.notBefore')<=? ORDER BY created_at,id LIMIT 32`,[taskType,now]);
        for (const row of rows) {
          const job=jobFromRow(row),id=String(row.id),payload=String(row.payload_json);
          if (!matchesPolicy(job,policy)) {
            await cas(db,id,'pending',payload,'cancelled',job,'stale_policy');
            continue;
          }
          if (job.kind==='organize') {
            const [recent]=await db.all(`SELECT 1 FROM ai_tasks WHERE task_type=? AND json_valid(payload_json)
              AND json_extract(payload_json,'$.kind')='organize' AND json_extract(payload_json,'$.dispatch.startedAt')>? LIMIT 1`,
            [taskType, now-organizeIntervalMs]);
            if (recent) continue;
          }
          const owned={...job,owner:{token:randomUUID(),expiresAt:now+leaseMs}};
          if (await cas(db,id,'pending',payload,'running',owned)===1) return {id,payload:JSON.stringify(owned),job:owned};
        }
        return null;
      });
    },

    async reserve(lease: PersonalMemoryJobLease, mayDispatch?: (db:Sql)=>Promise<boolean>): Promise<PersonalMemoryJobLease> {
      return write(async db=>{
        const job = await current(db,lease);
        if (!job || !matchesPolicy(job,await processing(db))) throw Error('stale_task');
        if (job.dispatch) throw Error('budget_exhausted');
        if (mayDispatch && !await mayDispatch(db)) throw Error('source_changed');
        const now = clock(), day = new Date(now).toISOString().slice(0,10);
        const [row] = await db.all(`SELECT COALESCE(SUM(COALESCE(json_extract(payload_json,'$.dispatch.actual'),
          json_extract(payload_json,'$.dispatch.reserved'))),0) AS calls FROM ai_tasks WHERE task_type=? AND json_valid(payload_json)
          AND json_extract(payload_json,'$.dispatch.day')=?`,[taskType,day]);
        if (Number(row.calls)+jobCalls>dayCalls) throw Error('budget_exhausted');
        const reserved={...job,dispatch:{day,startedAt:now,reserved:jobCalls,actual:null}};
        if (await cas(db,lease.id,'running',lease.payload,'running',reserved)!==1) throw Error('stale_task');
        return {id:lease.id,payload:JSON.stringify(reserved),job:reserved};
      });
    },

    async isCurrent(db: Sql, lease: PersonalMemoryJobLease) {
      const job = await current(db,lease);
      return !!job && matchesPolicy(job,await processing(db));
    },

    async deferBudget(db: Sql, lease: PersonalMemoryJobLease) {
      const job=await current(db,lease);
      if (!job || job.dispatch || !matchesPolicy(job,await processing(db))) throw Error('stale_task');
      const nextDay = new Date(clock());
      nextDay.setUTCHours(24,0,0,0);
      if (await cas(db,lease.id,'running',lease.payload,'pending',{...job,owner:null,notBefore:nextDay.getTime()},
        'budget_exhausted')!==1) throw Error('stale_task');
    },

    async deferBeforeDispatch(db: Sql, lease: PersonalMemoryJobLease) {
      const job=await current(db,lease);
      if (!job || job.dispatch || !matchesPolicy(job,await processing(db))) return false;
      return await cas(db,lease.id,'running',lease.payload,'pending',
        {...job,owner:null,notBefore:clock()+quietMs},'resource_wait')===1;
    },

    async finish(db: Sql, lease: PersonalMemoryJobLease, outcome: {
      status: 'succeeded' | 'partial' | 'failed' | 'cancelled';
      code?: string;
      modelCalls?: number;
      usage?: CandidateWorkerSuccess['usage'];
      saved?: number;
      notSaved?: number;
    }) {
      const job = await current(db,lease);
      if (!job) throw Error('stale_task');
      if ((outcome.status==='succeeded' || outcome.status==='partial') && !matchesPolicy(job,await processing(db))) throw Error('stale_task');
      const {modelCalls=undefined,usage=[],saved=0,notSaved=0}=outcome;
      if ((modelCalls!==undefined && (!natural(modelCalls) || modelCalls>(job.dispatch?.reserved??0)))
          || usage.length>(modelCalls??0) || !natural(saved) || !natural(notSaved)) throw Error('invalid_result');
      const code=outcome.code && /^[a-z_]{1,48}$/.test(outcome.code) ? outcome.code : null;
      const normalizedUsage=usage.map(({prompt_tokens,completion_tokens,prompt_cache_hit_tokens})=>
        ({prompt_tokens,completion_tokens,prompt_cache_hit_tokens}));
      const finished={...job,owner:null,dispatch:job.dispatch && {...job.dispatch,actual:modelCalls??null}};
      if (await cas(db,lease.id,'running',lease.payload,outcome.status,finished,code,
        {modelCalls:modelCalls??null,usage:normalizedUsage,saved,notSaved})!==1) throw Error('stale_task');
    },

    async recoverExpired() {
      return write(async db=>{
        const rows=await db.all("SELECT id,payload_json FROM ai_tasks WHERE task_type=? AND status='running'",[taskType]);
        for (const row of rows) {
          const job=jobFromRow(row);
          if (job.owner && job.owner.expiresAt>clock()) continue;
          // A no-store provider may have billed a request we did not receive. Keep its reservation and never silently resend.
          const unknown=!!job.dispatch;
          await cas(db,String(row.id),'running',String(row.payload_json),unknown?'failed':'pending',{...job,owner:null},
            unknown?'provider_effect_unknown':'lease_expired');
        }
      });
    },
  };
}
