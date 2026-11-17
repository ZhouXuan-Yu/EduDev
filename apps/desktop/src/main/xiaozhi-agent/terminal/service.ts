import {randomUUID} from 'node:crypto';
import type {TerminalJobRef, TerminalResult, XiaozhiTerminalApi} from '../../../shared/xiaozhi-terminal-jobs';
import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';
import {createTerminalLifecycle} from './lifecycle';
import {createTerminalInput} from './input';
import {terminalJobRef} from './presentation';
import {terminalError, validTerminalRead, validTerminalRef, validTerminalResize, validTerminalSession, validTerminalWrite} from './validation';
import type {JobActor} from './job-types';
import {permissionHash} from '../permissions/validation';

type Options = Parameters<typeof createTerminalLifecycle>[0] & {readable: (sessionId: string) => Promise<boolean>};

export function createTerminalService(options: Options) {
  const lifecycle = createTerminalLifecycle(options);
  const input = createTerminalInput(options.sql, lifecycle);
  const {jobs, view} = lifecycle;
  const teacher = (ref: TerminalJobRef): JobActor => ({kind: 'teacher', sessionId: ref.sessionId});
  async function readable(sessionId: string) {
    if (!validTerminalSession(sessionId)) throw Error('invalid_input');
    if (!await options.readable(sessionId)) throw Error('permission_denied');
  }
  async function readJob(sessionId: string, jobId: string) {
    await readable(sessionId);
    const record = await jobs.get(jobId);
    if (record.document.sessionId !== sessionId) throw Error('permission_denied');
    return record;
  }
  async function result<T>(action: () => Promise<T>): Promise<TerminalResult<T>> {
    try {return {ok: true, data: await action()};}
    catch (error) {return {ok: false, error: terminalError(error)};}
  }
  async function takeControl(ref: TerminalJobRef, actor: JobActor) {
    const entry = lifecycle.entry(ref.jobId);
    if (!entry?.lease) throw Error('closed');
    await entry.lease.authority.assert();
    const record = await jobs.mutate(ref, actor, doc => {
      if (actor.kind === 'teacher' && doc.controller.kind === 'agent') doc.blockedAgent = doc.controller.owner;
      if (actor.kind === 'agent' && doc.blockedAgent && permissionHash(doc.blockedAgent) === permissionHash(actor.owner)) throw Error('permission_denied');
      doc.controller = actor.kind === 'teacher' ? {kind: 'teacher'} : {kind: 'agent', owner: actor.owner};
      doc.controllerRevision++;
    }, false);
    lifecycle.notify(record);
    return view(record);
  }
  const api: Omit<XiaozhiTerminalApi, 'onXiaozhiTerminal'> = {
    listXiaozhiTerminals: sessionId => result(async () => {
      await readable(sessionId);
      return {sessionId, jobs: (await jobs.list(sessionId)).map(view)};
    }),
    readXiaozhiTerminal: request => result(async () => {
      if (!validTerminalRead(request)) throw Error('invalid_input');
      const record = await readJob(request.sessionId, request.jobId);
      const output = await jobs.readOutput(record, request.sinceSequence);
      return {sessionId: request.sessionId, job: view(record), ...output,
        ...(request.commandId ? {ack: await input.readAck(record, request.commandId)} : {})};
    }),
    writeXiaozhiTerminal: request => result(async () => {
      if (!validTerminalWrite(request)) throw Error('invalid_input');
      return input.write(request, teacher(request), request.chars);
    }),
    resizeXiaozhiTerminal: request => result(async () => {
      if (!validTerminalResize(request)) throw Error('invalid_input');
      return input.resize(request, teacher(request), {cols: request.cols, rows: request.rows});
    }),
    sendEofXiaozhiTerminal: request => result(async () => {
      if (!validTerminalRef(request)) throw Error('invalid_input');
      return input.eof(request, teacher(request));
    }),
    closeInputXiaozhiTerminal: request => result(async () => {
      if (!validTerminalRef(request)) throw Error('invalid_input');
      return input.closeInput(request, teacher(request));
    }),
    closeXiaozhiTerminal: request => result(async () => {
      if (!validTerminalRef(request)) throw Error('invalid_input');
      if (!lifecycle.entry(request.jobId)) {
        const record = await readJob(request.sessionId, request.jobId);
        const command = await lifecycle.effects.byCommand(request.sessionId, request.jobId, request.commandId);
        if (command?.operation === 'job_close') return view(record);
      }
      return input.close(request, teacher(request));
    }),
    takeControlXiaozhiTerminal: request => result(async () => {
      if (!validTerminalRef(request)) throw Error('invalid_input');
      return takeControl(request, teacher(request));
    }),
  };
  return {
    api, lifecycle,
    start: lifecycle.start,
    releaseRun: lifecycle.releaseRun,
    permissionCurrent: lifecycle.permissionCurrent,
    close: lifecycle.close,
    async permission(sessionId: string, taskId: string, jobId: string, owner?: PermissionOwner) {
      const record = await readJob(sessionId, jobId);
      if (record.document.taskId !== taskId) throw Error('permission_denied');
      if (owner && record.document.blockedAgent && permissionHash(record.document.blockedAgent) === permissionHash(owner)) throw Error('permission_denied');
      const lease = lifecycle.entry(jobId)?.lease;
      if (!lease) throw Error('closed');
      await lease.authority.assert();
      return lease.authority.decision;
    },
    async closeTask(sessionId: string, taskId?: string) {
      const active = (await jobs.active(sessionId, taskId))
        .map(record => lifecycle.entry(record.document.jobId)).filter(entry => !!entry);
      for (const entry of active) entry.handle?.cancel('cancelled');
      await Promise.allSettled(active.map(entry => entry.closed));
      if(await jobs.pendingCompletion(sessionId,taskId))throw Error('task_effect_recheck_required');
    },
    async agent(sessionId: string, callId: string, jobId: string) {
      const context = await options.current(sessionId, callId);
      const record = await readJob(sessionId, jobId);
      if (record.document.taskId !== context.owner.taskId) throw Error('permission_denied');
      const actor: JobActor = {kind: 'agent', owner: context.owner};
      const lease = lifecycle.entry(jobId)?.lease;
      if (!lease) throw Error('closed');
      await lease.authority.assert();
      await context.recordAuthority?.('job-lease:' + jobId + ':' + record.document.leaseRevision, lease.authority.decision.grantRefs, callId);
      const current = record.document.controller;
      if (current.kind !== 'agent' || current.owner.runId !== context.owner.runId || current.owner.generation !== context.owner.generation) {
        await takeControl(terminalJobRef(record, 'xicmd_' + randomUUID()), actor);
      }
      return {
        async write(commandId: string, chars: string) {
          const current = await jobs.get(jobId);
          return input.write(terminalJobRef(current, commandId), actor, chars, callId);
        },
        async close(commandId: string) {
          const current = await jobs.get(jobId);
          return input.close(terminalJobRef(current, commandId), actor, callId);
        },
        view: async () => view(await jobs.get(jobId)),
      };
    },
    async agentList(owner: PermissionOwner) {
      await readable(owner.sessionId);
      return (await jobs.list(owner.sessionId, owner.taskId)).map(view);
    },
  };
}
export type TerminalService = ReturnType<typeof createTerminalService>;
