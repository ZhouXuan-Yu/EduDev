import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {builtinPermissionDirectory, builtinSandboxManifest, createPermissionScratch, verifySandboxBinary, inspectPermissionPlatform, type PermissionPlatformInfo, type SandboxManifest} from './launcher';
import {digest, containsPath, scopeCovers} from '../resources';
import {permissionHash} from '../validation';
import type {PermissionScope} from '../../../../shared/xiaozhi-permissions';
import type {PermissionStore} from '../store';
import type {CurrentPermission} from '../current';
import {checkCompiledPermissionRuntime} from './runtime-health';

export type PermissionRuntime = {directory: string; manifest: SandboxManifest; version: string};
const configuration = 'framework-csc5-x64-optimize-checked-v1';

async function compilePermissionHelper(options: {
  compiler: string; windowsDirectory: string; sources: {file:string; bytes:Buffer|string}[];
  destination: string; signal: AbortSignal;
}) {
  // Framework csc synthesizes temporary filenames beside its output.
  const {directory:scratch,release} = createPermissionScratch('xzc-');
  const temporary = path.dirname(scratch);
  try {
    for (const entry of options.sources) {
      fs.writeFileSync(path.join(scratch, entry.file), entry.bytes, {flag:'wx', mode:0o600});
    }
    const outputName = 'xiaozhi-sandbox.exe';
    const args = ['/nologo', '/noconfig', '/target:exe', '/platform:x64', '/optimize+', '/checked+', '/warn:4',
      '/r:System.dll', '/r:System.Core.dll', '/out:' + outputName, ...options.sources.map(entry => entry.file)];
    options.signal.throwIfAborted();
    let output = '', outputBytes = 0;
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(options.compiler, args, {cwd:scratch, windowsHide:true, stdio:['ignore','pipe','pipe'], signal:options.signal,
        env:{SystemRoot:options.windowsDirectory, windir:options.windowsDirectory, TEMP:temporary, TMP:temporary}});
      let processError: Error | undefined;
      const deadline = setTimeout(() => child.kill(), 30000);
      const bounded = (bytes: Buffer) => {
        outputBytes += bytes.length;
        if (outputBytes > 8192) child.kill();
        else output += bytes.toString('utf8');
      };
      child.stdout.on('data', bounded);
      child.stderr.on('data', bounded);
      child.once('error', error => {processError = error;});
      child.once('close', code => {
        clearTimeout(deadline);
        if (processError) reject(processError);
        else resolve(code);
      });
    });
    if (exitCode === 0) {
      options.signal.throwIfAborted();
      const executable = path.join(scratch, outputName);
      const stat = fs.lstatSync(executable);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size === 0 || stat.size > 1048576) throw Error('configuration');
      fs.copyFileSync(executable, options.destination, fs.constants.COPYFILE_EXCL);
    }
    return {exitCode,output};
  } finally {
    release();
  }
}

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
    if (builtinSandboxManifest.sourceFiles.map(entry => entry.file).join(',') !== 'NativeSandbox.cs,PlatformInfo.cs,SessionOptions.cs,SessionInput.cs,SessionPackage.cs,JobLimits.cs,ConPtyNative.cs,ConPtySession.cs,PtyRunner.cs'
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
        // Publish and verify the binary under the managed runtime root.
        const stage = path.join(versions, '.stage-' + randomUUID());
        fs.mkdirSync(stage);
        let preserveStage = false;
        try {
          const escapedPath = runtime.path.replaceAll('"', '""');
          const pins = 'namespace Xiaozhi.PermissionRuntime { internal sealed class TrustedRuntime { internal string Path, Hash; internal TrustedRuntime(string path, string hash) { Path=path; Hash=hash; } } internal static class TrustedRuntimes { internal static readonly TrustedRuntime[] Items = { new TrustedRuntime(@"'
            + escapedPath + '", "' + runtime.sha256 + '") }; } }';
          await options.store.audit(authority.request.owner.sessionId, 'permission_runtime_build_intent', version,
            {owner: authority.request.owner, sourceHash, runtimeHash: runtime.sha256, compilerHash: digest(fs.readFileSync(compiler)), configuration, grantRefs: authority.decision.grantRefs});
          await authority.assert();
          const filename = path.join(stage, 'xiaozhi-sandbox.exe');
          const compiled = await compilePermissionHelper({compiler, windowsDirectory:platform.windowsDirectory,
            sources:[...source, {file:'TrustedRuntimes.cs',bytes:pins}], destination:filename, signal:authority.signal});
          if (compiled.exitCode !== 0) {
            await options.store.audit(authority.request.owner.sessionId, 'permission_runtime_build_failed', version,
              {owner: authority.request.owner, exitCode: compiled.exitCode, output: compiled.output});
            throw Error('configuration');
          }
          const manifest: SandboxManifest = {...builtinSandboxManifest, helperSha256: digest(fs.readFileSync(filename)), helperBytes: fs.statSync(filename).size,
            sourceSha256: sourceHash, pinsSourceSha256: digest(Buffer.from(pins)), runtimes: [runtime], buildTime: new Date().toISOString()};
          fs.writeFileSync(path.join(stage, 'sandbox-manifest.json'), JSON.stringify(manifest, null, 2), {flag: 'wx'});
          await checkCompiledPermissionRuntime({authority, store: options.store, version, manifest, directory: stage, runtime});
          await authority.assert();
          const directory = path.join(versions, version);
          if (fs.existsSync(directory)) throw Error('source_changed');
          try {
            const identity = fs.lstatSync(stage);
            for (let attempt = 0; ; attempt++) {
              await authority.assert();
              const current = fs.lstatSync(stage);
              if (!containsPath(versions, stage) || !containsPath(versions, directory) || current.isSymbolicLink()
                  || !current.isDirectory() || current.dev !== identity.dev || current.ino !== identity.ino
                  || fs.existsSync(directory)) throw Error('source_changed');
              verifySandboxBinary(manifest, stage);
              try {await fs.promises.rename(stage, directory); break;}
              catch (error) {
                const code = (error as NodeJS.ErrnoException).code;
                if (!['EPERM', 'EBUSY', 'EACCES'].includes(code || '') || attempt >= 7) throw error;
                await delay((attempt + 1) * 50, undefined, {signal: authority.signal});
              }
            }
          } catch (error) {
            preserveStage = true;
            await options.store.audit(authority.request.owner.sessionId, 'permission_runtime_activation_failed', version,
              {owner: authority.request.owner, stage, directory, code: (error as NodeJS.ErrnoException).code || 'configuration',
                helperHash: manifest.helperSha256, sourceHash: manifest.sourceSha256});
            throw error;
          }
          const selected = {directory, version, manifest};
          await remember(selected, authority);
          const temporaryPointer = pointer + '.' + randomUUID();
          fs.writeFileSync(temporaryPointer, JSON.stringify({version}), {flag: 'wx', mode: 0o600});
          await authority.assert();
          fs.renameSync(temporaryPointer, pointer);
          return {changed: true, runtime: selected};
        } finally {
          if (!preserveStage && fs.existsSync(stage) && containsPath(versions, path.resolve(stage)) && !fs.lstatSync(stage).isSymbolicLink()) {
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
