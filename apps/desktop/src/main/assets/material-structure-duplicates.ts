import { createHash } from "node:crypto";
import type { QuestionBankItem } from "../../shared/contracts";
import { QUESTION_DOCUMENT_SCHEMA } from "../../shared/question-document";
import { DOCUMENT_STRUCTURE_ENGINE } from "../../shared/material-document-structure";
import type { OriginHost } from "./material-question-origins";
import { teacherOwnsRuleQuestion } from "./material-rule-protection";

const keyPrefix = "pdf-structure:";
export const structureDuplicateIndex = "idx_material_pdf_structure_duplicates_v1";
export const structureDuplicateKey = (member: string) =>
  `${member}.duplicate_key GLOB '${keyPrefix}*'`;

const currentSource = (resource: string, member: string) =>
  `${resource}.id=${member}.resource_id AND ${resource}.content_hash=substr(${member}.duplicate_key,${keyPrefix.length + 1},64)`;
const pairedSource = (role: "question" | "answer", resource: string) => {
  const other = role === "question" ? "answer" : "question";
  return `EXISTS (
    SELECT 1 FROM material_book_pairs p
    JOIN teacher_resources paired ON paired.id=p.${other}_id AND paired.content_hash=p.${other}_version
    WHERE p.active=1 AND p.${role}_id=${resource}.id AND p.${role}_version=${resource}.content_hash
  )`;
};

// The source records and their review state remain independent. Only the default list
// and the pending-review count use this grouping.
export const structureDuplicateHidden = process.env.OMNI_EDU_RULE_DUPLICATES === "0" ? "0" : `EXISTS (
  SELECT 1 FROM material_question_members copy
  JOIN teacher_resources source ON ${currentSource("source", "copy")}
  JOIN material_question_members keeper ON keeper.duplicate_key=copy.duplicate_key
    AND keeper.resource_id<>copy.resource_id AND ${structureDuplicateKey("keeper")}
  JOIN teacher_resources kept ON ${currentSource("kept", "keeper")}
  JOIN question_bank_items candidate ON candidate.id=keeper.question_id
  WHERE copy.question_id=q.id AND ${structureDuplicateKey("copy")}
    AND NOT EXISTS (SELECT 1 FROM material_structure_hidden_questions h WHERE h.question_id=candidate.id)
    AND NOT ${pairedSource("question", "source")}
    AND NOT ${pairedSource("answer", "source")}
    AND NOT ${pairedSource("answer", "kept")}
    AND (${pairedSource("question", "kept")} OR
      (keeper.duplicate_order,keeper.question_id)<(copy.duplicate_order,copy.question_id))
)`;

export async function rememberStructureDuplicate(host: OriginHost, q: QuestionBankItem) {
  const archive = q.archive;
  const document = q.document;
  if (!archive?.structure || !document || document.schemaVersion !== QUESTION_DOCUMENT_SCHEMA ||
      archive.state !== "rule_extracted" || archive.sourceChecked || q.createdAt !== q.updatedAt ||
      q.sourceKind !== "teacher_resource" || await teacherOwnsRuleQuestion(host, q.id)) return false;
  const { resourceId, version, generation, candidateId, sha256 } = archive.structure;
  const [row] = await host.all(`SELECT c.document_json FROM material_question_members m
    JOIN teacher_resources r ON r.id=m.resource_id AND r.content_hash=?
    JOIN material_structure_jobs s ON s.resource_id=r.id AND s.version=r.content_hash
      AND s.engine=? AND s.generation=? AND s.status IN ('complete','partial')
    JOIN material_structure_questions c ON c.generation=s.generation AND c.id=?
      AND c.sha256=? AND c.status='candidate'
    WHERE m.question_id=? AND m.resource_id=? AND lower(r.original_file_name) LIKE '%.pdf'`,
    [version, DOCUMENT_STRUCTURE_ENGINE, generation, candidateId, sha256, q.id, resourceId]);
  if (row?.document_json !== JSON.stringify(document)) return false;
  const fingerprint = createHash("sha256").update(JSON.stringify([
    q.subject, q.grade, q.knowledgePoint, q.questionType, q.difficulty, q.stem, q.answer, q.analysis, q.tags,
    archive.number, archive.issues, archive.sourceRisks, archive.answerOrigin, archive.analysisOrigin,
    document,
  ], (key, value) => key === "resourceId" || key === "assetId" ? undefined : value)).digest("hex");
  const key = keyPrefix + version + ":" + fingerprint;
  await host.run(`UPDATE material_question_members SET duplicate_key=?,duplicate_order=?,duplicate_of=''
    WHERE question_id=? AND (duplicate_key<>? OR duplicate_order<>?)`,
    [key, q.createdAt, q.id, key, q.createdAt]);
  return true;
}
