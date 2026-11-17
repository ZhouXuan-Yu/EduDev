import {WORD_PAGES_ENGINE,type WordPagesView,type WordPagesQuery} from '../../shared/material-word-pages';

type Row = Record<string, unknown>;
type Value = string | number | null;
type Sql = {all: (sql: string, values?: Value[]) => Promise<Row[]>; run: (sql: string, values?: Value[]) => Promise<void>};
export const FOLDER_WORD_PAGES = 'word-pages.v1';
export type PrepareFolderWordPages = (input: WordPagesQuery, signal: AbortSignal) => Promise<WordPagesView>;

export async function migrateFolderWordPages(host: Sql) {
  const grants = await host.all('PRAGMA table_info(material_folder_ai)');
  if (!grants.some(column => column.name === 'word_source_policy')) {
    await host.run("ALTER TABLE material_folder_ai ADD COLUMN word_source_policy TEXT NOT NULL DEFAULT 'native.v1' CHECK(word_source_policy IN ('native.v1','word-pages.v1'))");
  }
  const resources = await host.all('PRAGMA table_info(material_folder_ai_resources)');
  for (const name of ['origin_resource_id', 'origin_version']) {
    if (!resources.some(column => column.name === name)) await host.run(`ALTER TABLE material_folder_ai_resources ADD COLUMN ${name} TEXT NOT NULL DEFAULT ''`);
  }
  await host.run("CREATE INDEX IF NOT EXISTS idx_folder_word_page_origin ON material_folder_ai_resources(batch_id,origin_resource_id) WHERE origin_resource_id<>''");
}

/** Direct files retain their old grant. Derived pages require the current original and exact conversion receipt. */
export async function folderResourceAuthorized(host: Pick<Sql, 'all'>, folderId: string, resourceId: string, version?: string) {
  const direct = await host.all(`SELECT 1 FROM material_import_entries e JOIN teacher_resources r ON r.id=e.resource_id
    WHERE e.batch_id=? AND e.kind='file' AND e.status='saved' AND r.id=? ${version ? 'AND r.content_hash=?' : ''} LIMIT 1`,
  version ? [folderId, resourceId, version] : [folderId, resourceId]);
  if (direct.length) return true;
  const tables = await host.all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('material_folder_ai','material_word_page_sources')");
  if (tables.length !== 2) return false;
  const grant = (await host.all('SELECT * FROM material_folder_ai WHERE batch_id=?', [folderId]))[0];
  if (grant?.word_source_policy !== FOLDER_WORD_PAGES) return false;
  return (await host.all(`SELECT 1 FROM material_folder_ai_resources child
    JOIN teacher_resources pdf ON pdf.id=child.resource_id AND pdf.content_hash=child.version
    JOIN material_folder_ai_resources parent ON parent.batch_id=child.batch_id AND parent.resource_id=child.origin_resource_id AND parent.version=child.origin_version
    JOIN teacher_resources original ON original.id=parent.resource_id AND original.content_hash=parent.version
    JOIN material_import_entries e ON e.batch_id=parent.batch_id AND e.resource_id=parent.resource_id AND e.kind='file' AND e.status='saved'
    JOIN material_word_page_sources p ON p.resource_id=parent.resource_id AND p.version=parent.version AND p.pdf_resource_id=child.resource_id AND p.pdf_sha=child.version
    WHERE child.batch_id=? AND child.resource_id=? AND parent.status='represented'
      AND NOT EXISTS(SELECT 1 FROM resource_chunks private WHERE private.resource_id=parent.resource_id AND private.contains_personal_data=1)
      AND p.status='complete' AND p.engine=? ${version ? 'AND child.version=?' : ''} LIMIT 1`,
  version ? [folderId, resourceId, WORD_PAGES_ENGINE, version] : [folderId, resourceId, WORD_PAGES_ENGINE])).length > 0;
}

export async function nextFolderWordPage(host: Pick<Sql, 'all'>, grant: Row) {
  if (grant.word_source_policy !== FOLDER_WORD_PAGES) return;
  return (await host.all(`SELECT fr.* FROM material_folder_ai_resources fr
    JOIN teacher_resources r ON r.id=fr.resource_id AND r.content_hash=fr.version
    WHERE fr.batch_id=? AND fr.origin_resource_id='' AND fr.status IN ('waiting','running') AND fr.error=''
      AND lower(r.original_file_name) LIKE '%.docx'
      AND NOT EXISTS(SELECT 1 FROM material_folder_ai_units u WHERE u.batch_id=fr.batch_id AND u.resource_id=fr.resource_id AND u.ai_batch_id<>'')
    ORDER BY fr.rowid LIMIT 1`, [String(grant.batch_id)]))[0];
}

/** Caller owns the folder writer transaction and rechecks the grant after conversion. */
export async function attachFolderWordPage(host: Sql, grant: Row, parent: Row, view: WordPagesView) {
  const id = String(grant.batch_id), pdf = view.pdf;
  if (view.status !== 'complete' || !pdf || view.original.id !== parent.resource_id || view.original.version !== parent.version) throw Error('source_changed');
  const current = (await host.all(`SELECT f.* FROM material_folder_ai f
    JOIN material_folder_ai_resources p ON p.batch_id=f.batch_id AND p.resource_id=? AND p.version=?
    JOIN teacher_resources r ON r.id=p.resource_id AND r.content_hash=p.version
    JOIN material_import_entries e ON e.batch_id=p.batch_id AND e.resource_id=p.resource_id AND e.kind='file' AND e.status='saved'
    WHERE f.batch_id=? AND p.origin_resource_id='' AND p.status IN ('waiting','running')`,
  [String(parent.resource_id), String(parent.version), id]))[0];
  if (!current || current.status !== 'running') throw Error('paused');
  if (current.revision !== grant.revision || current.settings_revision !== grant.settings_revision || current.word_source_policy !== FOLDER_WORD_PAGES) throw Error('source_changed');
  if (!(await host.all(`SELECT 1 FROM material_word_page_sources p JOIN teacher_resources r ON r.id=p.pdf_resource_id AND r.content_hash=p.pdf_sha
    WHERE p.resource_id=? AND p.version=? AND p.engine=? AND p.status='complete' AND p.pdf_resource_id=? AND p.pdf_sha=?`,
  [String(parent.resource_id), String(parent.version), WORD_PAGES_ENGINE, pdf.id, pdf.contentHash])).length) throw Error('source_changed');
  const existing = (await host.all('SELECT * FROM material_folder_ai_resources WHERE batch_id=? AND resource_id=?', [id, pdf.id]))[0];
  if (existing && (existing.version !== pdf.contentHash || existing.origin_resource_id && (existing.origin_resource_id !== parent.resource_id || existing.origin_version !== parent.version))) throw Error('source_changed');
  if (!existing) await host.run(`INSERT INTO material_folder_ai_resources(batch_id,resource_id,version,origin_resource_id,origin_version) VALUES(?,?,?,?,?)`,
  [id, pdf.id, pdf.contentHash, String(parent.resource_id), String(parent.version)]);
  await host.run("UPDATE material_folder_ai_resources SET status='represented',total=0,error='' WHERE batch_id=? AND resource_id=? AND version=?", [id, String(parent.resource_id), String(parent.version)]);
  await host.run("UPDATE material_folder_ai_units SET state='complete',error='word_page_source' WHERE batch_id=? AND resource_id=? AND ai_batch_id='' AND state='pending_local'", [id, String(parent.resource_id)]);
  if (!await folderResourceAuthorized(host, id, pdf.id, pdf.contentHash)) throw Error('source_changed');
}
