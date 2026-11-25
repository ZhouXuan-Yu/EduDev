import { validStructureReference, type DocumentStructureReference, type StructureFormulaSource } from "./material-document-structure";
import { validPageBox } from "./material-page-preview";
import { officeMathParts, officeMathHtml } from "./office-math";

export const FORMULA_RECOGNITION_SCHEMA = "xiaozhi.local-formula-recognition.v1" as const;
export const FORMULA_RECOGNITION_ENGINE = "pp-formulanet-plus-s.paddle3.v1" as const;

/** Legacy regions use their original ID. Inferred crops use a source-owned lead line. */
export function formulaRecognitionSource(source: StructureFormulaSource) {
  if (source.regionId && validPageBox(source.box)) return { id: source.regionId, box: source.box };
  const box = source.recognitionBox;
  if (!validPageBox(source.box) || !validPageBox(box) || source.lineIds.length < 3 ||
      !/^[a-z0-9_-]{1,116}$/iu.test(source.lineIds[0]) ||
      box[0] < source.box[0] || box[1] < source.box[1] || box[2] > source.box[2] || box[3] > source.box[3]) return;
  return { id: "stacked:" + source.lineIds[0], box };
}

export type FormulaRecognitionQuery = {
  reference: DocumentStructureReference;
  page: number;
  regionId: string;
  requestId: string;
  action: "status" | "run" | "cancel";
};

export type FormulaRecognitionResult =
  | { state: "ready" | "unavailable" | "unclear" | "cancelled" | "timeout" | "busy" | "failed" | "source_changed" }
  | { state: "candidate"; latex: string; copyLatex?: string; engine: typeof FORMULA_RECOGNITION_ENGINE; cropSha256: string };

export function stackedFractionValue(latex: string, lead: string) {
  if (!lead.normalize("NFKC").trimEnd().endsWith("=")) return;
  const value = /^=\s*(\\(?:frac|dfrac|tfrac)\b.+)$/u.exec(latex.trim())?.[1];
  return readableFormulaLatex(value) ? value : undefined;
}

export type FormulaComponentAction = "status" | "install" | "cancel";
export type FormulaComponentStatus = {
  phase: "missing" | "ready" | "unsupported" | "checking" | "downloading" | "installing" | "failed";
  downloadedBytes: number;
  totalBytes: number;
  installedBytes: number;
  reason?: "disk_full" | "verification_failed" | "download_failed";
};

export function formulaComponentInstalling(status: FormulaComponentStatus | undefined) {
  return status?.phase === "checking" || status?.phase === "downloading" || status?.phase === "installing";
}

export function validFormulaRecognitionQuery(raw: unknown): raw is FormulaRecognitionQuery {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const query = raw as FormulaRecognitionQuery;
  return Object.keys(query).sort().join(",") === "action,page,reference,regionId,requestId" &&
    validStructureReference(query.reference) &&
    Number.isSafeInteger(query.page) && query.page > 0 && query.page <= 10_000 &&
    typeof query.regionId === "string" && /^[a-z0-9_:-]{1,128}$/iu.test(query.regionId) &&
    typeof query.requestId === "string" && /^[a-f0-9-]{36}$/u.test(query.requestId) &&
    ["status", "run", "cancel"].includes(query.action);
}

export function readableFormulaLatex(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 320 || !/[\p{L}\p{N}]/u.test(value) ||
      /[\p{C}$]/u.test(value) || /\/(?:mathrm|frac|sqrt)\b/u.test(value)) return false;
  try {
    const input = "$" + value + "$";
    const parts = officeMathParts(input);
    if (parts.length !== 1 || parts[0].kind !== "math") return false;
    officeMathHtml(input);
    return true;
  } catch {
    return false;
  }
}
