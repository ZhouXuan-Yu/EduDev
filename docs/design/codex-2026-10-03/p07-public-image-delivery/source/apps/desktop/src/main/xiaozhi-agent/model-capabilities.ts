import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { XiaozhiModelCapabilities } from '../../shared/xiaozhi-agent';

const ENDPOINT = 'https://api.deepseek.com/v1/models';
const MAX_BYTES = 65536;
const TTL = 24 * 60 * 60 * 1000;
export type DeepSeekCatalogue = { version: 1; endpoint: typeof ENDPOINT; observedAt: string; models: XiaozhiModelCapabilities[] };
const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 4096 && Number(value) <= 16 * 1048576;
export function parseDeepSeekCapabilities(raw: unknown, observedAt: string): DeepSeekCatalogue {
  const data = raw as { object?: unknown; data?: unknown };
  if (!data || data.object !== 'list' || !Array.isArray(data.data) || !data.data.length || data.data.length > 32) throw new Error('configuration');
  const ids = new Set<string>();
  const models = data.data.map((entry: Record<string, unknown>) => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9._-]{1,120}$/.test(entry.id) || ids.has(entry.id)
      || !integer(entry.context_window) || !integer(entry.max_output_tokens) || Number(entry.max_output_tokens) > Number(entry.context_window)) throw new Error('configuration');
    ids.add(entry.id);
    const input = entry.input_modalities;
    if (input !== undefined && (!Array.isArray(input) || !input.length || input.length > 2
      || !input.includes('text') || new Set(input).size !== input.length || input.some(value => value !== 'text' && value !== 'image'))) throw new Error('configuration');
    return { id: entry.id, name: typeof entry.name === 'string' ? entry.name.slice(0, 160) : entry.id,
      contextWindow: Number(entry.context_window), maxOutputTokens: Number(entry.max_output_tokens),
      ...(input === undefined ? {} : { inputModalities: [...input] as ('text' | 'image')[] }), observedAt, source: 'official' as const };
  });
  return { version: 1, endpoint: ENDPOINT, observedAt, models };
}
export async function readDeepSeekCatalogue(root: string): Promise<DeepSeekCatalogue | undefined> {
  try {
    const file = path.join(root, 'deepseek-capabilities.v1.json');
    const stat = await fs.stat(file); if (stat.size > MAX_BYTES || !stat.isFile()) return undefined;
    const saved = JSON.parse(await fs.readFile(file, 'utf8')) as DeepSeekCatalogue;
    if (saved.version !== 1 || saved.endpoint !== ENDPOINT || !Number.isFinite(Date.parse(saved.observedAt)) || Date.parse(saved.observedAt) > Date.now() + 60000) return undefined;
    const catalogue = parseDeepSeekCapabilities({ object: 'list', data: saved.models.map(item => ({ id: item.id, name: item.name, context_window: item.contextWindow, max_output_tokens: item.maxOutputTokens,
      ...(item.inputModalities === undefined ? {} : { input_modalities: item.inputModalities }) })) }, saved.observedAt);
    return { ...catalogue, models: catalogue.models.map(item => ({ ...item, source: 'cache', stale: Date.now() - Date.parse(saved.observedAt) > TTL })) };
  } catch { return undefined; }
}
export async function readDeepSeekCapabilities(root: string, id: string): Promise<XiaozhiModelCapabilities | undefined> {
  return (await readDeepSeekCatalogue(root))?.models.find(item => item.id === id);
}
export async function fetchDeepSeekCatalogue(root: string, apiKey: string, signal?: AbortSignal): Promise<DeepSeekCatalogue> {
  let temporary: string | undefined;
  try {
    const response = await fetch(ENDPOINT, { headers: { Authorization: `Bearer ${apiKey}` },
      redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });
    if (response.status === 401 || response.status === 403) throw new Error('authentication');
    if (!response.ok) throw new Error('transport');
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('configuration');
    const reader = response.body?.getReader(); if (!reader) throw new Error('configuration');
    let size = 0; const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > MAX_BYTES) throw new Error('configuration'); chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const catalogue = parseDeepSeekCapabilities(JSON.parse(Buffer.concat(chunks).toString('utf8')), new Date().toISOString());
    signal?.throwIfAborted();
    await fs.mkdir(root, { recursive: true });
    temporary = path.join(root, `deepseek-capabilities.${randomUUID()}.tmp`);
    await fs.writeFile(temporary, JSON.stringify(catalogue), { flag: 'wx' });
    signal?.throwIfAborted();
    await fs.rename(temporary, path.join(root, 'deepseek-capabilities.v1.json')); temporary = undefined;
    return catalogue;
  } catch (error) {
    if (signal?.aborted) throw new Error('cancelled');
    if (error instanceof Error && ['authentication','configuration','transport'].includes(error.message)) throw error;
    throw new Error(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'transport');
  } finally { if (temporary) await fs.unlink(temporary).catch(() => undefined); }
}
export async function resolveDeepSeekCapabilities(root: string, id: string, apiKey: string, signal?: AbortSignal): Promise<XiaozhiModelCapabilities | undefined> {
  const cached = await readDeepSeekCapabilities(root, id);
  if (cached && !cached.stale && cached.inputModalities) return cached;
  let catalogue: DeepSeekCatalogue;
  try { catalogue = await fetchDeepSeekCatalogue(root, apiKey, signal); }
  catch (error) {
    if (signal?.aborted) throw new Error('cancelled');
    // Same provider/model only. Missing metadata is visible, never fabricated.
    return cached;
  }
  // An official removal is persisted and must never revive the old cached model.
  const found = catalogue.models.find(item => item.id === id);
  if (!found) throw new Error('configuration');
  return found;
}
