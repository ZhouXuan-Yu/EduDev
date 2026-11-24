import { pageSha, type PageBox } from "./material-page-preview";
import type { MaterialLine } from "./material-layout";
import type { PageBlock } from "./material-page-blocks";

export const DOCUMENT_STRUCTURE_SCHEMA =
  "xiaozhi.document-structure.v1" as const;
export const DOCUMENT_STRUCTURE_ENGINE =
  "layout-paragraph-question.v26" as const;
export const PREVIOUS_DOCUMENT_STRUCTURE_ENGINES = [
  "layout-paragraph-question.v25",
  "layout-paragraph-question.v24",
  "layout-paragraph-question.v23",
  "layout-paragraph-question.v22",
  "layout-paragraph-question.v21",
  "layout-paragraph-question.v20",
  "layout-paragraph-question.v19",
  "layout-paragraph-question.v18",
  "layout-paragraph-question.v17",
  "layout-paragraph-question.v16",
  "layout-paragraph-question.v15", "layout-paragraph-question.v14", "layout-paragraph-question.v13", "layout-paragraph-question.v12",
  "layout-paragraph-question.v11", "layout-paragraph-question.v10", "layout-paragraph-question.v9",
  "layout-paragraph-question.v8", "layout-paragraph-question.v7", "layout-paragraph-question.v6",
  "layout-paragraph-question.v5", "layout-paragraph-question.v4", "layout-paragraph-question.v3",
  "layout-paragraph-question.v2",
] as const;
export type DocumentStructureEngine = typeof DOCUMENT_STRUCTURE_ENGINE | typeof PREVIOUS_DOCUMENT_STRUCTURE_ENGINES[number];
export function validDocumentStructureEngine(value: unknown): value is DocumentStructureEngine {
  return value === DOCUMENT_STRUCTURE_ENGINE || PREVIOUS_DOCUMENT_STRUCTURE_ENGINES.some(engine => engine === value);
}
export type PrintedStructureRecovery = {
  parents: { line: MaterialLine; crop: PageBox; cropSha256: string; readings: string[]; engine: string; uncertain?: true }[];
  blanks: { beforeId: string; afterId: string; box: PageBox }[];
};
export type StructureIssue =
  | "pdf_text_conflict"
  | "native_unconfirmed"
  | "printed_crop_unconfirmed"
  | "low_ocr_score"
  | "ambiguous_region"
  | "ambiguous_columns"
  | "uncertain_boundary"
  | "numbering_conflict"
  | "missing_question_number"
  | "missing_question_start"
  | "missing_choice_options"
  | "formula_text_unconfirmed"
  | "table_content_unconfirmed"
  | "missing_figure"
  | "ambiguous_asset"
  | "shared_material_scope"
  | "oversized_question";
export type ParagraphRole =
  | "heading"
  | "body"
  | "question"
  | "option"
  | "subquestion"
  | "answer"
  | "analysis"
  | "material"
  | "header"
  | "footer"
  | "note"
  | "formula"
  | "table"
  | "figure";
