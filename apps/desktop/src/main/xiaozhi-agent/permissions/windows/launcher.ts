import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import type {PermissionOwner} from '../../../../shared/xiaozhi-permissions';
import {digest} from '../resources';
import {plain, exact, hash, text} from '../validation';
import {permissionTemporaryRoot, projectionTemporaryRoot} from './temporary';
import baseManifest from './generated/sandbox-manifest.json' with {type: 'json'};

export type SandboxManifest = typeof baseManifest & {ptyProtocolVersion?: number};
export type SandboxStart = {
  schemaVersion: 1;
  type: 'start';
  executionId: string;
  owner: PermissionOwner;
  grantHash: string;
  executable: string;
  executableHash: string;
  projectionRoot: string;
  cwd: string;
  command: string;
  env: Record<string, string>;
  timeoutMs: number;
  maxOutputBytes: number;
  maxProcesses: number;
  session?: {
    schemaVersion: 1;
    mode: 'stdio' | 'pty';
    cols?: number;
    rows?: number;
    arguments: string;
    maxInputBytes: number;
    memoryBytes: number;
    cpuRate: number;
    userTimeMs: number;
    environment: Record<string, string>;
  };
};
export type SandboxInput = {
  write: (bytes: Buffer) => Promise<void>;
  writeSequenced: (input: {sequence: number; bytes: Buffer}) => Promise<{sequence: number}>;
  resize: (input: {controlId: string; cols: number; rows: number}) => Promise<void>;
  close: () => void;
};
export type SandboxResult = {
  schemaVersion: 1;
  type: 'result';
  executionId: string;
  state: 'completed' | 'cancelled' | 'timed_out' | 'failed';
  exitCode: number | null;
  truncated: boolean;
  durationMs: number;
  error?: string;
  cleanup: {jobActiveProcesses: number; profileRemoved: boolean; remainingOwnedAces: number; ptyClosed?: boolean};
};
export const builtinSandboxManifest = baseManifest;
export type PermissionPlatformInfo = {
  schemaVersion: 1;
  type: 'platform_info';
  platform: 'win32';
  architecture: 'x64';
  windowsDirectory: string;
  runtimes: {kind: 'powershell5' | 'framework_csc'; path: string; sha256: string | null; fileVersion: string | null;
    trust: 'verified' | 'unavailable' | 'untrusted'; trustSource: 'embedded' | 'catalog' | 'none'; publisher: string | null; reason: string | null}[];
};

export function builtinPermissionDirectory() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.join(here, 'permission-runtime'), path.join(here, 'generated'), path.resolve('src/main/xiaozhi-agent/permissions/windows/generated')];
  const found = candidates.find(directory => fs.existsSync(path.join(directory, baseManifest.helperFile)));
  if (!found) throw Error('unsupported_constraint');
  return found;
}

export function verifySandboxBinary(manifest: SandboxManifest, directory: string) {
  if (process.platform !== 'win32' || process.arch !== manifest.architecture || manifest.schemaVersion !== 1
      || manifest.protocolVersion !== 1 || manifest.helperFile !== 'xiaozhi-sandbox.exe' || !hash(manifest.helperSha256)) throw Error('unsupported_constraint');
  const filename = path.join(directory, manifest.helperFile);
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== manifest.helperBytes
      || stat.size > 1048576 || digest(fs.readFileSync(filename)) !== manifest.helperSha256) throw Error('source_changed');
  return filename;
}

export function createPermissionScratch(prefix: 'xzc-' | 'xzs-') {
  const temporary = permissionTemporaryRoot();
  const directory = fs.mkdtempSync(path.join(temporary, prefix));
  const identity = fs.lstatSync(directory);
  return {
    directory,
    release() {
      if (permissionTemporaryRoot() !== temporary) throw Error('invalid_projection');
      const current = fs.lstatSync(directory, {throwIfNoEntry:false});
      if (current?.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino
          && path.dirname(directory) === temporary && fs.realpathSync(directory) === directory) {
        fs.rmSync(directory, {recursive:true, force:false});
      }
    },
  };
}

function spawnPermissionHelper(manifest:SandboxManifest, directory:string, args:string[], env:NodeJS.ProcessEnv, detached=false) {
  let executable = verifySandboxBinary(manifest, directory);
  const launch = (file:string) => spawn(file, args, {detached, windowsHide:true, stdio:['pipe','pipe','pipe'], env});
  // Legacy .NET executable startup fails near MAX_PATH even when Node can read the file.
  if (executable.length < 250) return launch(executable);
  const scratch = createPermissionScratch('xzs-');
  try {
    fs.copyFileSync(executable, path.join(scratch.directory, manifest.helperFile), fs.constants.COPYFILE_EXCL);
    executable = verifySandboxBinary(manifest, scratch.directory);
    const child = launch(executable);
    child.once('close', () => {
      try {scratch.release();} catch (error) {console.warn('Permission helper scratch cleanup failed:', (error as NodeJS.ErrnoException).code);}
    });
    return child;
  } catch (error) {
    scratch.release();
    throw error;
  }
}

