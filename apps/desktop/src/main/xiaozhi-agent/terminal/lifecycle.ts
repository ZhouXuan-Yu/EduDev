import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import type {PermissionOwner, PermissionRequest} from '../../../shared/xiaozhi-permissions';
import type {TerminalUpdate} from '../../../shared/xiaozhi-terminal-jobs';
import type {AcquisitionContext} from '../capabilities/acquisition/service';
import type {Sql} from '../session-state';
import type {PermissionService} from '../permissions/service';
import type {PermissionStore} from '../permissions/store';
import type {PermissionRuntimeManager} from '../permissions/windows/runtime';
import {currentPermission} from '../permissions/current';
import {openPermissionLease} from '../permissions/lease';
import {prepareExecutionProjection, commitExecutionProjection, removeOwnedProjection} from '../permissions/windows/projection';
import {runNativeSandbox, type SandboxResult} from '../permissions/windows/launcher';
import {permissionHash} from '../permissions/validation';
import {createTerminalJobState} from './job-state';
import {createEffectState} from '../effects/state';
import {createControlledTerminalBackend} from './controlled-backend';
import type {ControlledTerminalHandle} from './controlled-types';
import type {TerminalJobRecord} from './job-types';
import {terminalShellArguments} from './shell-startup';
import {terminalJobView} from './presentation';
import {recoverTerminalResources} from './recovery';
import {sealTerminalNotStarted, TerminalNotStartedError} from './not-started';

export type TerminalEntry = {
  jobId: string;
  sessionId: string;
  leaseRevision: number;
  controller: AbortController;
  leaseAbort: AbortController;
  handle?: ControlledTerminalHandle;
  lease?: Awaited<ReturnType<typeof openPermissionLease>>;
  raw: string;
  publicTail: string;
  bytes: number;
  truncated: boolean;
  decoder: StringDecoder;
  flushTimer?: ReturnType<typeof setTimeout>;
  outputLane: Promise<void>;
  inputLane: Promise<unknown>;
  inputQueued: number;
  started: Promise<void>;
  closed: Promise<void>;
};

