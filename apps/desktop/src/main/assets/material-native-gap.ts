import { sourceLayoutSignature } from "../../shared/material-ai-source-layout";
import {
  NATIVE_CROP_POLICY,
  type NativeTextLine,
  type NativeTextResult,
  type NativeGapRecovery,
  type NativeCropAttempt,
} from "../../shared/material-native-text";
import type { MaterialLine, PdfLayout } from "../../shared/material-layout";
import type { PageBlock } from "../../shared/material-page-blocks";
import type { PageBox } from "../../shared/material-page-preview";

const area = (box: PageBox) =>
  Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);
const overlap = (a: PageBox, b: PageBox) =>
  area([
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
    Math.min(a[2], b[2]),
    Math.min(a[3], b[3]),
  ]);
const lineBox = (line: MaterialLine): PageBox => [
  Math.min(...line.normalizedQuad.map((p) => p[0])),
  Math.min(...line.normalizedQuad.map((p) => p[1])),
  Math.max(...line.normalizedQuad.map((p) => p[0])),
  Math.max(...line.normalizedQuad.map((p) => p[1])),
];
export const nativeCropSignature = (text: string) =>
  sourceLayoutSignature(text.replace(/^([A-H])[．、][ \t]*/u, "$1."));

/** Native bytes locate a gap; only a concordant raster reading adds text. */
export function missingNativeLines(
  native: NativeTextLine[],
  ocr: MaterialLine[],
  regions: PageBlock[],
) {
  const boxes = ocr.map(lineBox);
  return native.filter((line) => {
    if (
      line.text.trim().length < 3 ||
      line.text.length > 400 ||
      /[\u0000-\u0008\ufffd]/u.test(line.text)
    )
      return false;
    if (boxes.some((box) => overlap(box, line.box) / area(line.box) > 0.08))
      return false;
    const owned = regions
      .filter((region) => overlap(region.box, line.box) / area(line.box) > 0.6)
      .sort((a, b) => area(a.box) - area(b.box));
    return (
      !!owned.length &&
      ![
        "header",
        "footer",
        "number",
        "footnote",
        "aside_text",
        "header_image",
        "footer_image",
        "image",
        "chart",
        "display_formula",
        "inline_formula",
      ].includes(owned[0].kind)
    );
  });
}

export async function recoverNativeGaps(
  layout: PdfLayout,
  native: NativeTextResult,
  regions: PageBlock[],
  signal: AbortSignal,
  recognize: (
    line: NativeTextLine,
    variant: "original" | "vertical-2x",
  ) => Promise<NativeCropAttempt>,
): Promise<NativeGapRecovery> {
  const result: NativeGapRecovery = {
    policy: NATIVE_CROP_POLICY,
    rasterSha256: layout.rasterSha256,
    native,
    attempts: [],
    accepted: [],
    unresolved: [],
  };
  if (!native.ok) return result;
  if (
    native.version !== layout.inputSha256 ||
    native.page !== layout.page ||
    native.total !== layout.total
  )
    throw Error("source_changed");
  const candidates = missingNativeLines(native.lines, layout.lines, regions);
  for (const [index, line] of candidates.entries()) {
    signal.throwIfAborted();
    if (index >= 8) {
      result.unresolved.push(line.id);
      continue;
    }
    let accepted: { attempt: NativeCropAttempt; index: number } | undefined;
    for (const variant of ["original", "vertical-2x"] as const) {
      const raw = await recognize(line, variant);
      signal.throwIfAborted();
      const attempt = { ...raw, variant },
        attemptIndex = result.attempts.length;
      result.attempts.push(attempt);
      const high =
        !!attempt.ocr && attempt.ocr.scores.every((score) => score >= 0.85);
      const expected = nativeCropSignature(line.text),
        observed = attempt.ocr ? nativeCropSignature(attempt.ocr.text) : "";
      if (high && attempt.image && observed === expected) {
        accepted = { attempt, index: attemptIndex };
        break;
      }
      // A high-confidence contradictory reading is held. Prefix-only detections are incomplete.
      if (high && observed && !expected.startsWith(observed)) break;
    }
    if (!accepted) {
      result.unresolved.push(line.id);
      continue;
    }
    const attempt = accepted.attempt,
      attemptIndex = accepted.index;
    const [left, top, right, bottom] = line.box;
    result.accepted.push({
      nativeLineId: line.id,
      attempt: attemptIndex,
      line: {
        id: "native-crop-" + line.id,
        kind: "text",
        needsReview: true,
        text: attempt.ocr!.text,
        score: Math.min(...attempt.ocr!.scores),
        normalizedQuad: [
          [left, top],
          [right, top],
          [right, bottom],
          [left, bottom],
        ],
        quad: [
          [left * layout.width, top * layout.height],
          [right * layout.width, top * layout.height],
          [right * layout.width, bottom * layout.height],
          [left * layout.width, bottom * layout.height],
        ],
      },
    });
  }
  return result;
}