export async function inspectPermissionPlatform(): Promise<PermissionPlatformInfo> {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawnPermissionHelper(baseManifest, builtinPermissionDirectory(), ['--platform-info'],
      Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(?:TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA)$/iu.test(name))));
    child.stdin.end();
    const chunks: Buffer[] = [];
    let size = 0, stderr = 0;
    const deadline = setTimeout(() => child.kill(), 10000);
    child.stdout.on('data', (bytes: Buffer) => {size += bytes.length; if (size > 65536) child.kill(); else chunks.push(bytes);});
    child.stderr.on('data', (bytes: Buffer) => {stderr += bytes.length; if (stderr > 8192) child.kill();});
    child.once('error', error => {clearTimeout(deadline); reject(error);});
    child.once('close', code => {clearTimeout(deadline); code === 0 && size <= 65536 && stderr <= 8192
      ? resolve(Buffer.concat(chunks).toString('utf8')) : reject(Error('unsupported_constraint'));});
  });
  const raw: unknown = JSON.parse(output);
  if (!plain(raw) || !exact(raw, ['schemaVersion', 'type', 'platform', 'architecture', 'windowsDirectory', 'runtimes'])
      || raw.schemaVersion !== 1 || raw.type !== 'platform_info' || raw.platform !== 'win32' || raw.architecture !== 'x64'
      || !text(raw.windowsDirectory) || !path.isAbsolute(raw.windowsDirectory) || !Array.isArray(raw.runtimes) || raw.runtimes.length !== 2) throw Error('invalid_protocol');
  const seen = new Set();
  for (const entry of raw.runtimes) {
    if (!plain(entry) || !exact(entry, ['kind', 'path', 'sha256', 'fileVersion', 'trust', 'trustSource', 'publisher', 'reason'])
        || !['powershell5', 'framework_csc'].includes(String(entry.kind)) || seen.has(entry.kind) || !text(entry.path)
        || entry.sha256 !== null && !hash(entry.sha256) || entry.fileVersion !== null && !text(entry.fileVersion)
        || !['verified', 'unavailable', 'untrusted'].includes(String(entry.trust))
        || !['embedded', 'catalog', 'none'].includes(String(entry.trustSource))
        || entry.publisher !== null && !text(entry.publisher) || entry.reason !== null && !text(entry.reason)) throw Error('invalid_protocol');
    seen.add(entry.kind);
    const expected = entry.kind === 'powershell5' ? path.join(raw.windowsDirectory, 'System32/WindowsPowerShell/v1.0/powershell.exe')
      : path.join(raw.windowsDirectory, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    if (path.resolve(entry.path).toLowerCase() !== path.resolve(expected).toLowerCase()) throw Error('invalid_protocol');
  }
  return raw as PermissionPlatformInfo;
}

function validResult(raw: unknown, executionId: string): raw is SandboxResult {
  if (!plain(raw)) return false;
  const keys = ['schemaVersion', 'type', 'executionId', 'state', 'exitCode', 'truncated', 'durationMs', 'cleanup'];
  if (raw.error !== undefined) keys.push('error');
  return exact(raw, keys) && raw.schemaVersion === 1 && raw.type === 'result' && raw.executionId === executionId
    && ['completed', 'cancelled', 'timed_out', 'failed'].includes(String(raw.state)) && (raw.exitCode === null || Number.isInteger(raw.exitCode))
    && typeof raw.truncated === 'boolean' && typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) && raw.durationMs >= 0
    && plain(raw.cleanup) && exact(raw.cleanup, ['jobActiveProcesses', 'profileRemoved', 'remainingOwnedAces', ...(raw.cleanup.ptyClosed === undefined ? [] : ['ptyClosed'])])
    && Number.isSafeInteger(raw.cleanup.jobActiveProcesses) && typeof raw.cleanup.profileRemoved === 'boolean'
    && Number.isSafeInteger(raw.cleanup.remainingOwnedAces) && (raw.cleanup.ptyClosed === undefined || typeof raw.cleanup.ptyClosed === 'boolean')
    && (raw.error === undefined || text(raw.error));
}

