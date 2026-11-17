import type { PageBox } from "./material-page-preview";
import type { MaterialLine } from "./material-layout";
import type { PageBlock } from "./material-page-blocks";

export const DOCUMENT_STRUCTURE_SCHEMA =
  "xiaozhi.document-structure.v1" as const;
export const DOCUMENT_STRUCTURE_ENGINE =
  "layout-paragraph-question.v2" as const;
export type StructureIssue =
  | "native_unconfirmed"
  | "low_ocr_score"
  | "ambiguous_region"
  | "ambiguous_columns"
  | "uncertain_boundary"
  | "numbering_conflict"
  | "missing_question_start"
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
export type StructureLine = {
  id: string;
  sourceId: string;
  origin?: "pdf_native_crop";
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
  engine: typeof DOCUMENT_STRUCTURE_ENGINE;
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
export type StructureQuestion = {
  id: string;
  number: string;
  ocrSourceKey?: string;
  section: string;
  kind: "question" | "answer";
  paragraphIds: string[];
  sharedMaterialIds: string[];
  stem: string;
  answer: string;
  analysis: string;
  options: StructurePart[];
  subquestions: StructurePart[];
  anchors: StructureAnchor[];
  assets: {
    page: number;
    regionId: string;
    kind: string;
    box: PageBox;
    lineIds?: string[];
    rawText?: string;
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
