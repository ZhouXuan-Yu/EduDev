import { NdjsonWorkerClient, pythonModulesAvailable } from './ndjson-worker';

/** Mirrors python/omni_edu_embed MODEL_DIMS so the status panel can answer without loading weights. */
const KNOWN_MODEL_DIMS: Record<string, number> = {
  'BAAI/bge-small-zh-v1.5': 512,
  'BAAI/bge-base-zh-v1.5': 768,
  'BAAI/bge-large-zh-v1.5': 1024,
};
const DEFAULT_VECTOR_MODEL = process.env.OMNI_EDU_EMBED_MODEL || 'BAAI/bge-small-zh-v1.5';

export function vectorModelInfo() {
  return { model: DEFAULT_VECTOR_MODEL, dims: KNOWN_MODEL_DIMS[DEFAULT_VECTOR_MODEL] ?? 0 };
}

export function vectorModelAvailable(): boolean {
  return pythonModulesAvailable(['sentence_transformers', 'lancedb']);
}

export type VectorIndexStatus = {
  available: boolean;
  model: string;
  dims: number;
  indexedCount: number;
  modelError: string;
};

export type VectorIndexResult =
  | { ok: true; indexed: number; indexedCount: number; model: string; dims: number }
  | { ok: false; code: string; message: string };

export type VectorQueryResult =
  | { ok: true; results: Array<{ id: string; score: number }>; model: string; dims: number }
  | { ok: false; code: string; message: string };

export class VectorIndexClient {
  private readonly worker: NdjsonWorkerClient;

  constructor(repoRoot: string) {
    this.worker = new NdjsonWorkerClient({
      repoRoot,
      moduleName: 'omni_edu_embed',
      label: '向量索引 worker',
      timeoutMs: 300_000,
      maxFrameBytes: 4_000_000,
      pythonModules: ['sentence_transformers', 'lancedb'],
    });
  }

  async status(indexPath: string): Promise<VectorIndexStatus> {
    const response = await this.worker.request({ schemaVersion: 'xiazhi.vector.request.v1', type: 'status', indexPath });
    return {
      available: response.modelAvailable === true,
      model: String(response.model ?? ''),
      dims: Number(response.dims ?? 0),
      indexedCount: Number(response.indexedCount ?? 0),
      modelError: String(response.modelError ?? ''),
    };
  }

  async index(indexPath: string, items: Array<{ id: string; text: string }>): Promise<VectorIndexResult> {
    const response = await this.worker.request({ schemaVersion: 'xiazhi.vector.request.v1', type: 'index', indexPath, items });
    if (response.ok !== true) {
      return { ok: false, code: String(response.code ?? 'INTERNAL_ERROR'), message: String(response.message ?? '建立向量索引失败') };
    }
    return {
      ok: true,
      indexed: Number(response.indexed ?? 0),
      indexedCount: Number(response.indexedCount ?? 0),
      model: String(response.model ?? ''),
      dims: Number(response.dims ?? 0),
    };
  }

  async query(indexPath: string, query: string, limit: number): Promise<VectorQueryResult> {
    const response = await this.worker.request({ schemaVersion: 'xiazhi.vector.request.v1', type: 'query', indexPath, query, limit });
    if (response.ok !== true) {
      return { ok: false, code: String(response.code ?? 'INTERNAL_ERROR'), message: String(response.message ?? '向量检索失败') };
    }
    const raw = Array.isArray(response.results) ? response.results : [];
    const results = raw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry) => ({ id: String(entry.id ?? ''), score: Number(entry.score ?? 0) }))
      .filter((entry) => entry.id);
    return { ok: true, results, model: String(response.model ?? ''), dims: Number(response.dims ?? 0) };
  }

  async stop() {
    await this.worker.stop();
  }
}
