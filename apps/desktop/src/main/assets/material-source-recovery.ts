import {createHash} from 'node:crypto';
import {validMaterialSource, type MaterialSource} from '../../shared/materials';
import {readQuestionArchive} from '../../shared/question-archive';

type Value = string | number | null;
type Host = {all: (sql: string, values?: Value[]) => Promise<Record<string, unknown>[]>};
const MAX_JSON_CHARS = 2 * 1024 * 1024;
const sameSource = (a: MaterialSource, b: MaterialSource) =>
  a.schemaVersion === b.schemaVersion && a.resourceId === b.resourceId &&
  a.version === b.version && a.offset === b.offset && a.chunkId === b.chunkId && a.bodyVersion === b.bodyVersion;

// Only durable host records can establish that a displaced ID was previously issued.
// A caller who knows the current text cannot mint a historical source reference.
const objectValue = "CASE WHEN s.type='object' THEN s.value ELSE '{}' END";
const sourcePredicate = `json_extract(${objectValue},'$.schemaVersion')=? AND
  json_extract(${objectValue},'$.resourceId')=? AND json_extract(${objectValue},'$.version')=? AND
  json_extract(${objectValue},'$.offset')=? AND json_extract(${objectValue},'$.chunkId')=? AND
  json_extract(${objectValue},'$.bodyVersion')=?`;
const values = (source: MaterialSource): Value[] => [
  source.schemaVersion, source.resourceId, source.version, source.offset, source.chunkId, source.bodyVersion,
];

export async function storedMaterialSource(host: Host, source: MaterialSource): Promise<boolean> {
  if ((await host.all('SELECT 1 FROM resource_chunks WHERE id=? LIMIT 1', [source.chunkId])).length) return false;
  const tables = new Set((await host.all(`SELECT name FROM sqlite_master WHERE type='table' AND name IN
    ('question_bank_items','material_question_members','material_ai_units','material_ai_batches',
     'material_ai_response_receipts','material_reading_entries')`)).map(row => String(row.name)));

  if (tables.has('question_bank_items') && tables.has('material_question_members')) {
    const rows = await host.all(`SELECT q.archive_json FROM material_question_members m
      JOIN question_bank_items q ON q.id=m.question_id WHERE m.resource_id=?
      AND length(q.archive_json)<=? AND EXISTS(SELECT 1 FROM
        json_each(CASE WHEN json_valid(q.archive_json) THEN q.archive_json ELSE '{}' END,'$.sources') s
        WHERE ${sourcePredicate}) LIMIT 8`, [source.resourceId, MAX_JSON_CHARS, ...values(source)]);
    for (const row of rows) {
      try {
        if (readQuestionArchive(row.archive_json)?.sources.some(saved => sameSource(saved, source))) return true;
      } catch { /* A corrupt archive cannot authorize recovery. */ }
    }
  }

  if (tables.has('material_reading_entries')) {
    const rows = await host.all(`SELECT source_json FROM material_reading_entries WHERE resource_id=?
      AND length(source_json)<=2048 AND EXISTS(SELECT 1 FROM json_each(json_array(
        CASE WHEN json_valid(source_json) THEN json(source_json) ELSE json('{}') END)) s
        WHERE ${sourcePredicate}) LIMIT 8`, [source.resourceId, ...values(source)]);
    for (const row of rows) {
      try {
        const saved: unknown = JSON.parse(String(row.source_json));
        if (validMaterialSource(saved) && sameSource(saved, source)) return true;
      } catch { /* Reading history remains intact when a receipt is malformed. */ }
    }
  }

  if (['material_ai_units', 'material_ai_batches', 'material_ai_response_receipts'].every(table => tables.has(table))) {
    const rows = await host.all(`SELECT u.input_json,
      (SELECT r.input_sha FROM material_ai_response_receipts r WHERE r.batch_id=u.batch_id
       AND r.ordinal=u.ordinal AND r.received_at<>'' ORDER BY r.rowid DESC LIMIT 1) received_input_sha
      FROM material_ai_batches b JOIN material_ai_units u ON u.batch_id=b.id WHERE b.resource_id=?
      AND length(u.input_json)<=? AND EXISTS(SELECT 1 FROM
        json_each(CASE WHEN json_valid(u.input_json) THEN u.input_json ELSE '{}' END,'$.sources') s
        WHERE ${sourcePredicate}) LIMIT 8`, [source.resourceId, MAX_JSON_CHARS, ...values(source)]);
    for (const row of rows) {
      const text = String(row.input_json);
      if (createHash('sha256').update(text).digest('hex') !== row.received_input_sha) continue;
      try {
        const input: unknown = JSON.parse(text);
        if (!input || typeof input !== 'object' || !('sources' in input) || !Array.isArray(input.sources)) continue;
        if (input.sources.some(saved => validMaterialSource(saved) && sameSource(saved, source))) return true;
      } catch { /* A saved response never authorizes different or malformed input. */ }
    }
  }
  return false;
}