export function createTerminalLifecycle(options: {
  sql: Sql;
  permissions: PermissionService;
  permissionStore: PermissionStore;
  runtime: PermissionRuntimeManager;
  current: (sessionId: string, callId: string) => Promise<AcquisitionContext>;
  workspace: (sessionId: string) => Promise<string>;
  sanitize: (text: string) => Promise<string>;
  emit: (event: TerminalUpdate) => void;
}) {
  const jobs = createTerminalJobState(options.sql);
  const effects = createEffectState(options.sql, {assertJob: jobs.assertEffect});
  const entries = new Map<string, TerminalEntry>();
  const pendingStarts = new Map<string, string>();
  let closing = false;
  const view = (record: TerminalJobRecord) => {
    const entry = entries.get(record.document.jobId);
    return terminalJobView(record, {live: !!entry, authorized: !!entry?.lease && !entry.lease.authority.signal.aborted});
  };
  function notify(record: TerminalJobRecord) {options.emit({sessionId: record.document.sessionId, job: view(record)});}
  const recoveryAbort=new AbortController();
  const recovery=recoverTerminalResources({jobs,runtime:options.runtime,store:options.permissionStore,notify,signal:recoveryAbort.signal});
  void recovery.catch(()=>undefined);
  function flush(entry: TerminalEntry, force = false) {
    clearTimeout(entry.flushTimer); entry.flushTimer = undefined;
    if (!entry.bytes && !force) return entry.outputLane;
    const raw = entry.raw, bytes = entry.bytes, truncated = entry.truncated;
    entry.raw = raw.slice(-32768);
    entry.bytes = 0;
    entry.outputLane = entry.outputLane.then(async () => {
      const full = await options.sanitize(raw);
      const text = (await options.sanitize(raw.slice(-32768))).slice(-32768);
      const append = full.startsWith(entry.publicTail) && full.slice(-32768) === text ? full.slice(entry.publicTail.length) : undefined;
      entry.publicTail = text;
      notify(await jobs.output(entry.jobId, entry.leaseRevision, {text, bytes, truncated, append}));
    });
    void entry.outputLane.catch(() => entry.controller.abort('cancelled'));
    return entry.outputLane;
  }
  async function finish(entry: TerminalEntry, closed: ControlledTerminalHandle['closed']) {
    let result: SandboxResult | undefined;
    let failure: unknown;
    let projectionState: TerminalJobRecord['document']['projectionState'] = 'needs_check';
    let committed: string[] = [];
    try {
      const terminal = await closed;
      result = terminal.result;
      const snapshot = await jobs.get(entry.jobId);
      await options.permissionStore.audit(snapshot.document.sessionId, 'terminal_job_terminal', entry.jobId, {
        owner: snapshot.document.origin, executionId: snapshot.document.projection.executionId, helperHash: terminal.helperHash,
        runtimeVersion: snapshot.document.runtime.version, result,
      });
      await entry.inputLane.catch(() => undefined);
      const tail = entry.decoder.end();
      if (tail) entry.raw = (entry.raw + tail).slice(-65536);
      await flush(entry, !!tail);
      const record = await jobs.get(entry.jobId);
      if (!entry.lease) throw Error('permission_denied');
      await entry.lease.authority.assert();
      const change = await commitExecutionProjection(record.document.projection, entry.lease.authority, options.permissionStore);
      committed = change.committed;
      projectionState = 'committed';
      const effect = await effects.get(record.document.effectId);
      if (effect?.state === 'executing') {
        await effects.transition(effect.id, effect.revision, 'committed', {kind: 'job', jobId: entry.jobId,
          leaseRevision: entry.leaseRevision, controllerRevision: record.document.controllerRevision}, {
          outcome: {digest: permissionHash({result, changes: change.changes}), references: ['job:' + entry.jobId, ...committed]},
          proofs: [{kind: 'terminal', reference: 'job:' + entry.jobId, digest: permissionHash({result, changes: change.changes})}],
        });
      }
      removeOwnedProjection(record.document.projection.root);
    } catch (error) {
      failure = error;
      try {
        const record = await jobs.get(entry.jobId);
        const effect = await effects.get(record.document.effectId);
        if (effect && ['intent', 'executing'].includes(effect.state)) {
          await effects.transition(effect.id, effect.revision, 'unknown', {kind: 'job', jobId: entry.jobId,
            leaseRevision: entry.leaseRevision, controllerRevision: record.document.controllerRevision});
        }
      } catch {/* Preserve the original terminal failure and its unresolved receipt. */}
    }
    finally {
      clearTimeout(entry.flushTimer);
      await entry.outputLane.catch(error => {failure ||= error;});
      await entry.lease?.close(failure instanceof Error ? failure : undefined).catch(error => {failure ||= error;});
      try {
        const state = result?.state || (entry.controller.signal.aborted ? 'cancelled' : 'failed');
        const record = await jobs.capture(entry.jobId, entry.leaseRevision, doc => {
          doc.state = state === 'completed' && result?.exitCode !== 0 ? 'failed' : state;
          doc.inputClosed = true; doc.cleanup = result && projectionState === 'committed' ? 'complete' : 'needs_check';
          doc.projectionState = projectionState; doc.committed = committed;
          if (result?.exitCode !== null && result?.exitCode !== undefined) doc.exitCode = result.exitCode;
          if (result) doc.durationMs = result.durationMs;
          if (result?.error === 'system_disk_full') doc.notice = 'system_disk_full';
          else if (failure) doc.notice = 'needs_check';
          doc.leaseRevision++; doc.controllerRevision++;
        });
        notify(record);
      } finally {entries.delete(entry.jobId);}
    }
  }
  return {
    jobs, effects, view, notify,
    entry: (jobId: string) => entries.get(jobId),
    async permissionCurrent(binding: {jobId: string; leaseRevision: number; approvalId?: string}, request: PermissionRequest) {
      const entry = entries.get(binding.jobId);
      if (!entry || entry.leaseAbort.signal.aborted || entry.leaseRevision !== binding.leaseRevision) return false;
      if (!await jobs.permissionCurrent(binding, request)) return false;
      const record = await jobs.get(binding.jobId);
      try {return permissionHash(await options.workspace(request.owner.sessionId)) === permissionHash(record.document.projection.originalRoot);}
      catch {return false;}
    },
    async start(sessionId: string, callId: string, input: {cmd: string; workdir?: string; tty?: boolean; background?: boolean; lease_ms?: number}) {
      if (closing || process.platform !== 'win32') throw Error('unavailable');
      const context = await options.current(sessionId, callId);
      const authority = currentPermission();
      if (!authority || authority.request.action !== 'exec_command' || permissionHash(authority.request.owner) !== permissionHash(context.owner)) throw Error('permission_denied');
      await authority.assert();
      const activeIds = new Set((await jobs.active(sessionId)).map(record => record.document.jobId));
      for(const [id, session] of pendingStarts)if(session===sessionId)activeIds.add(id);
      for(const entry of entries.values())if(entry.sessionId===sessionId)activeIds.add(entry.jobId);
      if(new Set([...entries.keys(),...pendingStarts.keys()]).size>=16||activeIds.size>=4)throw Error('resource_busy');
      const jobId='term_'+randomUUID();
      pendingStarts.set(jobId,sessionId);
      try{
      if ((await options.runtime.inspect()).status !== 'ready') {
        try {
          await options.runtime.prepare(authority, options.runtime.recipe().sha256);
        } catch (error) {
          if (error instanceof Error && error.message === 'system_disk_full') {
            const sealed = await context.persist(async () => {
              await authority.assert();
              return sealTerminalNotStarted(options.sql, context.owner, callId);
            });
            if (sealed) throw new TerminalNotStartedError();
          }
          throw error;
        }
      }
      const runtime = await options.runtime.resolve(authority);
      const projection = await prepareExecutionProjection(context.workspace, input.workdir || '.', authority);
      const effect = await effects.byCall(context.owner.runId, callId);
      if (!effect || effect.state !== 'executing') {removeOwnedProjection(projection.root); throw Error('effect_revision_conflict');}
      const stamp = new Date().toISOString();
      const lifetime = Math.min(input.lease_ms || 86400000, Date.parse(authority.request.expiresAt) - Date.now());
      if (!Number.isSafeInteger(lifetime) || lifetime < 1000) {removeOwnedProjection(projection.root); throw Error('expired');}
      let record: TerminalJobRecord;
      try {record = await context.persist(() => jobs.create({schemaVersion: 1, jobId, sessionId, taskId: context.owner.taskId,
        revision: 1, controllerRevision: 1, leaseRevision: 1, origin: context.owner, callId, effectId: effect.id, contract: effect.contract,
        controller: {kind: 'agent', owner: context.owner}, request: authority.request, decision: authority.decision,
        runtime: {version: runtime.version, directory: runtime.directory, helperHash: runtime.manifest.helperSha256}, projection,
        command: '', cwd: '', state: 'starting', tty: input.tty === true, background: true, createdAt: stamp, updatedAt: stamp,
        expiresAt: new Date(Date.now() + lifetime).toISOString(), inputClosed: false, cleanup: 'pending', committed: [], projectionState: 'pending'}));}
      catch (error) {removeOwnedProjection(projection.root); throw error;}
      const entry: TerminalEntry = {jobId, sessionId, leaseRevision: 1, controller: new AbortController(), leaseAbort: new AbortController(), raw: '', publicTail: '', bytes: 0, truncated: false,
        decoder: new StringDecoder('utf8'), outputLane: Promise.resolve(), inputLane: Promise.resolve(), inputQueued: 0,
        started: Promise.resolve(), closed: Promise.resolve()};
      entries.set(jobId, entry);
      try {
        entry.lease = await openPermissionLease(options.permissions.engine, authority.request, entry.leaseAbort.signal,
          {jobId, leaseRevision: 1, ...(authority.decision.approvalId ? {approvalId: authority.decision.approvalId} : {})});
        entry.lease.authority.signal.addEventListener('abort', () => entry.controller.abort(entry.lease!.authority.signal.reason), {once: true});
        const command = (await options.sanitize(input.cmd)).slice(0, 16384);
        const cwd = (await options.sanitize(path.resolve(context.workspace, input.workdir || '.'))).slice(0, 4096);
        record = await jobs.capture(jobId, 1, doc => {doc.command = command; doc.cwd = cwd;});
        await options.sql.transaction!(async work => {
          const scoped = {...work, transaction: <T>(action: (sql: Sql) => Promise<T>) => action(work)};
          const state = createEffectState(scoped, {assertJob: jobs.assertEffect});
          const latest = await state.get(effect.id);
          if (!latest) throw Error('effect_revision_conflict');
          await state.updateExecution(effect.id, latest.revision, {id: projection.executionId, jobId, leaseId: jobId + ':1'},
            {kind: 'job', jobId, leaseRevision: 1, controllerRevision: record.document.controllerRevision});
        });
        const processScope = authority.request.scopes.find(scope => scope.kind === 'process');
        if (!processScope || processScope.kind !== 'process') throw Error('permission_denied');
        entry.handle = createControlledTerminalBackend({controller: entry.controller,
          onData(bytes) {
            const text = entry.decoder.write(bytes);
            entry.truncated ||= entry.raw.length + text.length > 32768;
            entry.raw = (entry.raw + text).slice(-65536); entry.bytes += bytes.length;
            entry.flushTimer ??= setTimeout(() => {void flush(entry).catch(() => undefined);}, 100);
          },
          launch: callbacks => runNativeSandbox({manifest: runtime.manifest, directory: runtime.directory,
            start: {schemaVersion: 1, type: 'start', executionId: projection.executionId, owner: context.owner,
              grantHash: authority.decision.permissionSnapshotHash, executable: processScope.executable, executableHash: processScope.executableHash,
              projectionRoot: projection.root, cwd: projection.cwd, command: '', env: {}, timeoutMs: lifetime,
              maxOutputBytes: 4194304, maxProcesses: 8, session: {schemaVersion: 1, mode: 'pty',
                cols: 100, rows: 30, arguments: terminalShellArguments({cwd: projection.cwd, root: projection.root,
                  command: input.tty === true ? input.cmd : input.cmd + '; $__xiaozhiOk=$?; if($null -ne $LASTEXITCODE){exit $LASTEXITCODE}; if($__xiaozhiOk){exit 0}else{exit 1}'}),
                maxInputBytes: 4194304, memoryBytes: 536870912, cpuRate: 5000, userTimeMs: 0, environment: {TERM: 'xterm-256color'}}},
            signal: entry.controller.signal, onSession: callbacks.onSession, onBytes: callbacks.onBytes,
            onStarted(pid, helperPid) {
              entry.started = jobs.capture(jobId, 1, doc => {doc.state = 'running'; doc.pid = pid; doc.helperPid = helperPid;}).then(next => {notify(next);});
              callbacks.onStarted(pid, helperPid);
            }}),
        });
        entry.closed = finish(entry, entry.handle.closed);
        void entry.closed.catch(() => undefined);
        await entry.handle.ready; await entry.started;
        return view(await jobs.get(jobId));
      } catch (error) {
        entry.controller.abort('cancelled');
        await entry.handle?.closed.catch(() => undefined);
        if (!entry.handle) {
          const current = await jobs.get(jobId);
          const latest = await effects.get(effect.id);
          if (latest && ['intent', 'executing'].includes(latest.state)) {
            await effects.transition(latest.id, latest.revision, 'failed', {kind: 'job', jobId,
              leaseRevision: 1, controllerRevision: current.document.controllerRevision}, {
              outcome: {digest: permissionHash(['not_delivered', jobId]), references: ['job:' + jobId], error: 'not_delivered'},
            }).catch(() => undefined);
          }
          await entry.lease?.close(error instanceof Error ? error : undefined).catch(() => undefined);
          removeOwnedProjection(projection.root);
          await jobs.capture(jobId, 1, doc => {doc.state = 'failed'; doc.cleanup = 'complete'; doc.projectionState = 'committed'; doc.leaseRevision++; doc.controllerRevision++;});
          entries.delete(jobId);
        }
        throw error;
      }
      }finally{pendingStarts.delete(jobId);}
    },
    async releaseRun(owner: PermissionOwner) {
      for (const entry of entries.values()) {
        const record = await jobs.get(entry.jobId);
        if (record.document.controller.kind !== 'agent' || permissionHash(record.document.controller.owner) !== permissionHash(owner)) continue;
        notify(await jobs.capture(entry.jobId, entry.leaseRevision, doc => {doc.controller = {kind: 'teacher'}; doc.controllerRevision++;}));
      }
    },
    async close() {
      closing = true;
      recoveryAbort.abort('app_shutdown');
      const active = [...entries.values()];
      for (const entry of active) entry.controller.abort('cancelled');
      await Promise.allSettled(active.map(entry => entry.closed));
      await recovery.catch(()=>undefined);
    },
  };
}
export type TerminalLifecycle = ReturnType<typeof createTerminalLifecycle>;
