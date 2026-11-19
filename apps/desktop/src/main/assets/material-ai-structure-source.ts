import { createHash } from "node:crypto";
import {
  AI_STRUCTURE_SOURCE,
  validAiStructureContext,
  type AiStructureContext,
} from "../../shared/material-ai-structure";
import {
  validDocumentStructureEngine,
  type StructurePage,
} from "../../shared/material-document-structure";
import {
  PDF_LAYOUT_ENGINE,
  PDF_LAYOUT_SCHEMA,
  type MaterialLine,
  type PdfLayout,
} from "../../shared/material-layout";
import { validNativeTextResult } from "../../shared/material-native-text";
import { validLocalOcrReceipt } from "../../shared/xiaozhi-ocr";
import type { MaterialPageSource } from "../../shared/material-ai-page";
import {
  pageBlockTexts,
  type FragmentPageSource,
} from "../../shared/material-ai-page-fragments";
import { recoverNativeGaps } from "./material-native-gap";
import { QuestionAssets, type OriginalImage } from "./question-assets";

type Host = {
  root?: () => string;
  all: (
    sql: string,
    values?: (string | number | null)[],
  ) => Promise<Record<string, unknown>[]>;
};
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function context(
  page: StructurePage,
  generation: string,
  pageSha256: string,
): AiStructureContext {
  const recovery = page.nativeRecovery;
  const result: AiStructureContext = {
    schemaVersion: AI_STRUCTURE_SOURCE,
    engine: page.engine,
    reference: {
      resourceId: page.resourceId,
      version: page.version,
      page: page.page,
      generation,
      pageSha256,
      rasterSha256: page.rasterSha256,
      originalOcrSha256: digest(page.rawText),
    },
    paragraphs: page.paragraphs,
    supplemental: (recovery?.accepted ?? []).map((accepted) => {
      const proof = recovery!.attempts[accepted.attempt];
      const line = page.lines.find(
        (item) =>
          item.sourceId === accepted.line.id &&
          item.origin === "pdf_native_crop",
      );
      if (
        !proof?.ocr ||
        !proof.image ||
        !line ||
        line.text !== accepted.line.text ||
        line.score !== accepted.line.score
      )
        throw Error("source_changed");
      return {
        lineId: line.id,
        text: line.text,
        box: line.box,
        score: line.score,
        imageSha256: proof.image.sha256,
        ocrSha256: digest(JSON.stringify(proof.ocr)),
      };
    }),
    unresolved: recovery?.unresolved ?? [],
  };
  if (!validAiStructureContext(result)) throw Error("unit_too_large");
  return result;
}

async function readPage(
  host: Host,
  source: MaterialPageSource,
  generation: string,
  expectedSha?: string,
) {
  const row = (
    await host.all(
      "SELECT body_json,image_json,sha256 FROM material_structure_pages WHERE generation=? AND page=?",
      [generation, source.page],
    )
  )[0];
  if (
    !row ||
    typeof row.body_json !== "string" ||
    Buffer.byteLength(row.body_json) > 4 * 1048576 ||
    typeof row.image_json !== "string"
  )
    throw Error("source_changed");
  const page = JSON.parse(row.body_json) as StructurePage,
    image = JSON.parse(row.image_json) as OriginalImage;
  if (
    digest(JSON.stringify(page)) !== row.sha256 ||
    (expectedSha && row.sha256 !== expectedSha) ||
    !validDocumentStructureEngine(page.engine) ||
    page.resourceId !== source.resourceId ||
    page.version !== source.version ||
    page.page !== source.page ||
    image.resourceId !== source.resourceId ||
    image.version !== source.version ||
    image.page !== source.page ||
    image.sha256 !== page.rasterSha256
  )
    throw Error("source_changed");
  return { page, image, sha256: String(row.sha256) };
}

function orderedStructureLines(
  page: StructurePage,
  image: OriginalImage,
): MaterialLine[] {
  const lines = new Map(
    page.lines.map((line) => [
      line.id,
      {
        id: line.sourceId,
        kind: "text" as const,
        needsReview: true as const,
        text: line.text,
        score: line.score,
        normalizedQuad: line.quad,
        quad: line.quad.map((point) => [
          point[0] * image.width,
          point[1] * image.height,
        ]) as MaterialLine["quad"],
      },
    ]),
  );
  const ids = page.paragraphs.flatMap((paragraph) => paragraph.lineIds);
  if (
    ids.length !== lines.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !lines.has(id))
  )
    throw Error("source_changed");
  return ids.map((id) => lines.get(id)!);
}

