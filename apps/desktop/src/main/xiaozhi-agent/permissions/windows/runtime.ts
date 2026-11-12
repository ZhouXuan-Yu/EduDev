import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {builtinPermissionDirectory, builtinSandboxManifest, verifySandboxBinary, runNativeSandbox, inspectPermissionPlatform, type PermissionPlatformInfo, type SandboxManifest, type SandboxStart} from './launcher';
import {digest, containsPath, scopeCovers} from '../resources';
import {permissionHash} from '../validation';
import type {PermissionScope} from '../../../../shared/xiaozhi-permissions';
import type {PermissionStore} from '../store';
import type {CurrentPermission} from '../current';
import {removeOwnedProjection} from './projection';

export type PermissionRuntime = {directory: string; manifest: SandboxManifest; version: string};
const configuration = 'framework-csc5-x64-optimize-checked-v1';

/** Only this fixed built-in source recipe may compile a managed permission helper. */
export function createPermissionRuntimeManager(options: {root: string; store: PermissionStore}) {
  const root = path.resolve(options.root);
  const versions = path.join(root, 'versions');
  const pointer = path.join(root, 'active.json');
  let tail: Promise<unknown> = Promise.resolve();
  let platform: PermissionPlatformInfo | undefined;

  async function trustedPlatform() {
    const unchanged = platform && platform.runtimes.every(runtime => runtime.sha256 !== null && fs.existsSync(runtime.path)
      && digest(fs.readFileSync(runtime.path)) === runtime.sha256);
    if (!unchanged) platform = await inspectPermissionPlatform();
    return platform!;
  }

  async function systemRuntime() {
    const info = await trustedPlatform();
    const runtime = info.runtimes.find(item => item.kind === 'powershell5');
    if (!runtime || runtime.trust !== 'verified' || !runtime.sha256) throw Error('unsupported_constraint');
    return {path: runtime.path, sha256: runtime.sha256, fileVersion: runtime.fileVersion || '', required: true};
  }

  function sources() {
    const directory = builtinPermissionDirectory();
    if (builtinSandboxManifest.sourceFiles.map(entry => entry.file).join(',') !== 'NativeSandbox.cs,PlatformInfo.cs'
        || permissionHash(builtinSandboxManifest.sourceFiles) !== builtinSandboxManifest.sourceSha256) throw Error('source_changed');
    return builtinSandboxManifest.sourceFiles.map(entry => {
      const candidates = [path.join(directory, entry.file), path.join(path.dirname(directory), entry.file)];
      const filename = candidates.find(candidate => fs.existsSync(candidate) && digest(fs.readFileSync(candidate)) === entry.sha256);
      if (!filename) throw Error('source_changed');
      return {file: entry.file, bytes: fs.readFileSync(filename)};
    });
  }

  async function readVersion(version: string): Promise<PermissionRuntime> {
    if (!/^[a-f0-9]{64}$/u.test(version)) throw Error('source_changed');
    const directory = path.join(versions, version);
    const filename = path.join(directory, 'sandbox-manifest.json');
    const stat = fs.lstatSync(filename);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || stat.size > 65536) throw Error('source_changed');
    const manifest = JSON.parse(fs.readFileSync(filename, 'utf8')) as SandboxManifest;
    const receipts = await options.store.runtimeReceipts(version);
    if (!receipts.some(receipt => receipt.manifestHash === permissionHash(manifest) && receipt.helperHash === manifest.helperSha256)) throw Error('source_changed');
    verifySandboxBinary(manifest, directory);
    return {directory, manifest, version};
  }

  async function remember(runtime: PermissionRuntime, authority: CurrentPermission) {
    await options.store.auditOnce(authority.request.owner.sessionId, 'permission_runtime_ready', runtime.version,
      {owner: authority.request.owner, manifestHash: permissionHash(runtime.manifest), helperHash: runtime.manifest.helperSha256,
        sourceHash: runtime.manifest.sourceSha256, configuration});
  }

  async function preserveBuiltin(authority: CurrentPermission): Promise<PermissionRuntime> {
    const manifest = builtinSandboxManifest;
    const source = builtinPermissionDirectory();
    verifySandboxBinary(manifest, source);
    const version = permissionHash({helperHash: manifest.helperSha256, sourceHash: manifest.sourceSha256});
    const directory = path.join(versions, version);
    fs.mkdirSync(directory, {recursive: true});
    const destination = path.join(directory, manifest.helperFile);
    if (!fs.existsSync(destination)) fs.copyFileSync(path.join(source, manifest.helperFile), destination, fs.constants.COPYFILE_EXCL);
    verifySandboxBinary(manifest, directory);
    const metadata = path.join(directory, 'sandbox-manifest.json');
    if (!fs.existsSync(metadata)) fs.writeFileSync(metadata, JSON.stringify(manifest, null, 2), {flag: 'wx', mode: 0o600});
    const runtime = {manifest, directory, version};
    await remember(runtime, authority);
    return readVersion(version);
  }

  async function inspect() {
    try {
      const runtime = await systemRuntime();
      if (fs.existsSync(pointer)) {
        const current = JSON.parse(fs.readFileSync(pointer, 'utf8')) as {version: string};
        const selected = await readVersion(current.version);
        if (selected.manifest.sourceSha256 === builtinSandboxManifest.sourceSha256
            && selected.manifest.runtimes.some(pin => pin.required && pin.path === runtime.path && pin.sha256 === runtime.sha256)) {
          return {status: 'ready' as const, runtimeHash: runtime.sha256, sourceHash: selected.manifest.sourceSha256, helperHash: selected.manifest.helperSha256, selected};
        }
      }
      const pin = builtinSandboxManifest.runtimes.find(item => item.required);
      if (pin?.path === runtime.path && pin.sha256 === runtime.sha256) {
        verifySandboxBinary(builtinSandboxManifest, builtinPermissionDirectory());
        return {status: 'ready' as const, runtimeHash: runtime.sha256, sourceHash: builtinSandboxManifest.sourceSha256,
          helperHash: builtinSandboxManifest.helperSha256, selected: null};
      }
      return {status: 'needs_configuration' as const, runtimeHash: runtime.sha256, sourceHash: builtinSandboxManifest.sourceSha256, helperHash: null, selected: null};
    } catch {
      return {status: 'unavailable' as const, runtimeHash: null, sourceHash: builtinSandboxManifest.sourceSha256, helperHash: null, selected: null};
    }
  }

  function recipe(): Extract<PermissionScope, {kind: 'dependency'}> {
    return {kind: 'dependency', source: 'https://microsoft.com', package: 'xiaozhi.permission-runtime', version: '1.0.0',
      sha256: builtinSandboxManifest.sourceSha256, environment: root, installScripts: false};
  }

  return {
    inspect,
    recipe,
    systemRuntime,
    readVersion,
    async resolve(authority: CurrentPermission) {
      await authority.assert();
      const current = await inspect();
      if (current.status !== 'ready') throw Error(current.status === 'needs_configuration' ? 'needs_configuration' : 'unsupported_constraint');
      return current.selected || preserveBuiltin(authority);
    },
    async prepare(authority: CurrentPermission, expectedSourceHash: string) {
      const work = tail.then(async () => {
        await authority.assert();
        if (expectedSourceHash !== builtinSandboxManifest.sourceSha256 || !authority.request.scopes.some(scope => scopeCovers(scope, recipe()))) throw Error('permission_denied');
        const current = await inspect();
        if (current.status === 'ready') return {changed: false, runtime: current.selected || await preserveBuiltin(authority)};
        const runtime = await systemRuntime();
        const source = sources();
        const platform = await trustedPlatform();
        const compilerInfo = platform.runtimes.find(item => item.kind === 'framework_csc');
        if (!compilerInfo || compilerInfo.trust !== 'verified' || !compilerInfo.sha256) throw Error('unsupported_constraint');
        const compiler = compilerInfo.path;
        if (!containsPath(platform.windowsDirectory, compiler) || digest(fs.readFileSync(compiler)) !== compilerInfo.sha256) throw Error('source_changed');
        const sourceHash = builtinSandboxManifest.sourceSha256;
        const version = permissionHash({sourceHash, runtimeHash: runtime.sha256, configuration});
        try {
          const retained = await readVersion(version);
          const temporaryPointer = pointer + '.' + randomUUID();
          await authority.assert();
          fs.writeFileSync(temporaryPointer, JSON.stringify({version}), {flag: 'wx', mode: 0o600});
          fs.renameSync(temporaryPointer, pointer);
          return {changed: true, runtime: retained};
        } catch { /* A fresh fixed-source build is needed. */ }
        fs.mkdirSync(versions, {recursive: true});
        const stage = path.join(versions, version + '-stage-' + randomUUID());
        fs.mkdirSync(stage);
        try {
          for (const entry of source) fs.writeFileSync(path.join(stage, entry.file), entry.bytes, {flag: 'wx'});
          const escapedPath = runtime.path.replaceAll('"', '""');
          const pins = 'namespace Xiaozhi.PermissionRuntime { internal sealed class TrustedRuntime { internal string Path, Hash; internal TrustedRuntime(string path, string hash) { Path=path; Hash=hash; } } internal static class TrustedRuntimes { internal static readonly TrustedRuntime[] Items = { new TrustedRuntime(@"'
            + escapedPath + '", "' + runtime.sha256 + '") }; } }';
          fs.writeFileSync(path.join(stage, 'TrustedRuntimes.cs'), pins, {flag: 'wx'});
          const arguments_ = ['/nologo', '/noconfig', '/target:exe', '/platform:x64', '/optimize+', '/checked+', '/warn:4',
            '/r:System.dll', '/r:System.Core.dll', '/out:' + path.join(stage, 'xiaozhi-sandbox.exe'), ...source.map(entry => path.join(stage, entry.file)), path.join(stage, 'TrustedRuntimes.cs')];
          await options.store.audit(authority.request.owner.sessionId, 'permission_runtime_build_intent', version,
            {owner: authority.request.owner, sourceHash, runtimeHash: runtime.sha256, compilerHash: digest(fs.readFileSync(compiler)), configuration, grantRefs: authority.decision.grantRefs});
          await authority.assert();
          const compilerResult = await new Promise<number | null>((resolve, reject) => {
            const child = spawn(compiler, arguments_, {cwd: stage, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], signal: authority.signal,
              env: {SystemRoot: platform.windowsDirectory, windir: platform.windowsDirectory, TEMP: os.tmpdir(), TMP: os.tmpdir()}});
            let outputBytes = 0;
            const deadline = setTimeout(() => child.kill(), 30000);
            const bounded = (bytes: Buffer) => {outputBytes += bytes.length; if (outputBytes > 8192) child.kill();};
            child.stdout.on('data', bounded);
            child.stderr.on('data', bounded);
            child.once('error', error => {clearTimeout(deadline); reject(error);});
            child.once('close', code => {clearTimeout(deadline); resolve(code);});
          });
          if (compilerResult !== 0) throw Error('configuration');
          const filename = path.join(stage, 'xiaozhi-sandbox.exe');
          const manifest: SandboxManifest = {...builtinSandboxManifest, helperSha256: digest(fs.readFileSync(filename)), helperBytes: fs.statSync(filename).size,
            sourceSha256: sourceHash, pinsSourceSha256: digest(Buffer.from(pins)), runtimes: [runtime], buildTime: new Date().toISOString()};
          fs.writeFileSync(path.join(stage, 'sandbox-manifest.json'), JSON.stringify(manifest, null, 2), {flag: 'wx'});
          const projection = path.join(os.tmpdir(), 'xiaozhi-permission-exec-' + randomUUID());
          fs.mkdirSync(projection);
          const executionId = 'xiexec_' + randomUUID();
          fs.writeFileSync(path.join(projection, '.xiaozhi-projection.json'), JSON.stringify({schemaVersion: 1, executionId,
            grantHash: authority.decision.permissionSnapshotHash, owner: authority.request.owner}), {flag: 'wx'});
          const start: SandboxStart = {schemaVersion: 1, type: 'start', executionId, owner: authority.request.owner,
            grantHash: authority.decision.permissionSnapshotHash, executable: runtime.path, executableHash: runtime.sha256,
            projectionRoot: projection, cwd: projection, command: 'Write-Output XIAOZHI_SANDBOX_READY', env: {XIAOZHI_WORKSPACE: projection},
            timeoutMs: 5000, maxOutputBytes: 8192, maxProcesses: 4};
          let health = '';
          const tested = await runNativeSandbox({manifest, directory: stage, start, signal: authority.signal, onData: bytes => {health += bytes.toString('utf8');}});
          removeOwnedProjection(projection);
          if (tested.result.state !== 'completed' || tested.result.exitCode !== 0 || !health.includes('XIAOZHI_SANDBOX_READY')) throw Error('configuration');
          await authority.assert();
          const directory = path.join(versions, version);
          if (fs.existsSync(directory)) throw Error('source_changed');
          fs.renameSync(stage, directory);
          const selected = {directory, version, manifest};
          await remember(selected, authority);
          const temporaryPointer = pointer + '.' + randomUUID();
          fs.writeFileSync(temporaryPointer, JSON.stringify({version}), {flag: 'wx', mode: 0o600});
          await authority.assert();
          fs.renameSync(temporaryPointer, pointer);
          return {changed: true, runtime: selected};
        } finally {
          if (fs.existsSync(stage) && containsPath(versions, path.resolve(stage)) && !fs.lstatSync(stage).isSymbolicLink()) {
            fs.rmSync(stage, {recursive: true, force: false});
          }
        }
      });
      tail = work.catch(() => undefined);
      return work;
    }
  };
}
export type PermissionRuntimeManager = ReturnType<typeof createPermissionRuntimeManager>;
