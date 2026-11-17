import type {TeacherResource} from '../../shared/contracts';

type Value = string | number | null;
type Sql = {all: (sql: string, values?: Value[]) => Promise<Record<string, unknown>[]>; run: (sql: string, values?: Value[]) => Promise<void>};

export async function migrateWordPageSources(host: Pick<Sql, 'run'>) {
  await host.run(`CREATE TABLE IF NOT EXISTS material_word_page_sources(
    id TEXT PRIMARY KEY,resource_id TEXT NOT NULL,version TEXT NOT NULL,engine TEXT NOT NULL,original_name TEXT NOT NULL,
    status TEXT NOT NULL,error TEXT NOT NULL DEFAULT '',owner_pid INTEGER NOT NULL DEFAULT 0,owner_nonce TEXT NOT NULL DEFAULT '',
    pdf_resource_id TEXT NOT NULL DEFAULT '',pdf_sha TEXT NOT NULL DEFAULT '',pdf_bytes INTEGER NOT NULL DEFAULT 0,pdf_name TEXT NOT NULL,
    pages INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`);
  await host.run('CREATE INDEX IF NOT EXISTS idx_word_page_parent ON material_word_page_sources(resource_id,version,engine)');
  await host.run("CREATE INDEX IF NOT EXISTS idx_word_page_pdf ON material_word_page_sources(pdf_resource_id) WHERE pdf_resource_id<>''");
  await host.run("CREATE INDEX IF NOT EXISTS idx_word_page_receipt ON material_word_page_sources(pdf_sha,pdf_name)");
  await host.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_word_page_running ON material_word_page_sources(resource_id,version,engine) WHERE status='running'");
}

/** Also protects the interval between ordinary archive publication and conversion ACK. */
export async function isWordPageSource(host: Pick<Sql, 'all'>, resource: Pick<TeacherResource, 'id' | 'contentHash' | 'originalFileName'>) {
  return (await host.all(`SELECT 1 FROM material_word_page_sources p
    JOIN teacher_resources original ON original.id=p.resource_id AND original.content_hash=p.version
    WHERE p.pdf_sha=? AND (p.pdf_resource_id=? OR p.pdf_resource_id='' AND p.pdf_name=?) LIMIT 1`,
  [resource.contentHash, resource.id, resource.originalFileName])).length > 0;
}

// These snapshots supply page evidence. Their unowned text-only candidates are reversible derived views.
const archive = "CASE WHEN json_valid(wq.archive_json) THEN wq.archive_json ELSE '{}' END";
export const wordPageRuleCandidateHidden = `q.id IN (
  SELECT wq.id FROM material_word_page_sources p
  JOIN teacher_resources original ON original.id=p.resource_id AND original.content_hash=p.version
  JOIN teacher_resources page ON page.id=p.pdf_resource_id AND page.content_hash=p.pdf_sha
  JOIN material_question_members m ON m.resource_id=page.id
  JOIN question_bank_items wq ON wq.id=m.question_id
  WHERE p.status='complete' AND json_extract(${archive},'$.schemaVersion')='xiaozhi.question-archive.v1'
    AND json_extract(${archive},'$.extractor')='numbered-text.v1'
    AND json_extract(${archive},'$.state')='rule_extracted' AND json_type(${archive},'$.sourceChecked')='false'
    AND wq.created_at=wq.updated_at AND json_type(${archive},'$.ai') IS NULL
    AND json_type(${archive},'$.sources')='array' AND json_array_length(${archive},'$.sources') BETWEEN 1 AND 64
    AND NOT EXISTS(SELECT 1 FROM question_notebook_bookmarks b WHERE b.question_id=wq.id AND b.bookmarked=1)
    AND NOT EXISTS(SELECT 1 FROM question_notebook_category_links c WHERE c.question_id=wq.id)
    AND NOT EXISTS(SELECT 1 FROM question_bank_usage u WHERE u.question_id=wq.id)
    AND NOT EXISTS(SELECT 1 FROM json_each(${archive},'$.sources') s
      WHERE COALESCE(json_extract(CASE WHEN s.type='object' THEN s.value ELSE '{}' END,'$.resourceId'),'')<>page.id
        OR COALESCE(json_extract(CASE WHEN s.type='object' THEN s.value ELSE '{}' END,'$.version'),'')<>p.pdf_sha)
)`;
