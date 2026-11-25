import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join } from 'node:path';
import type { PersonalMemoryManifest } from './candidate-admission';

const protocol = 'xiaozhi.personal-memory-worker.v1';
const maximumRequestBytes = 65536;
const maximumOutputBytes = 65536;
const maximumStderrBytes = 8192;
const workerDeadlineMs = 120000;

type ExistingRecord = Readonly<{ id: string; proposal: unknown }>;
type CandidateUsage = { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number };
export type CandidateWorkerSuccess = {
  status: 'success' | 'success_empty';
  proposals: unknown[];
  modelCalls: number;
  usage: CandidateUsage[];
};

type WorkerOptions = { pythonExecutable: string; repoRoot: string; providerKey: string };

function validUsage(value: unknown): value is CandidateUsage {
  return !!value && typeof value==='object' && !Array.isArray(value) && Object.entries(value).every(([key,count])=>
    ['prompt_tokens','completion_tokens','prompt_cache_hit_tokens'].includes(key)
    && typeof count==='number' && Number.isSafeInteger(count) && count>=0);
}

function parseResult(output: Buffer, requestId: string): CandidateWorkerSuccess {
  let result: { schemaVersion?: unknown; requestId?: unknown; status?: unknown; proposals?: unknown; modelCalls?: unknown; usage?: unknown };
  try {
    result = JSON.parse(output.toString('utf8'));
  } catch {
    throw Error('invalid_result');
  }
  if (!result || result.schemaVersion !== protocol || result.requestId !== requestId) throw Error('invalid_result');
  if (result.status !== 'success' && result.status !== 'success_empty') {
    const knownErrors = ['invalid_input', 'dependency_unavailable', 'budget_exhausted', 'provider_configuration',
      'provider_timeout', 'provider_error', 'invalid_result', 'worker_failed'];
    throw Error(typeof result.status === 'string' && knownErrors.includes(result.status) ? result.status : 'worker_failed');
  }
  const { proposals, modelCalls, usage } = result;
  if (!Array.isArray(proposals) || proposals.length > 20 || (result.status === 'success_empty') !== !proposals.length
      || typeof modelCalls !== 'number' || !Number.isInteger(modelCalls) || modelCalls < 1 || modelCalls > 2
      || !Array.isArray(usage) || usage.length > modelCalls || !usage.every(validUsage)) throw Error('invalid_result');
  return {status: result.status, proposals, modelCalls, usage};
}

/** Runs one operation on the explicitly configured local LangMem interpreter. No credentials travel in argv. */
export function runPersonalMemoryCandidateWorker(options: WorkerOptions, manifest: PersonalMemoryManifest,
  existing: readonly ExistingRecord[] = [], signal?: AbortSignal): Promise<CandidateWorkerSuccess> {
  if (signal?.aborted) return Promise.reject(Error('cancelled'));
  if (!manifest.sources.length) return Promise.resolve({status:'success_empty', proposals:[], modelCalls:0, usage:[]});
  if (!isAbsolute(options.pythonExecutable) || !isAbsolute(options.repoRoot) || !options.providerKey) {
    return Promise.reject(Error('provider_configuration'));
  }
  const targets = new Set(manifest.targets.map(target => target.id));
  if (existing.length !== targets.size || new Set(existing.map(row => row.id)).size !== targets.size
      || existing.some(row => !targets.has(row.id))) return Promise.reject(Error('invalid_input'));
  const requestId = randomUUID();
  const payload = Buffer.from(JSON.stringify({schemaVersion:protocol, requestId, mode:existing.length ? 'organize' : 'extract',
    sources:manifest.sources, existing}));
  if (payload.length > maximumRequestBytes) return Promise.reject(Error('invalid_input'));
  const worker = join(options.repoRoot, 'python', 'omni_edu_personal_memory', 'worker.py');
  return new Promise((resolve, reject) => {
    const env = Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','TMPDIR','USERPROFILE','HOME']
      .flatMap(key => process.env[key] ? [[key,process.env[key]]] : []));
    const child = spawn(options.pythonExecutable, ['-I','-X','utf8',worker],
      {cwd:options.repoRoot, windowsHide:true, stdio:['pipe','pipe','pipe'],
        env:{...env, OMNI_EDU_MEMORY_PROVIDER_KEY:options.providerKey, LANGSMITH_TRACING:'false', LANGCHAIN_TRACING_V2:'false'}});
    const chunks: Buffer[] = [];
    let received = 0;
    let stderrBytes = 0;
    let failure: string | undefined;
    const stop = (reason: string) => {
      failure ??= reason;
      child.kill();
    };
    const abort = () => stop('cancelled');
    const timeout = setTimeout(() => stop('provider_timeout'), workerDeadlineMs);
    signal?.addEventListener('abort', abort, {once:true});
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > maximumStderrBytes) stop('worker_failed');
    });
    child.stdout.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > maximumOutputBytes) stop('invalid_result');
      else chunks.push(chunk);
    });
    child.once('error', () => { failure ??= 'dependency_unavailable'; });
    child.stdin.on('error', () => { failure ??= 'worker_failed'; });
    child.once('close', code => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (failure || code !== 0) return reject(Error(failure || 'worker_failed'));
      try {
        resolve(parseResult(Buffer.concat(chunks), requestId));
      } catch (error) {
        reject(error);
      }
    });
    if (signal?.aborted) abort();
    else child.stdin.end(payload);
  });
}
