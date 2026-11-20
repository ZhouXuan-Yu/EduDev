type Value = string | number | null;
type Host = {
  all: (sql: string, values?: Value[]) => Promise<Record<string, unknown>[]>;
  run: (sql: string, values?: Value[]) => Promise<void>;
};

export type StructureSearchPublication = { resourceId: string; version: string; generation: string };

export async function migrateMaterialSearchVisibility(host: Host) {
  const columns = await host.all("PRAGMA table_info(resource_chunks)");
  if (!columns.some(column => column.name === "structure_search_hidden"))
    await host.run("ALTER TABLE resource_chunks ADD COLUMN structure_search_hidden INTEGER NOT NULL DEFAULT 0");
}

export async function migrateStructureSearchPublications(host: Host) {
  await host.run("CREATE INDEX IF NOT EXISTS material_chunk_source_page ON resource_chunks(resource_id,page_number)");
  await host.run(`CREATE TABLE IF NOT EXISTS material_structure_search_publications(
    resource_id TEXT PRIMARY KEY,version TEXT NOT NULL,generation TEXT NOT NULL,pending INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT ''
  )`);
  await host.run("CREATE INDEX IF NOT EXISTS material_structure_search_pending ON material_structure_search_publications(pending) WHERE pending=1");
}

export async function seedStructureSearchBackfill(host: Pick<Host, "run">) {
  await host.run(`INSERT OR IGNORE INTO material_structure_search_publications(resource_id,version,generation,pending)
    SELECT s.resource_id,s.version,s.generation,1 FROM material_structure_jobs s
    JOIN teacher_resources r ON r.id=s.resource_id AND r.content_hash=s.version AND r.parse_status='ready'
    WHERE s.status IN ('complete','partial') AND s.pages>0 AND s.processed=s.pages`);
}

export async function nextStructureSearchPublication(host: Pick<Host, "all">) {
  const [row] = await host.all("SELECT resource_id,version,generation FROM material_structure_search_publications WHERE pending=1 ORDER BY rowid LIMIT 1");
  if (row) return { resourceId:String(row.resource_id),version:String(row.version),generation:String(row.generation) };
}

/** A publication changes discovery only. Original chunk IDs, positional offsets and content stay addressable. */
export async function publishStructureSearchVisibility(host: Host, publication: StructureSearchPublication, nativeWordBody: boolean) {
  const {resourceId,version,generation} = publication;
  if (!nativeWordBody) {
    const missing = await host.all(`SELECT 1 FROM material_structure_chunks s
      WHERE s.generation=? AND NOT EXISTS(SELECT 1 FROM resource_chunks c
        WHERE c.resource_id=? AND c.page_number=s.page
          AND c.content_md=CASE WHEN json_valid(s.body_json) THEN json_extract(s.body_json,'$.content') END)
      LIMIT 1`, [generation,resourceId]);
    if (missing.length) throw Error("source_changed");
    // Reuse the earliest exact physical excerpt when a later generation produces identical text.
    const active = `SELECT MIN(c.rowid) FROM material_structure_chunks s JOIN resource_chunks c
      ON c.resource_id=? AND c.page_number=s.page AND c.content_md=json_extract(s.body_json,'$.content')
      WHERE s.generation=? GROUP BY s.id`;
    await host.run(`WITH active(rowid) AS MATERIALIZED (${active}) UPDATE resource_chunks
      SET structure_search_hidden=(rowid NOT IN (SELECT rowid FROM active))
      WHERE resource_id=? AND contains_personal_data=0
        AND structure_search_hidden<>(rowid NOT IN (SELECT rowid FROM active))`,
     [resourceId,generation,resourceId]);
  }
  await host.run(`INSERT INTO material_structure_search_publications(resource_id,version,generation) VALUES(?,?,?)
    ON CONFLICT(resource_id) DO UPDATE SET version=excluded.version,generation=excluded.generation,pending=0,error=''`,[resourceId,version,generation]);
}
