import type {Sql} from '../session-state';
import type {TerminalJobRef} from '../../../shared/xiaozhi-terminal-jobs';
import type {JobPermissionBinding} from '../permissions/engine';
import type {PermissionRequest} from '../../../shared/xiaozhi-permissions';
import {snapshotRequest, permissionHash} from '../permissions/validation';
import type {EffectAuthority, EffectIntent, EffectRecord} from '../effects/types';
import type {JobActor, TerminalJobDocument, TerminalJobRecord} from './job-types';
import {createEffectState} from '../effects/state';

const live = (state: string) => state === 'starting' || state === 'running';
const states = new Set(['starting', 'running', 'completed', 'failed', 'cancelled', 'timed_out', 'interrupted']);
const jobIdentity = (value: unknown): value is string => typeof value === 'string' && /^term_[a-f0-9-]{36}$/iu.test(value);
const sameOwner = (left: TerminalJobDocument['origin'], right: TerminalJobDocument['origin']) => permissionHash(left) === permissionHash(right);

/** Business and authority revisions are separate from the high-frequency output/input cursors. */
export function createTerminalJobState(sql: Sql) {
  async function transaction<T>(action: (work: Sql) => Promise<T>) {
    if (!sql.transaction) throw Error('job_transaction_required');
    return sql.transaction(action);
  }
  function decode(row: Record<string, unknown>): TerminalJobRecord {
    const document = JSON.parse(String(row.document_json)) as TerminalJobDocument;
    if (document.schemaVersion !== 1 || !jobIdentity(document.jobId) || document.jobId !== row.job_id
        || document.sessionId !== row.session_id || document.taskId !== row.task_id || document.revision !== row.revision
        || document.controllerRevision !== row.controller_revision || document.leaseRevision !== row.lease_revision
        || document.state !== row.state || !states.has(document.state) || document.origin.taskId !== document.taskId
        || document.origin.sessionId !== document.sessionId || !sameOwner(document.origin, document.request.owner)
        || !/^xiexec_[a-f0-9-]{36}$/iu.test(document.projection.executionId)
        || ![document.revision, document.controllerRevision, document.leaseRevision].every(value => Number.isSafeInteger(value) && value >= 1)
        || !Number.isFinite(Date.parse(document.expiresAt))) throw Error('job_corrupt');
    snapshotRequest(document.request);
    return {document, inputSequence: Number(row.input_sequence), acknowledgedInputSequence: Number(row.acknowledged_input_sequence),
      outputSequence: Number(row.output_sequence), output: String(row.output_tail), outputBytes: Number(row.output_bytes), truncated: row.output_truncated === 1};
  }
  async function read(work: Sql, jobId: string) {
    if (!jobIdentity(jobId)) throw Error('invalid_input');
    const row = (await work.all('SELECT * FROM xiaozhi_jobs_v1 WHERE job_id=?', [jobId]))[0];
    if (!row) throw Error('not_found');
    return decode(row);
  }
  async function assertActor(work: Sql, record: TerminalJobRecord, actor: JobActor, controller = true) {
    const doc = record.document;
    const sessionId = actor.kind === 'teacher' ? actor.sessionId : actor.owner.sessionId;
    if (doc.sessionId !== sessionId) throw Error('permission_denied');
    const session = (await work.all('SELECT archived_at FROM ai_conversation_sessions WHERE id=?', [sessionId]))[0];
    if (!session || session.archived_at) throw Error('permission_denied');
    const row = (await work.all('SELECT value_json FROM app_settings WHERE key=?', ['xiaozhi.task.v1:' + doc.taskId]))[0];
    const task = row ? JSON.parse(String(row.value_json)).view : null;
    if (!task || task.sessionId !== sessionId || task.requirementsVersion !== doc.request.requirementsVersion
        || ['ended', 'completed'].includes(task.state)) throw Error('permission_denied');
    if (actor.kind === 'teacher') {
      if (controller && doc.controller.kind !== 'teacher') throw Error('changed');
      return;
    }
    if (actor.owner.taskId !== doc.taskId || task.state !== 'active' || !sameOwner({...task.binding, taskId: doc.taskId}, actor.owner)) throw Error('permission_denied');
    const current = (await work.all(`SELECT r.status FROM xiaozhi_event_owners o JOIN xiaozhi_event_runs r ON r.run_id=o.run_id
      WHERE o.session_id=? AND o.run_id=? AND o.generation=?`, [sessionId, actor.owner.runId, actor.owner.generation]))[0];
    if (!current || current.status !== 'running' || controller && (doc.controller.kind !== 'agent' || !sameOwner(doc.controller.owner, actor.owner))) throw Error('permission_denied');
  }
  function expected(record: TerminalJobRecord, ref: TerminalJobRef) {
    const doc = record.document;
    if (doc.sessionId !== ref.sessionId || doc.revision !== ref.expectedRevision || doc.controllerRevision !== ref.expectedControllerRevision
        || doc.leaseRevision !== ref.expectedLeaseRevision) throw Error('changed');
  }
  async function save(work: Sql, previous: TerminalJobRecord, next: TerminalJobDocument) {
    if (!work.change) throw Error('job_transaction_required');
    next.revision = previous.document.revision + 1;
    next.updatedAt = new Date().toISOString();
    const raw = JSON.stringify(next);
    if (Buffer.byteLength(raw) > 1048576) throw Error('job_bounds');
    const changed = await work.change(`UPDATE xiaozhi_jobs_v1 SET revision=?,controller_revision=?,lease_revision=?,state=?,document_json=?,updated_at=?
      WHERE job_id=? AND revision=? AND document_json=?`,
    [next.revision, next.controllerRevision, next.leaseRevision, next.state, raw, next.updatedAt,
      previous.document.jobId, previous.document.revision, JSON.stringify(previous.document)]);
    if (changed !== 1) throw Error('job_revision_conflict');
    return {...previous, document: structuredClone(next)};
  }
  return {
    async migrate() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_jobs_v1(job_id TEXT PRIMARY KEY,schema_version INTEGER NOT NULL DEFAULT 1,
        session_id TEXT NOT NULL,task_id TEXT NOT NULL,origin_run_id TEXT NOT NULL,call_id TEXT NOT NULL,effect_id TEXT NOT NULL,
        revision INTEGER NOT NULL,controller_revision INTEGER NOT NULL,lease_revision INTEGER NOT NULL,state TEXT NOT NULL,
        document_json TEXT NOT NULL,input_sequence INTEGER NOT NULL DEFAULT 0,acknowledged_input_sequence INTEGER NOT NULL DEFAULT 0,
        output_sequence INTEGER NOT NULL DEFAULT 0,output_tail TEXT NOT NULL DEFAULT '',output_bytes INTEGER NOT NULL DEFAULT 0,output_truncated INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(session_id,origin_run_id,call_id),
        FOREIGN KEY(effect_id) REFERENCES xiaozhi_effects_v1(effect_id))`);
      await sql.run('CREATE INDEX IF NOT EXISTS xiaozhi_jobs_task_v1 ON xiaozhi_jobs_v1(session_id,task_id,state)');
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_job_output_v1(job_id TEXT NOT NULL,sequence INTEGER NOT NULL,
        reset INTEGER NOT NULL,output TEXT NOT NULL,PRIMARY KEY(job_id,sequence),FOREIGN KEY(job_id) REFERENCES xiaozhi_jobs_v1(job_id))`);
      if (!(await sql.all('PRAGMA table_info(xiaozhi_jobs_v1)')).some(row => row.name === 'output_truncated')) {
        await sql.run('ALTER TABLE xiaozhi_jobs_v1 ADD COLUMN output_truncated INTEGER NOT NULL DEFAULT 0');
      }
    },
    get: (jobId: string) => read(sql, jobId),
    async authorize(ref: TerminalJobRef, actor: JobActor, controller = true) {
      const record = await read(sql, ref.jobId);
      expected(record, ref);
      await assertActor(sql, record, actor, controller);
      if (!live(record.document.state)) throw Error('closed');
      return record;
    },
    async list(sessionId: string, taskId?: string) {
      return (await sql.all(`SELECT * FROM xiaozhi_jobs_v1 WHERE session_id=? AND (? IS NULL OR task_id=?)
        ORDER BY CASE WHEN state IN ('starting','running') THEN 0 ELSE 1 END,created_at DESC,job_id DESC LIMIT 256`,
      [sessionId, taskId || null, taskId || null])).map(decode);
    },
    async active(sessionId: string, taskId?: string) {
      return (await sql.all(`SELECT * FROM xiaozhi_jobs_v1 WHERE session_id=? AND state IN ('starting','running')
        AND (? IS NULL OR task_id=?) ORDER BY created_at,job_id`, [sessionId, taskId || null, taskId || null])).map(decode);
    },
    async recoverable() {
      return (await sql.all(`SELECT * FROM xiaozhi_jobs_v1 WHERE state='interrupted'
        AND json_extract(document_json,'$.cleanup')='needs_check' ORDER BY created_at,job_id`)).map(decode);
    },
    async pendingCompletion(sessionId:string,taskId?:string){
      return (await sql.all(`SELECT job.job_id FROM xiaozhi_jobs_v1 job WHERE job.session_id=? AND (? IS NULL OR job.task_id=?)
        AND (job.state IN ('starting','running') OR json_extract(job.document_json,'$.cleanup')!='complete'
          OR EXISTS(SELECT 1 FROM xiaozhi_effects_v1 effect WHERE effect.session_id=job.session_id AND effect.task_id=job.task_id
            AND json_extract(effect.document_json,'$.execution.jobId')=job.job_id AND effect.state IN ('intent','executing','unknown'))) LIMIT 1`,
      [sessionId,taskId||null,taskId||null])).length>0;
    },
    recovered(jobId: string, revision: number) {
      return transaction(async work => {
        const record = await read(work, jobId);
        if(record.document.state!=='interrupted'||record.document.revision!==revision||record.document.cleanup!=='needs_check')throw Error('job_revision_conflict');
        const next=structuredClone(record.document);
        next.cleanup='complete';next.projectionState='needs_check';next.notice='needs_check';
        return save(work,record,next);
      });
    },
    create(document: TerminalJobDocument) {
      return transaction(async work => {
        if (!jobIdentity(document.jobId) || document.revision !== 1 || document.leaseRevision !== 1 || document.controllerRevision !== 1) throw Error('invalid_input');
        const current = (await work.all('SELECT run_id,generation FROM xiaozhi_event_owners WHERE session_id=?', [document.sessionId]))[0];
        if (!current || current.run_id !== document.origin.runId || current.generation !== document.origin.generation) throw Error('event_owner_stale');
        const effect = (await work.all('SELECT task_id,run_id,call_id FROM xiaozhi_effects_v1 WHERE effect_id=?', [document.effectId]))[0];
        if (!effect || effect.task_id !== document.taskId || effect.run_id !== document.origin.runId || effect.call_id !== document.callId) throw Error('effect_revision_conflict');
        const raw = JSON.stringify(document);
        await work.run(`INSERT INTO xiaozhi_jobs_v1(job_id,session_id,task_id,origin_run_id,call_id,effect_id,revision,controller_revision,
          lease_revision,state,document_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [document.jobId, document.sessionId, document.taskId, document.origin.runId, document.callId, document.effectId,
          1, 1, 1, document.state, raw, document.createdAt, document.updatedAt]);
        return read(work, document.jobId);
      });
    },
    async permissionCurrent(binding: JobPermissionBinding, request: PermissionRequest) {
      try {
        const record = await read(sql, binding.jobId), doc = record.document;
        if (!live(doc.state) || doc.leaseRevision !== binding.leaseRevision
            || permissionHash(doc.request) !== permissionHash(request) || binding.approvalId !== doc.decision.approvalId) return false;
        await assertActor(sql, record, {kind: 'teacher', sessionId: doc.sessionId}, false);
        return true;
      } catch {return false;}
    },
    async assertEffect(work: Sql, authority: Extract<EffectAuthority, {kind: 'job'}>, effect: EffectRecord | EffectIntent) {
      const record = await read(work, authority.jobId), doc = record.document;
      if (doc.sessionId !== effect.owner.sessionId || doc.taskId !== effect.owner.taskId || doc.leaseRevision !== authority.leaseRevision
          || doc.controllerRevision !== authority.controllerRevision) throw Error('permission_denied');
      // A late receipt records an already-admitted command after terminal cleanup. It grants no new I/O.
      const terminalReceipt = 'state' in effect && ['executing', 'unknown'].includes(effect.state)
        && effect.target === doc.jobId && effect.execution?.jobId === doc.jobId
        && ['job_input', 'job_eof', 'job_resize', 'job_input_close', 'job_close'].includes(effect.operation);
      if (!live(doc.state) && !terminalReceipt) throw Error('permission_denied');
    },
    mutate(ref: TerminalJobRef, actor: JobActor, action: (document: TerminalJobDocument) => void, control = true) {
      return transaction(async work => {
        const record = await read(work, ref.jobId);
        expected(record, ref);
        await assertActor(work, record, actor, control);
        const next = structuredClone(record.document);
        action(next);
        return save(work, record, next);
      });
    },
    capture(jobId: string, leaseRevision: number, action: (document: TerminalJobDocument) => void) {
      return transaction(async work => {
        const record = await read(work, jobId);
        if (record.document.leaseRevision !== leaseRevision || !live(record.document.state)) throw Error('job_revision_conflict');
        const next = structuredClone(record.document);
        action(next);
        return save(work, record, next);
      });
    },
    output(jobId: string, leaseRevision: number, value: {text: string; bytes: number; truncated: boolean; append?: string}) {
      return transaction(async work => {
        const record = await read(work, jobId);
        if (record.document.leaseRevision !== leaseRevision || !live(record.document.state) || !Number.isSafeInteger(value.bytes) || value.bytes < 0) throw Error('job_revision_conflict');
        await work.run(`UPDATE xiaozhi_jobs_v1 SET output_sequence=output_sequence+1,output_tail=?,output_bytes=output_bytes+?,output_truncated=? WHERE job_id=?`,
          [value.text.slice(-32768), value.bytes, value.truncated || record.truncated ? 1 : 0, jobId]);
        const append = value.append !== undefined && value.append.length <= 32768;
        const sequence = record.outputSequence + 1;
        await work.run('INSERT INTO xiaozhi_job_output_v1(job_id,sequence,reset,output) VALUES(?,?,?,?)',
          [jobId, sequence, append ? 0 : 1, append ? value.append! : value.text.slice(-32768)]);
        await work.run('DELETE FROM xiaozhi_job_output_v1 WHERE job_id=? AND sequence<=?', [jobId, sequence - 64]);
        return read(work, jobId);
      });
    },
    async readOutput(record: TerminalJobRecord, sinceSequence: number) {
      if (sinceSequence === record.outputSequence) return {sequence: record.outputSequence, reset: false, output: '', hasMore: false};
      const rows = await sql.all('SELECT sequence,reset,output FROM xiaozhi_job_output_v1 WHERE job_id=? AND sequence>? AND sequence<=? ORDER BY sequence LIMIT 64',
        [record.document.jobId, sinceSequence, record.outputSequence]);
      const reset = !rows.length || Number(rows[0].sequence) !== sinceSequence + 1
        || Number(rows.at(-1)?.sequence) !== record.outputSequence || rows.some(row => row.reset === 1)
        || rows.reduce((total, row) => total + String(row.output).length, 0) > 262144;
      return {sequence: record.outputSequence, reset, output: reset ? record.output : rows.map(row => String(row.output)).join(''), hasMore: false};
    },
    reserveInput(ref: TerminalJobRef, actor: JobActor, effectId: string) {
      return transaction(async work => {
        const record = await read(work, ref.jobId);
        expected(record, ref);
        await assertActor(work, record, actor);
        if (!live(record.document.state) || record.document.inputClosed) throw Error('closed');
        const effect = (await work.all('SELECT state,document_json FROM xiaozhi_effects_v1 WHERE effect_id=?', [effectId]))[0];
        if (!effect || effect.state !== 'intent') throw Error('effect_revision_conflict');
        const intent = JSON.parse(String(effect.document_json)) as EffectRecord;
        if (intent.target !== ref.jobId || intent.commandId !== ref.commandId || intent.owner.taskId !== record.document.taskId) throw Error('permission_denied');
        const sequence = record.inputSequence + 1;
        await work.run('UPDATE xiaozhi_jobs_v1 SET input_sequence=? WHERE job_id=? AND input_sequence=?', [sequence, ref.jobId, record.inputSequence]);
        return {record: await read(work, ref.jobId), sequence};
      });
    },
    acknowledge(jobId: string, leaseRevision: number, sequence: number) {
      return transaction(async work => {
        const record = await read(work, jobId);
        if (record.document.leaseRevision !== leaseRevision || sequence !== record.acknowledgedInputSequence + 1 || sequence > record.inputSequence) throw Error('input_sequence');
        await work.run('UPDATE xiaozhi_jobs_v1 SET acknowledged_input_sequence=? WHERE job_id=?', [sequence, jobId]);
        return read(work, jobId);
      });
    },
    async recover() {
      return transaction(async work => {
        const rows = await work.all("SELECT * FROM xiaozhi_jobs_v1 WHERE state IN ('starting','running','interrupted') ORDER BY created_at");
        for (const row of rows) {
          const record = decode(row);
          const effects=createEffectState({...work,transaction:action=>action(work)});
          const effect=await effects.get(record.document.effectId);
          if(effect&&['intent','executing'].includes(effect.state)){
            if(!sameOwner(effect.owner,record.document.origin))throw Error('effect_revision_conflict');
            await effects.transition(effect.id,effect.revision,'unknown',{kind:'recovery',sessionId:record.document.sessionId,taskId:record.document.taskId});
          }
          if(live(record.document.state)){
            const next = structuredClone(record.document);
            next.state = 'interrupted'; next.cleanup = 'needs_check'; next.notice = 'interrupted';
            next.controllerRevision++; next.leaseRevision++;
            await save(work, record, next);
          }
        }
      });
    },
  };
}
