import "../office-agent/register-source.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
const { MaterialFullTextSearch, materialSearchTokens } =
  await import("../../src/main/assets/material-full-text.ts");
const [sizeArg, outputArg, existingRoot] = process.argv.slice(2),
  size = Number(sizeArg);
assert([100000, 1000000].includes(size) && path.isAbsolute(outputArg));
const root = existingRoot
  ? fs.realpathSync(existingRoot)
  : fs.mkdtempSync(path.join(os.tmpdir(), "omni-full-text-scale-"));
const relative = path.relative(fs.realpathSync(os.tmpdir()), root);
assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
const file = path.join(root, "scale.db"),
  db = new DatabaseSync(file),
  timings = [];
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-32768;",
);
const host = {
  all: async (sql, p = []) => {
    const start = performance.now(),
      rows = db.prepare(sql).all(...p);
    timings.push({
      kind:
        sql.includes("COUNT(DISTINCT") || sql.includes("WITH resource_counts")
          ? "coverage"
          : sql.includes("indexed_count")
            ? "status"
            : sql.includes("MATCH ?")
              ? "match"
              : "other",
      ms: performance.now() - start,
    });
    return rows;
  },
  run: async (sql, p = []) => {
    db.prepare(sql).run(...p);
  },
  map: (r) => ({
    id: r.id,
    resourceId: r.resource_id,
    chunkIndex: r.chunk_index,
    pageNumber: r.page_number,
    contentMd: r.content_md,
    containsPersonalData: !!r.contains_personal_data,
  }),
};
const search = new MaterialFullTextSearch(host),
  start = performance.now();
try {
  if (!existingRoot) {
    db.exec(`CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,title TEXT,original_file_name TEXT,content_hash TEXT,parse_status TEXT);
   CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER,page_number INTEGER);
   CREATE INDEX idx_resource_chunks_resource ON resource_chunks(resource_id,chunk_index);`);
    await search.migrate();
    db.exec("BEGIN IMMEDIATE");
    const insert = db.prepare(
        "INSERT INTO teacher_resources VALUES(?,?,'物理资料.pdf',?,'ready')",
      ),
      hash = "a".repeat(64);
    for (let i = 0; i < size / 1000; i++)
      insert.run("resource_" + i, "物理资料" + i, hash);
    db.exec(
      `WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM seq WHERE n<${size}) INSERT INTO resource_chunks SELECT 'chunk_'||n,'resource_'||CAST((n-1)/1000 AS INTEGER),(n-1)%1000,CASE WHEN n%10000=0 THEN '稀有沸点标记 原图答案保存在本地。' ELSE '初中物理教材内容 条件单位来源保持完整。' END,n%101=1,1 FROM seq;`,
    );
    const common = materialSearchTokens(
        "初中物理教材内容 条件单位来源保持完整。",
      ),
      rare = materialSearchTokens("稀有沸点标记 原图答案保存在本地。");
    db.prepare(
      "INSERT INTO material_body_fts_v1(rowid,tokens,normalised) SELECT rowid,CASE WHEN chunk_index=999 AND CAST(substr(id,7) AS INTEGER)%10000=0 THEN ? ELSE ? END,replace(content_md,' ','') FROM resource_chunks WHERE contains_personal_data=0",
    ).run(rare, common);
    db.exec(
      "DELETE FROM material_body_dirty_v1;COMMIT;PRAGMA wal_checkpoint(TRUNCATE);",
    );
  } else await search.migrate();
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM resource_chunks").get().n,
    size,
  );
  timings.length = 0;
  const coldStart = performance.now(),
    cold = await search.candidates("稀有沸点", undefined, 20, 0, false),
    coldMs = performance.now() - coldStart,
    coldTimings = timings.splice(0);
  assert(cold.units.length > 0);
  assert.equal(cold.coverage.totalChunks, size);
  assert.equal(cold.coverage.resources, size / 1000);
  let backfillMs = 0;
  if (search.statistics) {
    const begin = performance.now();
    let rounds = 0;
    while (await search.statistics.pending()) {
      assert(++rounds < 10000);
      db.exec("BEGIN IMMEDIATE");
      try {
        await search.drain(0);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
    backfillMs = performance.now() - begin;
  }
  timings.length = 0;
  const samples = [];
  for (let i = 0; i < 20; i++) {
    const begin = performance.now(),
      result = await search.candidates("稀有沸点", undefined, 20, 0, false);
    assert.deepEqual(result.coverage, cold.coverage);
    assert.deepEqual(
      result.units.map((u) => u.chunk.id),
      cold.units.map((u) => u.chunk.id),
    );
    samples.push(performance.now() - begin);
  }
  let paired;
  if (process.argv.includes("--paired")) {
    const values = { original: [], cached: [] },
      expected = {
        coverage: cold.coverage,
        index: cold.index,
        ids: cold.units.map((u) => u.chunk.id),
      },
      saved = process.env.OMNI_EDU_MATERIAL_COVERAGE_STATS;
    try {
      for (let round = 0; round < 20; round++)
        for (const mode of round % 2
          ? ["cached", "original"]
          : ["original", "cached"]) {
          process.env.OMNI_EDU_MATERIAL_COVERAGE_STATS =
            mode === "original" ? "0" : "1";
          const begin = performance.now(),
            result = await search.candidates(
              "稀有沸点",
              undefined,
              20,
              0,
              false,
            );
          values[mode].push(performance.now() - begin);
          assert.deepEqual(
            {
              coverage: result.coverage,
              index: result.index,
              ids: result.units.map((u) => u.chunk.id),
            },
            expected,
          );
        }
    } finally {
      if (saved === undefined)
        delete process.env.OMNI_EDU_MATERIAL_COVERAGE_STATS;
      else process.env.OMNI_EDU_MATERIAL_COVERAGE_STATS = saved;
    }
    paired = Object.fromEntries(
      Object.entries(values).map(([mode, v]) => {
        v.sort((a, b) => a - b);
        return [mode, { medianMs: v[10], p95Ms: v[18], samples: v }];
      }),
    );
  }
  samples.sort((a, b) => a - b);
  const groups = {};
  for (const row of timings) {
    const g = (groups[row.kind] ||= []);
    g.push(row.ms);
    groups[row.kind] = g;
  }
  const stats = Object.fromEntries(
    Object.entries(groups).map(([kind, values]) => [
      kind,
      { calls: values.length, totalMs: values.reduce((a, b) => a + b, 0) },
    ]),
  );
  const result = {
    success: true,
    root,
    size,
    databaseBytes: fs.statSync(file).size,
    setupMs: performance.now() - start,
    coldMs,
    backfillMs,
    coldSqlMs: coldTimings.reduce((a, b) => a + b.ms, 0),
    ...(paired ? { paired } : {}),
    warmMedianMs: samples[10],
    warmP95Ms: samples[18],
    samples,
    sql: stats,
    coverage: cold.coverage,
    index: cold.index,
    rssBytes: process.memoryUsage().rss,
    scope:
      "Disk SQLite and actual FTS5 candidate/coverage/status path with generated Chinese documents. First query follows fixture creation in the same process and OS cache, so it is not an OS-cold measure. No embedding, reranker, IPC, natural quality, real 40GiB import or long-run acceptance.",
  };
  fs.writeFileSync(outputArg, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await search.close();
  db.close();
}
