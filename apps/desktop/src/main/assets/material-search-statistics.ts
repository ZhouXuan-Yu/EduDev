type Row = Record<string, unknown>;
type Value = string | number | null;
type Host = {
  all: (sql: string, values?: Value[]) => Promise<Row[]>;
  run: (sql: string, values?: Value[]) => Promise<void>;
};

export const MATERIAL_SEARCH_COUNTS = 'material_search_resource_counts_v1';
export const MATERIAL_SEARCH_COUNT_CONTROL = 'material_search_count_control_v1';
const control = MATERIAL_SEARCH_COUNT_CONTROL;
const fts = 'material_body_fts_v1';

/** Derived counts. A missing or incomplete resource always falls back to source SQL. */
export class MaterialSearchStatistics {
  constructor(private host: Host) {}

  async migrate(resetIndex: boolean) {
    for (const sql of [
      `CREATE TABLE IF NOT EXISTS ${MATERIAL_SEARCH_COUNTS}(resource_id TEXT PRIMARY KEY,total INTEGER NOT NULL DEFAULT 0,private INTEGER NOT NULL DEFAULT 0,ready INTEGER NOT NULL DEFAULT 0)`,
      `CREATE INDEX IF NOT EXISTS material_search_counts_pending_v1 ON ${MATERIAL_SEARCH_COUNTS}(ready,resource_id)`,
      `CREATE TABLE IF NOT EXISTS ${control}(id INTEGER PRIMARY KEY CHECK(id=1),resource_cursor INTEGER NOT NULL DEFAULT 0,indexed INTEGER NOT NULL DEFAULT 0,index_ready INTEGER NOT NULL DEFAULT 0)`,
      `INSERT OR IGNORE INTO ${control}(id) VALUES(1)`,
      `CREATE TRIGGER IF NOT EXISTS material_search_counts_insert_v1 AFTER INSERT ON resource_chunks BEGIN
        INSERT INTO ${MATERIAL_SEARCH_COUNTS}(resource_id,total,private) VALUES(new.resource_id,1,new.contains_personal_data<>0)
        ON CONFLICT(resource_id) DO UPDATE SET total=total+1,private=private+(new.contains_personal_data<>0); END`,
      `CREATE TRIGGER IF NOT EXISTS material_search_counts_delete_v1 AFTER DELETE ON resource_chunks BEGIN
        UPDATE ${MATERIAL_SEARCH_COUNTS} SET total=total-1,private=private-(old.contains_personal_data<>0) WHERE resource_id=old.resource_id; END`,
      `CREATE TRIGGER IF NOT EXISTS material_search_counts_update_v1 AFTER UPDATE OF resource_id,contains_personal_data ON resource_chunks
        WHEN old.resource_id<>new.resource_id OR old.contains_personal_data<>new.contains_personal_data BEGIN
        UPDATE ${MATERIAL_SEARCH_COUNTS} SET total=total-1,private=private-(old.contains_personal_data<>0) WHERE resource_id=old.resource_id;
        INSERT INTO ${MATERIAL_SEARCH_COUNTS}(resource_id,total,private) VALUES(new.resource_id,1,new.contains_personal_data<>0)
        ON CONFLICT(resource_id) DO UPDATE SET total=total+1,private=private+(new.contains_personal_data<>0); END`,
      `CREATE TRIGGER IF NOT EXISTS material_search_counts_resource_delete_v1 AFTER DELETE ON teacher_resources BEGIN
        DELETE FROM ${MATERIAL_SEARCH_COUNTS} WHERE resource_id=old.id; END`
    ]) await this.host.run(sql);
    if (resetIndex) await this.host.run(`UPDATE ${control} SET indexed=0,index_ready=0 WHERE id=1`);
  }

  /** Called inside the existing short writer. SQL scans one resource at a time. */
  async backfill(limit = 20) {
    const pending = await this.host.all(`SELECT s.resource_id FROM ${MATERIAL_SEARCH_COUNTS} s JOIN teacher_resources r ON r.id=s.resource_id WHERE s.ready=0 ORDER BY s.resource_id LIMIT ?`, [limit]);
    const remaining = limit - pending.length;
    const rows = remaining ? await this.host.all(`SELECT rowid,id AS resource_id FROM teacher_resources WHERE rowid>(SELECT resource_cursor FROM ${control} WHERE id=1) ORDER BY rowid LIMIT ?`, [remaining]) : [];
    for (const row of [...pending, ...rows]) {
      await this.host.run(`INSERT INTO ${MATERIAL_SEARCH_COUNTS}(resource_id,total,private,ready)
        SELECT ?,COUNT(*),COALESCE(SUM(contains_personal_data<>0),0),1 FROM resource_chunks WHERE resource_id=?
        ON CONFLICT(resource_id) DO UPDATE SET total=excluded.total,private=excluded.private,ready=1`, [String(row.resource_id), String(row.resource_id)]);
    }
    if (rows.length) await this.host.run(`UPDATE ${control} SET resource_cursor=? WHERE id=1`, [Number(rows.at(-1)!.rowid)]);
    const state = (await this.host.all(`SELECT index_ready FROM ${control} WHERE id=1`))[0];
    if (!state.index_ready) await this.host.run(`UPDATE ${control} SET indexed=(SELECT COUNT(*) FROM ${fts}),index_ready=1 WHERE id=1`);
  }

  async pending() {
    return !!(await this.host.all(`SELECT 1 FROM ${MATERIAL_SEARCH_COUNTS} s JOIN teacher_resources r ON r.id=s.resource_id WHERE s.ready=0
      UNION ALL SELECT 1 FROM teacher_resources WHERE rowid>(SELECT resource_cursor FROM ${control} WHERE id=1)
      UNION ALL SELECT 1 FROM ${control} WHERE index_ready=0 LIMIT 1`)).length;
  }

}

/** All production FTS writers share this operation and their existing transaction. */
export async function writeMaterialFtsRow(host: Host, rowid: number, content?: { tokens: string; normalised: string }) {
  const exists = (await host.all(`SELECT 1 FROM ${fts} WHERE rowid=?`, [rowid])).length;
  await host.run(`DELETE FROM ${fts} WHERE rowid=?`, [rowid]);
  if (content) await host.run(`INSERT INTO ${fts}(rowid,tokens,normalised) VALUES(?,?,?)`, [rowid, content.tokens, content.normalised]);
  // Some legacy hosts create the FTS before migrating the statistics reader.
  const available = (await host.all("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", [control])).length;
  if (available) await host.run(`UPDATE ${control} SET indexed=indexed+? WHERE id=1 AND index_ready=1`, [(content ? 1 : 0) - exists]);
}
