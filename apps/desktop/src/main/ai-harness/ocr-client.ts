import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type OcrLine = {
  text: string;
  confidence: number;
  bbox: number[][];
};

export type OcrHealthResult = {
  ok: boolean;
  modelAvailable: boolean;
  modelVersion: string;
  loadError: string;
};

export type OcrImageResult =
  | { ok: true; lines: OcrLine[]; lowConfidenceCount: number; modelVersion: string }
  | { ok: false; code: string; message: string };

const MAX_FRAME_BYTES = 2_000_000;
const OCR_TIMEOUT_MS = 120_000;

function ocrPythonCommand() {
  if (process.env.OMNI_EDU_PYTHON) return { command: process.env.OMNI_EDU_PYTHON, args: [] };
  if (process.platform !== 'win32') return { command: 'python3', args: [] };
  const candidates = ['C:\\Python314\\python.exe', 'D:\\Anaconda\\python.exe', 'C:\\Windows\\py.exe'];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const args = /(?:^|[\\/])py(?:\.exe)?$/i.test(candidate) ? ['-3'] : [];
    const probe = spawnSync(candidate, [...args, '-c', 'import rapidocr'], { stdio: 'ignore', timeout: 15_000 });
    if (probe.status === 0) return { command: candidate, args };
  }
  return { command: candidates.find((candidate) => existsSync(candidate)) ?? 'py', args: [] };
}

type PendingRequest = {
  resolve: (response: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

export class OcrWorkerClient {
  private child?: ChildProcessWithoutNullStreams;
  private lines?: Interface;
  private readonly pending = new Map<string, PendingRequest>();
  private requestSequence = 0;
  private stopped = false;
  private stderrTail = '';

  constructor(private readonly repoRoot: string) {}

  private ensureStarted() {
    if (this.child) return;
    const python = ocrPythonCommand();
    const sidecarRoot = join(this.repoRoot, 'python');
    this.child = spawn(python.command, [...python.args, '-m', 'omni_edu_ocr'], {
      cwd: this.repoRoot,
      env: { ...process.env, PYTHONPATH: sidecarRoot },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.handleLine(line));
    this.child.stderr.on('data', (chunk) => {
      this.stderrTail = `${this.stderrTail}${String(chunk)}`.slice(-4000);
    });
    this.child.on('error', (error) => this.failAll(new Error(`OCR worker 启动失败：${error.message}`)));
    this.child.on('exit', (code, signal) => {
      if (this.stopped) return;
      const detail = this.stderrTail.trim() || `exit code ${code} signal ${signal ?? ''}`.trim();
      this.failAll(new Error(`OCR worker 已退出：${detail.slice(0, 600)}`));
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
    if (line.length > MAX_FRAME_BYTES) {
      this.failAll(new Error('OCR worker 返回超长响应'));
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
  }

  private request(type: 'health' | 'ocr', imagePath?: string): Promise<Record<string, unknown>> {
    this.ensureStarted();
    if (!this.child || !this.child.stdin.writable) {
      return Promise.reject(new Error('OCR worker 不可用'));
    }
    this.requestSequence += 1;
    const requestId = `ocr_req_${this.requestSequence}`;
    const payload = imagePath
      ? { schemaVersion: 'xiazhi.ocr.request.v1', requestId, type, imagePath }
      : { schemaVersion: 'xiazhi.ocr.request.v1', requestId, type };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('OCR 识别超过 120 秒，已放弃本次请求。'));
      }, OCR_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timer });
      this.child?.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  async health(): Promise<OcrHealthResult> {
    const response = await this.request('health');
    return {
      ok: response.ok === true,
      modelAvailable: response.modelAvailable === true,
      modelVersion: String(response.modelVersion ?? ''),
      loadError: String(response.loadError ?? ''),
    };
  }

  async runOcr(imagePath: string): Promise<OcrImageResult> {
    const response = await this.request('ocr', imagePath);
    if (response.ok !== true) {
      return { ok: false, code: String(response.code ?? 'INTERNAL_ERROR'), message: String(response.message ?? 'OCR 失败') };
    }
    const rawLines = Array.isArray(response.lines) ? response.lines : [];
    const lines: OcrLine[] = [];
    for (const raw of rawLines) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as Record<string, unknown>;
      const text = String(entry.text ?? '').trim();
      if (!text) continue;
      lines.push({
        text,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : 0,
        bbox: Array.isArray(entry.bbox) ? entry.bbox.map((point) => (Array.isArray(point) ? point.map(Number) : [0, 0])) : [],
      });
    }
    return {
      ok: true,
      lines,
      lowConfidenceCount: typeof response.lowConfidenceCount === 'number' ? response.lowConfidenceCount : 0,
      modelVersion: String(response.modelVersion ?? ''),
    };
  }

  async stop() {
    this.stopped = true;
    this.failAll(new Error('OCR worker stopped by host.'));
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
}
