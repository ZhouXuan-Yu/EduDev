import type { TeacherResource } from './contracts';
import type { MaterialTextPage } from './material-search';
import { materialId } from './materials';
export const MATERIAL_CATALOG_SCHEMA = 'xiaozhi.material-catalog.v1' as const;
export const CATALOG_VECTOR_IDS = 256;
export type CatalogState = '' | 'ready' | 'waiting' | 'error';
export type CatalogScope = {
    directory: string | null;
    tags: string[];
    format: string;
    state: CatalogState;
};
export const emptyCatalogScope = (): CatalogScope => ({ directory: null, tags: [], format: '', state: '' });
export type CatalogQuery = {
    schemaVersion: typeof MATERIAL_CATALOG_SCHEMA;
    query: string;
    offset: number;
    scope: CatalogScope;
};
export type CatalogMetadata = {
    directory: string;
    tags: string[];
};
export type CatalogReceipt = {
    operationId: string;
    baseRevision: number;
    sourceVersion: string;
    patchDigest: string;
};
export type CatalogMetadataView = {
    schemaVersion: typeof MATERIAL_CATALOG_SCHEMA;
    resourceId: string;
    sourceVersion: string;
    revision: number;
    metadata: CatalogMetadata;
    receipt: CatalogReceipt | null;
};
export type CatalogMetadataQuery = {
    schemaVersion: typeof MATERIAL_CATALOG_SCHEMA;
    resourceId: string;
    sourceVersion: string;
};
export type CatalogSave = CatalogMetadataQuery & {
    expectedRevision: number;
    operationId: string;
    metadata: CatalogMetadata;
};
export type CatalogFacet = {
    value: string;
    count: number;
};
export type CatalogFacets = {
    directories: CatalogFacet[];
    tags: CatalogFacet[];
    formats: CatalogFacet[];
    states: CatalogFacet[];
};
export type CatalogPage = {
    schemaVersion: typeof MATERIAL_CATALOG_SCHEMA;
    items: {
        resource: TeacherResource;
        organization: CatalogMetadataView;
    }[];
    total: number;
    offset: number;
    hasMore: boolean;
    facets: CatalogFacets;
};
export type CatalogBodyQuery = {
    schemaVersion: typeof MATERIAL_CATALOG_SCHEMA;
    query: string;
    offset: number;
    mode: 'keyword' | 'hybrid';
    scope: CatalogScope;
};
export type CatalogBodyPage = MaterialTextPage & {
    catalogScope: CatalogScope;
    scopeStamp: string;
    actualMode: 'keyword' | 'hybrid';
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
        && Object.getPrototypeOf(v) === Object.prototype
        && Reflect.ownKeys(v).every(k => typeof k === 'string'
        && 'value' in Object.getOwnPropertyDescriptor(v, k)!);
const keys = (v: Record<string, unknown>, names: string[]) => Reflect.ownKeys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
const revision = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < Number.MAX_SAFE_INTEGER;
const source = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const catalogKey = (s: string) => s.normalize('NFKC').trim().toLowerCase();
export function normalizeCatalogMetadata(v: CatalogMetadata): CatalogMetadata {
    const tags = new Map<string, string>();
    for (const raw of v.tags) {
        const label = raw.normalize('NFKC').trim();
        if (label && !tags.has(catalogKey(label)))
            tags.set(catalogKey(label), label);
    }
    return {
        directory: v.directory.normalize('NFKC').trim(), tags: [...tags].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, label]) => label)
    };
}
export const catalogPatch = (v: CatalogMetadata) => JSON.stringify(normalizeCatalogMetadata(v));
export function validCatalogScope(v: unknown): v is CatalogScope {
    return record(v) && keys(v, ['directory', 'tags', 'format', 'state']) && (v.directory === null || text(v.directory, 128))
        && Array.isArray(v.tags)
        && v.tags.length <= 16
        && v.tags.every(t => text(t, 64)
        && catalogKey(t).length > 0)
        && new Set(v.tags.map(catalogKey)).size === v.tags.length
        && text(v.format, 256)
        && ['', 'ready', 'waiting', 'error'].includes(String(v.state));
}
export function normalizeCatalogScope(v: CatalogScope): CatalogScope {
    return {
        directory: v.directory === null ? null : catalogKey(v.directory), tags: [...v.tags.map(catalogKey)].sort(), format: v.format.toUpperCase(), state: v.state
    };
}
export const catalogScopeKey = (v: CatalogScope) => JSON.stringify(normalizeCatalogScope(v));
export const hasCatalogScope = (v: CatalogScope) => v.directory !== null || v.tags.length > 0 || !!v.format || !!v.state;
export function validCatalogQuery(v: unknown): v is CatalogQuery {
    return record(v) && keys(v, ['schemaVersion', 'query', 'offset', 'scope']) && v.schemaVersion === MATERIAL_CATALOG_SCHEMA
        && text(v.query, 128)
        && revision(v.offset)
        && v.offset <= 10000000
        && validCatalogScope(v.scope);
}
export function validCatalogMetadataQuery(v: unknown): v is CatalogMetadataQuery {
    return record(v) && keys(v, ['schemaVersion', 'resourceId', 'sourceVersion']) && v.schemaVersion === MATERIAL_CATALOG_SCHEMA
        && materialId(v.resourceId)
        && source(v.sourceVersion);
}
export function validCatalogSave(v: unknown): v is CatalogSave {
    if (!record(v) || !keys(v, ['schemaVersion', 'resourceId', 'sourceVersion', 'expectedRevision', 'operationId', 'metadata']))
        return false;
    const m = v.metadata;
    return v.schemaVersion === MATERIAL_CATALOG_SCHEMA && materialId(v.resourceId) && source(v.sourceVersion) && revision(v.expectedRevision)
        && typeof v.operationId === 'string'
        && /^catalog_[a-f0-9-]{36}$/.test(v.operationId)
        && record(m)
        && keys(m, ['directory', 'tags'])
        && text(m.directory, 128)
        && Array.isArray(m.tags)
        && m.tags.length <= 16
        && m.tags.every(t => text(t, 64)
        && catalogKey(t).length > 0)
        && text(normalizeCatalogMetadata(m as CatalogMetadata).directory, 128)
        && normalizeCatalogMetadata(m as CatalogMetadata).tags.every(t => text(t, 64));
}
export function validCatalogBodyQuery(v: unknown): v is CatalogBodyQuery {
    return record(v) && keys(v, ['schemaVersion', 'query', 'offset', 'mode', 'scope']) && v.schemaVersion === MATERIAL_CATALOG_SCHEMA
        && text(v.query, 128)
        && !!v.query.trim()
        && revision(v.offset)
        && v.offset <= 1000000
        && ['keyword', 'hybrid'].includes(String(v.mode))
        && validCatalogScope(v.scope);
}
