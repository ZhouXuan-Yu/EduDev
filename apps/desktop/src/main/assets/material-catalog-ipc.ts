import type { OmniEduStore } from '../db';
import { MATERIAL_SEARCH_SCHEMA, type MaterialTextHit } from '../../shared/material-search';
import {
    hasCatalogScope,
    normalizeCatalogScope,
    validCatalogBodyQuery,
    validCatalogMetadataQuery,
    validCatalogQuery,
    validCatalogSave,
    type CatalogBodyPage
} from '../../shared/material-catalog';
import { materialCitation } from '../../shared/materials';
import { materialReference, materialUnitDigest } from './material-source';
import { materialSnippet } from './material-snippet';
/** Shares the original main-window/main-frame authority; it grants no new file capability. */
export function registerMaterialCatalogIpc(
    store: OmniEduStore,
    ipc: Pick<Electron.IpcMain, 'handle'>,
    check: (event: Electron.IpcMainInvokeEvent) => void
) {
    ipc.handle('materials:catalog-list', async (event, input) => {
        check(event);
        if (!validCatalogQuery(input))
            throw Error('invalid_input');
        const result = await store.materialCatalog.list(structuredClone(input), () => check(event));
        check(event);
        return result;
    });
    ipc.handle('materials:catalog-metadata', async (event, input) => {
        check(event);
        if (!validCatalogMetadataQuery(input))
            throw Error('invalid_input');
        const result = await store.materialCatalog.get(structuredClone(input), () => check(event));
        check(event);
        return result;
    });
    ipc.handle('materials:catalog-save', async (event, input) => {
        check(event);
        if (!validCatalogSave(input))
            throw Error('invalid_input');
        const result = await store.materialCatalog.save(structuredClone(input), () => check(event));
        check(event);
        return result;
    });
    ipc.handle('materials:catalog-search', async (event, input): Promise<CatalogBodyPage> => {
        check(event);
        if (!validCatalogBodyQuery(input))
            throw Error('invalid_input');
        const q = structuredClone(input), scope = normalizeCatalogScope(q.scope);
        const before = await store.materialCatalog.snapshot(scope, () => check(event));
        check(event);
        if (!before.resourceIds.length) {
            const index = await store.materialSearch.status();
            check(event);
            const after = await store.materialCatalog.snapshot(scope, () => check(event));
            if (after.stamp !== before.stamp)
                throw Error('scope_changed');
            check(event);
            return {
                schemaVersion: MATERIAL_SEARCH_SCHEMA,
                hits: [], offset: q.offset, hasMore: false, index,
                catalogScope: scope, scopeStamp: before.stamp, actualMode: 'keyword'
            };
        }
        const scoped = hasCatalogScope(scope), catalog = scoped ? { scope, resourceIds: before.resourceIds } : undefined;
        const hybrid = q.mode === 'keyword' ? undefined : await store.retrieval.materials(q.query, undefined, 200, q.offset, 20, catalog);
        check(event);
        const result = hybrid || await store.materialSearch.candidates(q.query, undefined, 20, q.offset, true, scoped ? scope : undefined);
        check(event);
        const hits: MaterialTextHit[] = [], receipts: {
            id: string;
            seq: number;
            sources?: {
                id: string;
                revision: number;
            }[];
        }[] = [];
        const membership = new Set(before.resourceIds);
        for (const unit of result.units) {
            if (!membership.has(unit.resourceId))
                throw Error('scope_changed');
            const current = await store.retrieval.fact('material', unit.chunk.id);
            check(event);
            if (current.fact.deleted || !current.unit || current.unit.version !== unit.version || materialUnitDigest(current.unit) !== materialUnitDigest(unit))
                throw Error('source_changed');
            const source = materialReference(unit);
            await store.materials.source(source);
            check(event);
            const match = hybrid?.hits.find(h => h.unit.chunk.id === unit.chunk.id);
            const excerpt = match?.method === 'semantic'
                ? unit.chunk.contentMd.slice(
                    Math.max(0, match.start - 80),
                    Math.min(unit.chunk.contentMd.length, Math.max(match.start + 400, match.end))
                ).slice(0, 500)
                : materialSnippet(unit.chunk.contentMd, q.query);
            hits.push({
                title: unit.title, excerpt, source,
                citation: unit.restored
                    ? `${unit.title} · AI还原正文（原件第${unit.restored.page}页）`
                    : materialCitation(unit.title, unit.chunk),
                ...(match ? { method: match.method } : {})
            });
            receipts.push({ id: unit.chunk.id, seq: current.fact.seq, sources: current.sources });
        }
        const valid = await store.retrieval.filterCurrent('material', receipts, hybrid?.semantic);
        check(event);
        if (hits.some(h => !valid.has(h.source.chunkId)))
            throw Error('source_changed');
        // A new short snapshot, never the old snapshot held across embedding/reranking.
        const after = await store.materialCatalog.snapshot(scope, () => check(event));
        if (after.stamp !== before.stamp)
            throw Error('scope_changed');
        check(event);
        return {
            schemaVersion: MATERIAL_SEARCH_SCHEMA,
            hits, offset: q.offset, hasMore: result.hasMore, index: result.index,
            ...(hybrid ? { semantic: hybrid.semantic } : {}),
            catalogScope: scope, scopeStamp: before.stamp,
            actualMode: hybrid?.semantic.available ? 'hybrid' : 'keyword'
        };
    });
}
