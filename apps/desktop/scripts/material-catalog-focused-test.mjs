import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import sqlite3 from 'sqlite3';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const out = fs.mkdtempSync(path.join(fs.realpathSync('test-results'), 'ui-final-material-catalog-native-'));
const sha = v => createHash('sha256').update(v).digest('hex');
const report = {
    success: false, phase: 'PREPARE', checks: [], modelCalls: 0, electron: false, productAcceptance: false, output: out, seams: ['Synthetic owned SQLite fixture; production repositories and IPC handlers run unchanged. Electron transport alone is stubbed.', 'Native LocalVectorStore uses a deterministic synthetic encoder, not an embedding model.', 'Synthetic AI FTS documents verify UNION scope only, not AI page-proof acceptance.']
};
report.sourceFingerprints=Object.fromEntries(["src/shared/material-catalog.ts","src/main/assets/material-catalog.ts","src/main/assets/material-catalog-ipc.ts","src/main/db.ts","src/main/assets/material-ipc.ts","src/preload/index.ts","src/renderer/components/product/MaterialsWorkspace.tsx","src/renderer/components/product/MaterialCatalogFilters.tsx","src/renderer/components/product/MaterialCatalogMetadataEditor.tsx","src/renderer/ui-system/material-catalog.module.css","src/renderer/components/product/MaterialTextSearch.tsx","src/main/assets/material-full-text.ts","src/main/retrieval/repository.ts","src/shared/retrieval.ts","src/main/retrieval/vector-store.ts"].map(file=>[file,sha(fs.readFileSync(file))]));
report.testFingerprint=sha(fs.readFileSync(fileURLToPath(import.meta.url)));
const check = async (code, action) => {
    report.phase = code;
    try {
        await action();
        report.checks.push({ code, status: 'PASS' });
    }
    catch (error) {
        report.checks.push({
            code, status: 'FAIL', hash: sha(String(error)), site: String(error.stack).match(/material-catalog-focused-test\.mjs:\d+:\d+/)?.[0]
        });
        throw error;
    }
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const deferred = () => {
    let resolve;
    const promise = new Promise(r => resolve = r);
    return { promise, resolve };
};
const open = file => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, e => {
        if (e)
            reject(e);
        else {
            db.serialize();
            resolve(db);
        }
    });
});
const adapter = db => ({
    all: (q, p = []) => new Promise((resolve, reject) => db.all(q, p, (e, v) => e ? reject(e) : resolve(v))), run: (q, p = []) => new Promise((resolve, reject) => db.run(q, p, e => e ? reject(e) : resolve())), exec: q => new Promise((resolve, reject) => db.exec(q, e => e ? reject(e) : resolve())), close: () => new Promise((resolve, reject) => db.close(e => e ? reject(e) : resolve()))
});
let main, sql, catalog, fts, vectors, authority = true, hook;
const opened = [], parentTrace = [];
try {
    await build({
        stdin: {
            contents: `export * from './src/shared/material-catalog';export * from './src/shared/retrieval';export * from './src/shared/materials';export * from './src/main/assets/material-catalog';export * from './src/main/assets/material-catalog-ipc';export * from './src/main/assets/material-full-text';export * from './src/main/assets/material-repository';export * from './src/main/retrieval/repository';export * from './src/main/retrieval/vector-store';`, resolveDir: root, loader: 'ts'
        }, outfile: path.join(out, 'runtime.cjs'), bundle: true, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent', plugins: [{
                name: 'unused-electron', setup(b) {
                    b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'unused' }));
                    b.onLoad({ filter: /.*/, namespace: 'unused' }, () => ({
                        contents: `export const utilityProcess={fork(){throw Error('ELECTRON_FORBIDDEN')}}; export const app={isPackaged:false}; export const nativeImage={createFromPath(){throw Error('ELECTRON_FORBIDDEN')}};`, loader: 'js'
                    }));
                }
            }]
    });
    const api = createRequire(import.meta.url)(path.join(out, 'runtime.cjs'));
    const { MaterialCatalogRepository, MaterialFullTextSearch, MaterialRepository, RetrievalRepository, LocalVectorStore, MATERIAL_CATALOG_SCHEMA: schema, emptyCatalogScope, catalogKey, validCatalogQuery, validCatalogSave, validMaterialQuery, registerMaterialCatalogIpc } = api;
    const file = path.join(out, 'app.db');
    main = await open(file);
    sql = adapter(main);
    await sql.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,title TEXT,resource_type TEXT,original_file_name TEXT,local_path TEXT,file_size INTEGER,content_hash TEXT,parse_status TEXT,parse_engine TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,heading TEXT,content_md TEXT,page_number INTEGER,contains_personal_data INTEGER);CREATE TABLE competing_writer(value TEXT);CREATE TABLE retrieval_current(kind TEXT,object_id TEXT,seq INTEGER,PRIMARY KEY(kind,object_id));CREATE TABLE retrieval_source_revisions(resource_id TEXT PRIMARY KEY,revision INTEGER);CREATE TABLE retrieval_control(id INTEGER PRIMARY KEY,active TEXT,building TEXT);INSERT INTO retrieval_control VALUES(1,'','');CREATE TABLE retrieval_changes(seq INTEGER PRIMARY KEY,kind TEXT,object_id TEXT);CREATE TABLE retrieval_generations(id TEXT PRIMARY KEY,snapshot_seq INTEGER,applied_seq INTEGER,backfill_done INTEGER);CREATE TABLE retrieval_failures(generation TEXT);CREATE TABLE material_ai_text_documents_v1(id TEXT PRIMARY KEY,resource_id TEXT,version TEXT,content_md TEXT,page_number INTEGER,source_json TEXT,active INTEGER);CREATE TABLE material_ai_text_dirty_v1(error TEXT);`);
    const mapResource = r => ({
        id: String(r.id), title: String(r.title), resourceType: String(r.resource_type), originalFileName: String(r.original_file_name), localPath: String(r.local_path), fileSize: Number(r.file_size), contentHash: String(r.content_hash), parseStatus: String(r.parse_status), parseEngine: String(r.parse_engine), chunkCount: Number(r.chunk_count || 0), createdAt: String(r.created_at), updatedAt: String(r.updated_at)
    });
    const mapChunk = r => ({
        id: String(r.id), resourceId: String(r.resource_id), chunkIndex: Number(r.chunk_index), contentMd: String(r.content_md), pageNumber: Number(r.page_number), containsPersonalData: !!r.contains_personal_data
    });
    const openWork = async () => {
        const db = await open(file);
        opened.push(db);
        const originalExec = db.exec.bind(db), originalRun = db.run.bind(db);
        db.exec = (q, cb) => originalExec(q, e => {
            const pause = hook?.exec?.(q, e);
            if (pause)
                void pause.then(() => cb(e));
            else
                cb(e);
        });
        db.run = (q, p, cb) => originalRun(q, p, e => {
            hook?.run?.(q, e);
            cb(e);
        });
        return db;
    };
    const makeCatalog = () => new MaterialCatalogRepository({ open: openWork, mapResource, assertOpen: () => {
        } });
    catalog = makeCatalog();
    await catalog.init();
    const id = i => 'resource_' + String(i).padStart(8, '0') + '-0000-0000-0000-000000000000';
    const chunk = i => 'chunk_' + String(i).padStart(8, '0') + '-0000-0000-0000-000000000000';
    const hash = 'a'.repeat(64), query = (scope = emptyCatalogScope(), offset = 0, text = '') => ({ schemaVersion: schema, query: text, scope, offset });
    const input = (i, revision = 1, metadata = { directory: '教学目录', tags: ['实验', '浮力'] }, operationId = 'catalog_' + randomUUID()) => ({
        schemaVersion: schema, resourceId: id(i), sourceVersion: hash, expectedRevision: revision, operationId, metadata
    });
    await sql.exec('BEGIN;');
    for (let i = 0; i < 330; i++) {
        const status = i % 10 === 0 ? 'failed' : i % 10 === 1 ? 'partial' : 'ready';
        await sql.run('INSERT INTO teacher_resources VALUES(?,?,?,?,?,?,?,?,?,?,?)', [id(i), '资料' + i, 'document', `lesson.${i % 2 ? 'txt' : 'pdf'}`, path.join(out, 'original-' + i), 24, hash, status, 'synthetic', 'created', String(10000 - i)]);
        if (i % 10 !== 2) {
            await sql.run('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?,?)', [chunk(i), id(i), 0, '正文', '浮力 SYNTHETIC ' + i, 1, 0]);
            await sql.run('INSERT INTO retrieval_current VALUES(?,?,?)', ['material', chunk(i), 1]);
        }
        if (i !== 329) {
            await sql.run('INSERT INTO material_catalog_metadata_v1 VALUES(?,?,?,?,?,?,?,?,?)', [id(i), 1, i < 300 ? '大目录' : '小目录', i < 300 ? '大目录' : '小目录', 'catalog_' + randomUUID(), 0, hash, sha('{}'), 'fixture']);
            for (const tag of i < 300 ? ['共用'] : i % 2 ? ['物理'] : ['物理', '实验'])
                await sql.run('INSERT INTO material_catalog_tags_v1 VALUES(?,?,?)', [id(i), catalogKey(tag), tag]);
        }
    }
    await sql.run('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?,?)', [chunk(999), id(304), 9, 'private', 'PRIVATEONLY 浮力', 1, 1]);
    await sql.exec('COMMIT;');
    const sourceRows = sha(JSON.stringify(await sql.all('SELECT * FROM teacher_resources ORDER BY id')));
    const materials = new MaterialRepository({
        root: out, ...sql, change: async () => {
            throw Error('FORBIDDEN_WRITE');
        }, mapResource, mapChunk, commit: async () => {
            throw Error('FORBIDDEN_WRITE');
        }, reuse: async () => {
            throw Error('FORBIDDEN_WRITE');
        }, failure: async () => {
            throw Error('FORBIDDEN_WRITE');
        }
    });
    let retrieval;
    fts = new MaterialFullTextSearch({ ...sql, map: mapChunk, restored: () => retrieval?.restoredText });
    retrieval = new RetrievalRepository({
        ...sql, chunk: mapChunk, question: () => {
            throw Error('FORBIDDEN_QUESTION');
        }, fullText: () => fts, keyword: async () => [], writer: async () => {
            throw Error('FORBIDDEN_WRITER');
        }
    });
    await fts.migrate();
    await fts.applyPending(1000);
    const handlers = new Map(), store = { materialCatalog: catalog, materialSearch: fts, retrieval, materials };
    const register = () => {
        handlers.clear();
        registerMaterialCatalogIpc(store, { handle: (name, fn) => handlers.set(name, fn) }, () => {
            if (!authority)
                throw Error('permission_denied');
        });
    };
    register();
    const invoke = (name, value) => handlers.get(name)({}, value), scope = { directory: '小目录', tags: ['物理', '实验'], format: 'PDF', state: 'ready' };
    await check('STRICT_TYPED_INPUT_AND_LEGACY_V1', async () => {
        assert(validCatalogQuery(query()));
        assert(!validCatalogQuery({ ...query(), unknown: true }));
        assert(!validCatalogQuery(query({ ...emptyCatalogScope(), tags: ['X', 'x'] })));
        assert(validCatalogSave(input(5)));
        assert(!validCatalogSave({ ...input(5), sourceVersion: 'bad' }));
        assert(validMaterialQuery({ schemaVersion: 'xiaozhi.materials.v1', query: '', offset: 0 }));
        assert(!validMaterialQuery({ ...query(), schemaVersion: 'xiaozhi.materials.v1' }));
        const legacy = await materials.list({ schemaVersion: 'xiaozhi.materials.v1', query: '', offset: 50 });
        assert.equal(legacy.total, 330);
        assert.equal(legacy.resources.length, 50);
    });
    await check('GLOBAL_COMBINED_FILTER_TARGET_AFTER_FIRST_PAGE', async () => {
        const first = await catalog.list(query());
        assert.equal(first.items.length, 50);
        assert(!first.items.some(i => i.resource.id === id(304)));
        assert.equal(first.total, 330);
        assert(first.hasMore);
        const result = await catalog.list(query(scope));
        assert.deepEqual(result.items.map(i => i.resource.id), [304, 306, 308, 314, 316, 318, 324, 326, 328].map(id));
        assert.equal(result.total, 9);
        assert(!result.hasMore);
        assert.equal(result.facets.formats.find(f => f.value === 'PDF').count, 165);
        assert(result.facets.tags.some(f => f.value === '物理'));
        assert.equal((await catalog.list(query(emptyCatalogScope(), 300))).items.length, 30);
    });
    await check('TRUE_READINESS_EMPTY_PRIVATE_TAG_AND_CLEAR', async () => {
        const waiting = await catalog.list(query({ ...emptyCatalogScope(), state: 'waiting' }));
        assert.equal(waiting.total, 66);
        assert.equal((await catalog.list(query({ ...scope, tags: ['不存在'] }))).total, 0);
        assert.equal((await catalog.list(query({ ...emptyCatalogScope(), directory: '' }))).total, 1);
        assert.equal((await catalog.list(query(emptyCatalogScope(), 0, '物理'))).total, 29);
        assert.equal((await catalog.list(query())).total, 330);
    });
    await check('SAVE_SOURCE_CAS_IDEMPOTENCY_REOPEN', async () => {
        const request = input(5);
        const saved = await catalog.save(request);
        assert.equal(saved.revision, 2);
        assert.equal((await catalog.save(request)).revision, 2);
        await assert.rejects(catalog.save({ ...request, metadata: { directory: 'changed', tags: [] } }), /operation_conflict/);
        await catalog.close();
        catalog = makeCatalog();
        await catalog.init();
        store.materialCatalog = catalog;
        const read = await catalog.get({ schemaVersion: schema, resourceId: id(5), sourceVersion: hash });
        assert.equal(read.receipt.operationId, request.operationId);
        assert.equal(read.revision, 2);
        assert.equal(sha(JSON.stringify(await sql.all('SELECT * FROM teacher_resources ORDER BY id'))), sourceRows);
    });
    await check('TWO_CONNECTION_WRITER_LOCK_PARENT_UNTOUCHED', async () => {
        const entered = deferred(), release = deferred();
        let once = true;
        hook = {
            exec(q, e) {
                if (!e && q.includes('BEGIN IMMEDIATE') && once) {
                    once = false;
                    entered.resolve();
                    return release.promise;
                }
            }
        };
        main.on('trace', q => parentTrace.push(q));
        const saving = catalog.save(input(6));
        await entered.promise;
        let completed = false;
        const competing = sql.run('INSERT INTO competing_writer VALUES(?)', ['queued']).then(() => completed = true);
        await wait(70);
        assert.equal(completed, false);
        release.resolve();
        await saving;
        await competing;
        await wait(5);
        hook = undefined;
        assert(opened.length > 2);
        assert(!parentTrace.some(q => /SELECT|material_catalog/i.test(q)));
        assert(parentTrace.some(q => q.includes('competing_writer')));
    });
    await check('CONCURRENT_REVISION_ONLY_ONE_WRITER_COMMITS', async () => {
        const results = await Promise.allSettled([catalog.save(input(7)), catalog.save(input(7))]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.match(results.find(r => r.status === 'rejected').reason.message, /revision_conflict/);
    });
    await check('SOURCE_VERSION_AND_LEASE_ROLLBACK_ALL_TAGS', async () => {
        await sql.run('UPDATE teacher_resources SET content_hash=? WHERE id=?', ['b'.repeat(64), id(8)]);
        await assert.rejects(catalog.save(input(8)), /source_changed/);
        await sql.run('UPDATE teacher_resources SET content_hash=? WHERE id=?', [hash, id(8)]);
        let valid = true;
        hook = {
            run(q, e) {
                if (!e && q.startsWith('INSERT INTO material_catalog_tags'))
                    valid = false;
            }
        };
        await assert.rejects(catalog.save(input(8), () => {
            if (!valid)
                throw Error('permission_denied');
        }), /permission_denied/);
        hook = undefined;
        const view = await catalog.get({ schemaVersion: schema, resourceId: id(8), sourceVersion: hash });
        assert.equal(view.revision, 1);
        assert.deepEqual(view.metadata.tags, ['共用']);
    });
    await check('CLOSE_IN_TRANSACTION_ROLLBACK_AND_REJECT_NEW', async () => {
        let closing;
        hook = {
            run(q, e) {
                if (!e && q.startsWith('INSERT INTO material_catalog_tags'))
                    closing = catalog.close();
            }
        };
        await assert.rejects(catalog.save(input(9)), /cancelled/);
        await closing;
        hook = undefined;
        await assert.rejects(catalog.list(query()), /cancelled/);
        catalog = makeCatalog();
        await catalog.init();
        store.materialCatalog = catalog;
        assert.equal((await catalog.get({ schemaVersion: schema, resourceId: id(9), sourceVersion: hash })).revision, 1);
    });
    await check('COMMIT_ACK_LOSS_READ_ONLY_RECONCILE_NO_REWRITE', async () => {
        const request = input(13);
        hook = { exec(q, e) {
                if (!e && q === 'COMMIT;')
                    authority = false;
            } };
        await assert.rejects(invoke('materials:catalog-save', request), /permission_denied/);
        hook = undefined;
        authority = true;
        const read = await invoke('materials:catalog-metadata', { schemaVersion: schema, resourceId: id(13), sourceVersion: hash });
        assert.equal(read.receipt.operationId, request.operationId);
        assert.equal(read.revision, 2);
        assert.equal((await catalog.save(request)).revision, 2);
        await assert.rejects(catalog.save(input(13)), /revision_conflict/);
    });
    await check('REAL_FTS_SCOPE_BEFORE_LIMIT_PRIVATE_AND_PAGE', async () => {
        const result = await fts.candidates('浮力', undefined, 2, 0, true, scope);
        assert.equal(result.units.length, 2);
        assert(result.hasMore);
        assert(result.units.every(u => [304, 306, 308, 314, 316, 318, 324, 326, 328].map(id).includes(u.resourceId)));
        const next = await fts.candidates('浮力', undefined, 2, 2, true, scope);
        assert(!next.units.some(u => result.units.some(p => p.chunk.id === u.chunk.id)));
        assert.equal((await fts.candidates('PRIVATEONLY', undefined, 20, 0, true, scope)).units.length, 0);
    });
    await check('ACTUAL_BODY_IPC_SOURCE_AND_SCOPE_CHANGE_DENIED', async () => {
        const body = { schemaVersion: schema, query: '浮力', mode: 'keyword', offset: 0, scope };
        const result = await invoke('materials:catalog-search', body);
        assert.equal(result.hits.length, 9);
        assert.equal(result.actualMode, 'keyword');
        const original = store.materials;
        let once = true;
        store.materials = new Proxy(materials, {
            get(t, k) {
                if (k === 'source')
                    return async (source) => {
                        const view = await t.source(source);
                        if (once) {
                            once = false;
                            await catalog.save(input(304, 1, { directory: '移出范围', tags: [] }));
                        }
                        return view;
                    };
                return Reflect.get(t, k);
            }
        });
        await assert.rejects(invoke('materials:catalog-search', body), /scope_changed/);
        store.materials = original;
        await catalog.save(input(304, 2, { directory: '小目录', tags: ['物理', '实验'] }));
        const source = result.hits[0].source;
        await sql.run('UPDATE resource_chunks SET content_md=? WHERE id=?', ['changed', source.chunkId]);
        await assert.rejects(materials.source(source), /source_changed/);
        await sql.run('UPDATE resource_chunks SET content_md=? WHERE id=?', ['浮力 SYNTHETIC 304', source.chunkId]);
    });
    await check('BODY_POST_AWAIT_SOURCE_REVISION_STATE_AND_ADDED_MEMBER_FAIL_CLOSED',async()=>{
        const body={schemaVersion:schema,query:'浮力',mode:'keyword',offset:0,scope};
        const scenarios=[
          [()=>sql.run('UPDATE teacher_resources SET content_hash=? WHERE id=?',['b'.repeat(64),id(328)]),()=>sql.run('UPDATE teacher_resources SET content_hash=? WHERE id=?',[hash,id(328)])],
          [()=>sql.run('INSERT INTO retrieval_source_revisions VALUES(?,1)',[id(328)]),()=>sql.run('DELETE FROM retrieval_source_revisions WHERE resource_id=?',[id(328)])],
          [()=>sql.run('UPDATE teacher_resources SET parse_status=? WHERE id=?',['partial',id(328)]),()=>sql.run('UPDATE teacher_resources SET parse_status=? WHERE id=?',['ready',id(328)])],
          [()=>catalog.save(input(24,1,{directory:'小目录',tags:['物理','实验']})),()=>catalog.save(input(24,2,{directory:'大目录',tags:['共用']}))]
        ];
        for(const [change,restore]of scenarios){let once=true;const original=store.materials;
            store.materials=new Proxy(materials,{get(t,k){if(k==='source')return async source=>{const view=await t.source(source);if(once){once=false;await change();}return view;};return Reflect.get(t,k);}});
            try{await assert.rejects(invoke('materials:catalog-search',body),/scope_changed|source_changed/);assert.equal(once,false);}
            finally{store.materials=original;await restore();}
        }
    });
    await check('EMPTY_SCOPE_DOES_NOT_ENTER_RETRIEVAL', async () => {
        const old = store.retrieval;
        store.retrieval = new Proxy(old, {
            get(t, k) {
                if (k === 'materials')
                    return () => {
                        throw Error('FORBIDDEN_EMPTY_RETRIEVAL');
                    };
                return Reflect.get(t, k);
            }
        });
        const result = await invoke('materials:catalog-search', {
            schemaVersion: schema, query: '浮力', mode: 'hybrid', offset: 0, scope: { ...scope, directory: '不存在' }
        });
        assert.deepEqual(result.hits, []);
        store.retrieval = old;
    });
    await check('NATIVE_VECTOR_PREFILTER_EMPTY_INVALID_BEFORE_ENCODER', async () => {
        const vectorRoot = path.join(out, 'vectors');
        fs.mkdirSync(vectorRoot);
        let encoded = 0;
        const encoder = {
            embed: async (kind, texts) => {
                encoded++;
                return texts.map(text => [{
                        start: 0, end: text.length, vector: Array.from({ length: 512 }, (_, i) => i === (kind === 'query' || text === 'outside' || text.endsWith(' 24') ? 0 : 1) ? 1 : 0)
                    }]);
            }, close() {
            }
        };
        vectors = new LocalVectorStore(vectorRoot, encoder);
        const spec = {
            id: 'generation_' + randomUUID(), modelHash: api.EMBEDDING_MODEL, tokenizerHash: api.EMBEDDING_TOKENIZER, identity: api.EMBEDDING_ID, dimension: 512, normalization: 'l2', pooling: 'cls', distanceMetric: 'cosine', factSnapshotSeq: 0
        };
        const fact = (n, text) => ({
            kind: 'material', id: chunk(n), seq: 1, digest: 'c'.repeat(64), resourceId: id(n), subject: '', grade: '', knowledgePoint: '', questionType: '', difficulty: '', sourceKind: 'teacher_resource', text, deleted: false
        });
        await vectors.applyMany(spec, [fact(20, 'outside'), fact(304, 'inside')]);
        const q = { generation: spec.id, kind: 'material', query: 'query', limit: 1 };
        assert.equal((await vectors.query(spec, q)).hits[0].id, chunk(20));
        assert.equal((await vectors.query(spec, { ...q, resourceIds: [id(304)] })).hits[0].id, chunk(304));
        const before = encoded;
        assert.deepEqual((await vectors.query(spec, { ...q, resourceIds: [] })).hits, []);
        await assert.rejects(vectors.query(spec, { ...q, resourceIds: ['bare_uuid'] }), /invalid_input/);
        await assert.rejects(vectors.query(spec, { ...q, resourceIds: [id(304)], resourceId: id(20) }), /invalid_input/);
        await assert.rejects(vectors.query(spec, { ...q, kind: 'question', resourceIds: [id(304)] }), /invalid_input/);
        assert.equal(encoded, before);
        const realSpec = { ...spec, id: 'generation_' + randomUUID() };
        const realFacts = await Promise.all([retrieval.fact('material', chunk(24)), retrieval.fact('material', chunk(304))]);
        assert(realFacts.every(v => !v.fact.deleted));
        await vectors.applyMany(realSpec, realFacts.map(v => v.fact));
        await sql.run('INSERT INTO retrieval_generations VALUES(?,?,?,?)', [realSpec.id, 0, 0, 1]);
        await sql.run('UPDATE retrieval_control SET active=? WHERE id=1', [realSpec.id]);
        const forwarded = [];
        retrieval.configure({ query: async (s, q) => {
                forwarded.push(q);
                return vectors.query(s, q);
            } });
        const snap = await catalog.snapshot(scope), result = await retrieval.materials('浮力', undefined, 200, 0, 20, { scope, resourceIds: snap.resourceIds });
        assert(result.semantic.available);
        assert(forwarded.length > 0);
        assert.deepEqual(forwarded[0].resourceIds, snap.resourceIds);
        assert(result.units.every(v => snap.resourceIds.includes(v.resourceId)));
        assert(result.hits.some(v => v.unit.resourceId === id(304) && v.method !== 'keyword'));
        const unscoped = await retrieval.materials('浮力');
        assert(unscoped.semantic.available);
        assert.equal(forwarded.at(-1).resourceIds, undefined);
        report.nativeVector = {
            prefilter: true, syntheticEncoder: true, emptyBeforeEncode: true, actualRetrievalForwarding: true, unscopedHybridPreserved: true
        };
    });
    await check('OVER_VECTOR_BUDGET_REAL_FTS_FALLBACK_AFTER_200', async () => {
        const broad = { ...emptyCatalogScope(), directory: '大目录' };
        const snap = await catalog.snapshot(broad);
        assert(snap.resourceIds.length > 256);
        const result = await retrieval.materials('浮力', undefined, 200, 200, 20, { scope: broad, resourceIds: snap.resourceIds });
        assert.equal(result.semantic.available, false);
        assert.equal(result.semantic.reason, 'scope_candidate_limit');
        assert.equal(result.units.length, 20);
        assert(result.units.every(u => snap.resourceIds.includes(u.resourceId)));
        const direct = await fts.candidates('浮力', undefined, 20, 200, false, broad);
        assert.deepEqual(result.units.map(u => u.chunk.id), direct.units.map(u => u.chunk.id));
    });
    await check('AI_FTS_UNION_SCOPED_BOTH_ARMS', async () => {
        for (const n of [20, 304]) {
            const source = {
                schemaVersion: 'xiaozhi.material-ai-text-source.v1', resourceId: id(n), version: hash, offset: 0, chunkId: chunk(n + 2000), bodyVersion: hash, batchId: 'aibatch_' + randomUUID(), ordinal: 1, page: 1, finalSha: hash
            };
            await sql.run('INSERT INTO material_ai_text_documents_v1 VALUES(?,?,?,?,?,?,?)', [source.chunkId, id(n), hash, 'UNIONONLY', 1, JSON.stringify(source), 1]);
            const row = (await sql.all('SELECT rowid FROM material_ai_text_documents_v1 WHERE id=?', [source.chunkId]))[0];
            await sql.run('INSERT INTO material_body_fts_v1(rowid,tokens,normalised) VALUES(?,?,?)', [-row.rowid, api.materialSearchTokens('UNIONONLY'), 'uniononly']);
        }
        const result = await fts.candidates('UNIONONLY', undefined, 1, 0, true, scope);
        assert.equal(result.units.length, 1);
        assert.equal(result.units[0].resourceId, id(304));
        assert(result.units[0].restored);
        assert.equal(result.hasMore, false);
    });
    await check('THIN_STORE_WIRING_OLD_API_AND_NO_UNDECLARED_WRITES', async () => {
        const db = fs.readFileSync('src/main/db.ts', 'utf8'), preload = fs.readFileSync('src/preload/index.ts', 'utf8');
        assert(db.includes('open:()=>this.openDatabase(this.dbPath)'));
        assert(db.includes('await this.materialCatalog.close();'));
        assert(preload.includes("ipcRenderer.invoke('materials:list',input)"));
        assert.equal(opened.includes(main), false);
    });
    report.success = true;
}
catch (error) {
    report.failure = {
        code: 'FOCUSED_TEST_FAILURE', phase: report.phase, hash: sha(String(error)), site: String(error.stack).match(/material-catalog-focused-test\.mjs:\d+:\d+/)?.[0]
    };
    process.exitCode = 1;
}
finally {
    hook = undefined;
    await catalog?.close();
    await fts?.close();
    vectors?.close();
    await sql?.close();
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
        code: report.success ? 'CATALOG_FOCUSED_PASS' : 'CATALOG_FOCUSED_FAIL', phase: report.phase, checks: report.checks, output: out
    }));
}
