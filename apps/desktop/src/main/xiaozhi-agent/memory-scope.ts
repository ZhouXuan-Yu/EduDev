import { createHash } from 'node:crypto';
import type { OmniEduStore } from '../db';
import type { XiaozhiMemoryCatalogInput, XiaozhiMemoryCatalogResult, XiaozhiMemoryPreview,
  XiaozhiMemoryScope, XiaozhiMemoryScopeInput, XiaozhiMemorySource, XiaozhiMemoryTrace } from '../../shared/xiaozhi-memory';
import { XIAOZHI_MEMORY_LABELS, projectMemorySource } from '../../shared/xiaozhi-memory';
import type { XiaozhiActionResult } from '../../shared/xiaozhi-agent';
import type { PrivateMemorySelection } from './memory-scope-state';
import { validMemoryScopeInput, validMemorySelection, validMemorySession, validMemorySource } from './memory-selection';

type MemoryFact = XiaozhiMemorySource & Omit<XiaozhiMemoryPreview, 'sanitizedText' | 'layer' | 'source'> & { fingerprint: string };
/** Existing SQLite remains the memory fact source. Nothing here invokes a provider. */
export function createPiMemoryScope(store: OmniEduStore, options: { modelAccess?: 'available' } = {}) {
  async function facts(source: XiaozhiMemorySource): Promise<MemoryFact[]> {
    const items = source.layer === 'L2' ? (await store.getAiMemoryDocument(source.source))?.entries || []
      : (await store.getAiMemoryL3Document(source.source))?.entries || [];
    return items.map(entry => {
      if (!validMemorySelection({ ...projectMemorySource(source), id: entry.id, version: entry.version }) || typeof entry.text !== 'string' || entry.text.length > 1000
        || !['active', 'disabled', 'deleted'].includes(entry.status)) throw new Error('configuration');
      const refs = 'refs' in entry ? entry.refs : [];
      const surfaces = 'sourceDocuments' in entry ? entry.sourceDocuments : [];
      const fingerprint = createHash('sha256').update(JSON.stringify({ id: entry.id, version: entry.version, text: entry.text,
        status: entry.status, refs, surfaces, documentId: entry.documentId })).digest('hex');
      return { ...projectMemorySource(source), id: entry.id, version: entry.version, text: entry.text, status: entry.status,
        section: 'section' in entry ? entry.section.slice(0, 160) : XIAOZHI_MEMORY_LABELS[source.source],
        provenance: source.layer === 'L3' ? 'surface_only' : refs.length ? 'event_refs' : 'none',
        refs: refs.slice(0, 24).map(ref => ({ kind: ref.kind, id: ref.id.slice(0, 160), label: ref.label.slice(0, 160) })),
        sourceDocuments: surfaces.slice(0, 7), referenceCount: refs.length, fingerprint };
    });
  }
  async function availableSession(id: string, allowArchived = false) {
    if (!validMemorySession(id)) throw new Error('invalid_input');
    if ((await store.getAiConversationSession(id)).session.archivedAt && !allowArchived) throw new Error('permission_denied');
  }
  async function scope(id: string): Promise<XiaozhiMemoryScope> {
    await availableSession(id, true);
    const saved = await store.xiaozhiState.memoryScope(id);
    const cache = new Map<string, MemoryFact[] | null>();
    const selections: XiaozhiMemoryScope['selections'] = [];
    for (const item of saved.selections) {
      const key = `${item.layer}:${item.source}`;
      if (!cache.has(key)) { try { cache.set(key, await facts(item)); } catch { cache.set(key, null); } }
      const list = cache.get(key), current = list?.find(entry => entry.id === item.id);
      const state = !list ? 'unavailable' : !current || current.status === 'deleted' ? 'missing'
        : current.status !== 'active' ? 'disabled' : current.version !== item.version || current.fingerprint !== item.fingerprint ? 'changed' : 'ready';
      const { fingerprint: _private, ...selection } = item;
      selections.push({ ...selection, state, label: XIAOZHI_MEMORY_LABELS[item.source] });
    }
    return { version: saved.version, enabled: saved.enabled, modelAccess: options.modelAccess || 'unavailable', selections };
  }
  async function authority(id: string) {
    await availableSession(id);
    const saved = await store.xiaozhiState.memoryScope(id);
    const current: Array<{ id: string; fingerprint: string | null; state: string }> = [];
    const cache = new Map<string, MemoryFact[] | null>();
    if (saved.enabled) for (const item of saved.selections) {
      const sourceKey = `${item.layer}:${item.source}`;
      if (!cache.has(sourceKey)) { try { cache.set(sourceKey, await facts(item)); } catch { cache.set(sourceKey, null); } }
      const list = cache.get(sourceKey), fact = list?.find(entry => entry.id === item.id);
      current.push({ id: item.id, fingerprint: fact?.fingerprint || null, state: !list ? 'unavailable' : !fact || fact.status === 'deleted' ? 'missing'
        : fact.status !== 'active' ? 'disabled' : fact.version !== item.version || fact.fingerprint !== item.fingerprint ? 'changed' : 'ready' });
    }
    if (JSON.stringify(saved) !== JSON.stringify(await store.xiaozhiState.memoryScope(id))) throw new Error('memory_scope_changed');
    return { fingerprint: createHash('sha256').update(JSON.stringify({ saved, current })).digest('hex'),
      enabled: saved.enabled, valid: current.every(item => item.state === 'ready'), version: saved.version };
  }
  return {
    scope, authority,
    /** Main-only model payload. Never expose this method or authority hash through preload. */
    async readSelected(id: string, expectedAuthority: string, signal?: AbortSignal) {
      signal?.throwIfAborted();
      const initial = await authority(id);
      if (initial.fingerprint !== expectedAuthority || !initial.valid) throw new Error('memory_scope_changed');
      const saved = await store.xiaozhiState.memoryScope(id);
      const payload: Array<{ reference: string; layer: 'L2' | 'L3'; source: string; version: number; text: string;
        provenance: XiaozhiMemoryPreview['provenance']; sourceDocuments: string[]; refs: Array<{ kind: 'run' | 'event'; label: string }> }> = [];
      if (saved.enabled) for (const item of saved.selections) {
        signal?.throwIfAborted();
        const fact = (await facts(item)).find(entry => entry.id === item.id);
        if (!fact || fact.status !== 'active' || fact.version !== item.version || fact.fingerprint !== item.fingerprint) throw new Error('memory_scope_changed');
        const text = (await store.sanitizeProblemText(fact.text)).sanitizedText;
        const refs = [];
        for (const ref of fact.refs) refs.push({ kind: ref.kind, label: (await store.sanitizeProblemText(ref.label)).sanitizedText });
        payload.push({ reference: `记忆${payload.length + 1}`, layer: fact.layer, source: XIAOZHI_MEMORY_LABELS[fact.source],
          version: fact.version, text, provenance: fact.provenance, sourceDocuments: fact.sourceDocuments.map(source => XIAOZHI_MEMORY_LABELS[source]), refs });
      }
      const final = await authority(id);
      signal?.throwIfAborted();
      if (final.fingerprint !== expectedAuthority || !final.valid) throw new Error('memory_scope_changed');
      return payload;
    },
    async catalog(input: XiaozhiMemoryCatalogInput): Promise<XiaozhiMemoryCatalogResult> {
      if (!validMemorySource(input) || Object.keys(input).length !== 4 || Object.keys(input).some(key => !['sessionId', 'layer', 'source', 'offset'].includes(key))
        || !validMemorySession(input.sessionId) || !Number.isSafeInteger(input.offset) || input.offset < 0 || input.offset > 100000) return { ok: false, error: 'invalid_input' };
      try {
        await availableSession(input.sessionId);
        const list = await facts(input), entries: XiaozhiMemoryPreview[] = [];
        for (const { fingerprint: _private, ...item } of list.slice(input.offset, input.offset + 50)) {
          const sanitizedText = (await store.sanitizeProblemText(item.text)).sanitizedText;
          entries.push({ ...item, ...projectMemorySource(item), sanitizedText });
        }
        return { ok: true, catalog: { ...projectMemorySource(input), offset: input.offset,
          total: list.length, hasMore: input.offset + entries.length < list.length, entries } };
      } catch (error) { return { ok: false, error: error instanceof Error && error.message === 'permission_denied' ? 'permission_denied' : 'configuration' }; }
    },
    async trace(id: string): Promise<XiaozhiMemoryTrace | null> {
      await availableSession(id);
      const row = (await store.xiaozhiState.runs(id)).at(-1);
      if (!row) return null; // Never fall back to another conversation's latest run.
      const result = await store.getAiMemoryTrace(String(row.id), 30);
      return { runId: String(row.id), status: result.status, events: result.events.map(event => ({
        sequence: event.sequence, status: event.status, label: event.label, tool: event.toolName,
      })) };
    },
    async save(input: XiaozhiMemoryScopeInput): Promise<XiaozhiActionResult> {
      if (!validMemoryScopeInput(input)) return { ok: false, error: 'invalid_input' };
      try {
        await availableSession(input.sessionId);
        const selections: PrivateMemorySelection[] = [], cache = new Map<string, MemoryFact[]>();
        for (const item of input.selections) {
          const key = `${item.layer}:${item.source}`;
          if (!cache.has(key)) cache.set(key, await facts(item));
          const current = cache.get(key)!.find(entry => entry.id === item.id);
          if (!current || current.status !== 'active') return { ok: false, error: 'permission_denied' };
          if (current.version !== item.version) return { ok: false, error: 'command_conflict' };
          selections.push({ ...item, fingerprint: current.fingerprint });
        }
        return await store.xiaozhiState.saveMemoryScope(input.sessionId, input.version, { enabled: input.enabled, selections })
          ? { ok: true } : { ok: false, error: 'command_conflict' };
      } catch (error) { return { ok: false, error: error instanceof Error && error.message === 'permission_denied' ? 'permission_denied' : 'configuration' }; }
    },
  };
}
