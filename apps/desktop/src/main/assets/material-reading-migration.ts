/** Append-only local reading events. Existing material/chunk facts are untouched. */
export async function ensureMaterialReadingEntries(run:(sql:string)=>Promise<void>){
 await run(`CREATE TABLE IF NOT EXISTS material_reading_entries (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL REFERENCES teacher_resources(id),
  source_json TEXT NOT NULL,
  note TEXT NOT NULL,
  completed INTEGER NOT NULL CHECK(completed IN (0,1)),
  updated_at TEXT NOT NULL
 )`);
 await run('CREATE INDEX IF NOT EXISTS material_reading_resource ON material_reading_entries(resource_id,sequence DESC)');
}
