import type { OriginHost } from "./material-question-origins";
import type { DocumentStructureReference } from "../../shared/material-document-structure";

export const STRUCTURE_BANK_REVISION = ":archive.v2";

export function checkedStructureArchive(archive: string) {
  return `(json_type(${archive},'$.sourceChecked')='true'
    AND json_extract(${archive},'$.state') IN ('teacher_edited','book_enriched','web_enriched'))`;
}

export const structureDraftHidden = "EXISTS(SELECT 1 FROM material_structure_hidden_questions h WHERE h.question_id=q.id)";
export const structureDraftStaged = "EXISTS(SELECT 1 FROM material_structure_hidden_questions h WHERE h.question_id=q.id AND h.state='staged')";

export async function migrateStructureBank(host: Pick<OriginHost, "run">) {
  await host.run(`CREATE TABLE IF NOT EXISTS material_structure_hidden_questions(
    question_id TEXT PRIMARY KEY, resource_id TEXT NOT NULL, generation TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('staged','superseded'))
  )`);
  await host.run("CREATE INDEX IF NOT EXISTS material_structure_hidden_resource ON material_structure_hidden_questions(resource_id,generation,state)");
}

export async function stageStructureDraft(host: Pick<OriginHost, "run">, questionId: string, resourceId: string, generation: string) {
  await host.run("INSERT INTO material_structure_hidden_questions VALUES(?,?,?,'staged')", [questionId, resourceId, generation]);
}

export async function hasIdenticalVisibleStructureDraft(host: Pick<OriginHost, "all">, key: string, reference: DocumentStructureReference) {
  const rows = await host.all(`SELECT 1 FROM material_question_members m JOIN question_bank_items q ON q.id=m.question_id
    WHERE m.extraction_key BETWEEN ? AND ? AND NOT ${structureDraftHidden}
    AND CASE WHEN json_valid(q.archive_json) THEN json_extract(q.archive_json,'$.structure.sha256')=? ELSE 0 END
    LIMIT 1`, [key, key + ":\uffff", reference.sha256]);
  return rows.length > 0;
}

/** Inside the last archive writer transaction, publish the new set and retire older automatic drafts. */
export async function publishStructureDrafts(host: Pick<OriginHost, "run">, resourceId: string, generation: string, publishQuestions: boolean) {
  const archive = "CASE WHEN json_valid(q.archive_json) THEN q.archive_json ELSE '{}' END";
  await host.run(`WITH identical AS MATERIALIZED (
    SELECT q.id,ROW_NUMBER() OVER(PARTITION BY c.id
      ORDER BY COALESCE(${checkedStructureArchive(archive)},0) DESC,m.rowid) AS rank
    FROM material_question_members m JOIN question_bank_items q ON q.id=m.question_id
    JOIN material_structure_questions c ON c.generation=?
      AND c.id=json_extract(${archive},'$.structure.candidateId')
      AND c.sha256=json_extract(${archive},'$.structure.sha256')
    WHERE ? AND m.resource_id=? AND c.status='candidate' AND c.document_json<>''
      AND NOT ${structureDraftHidden}
  )
    INSERT OR IGNORE INTO material_structure_hidden_questions(question_id,resource_id,generation,state)
    SELECT q.id,m.resource_id,json_extract(q.archive_json,'$.structure.generation'),'superseded'
    FROM material_question_members m JOIN question_bank_items q ON q.id=m.question_id
    WHERE m.resource_id=? AND CASE WHEN json_valid(q.archive_json) THEN
      json_extract(q.archive_json,'$.structure.resourceId')=m.resource_id
      AND json_extract(q.archive_json,'$.structure.generation')<>?
      AND NOT COALESCE(${checkedStructureArchive("q.archive_json")},0)
      AND q.id NOT IN (SELECT id FROM identical WHERE rank=1)
      ELSE 0 END`, [generation, publishQuestions ? 1 : 0, resourceId, resourceId, generation]);
  if (publishQuestions)
    await host.run("DELETE FROM material_structure_hidden_questions WHERE resource_id=? AND generation=? AND state='staged'", [resourceId, generation]);
}

export async function assertStructureDraftEditable(host: Pick<OriginHost, "all">, questionId: string) {
  if ((await host.all("SELECT 1 FROM material_structure_hidden_questions WHERE question_id=?", [questionId])).length)
    throw Error("structure_draft_superseded");
}
