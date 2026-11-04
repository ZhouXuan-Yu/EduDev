import { createHash } from 'node:crypto';
import type sqlite3 from 'sqlite3';
import type { TeacherResource } from '../../shared/contracts';
import { MATERIAL_PAGE_SIZE, materialTerms } from '../../shared/materials';
import {
    MATERIAL_CATALOG_SCHEMA as schema,
    catalogKey,
    catalogPatch,
    normalizeCatalogMetadata,
    normalizeCatalogScope,
    validCatalogQuery,
    validCatalogSave,
    validCatalogMetadataQuery,
    type CatalogScope,
    type CatalogQuery,
    type CatalogPage,
    type CatalogFacets,
    type CatalogMetadataQuery,
    type CatalogMetadataView,
    type CatalogSave
} from '../../shared/material-catalog';
type Row = Record<string, unknown>;
type Value = string | number | null;
type Host = {
    open: () => Promise<sqlite3.Database>;
    mapResource: (row: Row) => TeacherResource;
    assertOpen: () => void;
};
type Sql = {
    all: (sql: string, p?: Value[]) => Promise<Row[]>;
    run: (sql: string, p?: Value[]) => Promise<void>;
};
export type CatalogSnapshot = {
    stamp: string;
    resourceIds: string[];
};
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
const metadataTable = 'material_catalog_metadata_v1', tagsTable = 'material_catalog_tags_v1';
/** A filename suffix, including legacy extensionless names, matches the existing catalogue display. */
export const catalogFormatSql = (r = 'r') => `COALESCE(NULLIF(upper((
    WITH RECURSIVE suffix(v) AS (
        SELECT ${r}.original_file_name
        UNION ALL SELECT substr(v,instr(v,'.')+1) FROM suffix WHERE instr(v,'.')>0
    ) SELECT v FROM suffix WHERE instr(v,'.')=0 LIMIT 1
)),''),'资料')`;
export const catalogStateSql = (r = 'r') => `CASE
    WHEN ${r}.parse_status='failed' THEN 'error'
    WHEN ${r}.parse_status IN ('ready','parsed','chunked','indexed','graph_extracted')
        AND EXISTS(SELECT 1 FROM resource_chunks cc WHERE cc.resource_id=${r}.id)
    THEN 'ready' ELSE 'waiting' END`;