export type StructureAnchor = { page: number; box: PageBox };
export type StructureFormulaSource = StructureAnchor & { rasterSha256: string; lineIds: string[] };
export type StructureTableSource = StructureAnchor & {
  regionId: string;
  rasterSha256: string;
  continuesFrom?: { page: number; regionId: string };
  rows: { box: PageBox; text: string; lineIds: string[]; needsReview: boolean; suspectedOverprint?: true;
    rowSpan?: number; columnSpan?: number; covered?: true }[][];
};
export type StructureLine = {
  id: string;
  sourceId: string;
  origin?: "pdf_native_crop" | "local_ocr_crop";
  text: string;
  box: PageBox;
  quad: MaterialLine["normalizedQuad"];
  score: number;
  regionIds: string[];
};
export type StructureParagraph = {
  id: string;
  role: ParagraphRole;
  column: number;
  lineIds: string[];
  regionIds: string[];
  rawText: string;
  text: string;
  anchor: StructureAnchor;
  confidence: number;
  issues: StructureIssue[];
  marker?: { kind: "parent" | "child" | "option"; label: string };
  needsReview: true;
};
export type StructurePage = {
  schemaVersion: typeof DOCUMENT_STRUCTURE_SCHEMA;
  engine: DocumentStructureEngine;
  resourceId: string;
  version: string;
  page: number;
  totalPages: number;
  rasterSha256: string;
  sourceEngine: string;
  layoutEngine: string;
  rasterSource?: { resourceId: string; version: string };
  rawText: string;
  nativeRecovery?: import("./material-native-text").NativeGapRecovery;
  printedRecovery?: PrintedStructureRecovery;
  tableSources?: StructureTableSource[];
  lines: StructureLine[];
  regions: PageBlock[];
  columns: PageBox[];
  paragraphs: StructureParagraph[];
  issues: StructureIssue[];
  needsReview: true;
};
export type StructurePart = {
  label: string;
  paragraphIds: string[];
  text: string;
  options?: StructurePart[];
  children?: StructurePart[];
  answer?: string;
  analysis?: string;
};
export function missingChoiceLabels(options: ReadonlyArray<Pick<StructurePart, "label">>, expected = 0) {
  const seen = new Set(options.map(option => option.label));
  const labels = Array.from("ABCDEFGH");
  const count = labels.reduce((end, label, index) => seen.has(label) ? Math.max(index + 1, end) : end, expected);
  return labels.slice(0, count).filter(label => !seen.has(label));
}
export function hasPrintedChoiceText(text: string) {
  return !!text.normalize("NFKC").replace(/^[、，,。]?\s*(?:\([A-H]\)|[A-H][.、])\s*/u, "").trim();
}
export function choiceLabelsForReview(question: Pick<StructureQuestion, "options" | "expectedChoiceCount" | "assets">) {
  const missing = missingChoiceLabels(question.options, question.expectedChoiceCount);
  for (const option of question.options) {
    if (!hasPrintedChoiceText(option.text) && !question.assets.some(asset => asset.choiceLabel === option.label))
      missing.push(option.label);
  }
  return [...new Set(missing)].sort();
}
export type StructureChoiceRecheck = StructureAnchor & {
  engine: string;
  rasterSha256: string;
  cropSha256: string;
  attempts: number;
  choices: { label: string; status: "consistent" | "single_read" | "conflicting" | "unreadable"; readings: string[] }[];
};
export type StructureQuestion = {
  id: string;
  number: string;
  ocrSourceKey?: string;
  pdfSourceSlices?: PageBox[];
  section: string;
  kind: "question" | "answer";
  paragraphIds: string[];
  sharedMaterialIds: string[];
  stem: string;
  answer: string;
  analysis: string;
  options: StructurePart[];
  expectedChoiceCount?: number;
  choiceRecheck?: StructureChoiceRecheck;
  subquestions: StructurePart[];
  formulaSources?: StructureFormulaSource[];
  tableSources?: StructureTableSource[];
  anchors: StructureAnchor[];
  assets: {
    page: number;
    regionId: string;
    kind: string;
    box: PageBox;
    lineIds?: string[];
    rawText?: string;
    choiceLabel?: string;
  }[];
  pageRange: [number, number];
  confidence: number;
  issues: StructureIssue[];
  status: "candidate" | "needs_review";
  needsReview: true;
};
export type StructurePageInput = {
  resourceId: string;
  version: string;
  page: number;
  totalPages: number;
  rasterSha256: string;
  sourceEngine: string;
  layoutEngine: string;
  rasterSource?: { resourceId: string; version: string };
  nativeRecovery?: import("./material-native-text").NativeGapRecovery;
  printedRecovery?: PrintedStructureRecovery;
  tableSources?: StructureTableSource[];
  lines: MaterialLine[];
  regions: PageBlock[];
};
export type DocumentStructureSummary = {
  resourceId: string;
  version: string;
  engine: string;
  generation: string;
  status:
    | "pending"
    | "running"
    | "complete"
    | "partial"
    | "failed"
    | "cancelled";
  pages: number;
  processed: number;
  paragraphs: number;
  questions: number;
  held: number;
  error: string;
};
export type DocumentStructureQuery = {
  resourceId: string;
  version: string;
  page: number;
};
export type DocumentStructureImageQuery = DocumentStructureQuery & { rasterSha256?: string };
export const STRUCTURE_REVIEW_GROUPS = ["boundaries", "choices", "formulas", "visuals", "transcription"] as const;
export type StructureReviewGroup = typeof STRUCTURE_REVIEW_GROUPS[number];
export type DocumentStructureReviewOverview = {
  generation: string;
  groups: { kind: StructureReviewGroup; count: number; firstPage: number; nextPage: number }[];
};
export type DocumentStructureView = {
  summary?: DocumentStructureSummary;
  page?: StructurePage;
  questions: StructureQuestion[];
  references?: Record<string, DocumentStructureReference>;
  reviewed?: Record<string, string>;
};
export type DocumentStructureReference = {
  schemaVersion: typeof DOCUMENT_STRUCTURE_SCHEMA;
  resourceId: string;
  version: string;
  generation: string;
  candidateId: string;
  sha256: string;
};

export function validStructureQuery(
  value: unknown,
): value is DocumentStructureQuery {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    Object.keys(v).length === 3 &&
    typeof v.resourceId === "string" &&
    /^resource_[a-f0-9-]{36}$/i.test(v.resourceId) &&
    typeof v.version === "string" &&
    /^[a-f0-9]{64}$/.test(v.version) &&
    Number.isSafeInteger(v.page) &&
    Number(v.page) >= 1 &&
    Number(v.page) <= 10000
  );
}

export function validStructureImageQuery(value: unknown): value is DocumentStructureImageQuery {
  if (validStructureQuery(value)) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { rasterSha256, ...query } = value as Record<string, unknown>;
  return pageSha(rasterSha256) && validStructureQuery(query);
}

export const STRUCTURE_REVIEW_SCHEMA = 'xiaozhi.structure-review.v1' as const;
export type StructureReviewReceipt = {
  schemaVersion: typeof STRUCTURE_REVIEW_SCHEMA;
  id: string;
  sha256: string;
};
export function validStructureReference(value: unknown): value is DocumentStructureReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return Object.keys(r).sort().join(',') === 'candidateId,generation,resourceId,schemaVersion,sha256,version'
    && r.schemaVersion === DOCUMENT_STRUCTURE_SCHEMA
    && typeof r.resourceId === 'string' && /^resource_[a-f0-9-]{36}$/.test(r.resourceId)
    && typeof r.version === 'string' && /^[a-f0-9]{64}$/.test(r.version)
    && typeof r.generation === 'string' && /^[a-f0-9-]{36}$/.test(r.generation)
    && typeof r.candidateId === 'string' && /^sq_[a-f0-9]{40}$/.test(r.candidateId)
    && typeof r.sha256 === 'string' && /^[a-f0-9]{64}$/.test(r.sha256);
}
export function validStructureReviewReceipt(value: unknown): value is StructureReviewReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return Object.keys(r).sort().join(',') === 'id,schemaVersion,sha256'
    && r.schemaVersion === STRUCTURE_REVIEW_SCHEMA
    && typeof r.id === 'string' && /^structure_review_[a-f0-9-]{36}$/.test(r.id)
    && typeof r.sha256 === 'string' && /^[a-f0-9]{64}$/.test(r.sha256);
}
