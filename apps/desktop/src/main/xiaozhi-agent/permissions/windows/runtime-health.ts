import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {CurrentPermission} from '../current';
import type {PermissionStore} from '../store';
import {runNativeSandbox, type SandboxManifest, type SandboxStart} from './launcher';
import {removeOwnedProjection} from './projection';
import {permissionTemporaryRoot} from './temporary';

const healthMarker = 'XIAOZHI_SANDBOX_READY';

export async function checkCompiledPermissionRuntime(options: {
  authority: CurrentPermission;
  store: PermissionStore;
  version: string;
  manifest: SandboxManifest;
  directory: string;
  runtime: {path: string; sha256: string};
}, run = runNativeSandbox) {
  const {authority, store, version, runtime, manifest, directory} = options;
  const {owner} = authority.request;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await authority.assert();
    const projection = path.join(permissionTemporaryRoot(), 'xiaozhi-permission-exec-' + randomUUID());
    const executionId = 'xiexec_' + randomUUID();
    const grantHash = authority.decision.permissionSnapshotHash;
    fs.mkdirSync(projection);
    fs.writeFileSync(path.join(projection, '.xiaozhi-projection.json'),
      JSON.stringify({schemaVersion: 1, executionId, grantHash, owner}), {flag: 'wx'});
    const start: SandboxStart = {schemaVersion: 1, type: 'start', executionId, owner, grantHash,
      executable: runtime.path, executableHash: runtime.sha256, projectionRoot: projection, cwd: projection,
      command: 'Write-Output ' + healthMarker, env: {XIAOZHI_WORKSPACE: projection},
      timeoutMs: 5000, maxOutputBytes: 8192, maxProcesses: 4};
    let output = '';
    const checked = await run({manifest, directory, start, signal: authority.signal,
      onData: bytes => {output += bytes.toString('utf8');}});
    const {result, started} = checked;
    const ready = started && result.state === 'completed' && result.exitCode === 0 && output.includes(healthMarker);
    await store.audit(owner.sessionId, 'permission_runtime_health', version, {owner, result, ready, attempt, started});
    // The launcher returns only after the helper has confirmed complete native cleanup.
    removeOwnedProjection(projection);
    if (ready) return;
    if (result.error === 'system_disk_full') throw Error('system_disk_full');
    if (attempt === 2 || started || result.state !== 'failed' || result.error !== 'launch_failed') throw Error('configuration');
    // Only the fixed host probe can retry. Each attempt has its own projection and execution ID.
    await delay(150, undefined, {signal: authority.signal});
  }
}
