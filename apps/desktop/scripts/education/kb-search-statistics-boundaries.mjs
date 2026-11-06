import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
const { MaterialFullTextSearch } =
  await import("../../src/main/assets/material-full-text.ts");
const { writeMaterialFtsRow } =
  await import("../../src/main/assets/material-search-statistics.ts");
let checks = 0;
async function check(name, action) {
  await action();
  checks++;
  console.log("PASS " + name);
}
async function fixture(old = false) {
  const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "omni-search-statistics-"),
    ),
    db = new DatabaseSync(path.join(root, "app.db"));
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,title TEXT,original_file_name TEXT,content_hash TEXT,parse_status TEXT);
 CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER,page_number INTEGER);
 CREATE INDEX source_chunks_resource ON resource_chunks(resource_id,chunk_index);
 CREATE TABLE material_catalog_metadata_v1(resource_id TEXT PRIMARY KEY,directory_key TEXT);
 CREATE TABLE material_catalog_tags_v1(resource_id TEXT,tag_key TEXT);`);
  const resource = db.prepare(
    "INSERT INTO teacher_resources VALUES(?,? ,?,'hash','ready')",
  );
  for (const [id, name] of [
    ["a", "甲.pdf"],
    ["b", "乙.docx"],
    ["empty", "空.pdf"],
  ])
    resource.run(id, id, name);
  const put = db.prepare(
    "INSERT INTO resource_chunks VALUES(?,?,?,'物理沸点来源',?,1)",
  );
  if (old)
    for (let i = 0; i < 8; i++)
      put.run("old" + i, i < 5 ? "a" : "b", i, i % 3 === 0 ? 1 : 0);
  const host = {
    all: async (s, p = []) => db.prepare(s).all(...p),
    run: async (s, p = []) => {
      db.prepare(s).run(...p);
    },
    map: (r) => ({
      id: r.id,
      contentMd: r.content_md,
      resourceId: r.resource_id,
      chunkIndex: r.chunk_index,
      containsPersonalData: !!r.contains_personal_data,
      pageNumber: r.page_number,
    }),
  };
  const search = new MaterialFullTextSearch(host);
  await search.migrate();
  const read = (scope) =>
    search.candidates("物理", undefined, 20, 0, false, scope);
  const compare = async (scope) => {
    const saved = process.env.OMNI_EDU_MATERIAL_COVERAGE_STATS;
    try {
      delete process.env.OMNI_EDU_MATERIAL_COVERAGE_STATS;
      const cached = await read(scope);
      process.env.OMNI_EDU_MATERIAL_COVERAGE_STATS = "0";
      const exact = await read(scope);
      assert.deepEqual(cached.coverage, exact.coverage);
      assert.deepEqual(cached.index, exact.index);
      assert.deepEqual(cached.units, exact.units);
      return cached;
    } finally {
      if (saved === undefined)
        delete process.env.OMNI_EDU_MATERIAL_COVERAGE_STATS;
      else process.env.OMNI_EDU_MATERIAL_COVERAGE_STATS = saved;
    }
  };
  const drain = async () => {
    let n = 0;
    while (
      (await search.statistics.pending()) ||
      db.prepare("SELECT 1 FROM material_body_dirty_v1 LIMIT 1").get()
    ) {
      assert(++n < 100);
      db.exec("BEGIN IMMEDIATE");
      try {
        await search.drain(3);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
  };
  return {
    root,
    db,
    put,
    host,
    search,
    read,
    compare,
    drain,
    async close() {
      await search.close();
      db.close();
    },
  };
}
await check(
  "Old database remains exact before, during and after incremental coverage backfill",
  async () => {
    const f = await fixture(true);
    try {
      await f.compare();
      for (let i = 0; i < 3; i++) {
        f.db.exec("BEGIN");
        await f.search.statistics.backfill(1);
        f.db.exec("COMMIT");
        await f.compare();
      }
      await f.drain();
      await f.compare();
      const original = f.db
        .prepare("SELECT * FROM resource_chunks ORDER BY id")
        .all();
      await f.search.migrate();
      await f.compare();
      assert.deepEqual(
        f.db.prepare("SELECT * FROM resource_chunks ORDER BY id").all(),
        original,
      );
    } finally {
      await f.close();
    }
  },
);
await check(
  "Incremental inserts, privacy flips, owner changes and deletes match source counts before FTS catches up",
  async () => {
    const f = await fixture();
    try {
      await f.drain();
      for (let i = 0; i < 6; i++) f.put.run("x" + i, "a", i, i % 2);
      await f.compare();
      await f.drain();
      await f.compare();
      f.db.exec(
        "UPDATE resource_chunks SET contains_personal_data=1 WHERE id='x0';UPDATE resource_chunks SET resource_id='b',contains_personal_data=0 WHERE id='x1';DELETE FROM resource_chunks WHERE id='x3'",
      );
      await f.compare();
      await f.drain();
      await f.compare();
      f.db.exec(
        "UPDATE resource_chunks SET resource_id='a',contains_personal_data=contains_personal_data WHERE id='x2'",
      );
      await f.compare();
    } finally {
      await f.close();
    }
  },
);
await check(
  "Source and derived counters roll back together and readers see only committed facts",
  async () => {
    const f = await fixture(true);
    try {
      await f.drain();
      const second = new DatabaseSync(path.join(f.root, "app.db"), {
        readOnly: true,
      });
      try {
        const before = f.db
          .prepare(
            "SELECT * FROM material_search_resource_counts_v1 ORDER BY resource_id",
          )
          .all();
        f.db.exec("BEGIN IMMEDIATE");
        f.put.run("rollback", "a", 88, 1);
        assert.deepEqual(
          second
            .prepare(
              "SELECT * FROM material_search_resource_counts_v1 ORDER BY resource_id",
            )
            .all(),
          before,
        );
        await f.compare();
        f.db.exec("ROLLBACK");
        assert.deepEqual(
          f.db
            .prepare(
              "SELECT * FROM material_search_resource_counts_v1 ORDER BY resource_id",
            )
            .all(),
          before,
        );
        await f.compare();
      } finally {
        second.close();
      }
    } finally {
      await f.close();
    }
  },
);
await check(
  "Catalogue directory/tag/format/state and exact resource scope retain their existing coverage",
  async () => {
    const f = await fixture(true);
    try {
      f.db.exec(
        "INSERT INTO material_catalog_metadata_v1 VALUES('a','物理');INSERT INTO material_catalog_tags_v1 VALUES('a','初中')",
      );
      await f.drain();
      for (const scope of [
        { directory: null, tags: [], format: "", state: "" },
        { directory: "物理", tags: [], format: "", state: "" },
        { directory: null, tags: ["初中"], format: "", state: "" },
        { directory: null, tags: [], format: "PDF", state: "" },
        { directory: null, tags: [], format: "", state: "ready" },
      ])
        await f.compare(scope);
      const result = await f.search.candidates("物理", "a", 20, 0, false);
      assert.equal(result.coverage.totalChunks, 5);
      f.db.exec(
        "UPDATE teacher_resources SET parse_status='failed' WHERE id='a'",
      );
      await f.compare();
    } finally {
      await f.close();
    }
  },
);
await check(
  "Countered FTS insertion, replacement and removal support both positive chunks and negative restored documents",
  async () => {
    const f = await fixture(true);
    try {
      await f.drain();
      const before = (await f.search.status()).indexed;
      f.db.exec("BEGIN");
      await writeMaterialFtsRow(f.host, -1, {
        tokens: "example",
        normalised: "example",
      });
      f.db.exec("COMMIT");
      assert.equal((await f.search.status()).indexed, before + 1);
      await f.compare();
      await writeMaterialFtsRow(f.host, -1, {
        tokens: "different",
        normalised: "different",
      });
      assert.equal((await f.search.status()).indexed, before + 1);
      await writeMaterialFtsRow(f.host, -1);
      await writeMaterialFtsRow(f.host, -1);
      assert.equal((await f.search.status()).indexed, before);
      f.db.exec("BEGIN");
      await writeMaterialFtsRow(f.host, -2, {
        tokens: "rollback",
        normalised: "rollback",
      });
      f.db.exec("ROLLBACK");
      await f.compare();
    } finally {
      await f.close();
    }
  },
);
await check(
  "Restart, FTS recreation and resource removal preserve accurate fallback and rebuildable counts",
  async () => {
    const f = await fixture(true);
    try {
      await f.drain();
      f.db.exec(
        "DELETE FROM teacher_resources WHERE id='a';DELETE FROM resource_chunks WHERE resource_id='a'",
      );
      await f.compare();
      await f.drain();
      f.db.exec("DROP TABLE material_body_fts_v1");
      const cold = new MaterialFullTextSearch(f.host);
      await cold.migrate();
      await f.compare();
      await f.drain();
      await f.compare();
    } finally {
      await f.close();
    }
  },
);
console.log(
  JSON.stringify({
    success: true,
    checks,
    scope:
      "Real disk SQLite/FTS5 and separate reader snapshots, exact original-query comparison, source/FTS rollback, partial backfill and catalogue filtering. No model, whole product or 40GiB acceptance.",
  }),
);
