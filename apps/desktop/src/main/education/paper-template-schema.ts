import type {PaperSql} from './paper-sql';

/** Additive only; invoke inside the host migration transaction. No old table rewrites. */
export async function migratePaperTemplates(sql: Pick<PaperSql, 'run'>) {
  await sql.run(`CREATE TABLE IF NOT EXISTS paper_template_heads (
    template_id TEXT PRIMARY KEY, student_id TEXT NOT NULL,
    head_version INTEGER NOT NULL CHECK(head_version >= 1))`);
  await sql.run(`CREATE TABLE IF NOT EXISTS paper_template_versions (
    template_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version >= 1),
    digest TEXT NOT NULL, name TEXT NOT NULL, data_json TEXT NOT NULL,
    created_at TEXT NOT NULL, PRIMARY KEY(template_id, version),
    FOREIGN KEY(template_id) REFERENCES paper_template_heads(template_id))`);
  await sql.run(`CREATE TABLE IF NOT EXISTS paper_template_receipts (
    session_id TEXT NOT NULL, request_id TEXT NOT NULL, student_id TEXT NOT NULL,
    input_digest TEXT NOT NULL, result_json TEXT NOT NULL,
    PRIMARY KEY(session_id, request_id))`);
  for (const operation of ['UPDATE', 'DELETE']) {
    await sql.run(`CREATE TRIGGER IF NOT EXISTS paper_template_versions_no_${operation.toLowerCase()}
      BEFORE ${operation} ON paper_template_versions BEGIN
      SELECT RAISE(ABORT, 'immutable_template_version'); END`);
    await sql.run(`CREATE TRIGGER IF NOT EXISTS paper_template_receipts_no_${operation.toLowerCase()}
      BEFORE ${operation} ON paper_template_receipts BEGIN
      SELECT RAISE(ABORT, 'immutable_template_receipt'); END`);
  }
}
