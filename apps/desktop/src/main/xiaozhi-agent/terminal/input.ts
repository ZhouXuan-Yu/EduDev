import type {TerminalInputAck, TerminalJobRef, TerminalWriteResult} from '../../../shared/xiaozhi-terminal-jobs';
import type {Sql} from '../session-state';
import type {EffectAuthority, EffectIntent, EffectRecord} from '../effects/types';
import {createEffectState} from '../effects/state';
import {protocolHash} from '../capabilities/validation';
import {createTerminalJobState} from './job-state';
import type {JobActor, TerminalJobRecord} from './job-types';
import type {TerminalLifecycle} from './lifecycle';
import {terminalEofBytes} from './shell-startup';

const inline = (work: Sql): Sql => ({...work, transaction: action => action(work)});
const jobAuthority = (record: TerminalJobRecord): EffectAuthority => ({kind: 'job', jobId: record.document.jobId,
  leaseRevision: record.document.leaseRevision, controllerRevision: record.document.controllerRevision});

/** Only main holds this object. Renderer commands supply identifiers and CAS references. */
export function createTerminalInput(sql: Sql, lifecycle: TerminalLifecycle) {
  const {jobs, effects} = lifecycle;
  async function intent(work: Sql, record: TerminalJobRecord, ref: TerminalJobRef, actor: JobActor,
    operation: string, digest: string, callId?: string) {
    const state = createEffectState(inline(work), {assertJob: jobs.assertEffect});
    const parent = actor.kind === 'agent' && callId ? await state.byCall(actor.owner.runId, callId) : null;
    if (actor.kind === 'agent' && !parent) throw Error('tool_receipt_conflict');
    const owner = parent?.owner || record.document.origin;
    const lease = lifecycle.entry(ref.jobId)?.lease;
    const base = parent?.contract || record.document.contract;
    const contract = {...base, inputDigest: digest, target: ref.jobId,
      grantRefs: lease?.authority.decision.grantRefs || base.grantRefs,
      authorityRefs: [...new Set([...base.authorityRefs, 'job-lease:' + ref.jobId + ':' + record.document.leaseRevision])]};
    const input: EffectIntent = {owner, callId: parent?.callId || record.document.callId, commandId: ref.commandId,
      tool: parent?.tool || 'terminal.teacher', operation,
      idempotencyKey: protocolHash(['job_command', ref.jobId, ref.commandId]),
      receipt: parent?.receipt || {runId: record.document.origin.runId, callId: record.document.callId},
      contract, target: ref.jobId, targetVersion: String(record.document.leaseRevision)};
    const created = await state.intent(input, jobAuthority(record));
    if (created.record.operation !== operation || created.record.contract.inputDigest !== digest) throw Error('effect_idempotency_conflict');
    return {state, ...created};
  }
  function ack(record: TerminalJobRecord, effect: EffectRecord): TerminalInputAck {
    const sequence = effect.execution?.inputSequence || 0;
    return {jobId: record.document.jobId, commandId: effect.commandId, sequence,
      state: sequence > 0 && record.acknowledgedInputSequence >= sequence ? 'acknowledged' : 'unknown'};
  }
  async function settled(effectId: string, operation: string, value: unknown) {
    const effect = await effects.get(effectId);
    if (!effect || !['executing', 'unknown'].includes(effect.state)) return;
    const record = await jobs.get(effect.target!);
    const digest = protocolHash(value);
    await effects.transition(effect.id, effect.revision, effect.state === 'unknown' ? 'reconciled' : 'committed', jobAuthority(record), {
      outcome: {digest, references: ['job:' + record.document.jobId],
        ...(effect.execution?.inputSequence ? {acknowledgedInputSequence: effect.execution.inputSequence} : {})},
      proofs: [{kind: operation === 'job_input' || operation === 'job_eof' ? 'job_input' : 'terminal',
        reference: 'job:' + record.document.jobId + ':' + effect.commandId, digest}],
    });
  }
  async function unknown(effectId: string) {
    const effect = await effects.get(effectId);
    if (!effect || effect.state !== 'executing') return;
    const record = await jobs.get(effect.target!);
    await effects.transition(effect.id, effect.revision, 'unknown', jobAuthority(record));
    if (['starting', 'running'].includes(record.document.state)) {
      lifecycle.notify(await jobs.capture(record.document.jobId, record.document.leaseRevision, doc => {doc.notice = 'unknown_ack';}));
    }
  }
  async function write(ref: TerminalJobRef, actor: JobActor, bytes: Buffer, eof: boolean, callId?: string): Promise<TerminalWriteResult> {
    const entry = lifecycle.entry(ref.jobId);
    if (!entry?.handle || !entry.lease) throw Error('closed');
    if (entry.inputQueued >= 4) throw Error('input_backpressure');
    entry.inputQueued++;
    const operation = eof ? 'job_eof' : 'job_input';
    const run = async () => {
      await entry.lease!.authority.assert();
      let effect!: EffectRecord;
      let sequence = 0;
      let duplicate = false;
      await sql.transaction!(async work => {
        const scopedJobs = createTerminalJobState(inline(work));
        const record = await scopedJobs.authorize(ref, actor);
        if (Date.parse(record.document.expiresAt) <= Date.now()) throw Error('expired');
        const scopedEffects = createEffectState(inline(work), {assertJob: scopedJobs.assertEffect});
        const prior = await scopedEffects.byCommand(ref.sessionId, ref.jobId, ref.commandId);
        if (record.document.notice === 'unknown_ack' && record.acknowledgedInputSequence < record.inputSequence && !prior) throw Error('unknown_ack');
        const created = await intent(work, record, ref, actor, operation, protocolHash(bytes.toString('base64')), callId);
        effect = created.record;
        if (!created.created) {duplicate = true; return;}
        const reserved = await scopedJobs.reserveInput(ref, actor, effect.id);
        sequence = reserved.sequence;
        effect = await created.state.transition(effect.id, effect.revision, 'executing', jobAuthority(record), {
          execution: {id: ref.commandId, jobId: ref.jobId, leaseId: ref.jobId + ':' + ref.expectedLeaseRevision, inputSequence: sequence},
        });
      });
      if (duplicate) {
        const record = await jobs.get(ref.jobId);
        return {job: lifecycle.view(record), ack: ack(record, effect)};
      }
      try {
        await entry.lease!.authority.assert();
        const current = await jobs.get(ref.jobId);
        // A newer controller may cancel an admitted block before the helper receives it.
        if (current.document.controllerRevision !== ref.expectedControllerRevision || current.document.leaseRevision !== ref.expectedLeaseRevision) throw Error('changed');
        const received = await entry.handle!.write({sequence, bytes});
        if (received.sequence !== sequence) throw Error('unknown_ack');
        await jobs.acknowledge(ref.jobId, entry.leaseRevision, sequence);
        await settled(effect.id, operation, {jobId: ref.jobId, commandId: ref.commandId, sequence});
        const record = await jobs.get(ref.jobId);
        lifecycle.notify(record);
        return {job: lifecycle.view(record), ack: ack(record, effect)};
      } catch {
        await unknown(effect.id).catch(() => undefined);
        const record = await jobs.get(ref.jobId);
        return {job: lifecycle.view(record), ack: ack(record, effect)};
      }
    };
    const pending = entry.inputLane.then(run);
    entry.inputLane = pending.catch(() => undefined);
    try {return await pending;}
    finally {entry.inputQueued--;}
  }
  async function control(ref: TerminalJobRef, actor: JobActor, operation: 'job_resize' | 'job_input_close' | 'job_close',
    value: {cols: number; rows: number} | null, callId?: string) {
    const entry = lifecycle.entry(ref.jobId);
    if (!entry?.handle || !entry.lease) throw Error('closed');
    if (operation !== 'job_close') await entry.lease.authority.assert();
    const prepared = await sql.transaction!(async work => {
      const record = await createTerminalJobState(inline(work)).authorize(ref, actor, operation !== 'job_close');
      return {...await intent(work, record, ref, actor, operation, protocolHash(value), callId), job: record};
    });
    if (!prepared.created) return lifecycle.view(await jobs.get(ref.jobId));
    const effect = await effects.transition(prepared.record.id, prepared.record.revision, 'executing', jobAuthority(prepared.job),
      {execution: {id: ref.commandId, jobId: ref.jobId, leaseId: ref.jobId + ':' + ref.expectedLeaseRevision}});
    try {
      await jobs.authorize(ref, actor, operation !== 'job_close');
      if (operation === 'job_resize') await entry.handle.resize({controlId: ref.commandId, ...value!});
      if (operation === 'job_input_close') {
        // EOF is a separate input frame. This closes the physical channel after its admitted frames drain.
        lifecycle.notify(await jobs.mutate(ref, actor, doc => {doc.inputClosed = true;}));
        await entry.inputLane;
        await entry.lease.authority.assert();
        entry.handle.closeInput();
      }
      if (operation === 'job_close') {
        entry.handle.cancel('cancelled');
        await entry.closed;
      }
      await settled(effect.id, operation, {jobId: ref.jobId, operation, value});
      return lifecycle.view(await jobs.get(ref.jobId));
    } catch (error) {
      await unknown(effect.id).catch(() => undefined);
      throw error;
    }
  }
  return {
    write: (ref: TerminalJobRef, actor: JobActor, chars: string, callId?: string) => write(ref, actor, Buffer.from(chars, 'utf8'), false, callId),
    eof: (ref: TerminalJobRef, actor: JobActor, callId?: string) => write(ref, actor, terminalEofBytes(), true, callId),
    resize: (ref: TerminalJobRef, actor: JobActor, value: {cols: number; rows: number}, callId?: string) => control(ref, actor, 'job_resize', value, callId),
    closeInput: (ref: TerminalJobRef, actor: JobActor, callId?: string) => control(ref, actor, 'job_input_close', null, callId),
    close: (ref: TerminalJobRef, actor: JobActor, callId?: string) => control(ref, actor, 'job_close', null, callId),
    async readAck(record: TerminalJobRecord, commandId: string) {
      const effect = await effects.byCommand(record.document.sessionId, record.document.jobId, commandId);
      return effect && ['job_input', 'job_eof'].includes(effect.operation) ? ack(record, effect) : undefined;
    },
  };
}