/** The helper owns the shell Job. Keep it alive to finish profile/ACE cleanup. */
export async function runNativeSandbox(options: {
  manifest: SandboxManifest;
  directory: string;
  start: SandboxStart;
  signal: AbortSignal;
  cleanupOnly?: boolean;
  onData?: (bytes: Buffer) => void;
  onStarted?: (pid: number, helperPid: number) => void;
  onBytes?: (stream: 'stdout' | 'stderr' | 'pty', bytes: Buffer) => void;
  onSession?: (input: SandboxInput) => void;
  onResult?: (result: SandboxResult) => void;
}) {
  if (options.start.session && options.manifest.sessionProtocolVersion !== 1) throw Error('unsupported_constraint');
  const pty = options.start.session?.mode === 'pty';
  if (pty && options.manifest.ptyProtocolVersion !== 1) throw Error('unsupported_constraint');
  options.signal.throwIfAborted();
  const temporary = projectionTemporaryRoot(options.start.projectionRoot, options.cleanupOnly === true);
  const child = spawnPermissionHelper(options.manifest, options.directory, [options.cleanupOnly ? '--cleanup-owned' : '--protocol-stdio'],
    {...Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(?:SystemRoot|windir|USERPROFILE|LOCALAPPDATA|APPDATA|SystemDrive)$/iu.test(name))), TEMP: temporary, TMP: temporary}, !pty);
  const decoders = {stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8'), pty: new StringDecoder('utf8')};
  const protocol = new StringDecoder('utf8');
  let pending = '', outputBytes = 0, stderrBytes = 0;
  let started = false, result: SandboxResult | undefined, failure: Error | undefined;
  let inputSequence = 0, acknowledgedSequence = 0, inputBytes = 0, inputClosed = false;
  const acknowledgements = new Map<number, {resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  const resizes = new Map<string, {cols: number; rows: number; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  const sendControl = (frame: Record<string, unknown>) => {
    if (child.stdin.destroyed || !child.stdin.writable) throw Error('input_closed');
    child.stdin.write(JSON.stringify({schemaVersion: 1, executionId: options.start.executionId, ...frame}) + '\n');
  };
  const writeSequenced = ({bytes, sequence}: {bytes: Buffer; sequence: number}) => {
      options.signal.throwIfAborted();
      if (!started || result || failure || inputClosed) return Promise.reject(Error('input_closed'));
      if (!Number.isSafeInteger(sequence) || sequence !== inputSequence + 1) return Promise.reject(Error('input_sequence'));
      if (!bytes.length || bytes.length > 16384 || acknowledgements.size >= 4
          || inputBytes + bytes.length > options.start.session!.maxInputBytes) return Promise.reject(Error('input_limit'));
      inputBytes += bytes.length;
      inputSequence = sequence;
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {acknowledgements.delete(sequence); reject(Error('input_timeout')); fail();}, 30000);
        acknowledgements.set(sequence, {resolve, reject, timer});
        try {sendControl({type: 'input', sequence, data: bytes.toString('base64')});}
        catch (error) {clearTimeout(timer); acknowledgements.delete(sequence); reject(error); fail();}
      }).then(() => ({sequence}));
  };
  if (options.start.session) options.onSession?.({
    write: bytes => writeSequenced({bytes, sequence: inputSequence + 1}).then(() => undefined),
    writeSequenced,
    resize({controlId, cols, rows}) {
      options.signal.throwIfAborted();
      if (!pty || !started || result || failure) return Promise.reject(Error('input_closed'));
      if (!/^[A-Za-z0-9_-]{1,160}$/u.test(controlId) || ![cols, rows].every(value => Number.isInteger(value) && value >= 1 && value <= 1000)) {
        return Promise.reject(Error('invalid_input'));
      }
      if (resizes.size >= 4 || resizes.has(controlId)) return Promise.reject(Error('input_limit'));
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {resizes.delete(controlId); reject(Error('input_timeout')); fail();}, 30000);
        resizes.set(controlId, {cols, rows, resolve, reject, timer});
        try {sendControl({type: 'resize', controlId, cols, rows});}
        catch (error) {clearTimeout(timer); resizes.delete(controlId); reject(error); fail();}
      });
    },
    close() {
      if (inputClosed) return;
      inputClosed = true;
      if (!result && !failure) sendControl({type: 'input_close'});
    },
  });
  const cancel = () => {
    if (!child.stdin.destroyed) child.stdin.write(JSON.stringify({schemaVersion: 1, type: 'cancel', executionId: options.start.executionId,
      reason: options.signal.reason === 'revoked' ? 'revoked' : options.signal.reason === 'timeout' ? 'timeout' : 'cancelled'}) + '\n');
  };
  const fail = () => {
    failure ||= Error('invalid_protocol');
    cancel(); child.stdin.end();
  };
  options.signal.addEventListener('abort', cancel, {once: true});
  const deadline = setTimeout(() => {failure ||= Error('timeout'); cancel(); child.stdin.end();}, options.start.timeoutMs + 15000);
  deadline.unref();
  const onInputError = () => { /* EOF/parent-monitor cleanup is verified separately. */ };
  const onDiagnostic = (bytes: Buffer) => {stderrBytes += bytes.length; if (stderrBytes > 8192) fail();};
  const onProtocol = (bytes: Buffer) => {
    try {
      pending += protocol.write(bytes);
      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        const frame: unknown = JSON.parse(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        if (!plain(frame) || frame.schemaVersion !== 1 || frame.executionId !== options.start.executionId || result) return fail();
        if (frame.type === 'started') {
          if (started || options.cleanupOnly || !exact(frame, ['schemaVersion', 'type', 'executionId', 'pid', 'tokenIsAppContainer', 'jobAssigned', 'profileName', 'projectionRoot'])
              || !Number.isInteger(frame.pid) || frame.tokenIsAppContainer !== true || frame.jobAssigned !== true
              || frame.projectionRoot !== options.start.projectionRoot || frame.profileName !== 'XiaozhiSandbox.' + options.start.executionId.slice(7).replaceAll('-', '')) return fail();
          started = true;
          options.onStarted?.(Number(frame.pid), child.pid!);
        } else if (frame.type === 'output') {
          if (!started || !exact(frame, ['schemaVersion', 'type', 'executionId', 'stream', 'data'])
              || !(pty ? ['pty'] : ['stdout', 'stderr']).includes(String(frame.stream)) || typeof frame.data !== 'string'
              || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(frame.data)) return fail();
          const chunk = Buffer.from(frame.data, 'base64');
          outputBytes += chunk.length;
          if (chunk.length > 16384 || outputBytes > options.start.maxOutputBytes) return fail();
          options.onBytes?.(frame.stream as 'stdout' | 'stderr' | 'pty', chunk);
          const decoded = decoders[frame.stream as 'stdout' | 'stderr' | 'pty'].write(chunk);
          if (decoded) options.onData?.(Buffer.from(decoded));
        } else if (frame.type === 'input_ack') {
          if (!options.start.session || !started || !exact(frame, ['schemaVersion', 'type', 'executionId', 'sequence'])
              || frame.sequence !== acknowledgedSequence + 1) return fail();
          const pendingAck = acknowledgements.get(Number(frame.sequence));
          if (!pendingAck) return fail();
          acknowledgedSequence++;
          clearTimeout(pendingAck.timer); acknowledgements.delete(acknowledgedSequence); pendingAck.resolve();
        } else if (frame.type === 'resize_ack') {
          if (!pty || !started || !exact(frame, ['schemaVersion', 'type', 'executionId', 'controlId', 'cols', 'rows']) || typeof frame.controlId !== 'string') return fail();
          const pendingResize = resizes.get(frame.controlId);
          if (!pendingResize || pendingResize.cols !== frame.cols || pendingResize.rows !== frame.rows) return fail();
          clearTimeout(pendingResize.timer); resizes.delete(frame.controlId); pendingResize.resolve();
        } else if (frame.type === 'result' && validResult(frame, options.start.executionId)) {
          result = frame;
          options.onResult?.(frame);
        }
        else return fail();
        newline = pending.indexOf('\n');
      }
      if (Buffer.byteLength(pending) > 65536) fail();
    } catch {fail();}
  };
  const onHelperError = (error: Error) => {failure ||= error;};
  child.stdin.on('error', onInputError);
  child.stderr.on('data', onDiagnostic);
  child.stdout.on('data', onProtocol);
  child.once('error', onHelperError);
  try {
    const code = await new Promise<number | null>(resolve => {
      child.once('close', resolve);
      child.stdin.write(JSON.stringify(options.start) + '\n');
      if (options.signal.aborted) cancel();
    });
    if (failure) throw failure;
    if (pending.trim() || !result || result.cleanup.jobActiveProcesses !== 0 || !result.cleanup.profileRemoved || result.cleanup.remainingOwnedAces !== 0
        || pty && (result.cleanup.ptyClosed === false || started && result.cleanup.ptyClosed !== true)
        || code !== (result.state === 'failed' ? 1 : 0) || !options.cleanupOnly && result.state === 'completed' && !started) throw Error('cleanup_failed');
    for (const decoder of Object.values(decoders)) {const tail = decoder.end(); if (tail) options.onData?.(Buffer.from(tail));}
    return {result, helperHash: options.manifest.helperSha256, outputBytes, started};
  } finally {
    for (const pendingAck of acknowledgements.values()) {clearTimeout(pendingAck.timer); pendingAck.reject(Error('input_closed'));}
    acknowledgements.clear();
    for (const pendingResize of resizes.values()) {clearTimeout(pendingResize.timer); pendingResize.reject(Error('input_closed'));}
    resizes.clear();
    clearTimeout(deadline);
    options.signal.removeEventListener('abort', cancel);
    child.removeListener('error', onHelperError);
    child.stdout.removeListener('data', onProtocol);
    child.stderr.removeListener('data', onDiagnostic);
    if (!child.stdin.destroyed) child.stdin.end();
    child.stdin.removeListener('error', onInputError);
  }
}
