import type { PageBox } from "./material-page-preview";
import { validPageBox } from "./material-page-preview";
export const NATIVE_TEXT_SCHEMA = "xiaozhi.pdf-native-text.v1" as const;
export const NATIVE_TEXT_ENGINE = "unpdf-1.8.1/pdfjs-6.1.200-text.v1" as const;
export const NATIVE_TEXT_MAX_READ = 64 * 1048576;
export type NativeTextItem = {
  id: string;
  text: string;
  box: PageBox;
  transform: number[];
  width: number;
  height: number;
};
export type NativeTextLine = {
  id: string;
  text: string;
  box: PageBox;
  itemIds: string[];
};
export type NativeTextRequest = {
  schemaVersion: typeof NATIVE_TEXT_SCHEMA;
  file: string;
  version: string;
  stamp: string;
  page: number;
};
export type NativeTextResult =
  | {
      schemaVersion: typeof NATIVE_TEXT_SCHEMA;
      ok: true;
      engine: typeof NATIVE_TEXT_ENGINE;
      version: string;
      page: number;
      total: number;
      readBytes: number;
      items: NativeTextItem[];
      lines: NativeTextLine[];
    }
  | { schemaVersion: typeof NATIVE_TEXT_SCHEMA; ok: false; error: string };
export function validNativeTextRequest(v: unknown): v is NativeTextRequest {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  return (
    Object.keys(r).sort().join(",") ===
      "file,page,schemaVersion,stamp,version" &&
    r.schemaVersion === NATIVE_TEXT_SCHEMA &&
    typeof r.file === "string" &&
    r.file.length <= 32767 &&
    !r.file.includes("\0") &&
    typeof r.stamp === "string" &&
    /^\d+:\d+:\d+:\d+:\d+$/.test(r.stamp) &&
    typeof r.version === "string" &&
    /^[a-f0-9]{64}$/.test(r.version) &&
    Number.isSafeInteger(r.page) &&
    Number(r.page) >= 1 &&
    Number(r.page) <= 10000
  );
}
export function validNativeTextResult(v: unknown): v is NativeTextResult {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  if (r.schemaVersion !== NATIVE_TEXT_SCHEMA) return false;
  if (r.ok === false)
    return (
      Object.keys(r).length === 3 &&
      typeof r.error === "string" &&
      [
        "busy",
        "cancelled",
        "timeout",
        "unavailable",
        "parse_failed",
        "source_changed",
        "too_large",
        "invalid_input",
      ].includes(r.error)
    );
  if (
    r.ok !== true ||
    Object.keys(r).length !== 9 ||
    r.engine !== NATIVE_TEXT_ENGINE ||
    typeof r.version !== "string" ||
    !/^[a-f0-9]{64}$/.test(r.version) ||
    !Number.isSafeInteger(r.page) ||
    !Number.isSafeInteger(r.total) ||
    Number(r.page) < 1 ||
    Number(r.page) > Number(r.total) ||
    Number(r.total) > 10000 ||
    !Number.isSafeInteger(r.readBytes) ||
    Number(r.readBytes) < 1 ||
    Number(r.readBytes) > NATIVE_TEXT_MAX_READ ||
    !Array.isArray(r.items) ||
    r.items.length > 4000 ||
    !Array.isArray(r.lines) ||
    r.lines.length > 2000
  )
    return false;
  let chars = 0;
  if (
    !r.items.every((item, i) => {
      if (
        !item ||
        typeof item !== "object" ||
        Object.keys(item).length !== 6 ||
        item.id !== "native-item-" + (i + 1) ||
        typeof item.text !== "string" ||
        !item.text.trim() ||
        !validPageBox(item.box) ||
        !Array.isArray(item.transform) ||
        item.transform.length !== 6 ||
        !item.transform.every(Number.isFinite) ||
        ![item.width, item.height].every(
          (n) => typeof n === "number" && Number.isFinite(n) && n > 0,
        )
      )
        return false;
      chars += item.text.length;
      return chars <= 128000;
    })
  )
    return false;
  const ids = new Set((r.items as NativeTextItem[]).map((item) => item.id));
  return r.lines.every(
    (line, i) =>
      line &&
      typeof line === "object" &&
      Object.keys(line).length === 4 &&
      line.id === "native-line-" + (i + 1) &&
      typeof line.text === "string" &&
      line.text.length <= 12000 &&
      !!line.text.trim() &&
      validPageBox(line.box) &&
      Array.isArray(line.itemIds) &&
      line.itemIds.length > 0 &&
      line.itemIds.length <= 4000 &&
      line.itemIds.every(
        (id: unknown) => typeof id === "string" && ids.has(id),
      ),
  );
}

export const NATIVE_CROP_POLICY = "pdf-native-crop-concordance.v1" as const;
export type NativeCropAttempt = {
  variant?: "original" | "vertical-2x";
  sourceAssetId?: string;
  nativeLineId: string;
  image?: {
    assetId: string;
    sha256: string;
    width: number;
    height: number;
    box: PageBox;
  };
  ocr?: Extract<import("./xiaozhi-ocr").LocalOcrReceipt, { ok: true }>;
  error?: string;
};
export type NativeGapRecovery = {
  policy: typeof NATIVE_CROP_POLICY;
  rasterSha256: string;
  native: NativeTextResult;
  attempts: NativeCropAttempt[];
  accepted: {
    nativeLineId: string;
    attempt: number;
    line: import("./material-layout").MaterialLine;
  }[];
  unresolved: string[];
};
