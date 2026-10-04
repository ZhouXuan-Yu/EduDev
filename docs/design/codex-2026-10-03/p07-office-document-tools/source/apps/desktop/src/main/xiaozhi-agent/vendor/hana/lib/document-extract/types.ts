// @ts-nocheck
// Hana 0.449.0 / Apache-2.0; original body preserved. See source-manifest.json.
export type ExtractFailureReason = "unsupported" | "parse-failed" | "scanned-pdf" | "too-large";

export interface ExtractSuccess {
  ok: true;
  markdown: string;
  format: string;
  warnings: string[];
}

export interface ExtractFailure {
  ok: false;
  reason: ExtractFailureReason;
  message: string;
}

export type ExtractResult = ExtractSuccess | ExtractFailure;
