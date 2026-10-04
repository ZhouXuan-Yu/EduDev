import fs from 'node:fs';
import path from 'node:path';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { SpawnedCodexAppServerClient } from './vendor/official-client/transport';
import type { InitializeParams } from './vendor/codex-protocol/InitializeParams';
import type { InitializeResponse } from './vendor/codex-protocol/InitializeResponse';
import type { ThreadStartParams } from './vendor/codex-protocol/v2/ThreadStartParams';
import type { ThreadStartResponse } from './vendor/codex-protocol/v2/ThreadStartResponse';
import type { ThreadResumeParams } from './vendor/codex-protocol/v2/ThreadResumeParams';
import type { ThreadResumeResponse } from './vendor/codex-protocol/v2/ThreadResumeResponse';
import type { ThreadReadParams } from './vendor/codex-protocol/v2/ThreadReadParams';
import type { ThreadReadResponse } from './vendor/codex-protocol/v2/ThreadReadResponse';
import type { TurnStartParams } from './vendor/codex-protocol/v2/TurnStartParams';
import type { TurnStartResponse } from './vendor/codex-protocol/v2/TurnStartResponse';
import type { TurnInterruptParams } from './vendor/codex-protocol/v2/TurnInterruptParams';
import type { TurnInterruptResponse } from './vendor/codex-protocol/v2/TurnInterruptResponse';

type Protocol = {
  initialize: [InitializeParams, InitializeResponse];
  'thread/start': [ThreadStartParams, ThreadStartResponse];
  'thread/resume': [ThreadResumeParams, ThreadResumeResponse];
  'thread/read': [ThreadReadParams, ThreadReadResponse];
  'turn/start': [TurnStartParams, TurnStartResponse];
  'turn/interrupt': [TurnInterruptParams, TurnInterruptResponse];
};
export type OfficeServerRequest = { id: number | string; method: string; params: unknown };
export type OfficeServerReply = { result: unknown } | { error: { code: number; message: string } };
export type OfficeEngineNotification = { method: string; params?: unknown };
type RawClient = {
  initialize(): Promise<void>; close(): Promise<void>; notify(method: string, params: unknown): void;
  request(method: string, params: unknown): Promise<unknown>; sendMessage(message: unknown): void;
  handleServerRequest(message: OfficeServerRequest): void;
  setNotificationHandler(handler: (message: OfficeEngineNotification) => void): void;
  pending: Map<number, { method: string; reject(error: Error): void }>;
  proc?: ChildProcessWithoutNullStreams;
  closed: boolean; exitResolved?: boolean; exitPromise: Promise<void>; stderr: string;
};

export class OfficeConnectionError extends Error {
  readonly code: 'closed' | 'timeout' | 'busy' | 'protocol' | 'process_exit';
  constructor(code: OfficeConnectionError['code'], message: string) {
    super(message); this.name = 'OfficeConnectionError'; this.code = code;
  }
}

export interface OfficeConnectionOptions {
  binaryPath: string; cwd: string; env: Record<string, string>;
  requestTimeoutMs?: number; serverRequestTimeoutMs?: number; maxPending?: number;
  onNotification?: (notification: OfficeEngineNotification, sequence: number) => void;
  onServerRequest?: (request: OfficeServerRequest, signal: AbortSignal) => Promise<OfficeServerReply>;
  onDisconnect?: (error: OfficeConnectionError) => void;
}

