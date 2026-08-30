import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  XiazhiBridgeResponse,
  XiazhiCapabilityEvent,
  XiazhiCapabilityManifest,
  XiazhiCapabilityRequest,
  XiazhiHostToolRequest,
  XiazhiHostToolResult,
  XiazhiModelRequest,
  XiazhiModelResult,
  XiazhiUserInputRequest,
  XiazhiUserInputResult,
} from '../../shared/contracts';

type SidecarClientOptions = {
  repoRoot: string;
  pythonCommand?: string;
  sidecarRoot?: string;
  onEvent?: (event: XiazhiCapabilityEvent) => void;
  onExit?: (error: Error) => void;
  onHostToolRequest?: (request: XiazhiHostToolRequest) => Promise<XiazhiHostToolResult>;
  onModelRequest?: (request: XiazhiModelRequest) => Promise<XiazhiModelResult>;
  onUserInputRequest?: (request: XiazhiUserInputRequest) => Promise<XiazhiUserInputResult>;
};

type PendingRequest = {
  resolve: (response: XiazhiBridgeResponse) => void;
  reject: (error: Error) => void;
};

const MAX_FRAME_BYTES = 1_000_000;
const CAPABILITY_NAMES = new Set(['chat', 'deep_solve', 'deep_question', 'deep_research', 'visualize', 'mastery_path']);

function localPythonCommand() {
  if (process.env.OMNI_EDU_PYTHON) return { command: process.env.OMNI_EDU_PYTHON, args: [] };
  if (process.platform !== 'win32') return { command: 'python3', args: [] };
  const candidates = ['C:\\Python314\\python.exe', 'D:\\Anaconda\\python.exe', 'C:\\Windows\\py.exe'];
  const command = candidates.find((candidate) => existsSync(candidate)) ?? 'py';
  return { command, args: /(?:^|[\\/])py(?:\.exe)?$/i.test(command) ? ['-3'] : [] };
}

export class DeepTutorSidecarClient {
  private child?: ChildProcessWithoutNullStreams;
  private lines?: Interface;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly lastEventSequence = new Map<string, number>();
  private requestSequence = 0;
  private manifest?: XiazhiCapabilityManifest;
  private ready = false;
  private stopping = false;
  private stderrTail = '';

  constructor(private readonly options: SidecarClientOptions) {}

  get isReady() {
    return this.ready;
  }

  get capabilityManifest() {
    return this.manifest;
  }

