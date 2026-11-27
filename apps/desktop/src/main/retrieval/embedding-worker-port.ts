import { randomUUID } from 'node:crypto';
import { RETRIEVAL_SCHEMA, type VectorWindow } from '../../shared/retrieval';

const requestKind = 'embedding.request';
const resultKind = 'embedding.result';
type Role = 'query' | 'document';
type EmbeddingRequest = { kind: typeof requestKind; id: string; role: Role; texts: string[] };
type EmbeddingResult = { schemaVersion: typeof RETRIEVAL_SCHEMA; kind: typeof resultKind; id: string; values?: VectorWindow[][]; error?: string };

export function isEmbeddingRequest(value: unknown): value is EmbeddingRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<EmbeddingRequest>;
  return request.kind === requestKind && typeof request.id === 'string' && request.id.length <= 64
    && (request.role === 'query' || request.role === 'document') && Array.isArray(request.texts)
    && request.texts.length > 0 && request.texts.length <= 2
    && request.texts.every(text => typeof text === 'string' && text.length <= 12000);
}

export function embeddingResult(id: string, values?: VectorWindow[][], error?: string): EmbeddingResult {
  return { schemaVersion: RETRIEVAL_SCHEMA, kind: resultKind, id, values, error };
}

export function createWorkerEmbedding(send: (request: EmbeddingRequest) => void) {
  const pending = new Map<string, { resolve: (value: VectorWindow[][]) => void; reject: (error: Error) => void }>();
  return {
    embed(role: Role, texts: string[]) {
      const request = { kind: requestKind, id: randomUUID(), role, texts } as const;
      if (!isEmbeddingRequest(request)) return Promise.reject(Error('invalid_input'));
      if (pending.size >= 32) return Promise.reject(Error('busy'));
      return new Promise<VectorWindow[][]>((resolve, reject) => {
        pending.set(request.id, { resolve, reject });
        try { send(request); }
        catch { pending.delete(request.id); reject(Error('embedding_unavailable')); }
      });
    },
    receive(message: unknown) {
      const result = message as Partial<EmbeddingResult> | null;
      if (result?.schemaVersion !== RETRIEVAL_SCHEMA || result.kind !== resultKind || typeof result.id !== 'string') return false;
      const request = pending.get(result.id);
      pending.delete(result.id);
      if (Array.isArray(result.values)) request?.resolve(result.values);
      else request?.reject(Error(result.error === 'invalid_input' ? 'invalid_input' : 'embedding_unavailable'));
      return true;
    },
    close() {
      for (const request of pending.values()) request.reject(Error('cancelled'));
      pending.clear();
    },
  };
}
