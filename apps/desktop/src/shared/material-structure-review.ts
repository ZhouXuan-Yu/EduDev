import { validArchiveFields, type ArchiveFields } from "./question-archive";
import {
  STRUCTURE_REVIEW_SCHEMA,
  validStructureReference,
  type DocumentStructureReference,
} from "./material-document-structure";

export type StructureReviewInput = {
  schemaVersion: typeof STRUCTURE_REVIEW_SCHEMA;
  reference: DocumentStructureReference;
  fields: ArchiveFields;
  sourceChecked: true;
};
export function validStructureReviewInput(
  value: unknown,
): value is StructureReviewInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    Object.keys(v).sort().join(",") ===
      "fields,reference,schemaVersion,sourceChecked" &&
    v.schemaVersion === STRUCTURE_REVIEW_SCHEMA &&
    v.sourceChecked === true &&
    validStructureReference(v.reference) &&
    validArchiveFields(v.fields)
  );
}