async function authenticate(
  host: Host,
  page: StructurePage,
  image: OriginalImage,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (!host.root) throw Error("storage_unavailable");
  const assets = new QuestionAssets(host.root);
  await assets.read(image, true, signal);
  const native = page.nativeRecovery;
  if (!native) return;
  if (
    !validNativeTextResult(native.native) ||
    native.rasterSha256 !== page.rasterSha256
  )
    throw Error("source_changed");
  const rawLines: MaterialLine[] = page.lines
    .filter((line) => !line.origin)
    .map((line) => ({
      id: line.sourceId,
      kind: "text",
      needsReview: true,
      text: line.text,
      score: line.score,
      normalizedQuad: line.quad,
      quad: line.quad.map((point) => [
        point[0] * image.width,
        point[1] * image.height,
      ]) as MaterialLine["quad"],
    }));
  if (rawLines.map((line) => line.text).join("\n") !== page.rawText)
    throw Error("source_changed");
  const layout: PdfLayout = {
    schemaVersion: PDF_LAYOUT_SCHEMA,
    ok: true,
    engine: PDF_LAYOUT_ENGINE,
    inputSha256: page.version,
    page: page.page,
    total: page.totalPages,
    width: image.width,
    height: image.height,
    png: "",
    rasterSha256: page.rasterSha256,
    lines: rawLines,
  };
  const recomputed = await recoverNativeGaps(
    layout,
    native.native,
    page.regions,
    signal,
    async (line, variant) => {
      const attempt = native.attempts.find(
        (item) => item.nativeLineId === line.id && item.variant === variant,
      );
      if (
        !attempt ||
        !attempt.image ||
        (attempt.ocr && !validLocalOcrReceipt(attempt.ocr))
      )
        throw Error("source_changed");
      const original = native.attempts.find(
        (item) => item.nativeLineId === line.id && item.variant === "original",
      );
      if (!original?.image || attempt.sourceAssetId !== original.image.assetId)
        throw Error("source_changed");
      await assets.read({ ...image, ...attempt.image }, true, signal);
      return attempt;
    },
  );
  if (JSON.stringify(recomputed) !== JSON.stringify(native))
    throw Error("source_changed");
}

/** Called only while constructing a new non-legacy input. Historical prompts stay frozen. */
export async function withAiStructureSource(
  host: Host,
  source: MaterialPageSource,
  original: FragmentPageSource,
  signal: AbortSignal,
): Promise<FragmentPageSource> {
  if (
    !(
      await host.all(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='material_structure_jobs'",
      )
    ).length
  )
    return original;
  const job = (
    await host.all(
      "SELECT generation,version,engine,status FROM material_structure_jobs WHERE resource_id=?",
      [source.resourceId],
    )
  )[0];
  if (!job || !validDocumentStructureEngine(job.engine)) return original;
  if (
    job.version !== source.version ||
    !["complete", "partial"].includes(String(job.status))
  )
    throw Error("source_incomplete");
  const { page, image, sha256 } = await readPage(
    host,
    source,
    String(job.generation),
  );
  if (page.engine !== job.engine) throw Error("source_changed");
  if (
    page.rasterSha256 !== original.blocks.rasterSha256 ||
    image.width !== original.blocks.width ||
    image.height !== original.blocks.height ||
    !original.lines ||
    JSON.stringify(
      original.lines.map((line) => [
        line.id,
        line.text,
        line.normalizedQuad,
        line.score,
      ]),
    ) !==
      JSON.stringify(
        page.lines
          .filter((line) => !line.origin)
          .map((line) => [line.sourceId, line.text, line.quad, line.score]),
      )
  )
    throw Error("source_changed");
  await authenticate(host, page, image, signal);
  const lines = orderedStructureLines(page, image);
  return {
    ...original,
    lines,
    blockTexts: pageBlockTexts(original.blocks, { ...original.blocks, lines }),
    structureContext: context(page, String(job.generation), sha256),
  };
}

/** Historical generation authentication survives a later explicit derivative rebuild. */
export async function validateAiStructureSource(
  host: Host,
  source: MaterialPageSource,
  frozen: AiStructureContext,
  rasterSha256: string,
  signal: AbortSignal,
  hints?: Pick<FragmentPageSource, "blocks" | "blockTexts">,
) {
  if (
    !validAiStructureContext(frozen) ||
    frozen.reference.resourceId !== source.resourceId ||
    frozen.reference.version !== source.version ||
    frozen.reference.page !== source.page ||
    frozen.reference.rasterSha256 !== rasterSha256
  )
    throw Error("source_changed");
  const { page, image, sha256 } = await readPage(
    host,
    source,
    frozen.reference.generation,
    frozen.reference.pageSha256,
  );
  await authenticate(host, page, image, signal);
  if (hints) {
    const expected = pageBlockTexts(hints.blocks, {
      rasterSha256: page.rasterSha256,
      width: image.width,
      height: image.height,
      lines: orderedStructureLines(page, image),
    });
    if (JSON.stringify(hints.blockTexts) !== JSON.stringify(expected))
      throw Error("source_changed");
  }
  if (
    JSON.stringify(context(page, frozen.reference.generation, sha256)) !==
    JSON.stringify(frozen)
  )
    throw Error("source_changed");
}