// Strict main-process facade around the reused official transport, no agent loop.
export class OfficeAppServerConnection {
  private readonly raw: RawClient;
  private readonly originalRequest: RawClient['request'];
  private readonly lifecycle = new AbortController();
  private readonly serverRequests = new Map<string, AbortController>();
  private phase: 'new' | 'connecting' | 'ready' | 'closing' | 'closed' = 'new';
  private connecting?: Promise<void>;
  private closing?: Promise<void>;
  private readonly requestTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private sequence = 0;
  private readonly options: OfficeConnectionOptions;
  constructor(options: OfficeConnectionOptions) {
    this.options = options;
    if (!path.isAbsolute(options.binaryPath) || !fs.statSync(options.binaryPath).isFile()
      || !path.isAbsolute(options.cwd) || !fs.statSync(options.cwd).isDirectory()
      || !options.env.CODEX_HOME || !path.isAbsolute(options.env.CODEX_HOME)
      || !fs.statSync(options.env.CODEX_HOME).isDirectory()) {
      throw new OfficeConnectionError('protocol', 'Private native binary, workspace and runtime home required');
    }
    const actualHome = fs.realpathSync(options.env.CODEX_HOME).toLowerCase();
    const userCodex = path.resolve(process.env.USERPROFILE || '', '.codex').toLowerCase();
    if (actualHome === userCodex || actualHome.startsWith(`${userCodex}${path.sep}`)) {
      throw new OfficeConnectionError('protocol', 'Global Codex home cannot be used by Office Host');
    }
    const childEnv = Object.fromEntries(Object.entries(options.env).filter(([key]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|COMSPEC|PROCESSOR_ARCHITECTURE|CODEX_HOME|DEEPSEEK_API_KEY)$/i.test(key)));
    const Raw = SpawnedCodexAppServerClient as unknown as new (cwd: string, options: unknown) => RawClient;
    this.raw = new Raw(options.cwd, { binaryPath: options.binaryPath, env: childEnv });
    this.originalRequest = this.raw.request.bind(this.raw);
    this.raw.request = (method, params) => this.sendRequest(method, params);
    this.raw.setNotificationHandler(message => {
      if (this.lifecycle.signal.aborted || /reasoning|rawResponse/i.test(message.method)) return;
      const item = (message.params as { item?: { type?: string } })?.item;
      if (item?.type === 'reasoning') return;
      if (message.method === 'turn/completed') {
        const params = message.params as { turn?: { id?: string } };
        // Runtime terminal notification invalidates unfinished request work.
        if (params?.turn?.id) this.abortTurn(params.turn.id);
      }
      try { this.options.onNotification?.(message, ++this.sequence); }
      catch { this.disconnect(new OfficeConnectionError('protocol', 'Notification consumer failed')); }
    });
    this.raw.handleServerRequest = request => { void this.answer(request); };
    void this.raw.exitPromise.then(() => {
      if (this.phase !== 'closing' && this.phase !== 'closed') this.disconnect(new OfficeConnectionError('process_exit', 'Owned app-server connection closed'));
    });
  }
  get diagnostics() {
    return { phase: this.phase, pending: this.raw.pending.size, serverRequests: this.serverRequests.size,
      sequence: this.sequence, ownedPid: this.raw.proc?.pid, stderrBytes: Buffer.byteLength(this.raw.stderr) };
  }
  async connect(): Promise<void> {
    if (this.phase === 'ready') return;
    if (this.phase === 'closing' || this.phase === 'closed') throw new OfficeConnectionError('closed', 'Connection is no longer available');
    if (this.connecting) return this.connecting;
    if (this.phase !== 'new') throw new OfficeConnectionError('closed', 'Connection is no longer available');
    this.phase = 'connecting';
    this.connecting = this.raw.initialize().then(() => {
      if (this.lifecycle.signal.aborted) throw new OfficeConnectionError('closed', 'Connection closed during initialization');
      this.phase = 'ready';
    }).catch(async error => { await this.close(); throw this.publicError(error); });
    return this.connecting;
  }
  request<M extends keyof Protocol>(method: M, params: Protocol[M][0], timeoutMs?: number): Promise<Protocol[M][1]> {
    if (this.phase !== 'ready') return Promise.reject(new OfficeConnectionError('closed', 'Connect before requesting'));
    return this.sendRequest(method, params, timeoutMs) as Promise<Protocol[M][1]>;
  }
  private publicError(error: unknown): OfficeConnectionError {
    if (error instanceof OfficeConnectionError) return error;
    // Raw RPC details/line/stderr stay private; never forward them to a renderer.
    return new OfficeConnectionError('protocol', 'App-server request failed');
  }
  private sendRequest(method: string, params: unknown, timeoutMs?: number): Promise<unknown> {
    if (this.lifecycle.signal.aborted || this.raw.closed || this.raw.exitResolved) return Promise.reject(new OfficeConnectionError('closed', 'Connection closed'));
    if (this.raw.pending.size >= (this.options.maxPending || 32)) return Promise.reject(new OfficeConnectionError('busy', 'Pending request limit reached'));
    const timeout = timeoutMs ?? this.options.requestTimeoutMs ?? 45000;
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 120000) {
      return Promise.reject(new OfficeConnectionError('protocol', 'Invalid request timeout'));
    }
    const before = new Set(this.raw.pending.keys());
    const response = this.originalRequest(method, params);
    const id = [...this.raw.pending.keys()].find(item => !before.has(item));
    if (id !== undefined) {
      this.requestTimers.set(id, setTimeout(() => {
        const pending = this.raw.pending.get(id);
        this.raw.pending.delete(id); this.requestTimers.delete(id);
        pending?.reject(new OfficeConnectionError('timeout', `App-server request timed out: ${method}`));
      }, timeout));
    }
    return response.catch(error => { throw this.publicError(error); }).finally(() => {
      if (id !== undefined) { clearTimeout(this.requestTimers.get(id)); this.requestTimers.delete(id); }
    });
  }
  private async answer(request: OfficeServerRequest) {
    if (this.lifecycle.signal.aborted) return;
    const key = String(request.id);
    if (this.serverRequests.has(key) || this.serverRequests.size >= 32) {
      this.disconnect(new OfficeConnectionError('protocol', 'Invalid overlapping server request')); return;
    }
    const controller = new AbortController();
    const params = request.params as { turnId?: unknown };
    const turn = typeof params?.turnId === 'string' ? params.turnId : '';
    Object.assign(controller, { turnId: turn });
    this.serverRequests.set(key, controller);
    const timer = setTimeout(() => controller.abort(new OfficeConnectionError('timeout', 'Tool request timed out')), this.options.serverRequestTimeoutMs ?? 120000);
    try {
      let response: OfficeServerReply;
      if (!this.options.onServerRequest) response = { error: { code: -32601, message: 'No authorized tool handler' } };
      else response = await new Promise<OfficeServerReply>((resolve, reject) => {
        const abort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', abort, { once: true });
        Promise.resolve().then(() => this.options.onServerRequest!(request, controller.signal))
          .then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', abort));
      });
      if (!this.lifecycle.signal.aborted && !controller.signal.aborted) this.raw.sendMessage({ id: request.id, ...response });
    } catch {
      if (!this.lifecycle.signal.aborted && !this.raw.closed) {
        try { this.raw.sendMessage({ id: request.id, error: { code: -32603, message: 'Tool request cancelled or failed' } }); }
        catch { this.disconnect(new OfficeConnectionError('process_exit', 'Tool response connection closed')); }
      }
    } finally { clearTimeout(timer); this.serverRequests.delete(key); }
  }
  private abortTurn(turnId: string) {
    for (const controller of this.serverRequests.values()) {
      if ((controller as AbortController & { turnId?: string }).turnId === turnId) controller.abort(new OfficeConnectionError('closed', 'Turn ended'));
    }
  }
  private disconnect(error: OfficeConnectionError) {
    if (this.lifecycle.signal.aborted) return;
    this.lifecycle.abort(error);
    for (const controller of this.serverRequests.values()) controller.abort(error);
    try { this.options.onDisconnect?.(error); } catch { /* Close ownership is independent of a consumer failure. */ }
    finally { void this.close().catch(() => {}); }
  }
  async close(): Promise<void> {
    if (this.closing) return this.closing;
    this.phase = 'closing';
    this.lifecycle.abort(new OfficeConnectionError('closed', 'Connection closed'));
    for (const controller of this.serverRequests.values()) controller.abort(this.lifecycle.signal.reason);
    for (const timer of this.requestTimers.values()) clearTimeout(timer);
    this.requestTimers.clear();
    for (const pending of this.raw.pending.values()) pending.reject(new OfficeConnectionError('closed', 'Connection closed'));
    this.raw.pending.clear();
    this.closing = (async () => {
      const proc = this.raw.proc;
      if (!proc) { this.phase = 'closed'; return; }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([this.raw.close(), new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            const pid = proc.pid;
            if (proc.exitCode === null && proc.signalCode === null && Number.isSafeInteger(pid) && Number(pid) > 0) {
              spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5000 });
            }
            reject(new OfficeConnectionError('process_exit', 'Owned process shutdown exceeded deadline'));
          }, 5000);
        })]);
      } finally { clearTimeout(timer); this.phase = 'closed'; }
    })();
    return this.closing;
  }
}
