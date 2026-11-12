import path from 'node:path';
import type {PowerShellOperations} from '@earendil-works/pi-coding-agent';
import {setTimeout as delay} from 'node:timers/promises';
import {currentPermission} from '../current';
import {permissionHash} from '../validation';
import {containsPath} from '../resources';
import type {PermissionStore} from '../store';
import type {PermissionRuntimeManager} from './runtime';
import {prepareExecutionProjection, commitExecutionProjection, removeOwnedProjection} from './projection';
import {runNativeSandbox, type SandboxStart} from './launcher';
import {createScriptNetworkSpool} from './broker';
import type {createPermissionNetworkBroker} from '../network';

export function createControlledPowerShellOperations(options: {
  runtime: PermissionRuntimeManager;
  store: PermissionStore;
  broker: ReturnType<typeof createPermissionNetworkBroker>;
}): PowerShellOperations {
  return {
    async exec(command, cwd, execution) {
      const startedAt = performance.now();
      const authority = currentPermission();
      if (!authority || authority.request.action !== 'exec_command') throw Error('permission_denied');
      await authority.assert();
      const processScope = authority.request.scopes.find(scope => scope.kind === 'process');
      if (!processScope || !containsPath(processScope.workspace, cwd)) throw Error('permission_denied');
      const configured = await options.runtime.inspect();
      if (configured.status === 'needs_configuration') {
        await options.runtime.prepare(authority, options.runtime.recipe().sha256);
      }
      const runtime = await options.runtime.resolve(authority);
      const runtimeReadyAt = performance.now();
      if (!runtime.manifest.runtimes.some(pin => pin.path === processScope.executable && pin.sha256 === processScope.executableHash)) throw Error('source_changed');
      const projection = await prepareExecutionProjection(processScope.workspace, path.relative(processScope.workspace, cwd), authority);
      const projectionReadyAt = performance.now();
      authority.execution = {id: projection.executionId, logicalCwd: cwd, physicalCwd: projection.cwd,
        helperHash: runtime.manifest.helperSha256, committed: [], excluded: projection.excluded};
      const spool = createScriptNetworkSpool(projection.root, authority, options.broker);
      const controller = new AbortController();
      const signal = AbortSignal.any([authority.signal, controller.signal, ...(execution.signal ? [execution.signal] : [])]);
      const start: SandboxStart = {
        schemaVersion: 1, type: 'start', executionId: projection.executionId, owner: authority.request.owner,
        grantHash: authority.decision.permissionSnapshotHash, executable: processScope.executable,
        executableHash: processScope.executableHash, projectionRoot: projection.root, cwd: projection.cwd,
        command: spool.prefix + command, env: {XIAOZHI_WORKSPACE: projection.root},
        timeoutMs: Math.min(120000, Math.max(1000, (execution.timeout || 60) * 1000)),
        maxOutputBytes: 1048576, maxProcesses: 16
      };
      // Raw scripts and credentials stay in memory. This receipt supports exact owned cleanup.
      const recovery = {...start, command: ''};
      await options.store.audit(authority.request.owner.sessionId, 'sandbox_execution_prepared', projection.executionId, {
        owner: authority.request.owner, runtimeVersion: runtime.version, helperHash: runtime.manifest.helperSha256,
        recovery, commandHash: permissionHash(command), grantRefs: authority.decision.grantRefs
      });
      let monitorStopped = false;
      const monitor = (async () => {
        while (!monitorStopped && !signal.aborted) {
          if (spool.failure) {controller.abort(); break;}
          await delay(25);
        }
      })();
      let cleaned = false;
      try {
        const receipt = await runNativeSandbox({manifest: runtime.manifest, directory: runtime.directory,
          start, signal, onData: execution.onData});
        cleaned = receipt.result.cleanup.profileRemoved && receipt.result.cleanup.remainingOwnedAces === 0
          && receipt.result.cleanup.jobActiveProcesses === 0;
        await options.store.audit(authority.request.owner.sessionId, 'sandbox_execution_finished', projection.executionId, {
          owner: authority.request.owner, state: receipt.result.state, exitCode: receipt.result.exitCode,
          cleanup: receipt.result.cleanup, runtimeVersion: runtime.version,
          timing: {runtimeResolutionMs: runtimeReadyAt - startedAt, projectionMs: projectionReadyAt - runtimeReadyAt,
            nativeMs: receipt.result.durationMs, elapsedMs: performance.now() - startedAt}
        });
        if (spool.failure) throw spool.failure;
        if (receipt.result.state === 'cancelled') throw Error('Command aborted');
        if (receipt.result.state === 'timed_out') throw Error('Command timed out');
        if (receipt.result.state !== 'completed') throw Error(receipt.result.error || 'execution_failed');
        await authority.assert();
        const committed = await commitExecutionProjection(projection, authority, options.store);
        authority.execution.committed = committed.committed;
        await options.store.audit(authority.request.owner.sessionId, 'sandbox_projection_committed', projection.executionId,
          {owner: authority.request.owner, committed: committed.committed, elapsedMs: performance.now() - startedAt});
        return {exitCode: receipt.result.exitCode};
      } finally {
        monitorStopped = true;
        await spool.stop();
        await monitor;
        if (!cleaned) {
          try {
            const recovered = await runNativeSandbox({manifest: runtime.manifest, directory: runtime.directory,
              start: recovery, signal: new AbortController().signal, cleanupOnly: true, onData: () => {}});
            cleaned = recovered.result.cleanup.profileRemoved && recovered.result.cleanup.remainingOwnedAces === 0
              && recovered.result.cleanup.jobActiveProcesses === 0;
            await options.store.audit(authority.request.owner.sessionId, 'sandbox_owned_recovered', projection.executionId,
              {owner: authority.request.owner, cleanup: recovered.result.cleanup, runtimeVersion: runtime.version});
          } catch {
            await options.store.audit(authority.request.owner.sessionId, 'sandbox_cleanup_required', projection.executionId,
              {owner: authority.request.owner, runtimeVersion: runtime.version, projectionRoot: projection.root});
          }
        }
        if (cleaned) removeOwnedProjection(projection.root);
      }
    }
  };
}
