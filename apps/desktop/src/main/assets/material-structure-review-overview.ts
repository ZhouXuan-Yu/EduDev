import type { DocumentStructureReviewOverview, StructureIssue, StructureReviewGroup } from "../../shared/material-document-structure";

const issueGroups: Record<StructureIssue, StructureReviewGroup> = {
  ambiguous_columns: "boundaries",
  uncertain_boundary: "boundaries",
  numbering_conflict: "boundaries",
  missing_question_number: "boundaries",
  missing_question_start: "boundaries",
  printed_crop_unconfirmed: "boundaries",
  shared_material_scope: "boundaries",
  oversized_question: "boundaries",
  missing_choice_options: "choices",
  formula_text_unconfirmed: "formulas",
  missing_figure: "visuals",
  ambiguous_asset: "visuals",
  ambiguous_region: "visuals",
  pdf_text_conflict: "transcription",
  native_unconfirmed: "transcription",
  low_ocr_score: "transcription",
};

/** A question can have several issue codes but counts once per affected area. */
export async function readStructureReviewOverview(
  all: (sql: string, values: (string | number)[]) => Promise<Record<string, unknown>[]>,
  generation: string,
  currentPage: number,
): Promise<DocumentStructureReviewOverview> {
  const rows = await all(`
    WITH defects AS (
      SELECT DISTINCT q.id, q.first_page, coalesce(policy.value, 'transcription') AS kind
      FROM material_structure_questions q
      LEFT JOIN json_each(q.body_json, '$.issues') issue
      LEFT JOIN json_each(?) policy ON policy.key = issue.value
      WHERE q.generation=? AND q.status='needs_review'
        AND json_extract(q.body_json, '$.kind')='question'
    )
    SELECT kind, count(*) AS count, min(first_page) AS firstPage,
      coalesce(min(CASE WHEN first_page>? THEN first_page END), min(first_page)) AS nextPage
    FROM defects GROUP BY kind`, [JSON.stringify(issueGroups), generation, currentPage]);
  return { generation, groups: rows.map(row => ({
    kind: row.kind as StructureReviewGroup,
    count: Number(row.count),
    firstPage: Number(row.firstPage),
    nextPage: Number(row.nextPage),
  })) };
}