  async start(): Promise<XiazhiCapabilityManifest> {
    if (this.ready && this.manifest) return this.manifest;
    if (this.child) throw new Error('DeepTutor sidecar is starting or unavailable.');
    const python = this.options.pythonCommand
      ? { command: this.options.pythonCommand, args: [] }
      : localPythonCommand();
    this.stopping = false;
    this.stderrTail = '';
    const sidecarRoot = this.options.sidecarRoot ?? join(this.options.repoRoot, 'python');
    const args = [...python.args, '-m', 'omni_edu_deeptutor_bridge'];
    this.child = spawn(python.command, args, {
      cwd: this.options.repoRoot,
      env: { ...process.env, PYTHONPATH: sidecarRoot },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.handleLine(line));
    this.child.on('exit', (code, signal) => {
      const diagnostic = this.stderrTail.trim();
      const reason = new Error([
        `DeepTutor sidecar exited (${code ?? 'null'}/${signal ?? 'none'}).`,
        diagnostic ? `Diagnostics: ${diagnostic}` : '',
      ].filter(Boolean).join(' '));
      for (const pending of this.pending.values()) pending.reject(reason);
      this.pending.clear();
      this.ready = false;
      this.child = undefined;
      this.lastEventSequence.clear();
      this.lines?.close();
      this.lines = undefined;
      if (!this.stopping) this.options.onExit?.(reason);
      this.stopping = false;
    });
    this.child.stderr.on('data', (chunk) => {
      // Keep a bounded, credential-redacted tail for actionable host errors.
      // It is never sent to the model and only becomes visible if the sidecar exits.
      const safe = String(chunk)
        .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-[redacted]')
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s]+/gi, '$1[redacted]');
      this.stderrTail = `${this.stderrTail}${safe}`.slice(-4_000);
    });
    const response = await this.request('handshake', {});
    const candidate = response.result?.manifest;
    const candidateRecord = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : undefined;
    if (!candidateRecord || candidateRecord.schemaVersion !== 'xiazhi.capability.manifest.v1' || candidateRecord.bridgeProtocol !== 'xiazhi.bridge.v1') {
      await this.stop();
      throw new Error('DeepTutor sidecar handshake contract mismatch.');
    }
    const manifest = candidate as unknown as XiazhiCapabilityManifest;
    if (!manifest.capabilities.every((item) => CAPABILITY_NAMES.has(item.name))) {
      await this.stop();
      throw new Error('DeepTutor sidecar declared an unsupported capability.');
    }
    this.manifest = manifest;
    this.ready = true;
    return manifest;
  }

  async startTurn(request: XiazhiCapabilityRequest) {
    if (!this.ready) throw new Error('DeepTutor sidecar is not ready.');
    return this.request('start_turn', request as unknown as Record<string, unknown>);
  }

  async cancelTurn(turnId: string) {
    return this.request('cancel_turn', { turnId });
  }

  async stop() {
    if (!this.child) return;
    this.stopping = true;
    try {
      await this.request('shutdown', {});
    } catch {
      // The process may already be gone; killing the known child is scoped.
    }
    this.child.kill();
    this.child = undefined;
    this.ready = false;
    this.lastEventSequence.clear();
  }

  private request(method: 'handshake' | 'start_turn' | 'cancel_turn' | 'shutdown', params: Record<string, unknown>) {
    const child = this.child;
    if (!child?.stdin.writable) return Promise.reject(new Error('DeepTutor sidecar stdin is unavailable.'));
    const id = `bridge_${++this.requestSequence}`;
    const payload = JSON.stringify({ type: 'request', id, method, params });
    if (Buffer.byteLength(payload, 'utf8') > MAX_FRAME_BYTES) return Promise.reject(new Error('DeepTutor bridge request exceeds 1MB.'));
    return new Promise<XiazhiBridgeResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      child.stdin.write(`${payload}\n`, (error) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  private writeHostToolResult(result: XiazhiHostToolResult) {
    const child = this.child;
    if (!child?.stdin.writable) return;
    const payload = JSON.stringify({ type: 'host_tool_result', result });
    if (Buffer.byteLength(payload, 'utf8') > MAX_FRAME_BYTES) return;
    child.stdin.write(`${payload}\n`);
  }

  private writeModelResult(result: XiazhiModelResult) {
    const child = this.child;
    if (!child?.stdin.writable) return;
    const payload = JSON.stringify({ type: 'model_result', result });
    if (Buffer.byteLength(payload, 'utf8') > MAX_FRAME_BYTES) return;
    child.stdin.write(`${payload}\n`);
  }

  private writeUserInputResult(result: XiazhiUserInputResult) {
    const child = this.child;
    if (!child?.stdin.writable) return;
    const payload = JSON.stringify({ type: 'user_input_result', result });
    if (Buffer.byteLength(payload, 'utf8') > MAX_FRAME_BYTES) return;
    child.stdin.write(`${payload}\n`);
  }

  private handleLine(line: string) {
    if (Buffer.byteLength(line, 'utf8') > MAX_FRAME_BYTES) return;
    let payload: unknown;
    try {
      payload = JSON.parse(line);
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') return;
    const record = payload as Record<string, unknown>;
    if (record.type === 'response' && typeof record.id === 'string') {
      const pending = this.pending.get(record.id);
      if (!pending) return;
      this.pending.delete(record.id);
      const response = payload as XiazhiBridgeResponse;
      if (response.ok) pending.resolve(response);
      else pending.reject(new Error(`${response.error?.code ?? 'BRIDGE_ERROR'}: ${response.error?.message ?? 'bridge request failed'}`));
      return;
    }
    if (record.type === 'host_tool_request' && record.request && typeof record.request === 'object') {
      const request = record.request as XiazhiHostToolRequest;
      if (request.schemaVersion !== 'xiazhi.host_tool.request.v1') return;
      const handler = this.options.onHostToolRequest;
      if (!handler) return;
      void handler(request).then((result) => this.writeHostToolResult(result));
      return;
    }
    if (record.type === 'model_request' && record.request && typeof record.request === 'object') {
      const request = record.request as XiazhiModelRequest;
      if (request.schemaVersion !== 'xiazhi.model.request.v1') return;
      const handler = this.options.onModelRequest;
      if (!handler) return;
      void handler(request).then((result) => this.writeModelResult(result));
      return;
    }
    if (record.type === 'user_input_request' && record.request && typeof record.request === 'object') {
      const request = record.request as XiazhiUserInputRequest;
      if (request.schemaVersion !== 'xiazhi.user_input.request.v1') return;
      const handler = this.options.onUserInputRequest;
      if (!handler) return;
      void handler(request).then((result) => this.writeUserInputResult(result));
      return;
    }
    if (record.type !== 'event' || !record.event || typeof record.event !== 'object') return;
    const event = record.event as XiazhiCapabilityEvent;
    if (event.schemaVersion !== 'xiazhi.capability.event.v1' || typeof event.turnId !== 'string' || !Number.isInteger(event.sequence)) return;
    const previous = this.lastEventSequence.get(event.turnId) ?? 0;
    if (event.sequence !== previous + 1) return;
    this.lastEventSequence.set(event.turnId, event.sequence);
    this.options.onEvent?.(event);
  }
}
