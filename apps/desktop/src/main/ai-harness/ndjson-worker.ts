import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type NdjsonWorkerOptions = {
  repoRoot: string;
  /** Python module executed with `-m`, e.g. `omni_edu_ocr`. */
  moduleName: string;
  /** Human readable label used in failure messages. */
  label: string;
  /** Milliseconds before a single request is abandoned. */
  timeoutMs?: number;
  /** Guard for oversized response frames. */
  maxFrameBytes?: number;
  /** Optional python modules (checked with importlib.find_spec, never imported) used to pick the right interpreter. */
  pythonModules?: string[];
  /** Preferred extra modules: an interpreter satisfying pythonModules+these wins; otherwise the first pythonModules-only match is used. */
  pythonOptionalModules?: string[];
  /** Kill the worker after this many idle milliseconds so heavy python deps are not held resident. */
  idleTimeoutMs?: number;
};

type PendingRequest = {
  resolve: (response: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_FRAME_BYTES = 2_000_000;
const DEFAULT_IDLE_TIMEOUT_MS = 90_000;

function localPythonCandidates() {
  if (process.env.OMNI_EDU_PYTHON) return [process.env.OMNI_EDU_PYTHON];
  if (process.platform !== 'win32') return ['python3'];
  return ['C:\\Python314\\python.exe', 'D:\\Anaconda\\python.exe', 'C:\\Windows\\py.exe'];
}

function pythonArgsFor(command: string) {
  return /(?:^|[\\/])py(?:\.exe)?$/i.test(command) ? ['-3'] : [];
}

/** Probes must never import heavy packages: the Electron main thread is blocked for their whole runtime. */
function moduleProbeSnippet(modules: string[]) {
  const list = modules.map((name) => `'${name}'`).join(', ');
  return `import importlib.util,sys; sys.exit(0 if all(importlib.util.find_spec(m) for m in [${list}]) else 1)`;
}

// Resolution is stable for the lifetime of the machine session, so cache it per probe.
const pythonResolutionCache = new Map<string, { command: string; args: string[] }>();

/**
 * Cheap availability probe: runs `importlib.util.find_spec` (never imports the
 * heavy packages) and caches the answer, so status screens do not have to keep a
 * python worker resident just to answer "is this feature available?".
 */
export function pythonModulesAvailable(modules: string[]): boolean {
  const cacheKey = `probe:${modules.join(',')}`;
  const cached = pythonResolutionCache.get(cacheKey);
  if (cached) return cached.command === 'available';
  const snippet = moduleProbeSnippet(modules);
  const available = localPythonCandidates().some((candidate) => {
    if (!existsSync(candidate)) return false;
    const probe = spawnSync(candidate, [...pythonArgsFor(candidate), '-c', snippet], { stdio: 'ignore', timeout: 15_000 });
    return probe.status === 0;
  });
  pythonResolutionCache.set(cacheKey, available ? { command: 'available', args: [] } : { command: 'missing', args: [] });
  return available;
}

export class NdjsonWorkerClient {
  private child?: ChildProcessWithoutNullStreams;
  private lines?: Interface;
  private readonly pending = new Map<string, PendingRequest>();
  private requestSequence = 0;
  private stopped = false;
  private intentionalKill = false;
  private stderrTail = '';
  private idleTimer?: NodeJS.Timeout;
  private readonly timeoutMs: number;
  private readonly maxFrameBytes: number;
  private readonly idleTimeoutMs: number;

  constructor(private readonly options: NdjsonWorkerOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxFrameBytes = options.maxFrameBytes ?? DEFAULT_MAX_FRAME_BYTES;
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  }

  private clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  /** Release the python process once nothing is pending, so torch/onnxruntime are not held resident. */
  private scheduleIdleShutdown() {
    if (this.idleTimeoutMs <= 0 || this.pending.size > 0 || !this.child) return;
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      if (this.pending.size > 0) return;
      this.killChild();
    }, this.idleTimeoutMs);
  }

  private killChild() {
    this.clearIdleTimer();
    this.intentionalKill = true;
    if (this.child && !this.child.killed) {
      try {
        this.child.stdin.end();
      } catch {
        // stdin may already be closed.
      }
      this.child.kill();
    }
    this.child = undefined;
    this.lines = undefined;
  }

  private resolvePython(): { command: string; args: string[] } {
    const probeModules = this.options.pythonModules ?? [];
    const preferredModules = this.options.pythonOptionalModules ?? [];
    const cacheKey = `${this.options.moduleName}:${probeModules.join(',')}${preferredModules.length ? `:pref:${preferredModules.join(',')}` : ''}`;
    const cached = pythonResolutionCache.get(cacheKey);
    if (cached) return cached;
    const candidates = localPythonCandidates();
    const snippet = probeModules.length ? moduleProbeSnippet(probeModules) : '';
    const preferredSnippet = probeModules.length && preferredModules.length ? moduleProbeSnippet([...probeModules, ...preferredModules]) : '';
    const fallback = { command: candidates.find((candidate) => existsSync(candidate)) ?? candidates[0], args: [] as string[] };
    let resolved: { command: string; args: string[] } | null = null;
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      const args = pythonArgsFor(candidate);
      if (!snippet) {
        resolved = { command: candidate, args };
        break;
      }
      const probe = spawnSync(candidate, [...args, '-c', snippet], { stdio: 'ignore', timeout: 15_000 });
      if (probe.status !== 0) continue;
      if (preferredSnippet) {
        const preferred = spawnSync(candidate, [...args, '-c', preferredSnippet], { stdio: 'ignore', timeout: 15_000 });
        if (preferred.status === 0) {
          resolved = { command: candidate, args };
          break;
        }
        fallback.command = candidate;
        fallback.args = args;
        continue;
      }
      resolved = { command: candidate, args };
      break;
    }
    resolved = resolved ?? fallback;
    pythonResolutionCache.set(cacheKey, resolved);
    return resolved;
  }

  private ensureStarted() {
    if (this.child) return;
    this.clearIdleTimer();
    this.intentionalKill = false;
    const python = this.resolvePython();
    const sidecarRoot = join(this.options.repoRoot, 'python');
    this.child = spawn(python.command, [...python.args, '-m', this.options.moduleName], {
      cwd: this.options.repoRoot,
      env: { ...process.env, PYTHONPATH: sidecarRoot },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.handleLine(line));
    this.child.stderr.on('data', (chunk) => {
      this.stderrTail = `${this.stderrTail}${String(chunk)}`.slice(-4000);
    });
    this.child.on('error', (error) => this.failAll(new Error(`${this.options.label} 启动失败：${error.message}`)));
    this.child.on('exit', (code, signal) => {
      if (this.stopped || this.intentionalKill) {
        this.intentionalKill = false;
        return;
      }
      const detail = this.stderrTail.trim() || `exit code ${code} signal ${signal ?? ''}`.trim();
      this.failAll(new Error(`${this.options.label} 已退出：${detail.slice(0, 600)}`));
      this.child = undefined;
      this.lines = undefined;
    });
  }

  private failAll(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private handleLine(line: string) {
    if (line.length > this.maxFrameBytes) {
      this.failAll(new Error(`${this.options.label} 返回超长响应`));
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(line);
    } catch {
      return;
    }
    const requestId = String(payload.requestId ?? '');
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    clearTimeout(pending.timer);
    pending.resolve(payload);
    this.scheduleIdleShutdown();
  }

  request(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.ensureStarted();
    if (!this.child || !this.child.stdin.writable) {
      return Promise.reject(new Error(`${this.options.label} 不可用`));
    }
    this.requestSequence += 1;
    const requestId = `req_${this.requestSequence}`;
    const body = { ...payload, requestId };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`${this.options.label} 超过 ${Math.round(this.timeoutMs / 1000)} 秒未响应，已放弃本次请求。`));
      }, this.timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      this.child?.stdin.write(`${JSON.stringify(body)}\n`);
    });
  }

  async stop() {
    this.stopped = true;
    this.failAll(new Error(`${this.options.label} stopped by host.`));
    this.killChild();
  }
}