/** Internal SQL only: renderer supplies a typed filter, never SQL or a path. */
export function catalogPredicate(raw: CatalogScope, r = 'r'): {
    sql: string;
    params: Value[];
} {
    const scope = normalizeCatalogScope(raw), parts: string[] = [], params: Value[] = [];
    if (scope.directory !== null) {
        parts.push(`COALESCE((SELECT m.directory_key FROM ${metadataTable} m WHERE m.resource_id=${r}.id),'')=?`);
        params.push(scope.directory);
    }
    for (const tag of scope.tags) {
        parts.push(`EXISTS(SELECT 1 FROM ${tagsTable} t WHERE t.resource_id=${r}.id AND t.tag_key=?)`);
        params.push(tag);
    }
    if (scope.format) {
        parts.push(`${catalogFormatSql(r)}=?`);
        params.push(scope.format);
    }
    if (scope.state) {
        parts.push(`${catalogStateSql(r)}=?`);
        params.push(scope.state);
    }
    return { sql: parts.length ? parts.join(' AND ') : '1', params };
}
/** Own short connections: no callback reads from the parent connection while a writer is held. */
export class MaterialCatalogRepository {
    private closing = false;
    private tasks = new Set<Promise<unknown>>();
    constructor(private host: Host) {
    }
    private current(assertCurrent: () => void) {
        if (this.closing)
            throw Error('cancelled');
        this.host.assertOpen();
        assertCurrent();
    }
    private work<T>(write: boolean, action: (sql: Sql, current: () => void) => Promise<T>, assertCurrent: () => void = () => {
    }): Promise<T> {
        const current = () => this.current(assertCurrent);
        let committed = false;
        const task = (async () => {
            current();
            const db = await this.host.open();
            const raw = (sql: string) => new Promise<void>((resolve, reject) => db.exec(sql, e => e ? reject(e) : resolve()));
            const sql: Sql = {
                all: async (q, p = []) => {
                    current();
                    const rows = await new Promise<Row[]>((resolve, reject) => db.all(q, p, (e, rows: Row[]) => e ? reject(e) : resolve(rows)));
                    current();
                    return rows;
                }, run: async (q, p = []) => {
                    current();
                    await new Promise<void>((resolve, reject) => db.run(q, p, e => e ? reject(e) : resolve()));
                    current();
                }
            };
            try {
                current();
                await raw('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; ' + (write ? 'BEGIN IMMEDIATE;' : 'BEGIN;'));
                current();
                const result = await action(sql, current);
                current();
                await raw('COMMIT;');
                committed = true;
                return result;
            }
            catch (error) {
                if (!committed)
                    await raw('ROLLBACK;').catch(() => undefined);
                throw error;
            }
            finally {
                await new Promise<void>((resolve, reject) => db.close(e => e ? reject(e) : resolve()));
            }
        })();
        this.tasks.add(task);
        void task.then(() => this.tasks.delete(task), () => this.tasks.delete(task));
        return task;
    }
    async init() {
        this.closing = false;
        await this.work(true, async (sql) => {
            await sql.run(`CREATE TABLE IF NOT EXISTS ${metadataTable}(
                resource_id TEXT PRIMARY KEY REFERENCES teacher_resources(id),
                revision INTEGER NOT NULL CHECK(revision>0),
                directory TEXT NOT NULL, directory_key TEXT NOT NULL,
                operation_id TEXT NOT NULL, base_revision INTEGER NOT NULL,
                source_version TEXT NOT NULL, patch_digest TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )`);
            await sql.run(`CREATE TABLE IF NOT EXISTS ${tagsTable}(
                resource_id TEXT NOT NULL REFERENCES ${metadataTable}(resource_id),
                tag_key TEXT NOT NULL, label TEXT NOT NULL,
                PRIMARY KEY(resource_id,tag_key)
            )`);
            await sql.run(`CREATE INDEX IF NOT EXISTS material_catalog_directory_v1 ON ${metadataTable}(directory_key,resource_id)`);
            await sql.run(`CREATE INDEX IF NOT EXISTS material_catalog_tag_v1 ON ${tagsTable}(tag_key,resource_id)`);
        });
    }
    /** Synchronous latch runs before the first await in store shutdown. */
    async close() {
        this.closing = true;
        await Promise.allSettled([...this.tasks]);
    }
    private async view(sql: Sql, resourceId: string, expectedSource?: string): Promise<CatalogMetadataView> {
        const r = (await sql.all('SELECT content_hash FROM teacher_resources WHERE id=?', [resourceId]))[0];
        if (!r)
            throw Error('not_found');
        const sourceVersion = String(r.content_hash || '');
        if (expectedSource !== undefined && sourceVersion !== expectedSource)
            throw Error('source_changed');
        const m = (await sql.all(`SELECT * FROM ${metadataTable} WHERE resource_id=?`, [resourceId]))[0], tags = await sql.all(`SELECT label FROM ${tagsTable} WHERE resource_id=? ORDER BY tag_key`, [resourceId]);
        return {
            schemaVersion: schema, resourceId, sourceVersion, revision: Number(m?.revision || 0), metadata: { directory: String(m?.directory || ''), tags: tags.map(t => String(t.label)) }, receipt: m ? {
                operationId: String(m.operation_id), baseRevision: Number(m.base_revision), sourceVersion: String(m.source_version), patchDigest: String(m.patch_digest)
            } : null
        };
    }
    get(input: CatalogMetadataQuery, assertCurrent?: () => void) {
        if (!validCatalogMetadataQuery(input))
            return Promise.reject(Error('invalid_input'));
        return this.work(false, sql => this.view(sql, input.resourceId, input.sourceVersion), assertCurrent);
    }
    save(input: CatalogSave, assertCurrent?: () => void) {
        if (!validCatalogSave(input))
            return Promise.reject(Error('invalid_input'));
        const metadata = normalizeCatalogMetadata(input.metadata), patchDigest = digest(catalogPatch(metadata));
        return this.work(true, async (sql) => {
            const prior = await this.view(sql, input.resourceId, input.sourceVersion);
            if (prior.receipt?.operationId === input.operationId) {
                if (prior.receipt.patchDigest !== patchDigest || prior.receipt.baseRevision !== input.expectedRevision || prior.receipt.sourceVersion !== input.sourceVersion)
                    throw Error('operation_conflict');
                return prior;
            }
            if (prior.revision !== input.expectedRevision)
                throw Error('revision_conflict');
            await sql.run(`INSERT INTO ${metadataTable}(
                resource_id,revision,directory,directory_key,operation_id,
                base_revision,source_version,patch_digest,updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(resource_id) DO UPDATE SET
                revision=excluded.revision, directory=excluded.directory,
                directory_key=excluded.directory_key, operation_id=excluded.operation_id,
                base_revision=excluded.base_revision, source_version=excluded.source_version,
                patch_digest=excluded.patch_digest, updated_at=excluded.updated_at`, [
                input.resourceId, prior.revision + 1, metadata.directory,
                catalogKey(metadata.directory), input.operationId, input.expectedRevision,
                input.sourceVersion, patchDigest, new Date().toISOString()
            ]);
            await sql.run(`DELETE FROM ${tagsTable} WHERE resource_id=?`, [input.resourceId]);
            for (const label of metadata.tags)
                await sql.run(`INSERT INTO ${tagsTable}(resource_id,tag_key,label) VALUES(?,?,?)`, [input.resourceId, catalogKey(label), label]);
            return this.view(sql, input.resourceId, input.sourceVersion);
        }, assertCurrent);
    }
    list(input: CatalogQuery, assertCurrent?: () => void): Promise<CatalogPage> {
        if (!validCatalogQuery(input))
            return Promise.reject(Error('invalid_input'));
        return this.work(false, async (sql) => {
            const p = catalogPredicate(input.scope), terms = materialTerms(input.query);
            for (const term of terms) {
                p.sql += ` AND (instr(lower(r.title||' '||r.original_file_name||' '||r.resource_type),?)>0 OR EXISTS(SELECT 1 FROM ${tagsTable} t WHERE t.resource_id=r.id AND instr(t.tag_key,?)>0))`;
                p.params.push(term, term);
            }
            const total = Number((await sql.all(`SELECT COUNT(*) n FROM teacher_resources r WHERE ${p.sql}`, p.params))[0].n);
            const rows = await sql.all(`SELECT r.*,
                (SELECT COUNT(*) FROM resource_chunks c WHERE c.resource_id=r.id) chunk_count
                FROM teacher_resources r WHERE ${p.sql}
                ORDER BY r.updated_at DESC,r.id DESC LIMIT ? OFFSET ?`,
                [...p.params, MATERIAL_PAGE_SIZE, input.offset]);
            const items = [];
            for (const row of rows)
                items.push({ resource: this.host.mapResource(row), organization: await this.view(sql, String(row.id)) });
            const facets: CatalogFacets = { directories: [], tags: [], formats: [], states: [] };
            for (const [key, q] of Object.entries({
                directories: `SELECT COALESCE(m.directory,'') value,COUNT(*) count
                    FROM teacher_resources r LEFT JOIN ${metadataTable} m ON m.resource_id=r.id
                    GROUP BY COALESCE(m.directory_key,'') ORDER BY value`,
                tags: `SELECT t.label value,COUNT(*) count FROM ${tagsTable} t
                    JOIN teacher_resources r ON r.id=t.resource_id GROUP BY t.tag_key ORDER BY t.tag_key`,
                formats: `SELECT ${catalogFormatSql()} value,COUNT(*) count
                    FROM teacher_resources r GROUP BY value ORDER BY value`,
                states: `SELECT ${catalogStateSql()} value,COUNT(*) count
                    FROM teacher_resources r GROUP BY value ORDER BY value`
            }))
                facets[key as keyof CatalogFacets] = (await sql.all(q)).map(r => ({ value: String(r.value), count: Number(r.count) }));
            return {
                schemaVersion: schema, items, total, offset: input.offset, hasMore: input.offset + items.length < total, facets
            };
        }, assertCurrent);
    }
    snapshot(scope: CatalogScope, assertCurrent?: () => void): Promise<CatalogSnapshot> {
        return this.work(false, async (sql) => {
            const versioned = (await sql.all("SELECT 1 FROM sqlite_master WHERE name='retrieval_source_revisions'")).length > 0;
            const sourceRevision = versioned ? 'COALESCE((SELECT revision FROM retrieval_source_revisions v WHERE v.resource_id=r.id),0)' : '0';
            const p = catalogPredicate(scope);
            const rows = await sql.all(`SELECT
                r.id,r.content_hash,r.parse_status,r.parse_engine,r.updated_at,
                ${sourceRevision} source_revision,COALESCE(m.revision,0) revision,
                (SELECT COUNT(*) FROM resource_chunks c WHERE c.resource_id=r.id) chunks
                FROM teacher_resources r LEFT JOIN ${metadataTable} m ON m.resource_id=r.id
                WHERE ${p.sql} ORDER BY r.id`, p.params);
            return { stamp: digest(JSON.stringify(rows)), resourceIds: rows.map(r => String(r.id)) };
        }, assertCurrent);
    }
}
