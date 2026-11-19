import { nativePdfText } from "./material-native-text-host";
import { recoverNativeGaps } from "./material-native-gap";
import type { NativeGapRecovery } from "../../shared/material-native-text";
import { createHash, randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { nativeImage } from "electron";
import type { TeacherResource } from "../../shared/contracts";
import type {
  StructureQuestion,
  StructurePage,
} from "../../shared/material-document-structure";
import { DOCUMENT_STRUCTURE_ENGINE } from "../../shared/material-document-structure";
import {
  PDF_PAGE_ENGINE,
  MATERIAL_PREVIEW_SCHEMA,
  type PageBox,
} from "../../shared/material-page-preview";
import {
  MATERIAL_LAYOUT_SCHEMA,
  type PdfLayout,
} from "../../shared/material-layout";
import {
  QUESTION_DOCUMENT_SCHEMA,
  validQuestionDocument,
  type QuestionDocument,
} from "../../shared/question-document";
import { emptyQuestionProjection } from "../../shared/question-projection";
import { MaterialLayoutCache, readMaterialLayout } from "./material-layout";
import { withMaterialPageBlocks } from "./material-page-blocks";
import { QuestionAssets, type OriginalImage } from "./question-assets";
import { layoutPdfFile } from "../xiaozhi-agent/pdf-file-host";
import {
  recognizeLocalImage,
  recognizeLocalPdfLayout,
  recognizeLocalPageBlocks,
} from "../xiaozhi-agent/ocr-host";
import type { MaterialRepository } from "./material-repository";
import type { MaterialWordPagesRepository } from "./material-word-pages";
import type { StructurePageReceipt } from "./material-structure-repository";
import type { QuestionBankItem } from "../../shared/contracts";
import type { AutomaticQuestionSource } from "../education/original-question-repository";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const assetId = (value: string) =>
  `asset_${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;

/** Lossless image-to-PDF adapter reuses the installed PDFium/RapidOCR geometry protocol. */
export function structureImagePdf(bytes: Buffer) {
  let image = nativeImage.createFromBuffer(bytes);
  if (image.isEmpty()) throw Error("parse_failed");
  const size = image.getSize();
  if (size.width * size.height > 24_000_000) throw Error("too_large");
  if (Math.max(size.width, size.height) > 2400)
    image = image.resize({
      width: Math.round(
        size.width * Math.min(1, 2400 / Math.max(size.width, size.height)),
      ),
      height: Math.round(
        size.height * Math.min(1, 2400 / Math.max(size.width, size.height)),
      ),
      quality: "best",
    });
  const { width, height } = image.getSize(),
    bitmap = image.toBitmap(),
    rgb = Buffer.alloc(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const alpha = bitmap[pixel * 4 + 3] / 255;
    for (let channel = 0; channel < 3; channel++)
      rgb[pixel * 3 + channel] = Math.round(
        bitmap[pixel * 4 + 2 - channel] * alpha + 255 * (1 - alpha),
      );
  }
  const compressed = deflateSync(rgb);
  const content = Buffer.from(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`);
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    ),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
      ),
      compressed,
      Buffer.from("\nendstream"),
    ]),
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`),
      content,
      Buffer.from("\nendstream"),
    ]),
  ];
  const parts = [Buffer.from("%PDF-1.4\n")],
    offsets = [0];
  let length = parts[0].length;
  for (const [index, object] of objects.entries()) {
    offsets.push(length);
    const part = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      object,
      Buffer.from("\nendobj\n"),
    ]);
    parts.push(part);
    length += part.length;
  }
  parts.push(
    Buffer.from(
      `xref\n0 6\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => String(offset).padStart(10, "0") + " 00000 n ")
        .join(
          "\n",
        )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`,
    ),
  );
  return Buffer.concat(parts);
}

export class MaterialStructureRuntime {
  private cache: MaterialLayoutCache;
  private assets: QuestionAssets;
  private root: () => string;
  private materials: () => MaterialRepository;
  private words: () => MaterialWordPagesRepository;
  constructor(
    root: () => string,
    materials: () => MaterialRepository,
    words: () => MaterialWordPagesRepository,
  ) {
    this.root = root;
    this.materials = materials;
    this.words = words;
    this.cache = new MaterialLayoutCache(root);
    this.assets = new QuestionAssets(root);
  }

  async automatic(
    q: QuestionBankItem,
    signal: AbortSignal,
  ): Promise<AutomaticQuestionSource> {
    if (!q.document) throw Error("source_changed");
    const images: AutomaticQuestionSource["images"] = [];
    for (const block of q.document.blocks)
      if (block.kind === "image") {
        const source = q.document.source,
          anchor = block.anchors[0];
        const image: OriginalImage = {
          schemaVersion: MATERIAL_PREVIEW_SCHEMA,
          ok: true,
          requestId: randomUUID(),
          resourceId: source.resourceId,
          version: source.resourceVersion,
          engine: PDF_PAGE_ENGINE,
          assetId: block.assetId,
          page: anchor.page,
          total: Math.max(
            ...q.document.blocks.flatMap((b) => b.anchors.map((a) => a.page)),
          ),
          box: anchor.box,
          width: block.width,
          height: block.height,
          sha256: block.sha256,
        };
        images.push({
          blockId: block.id,
          role: "question",
          assetId: block.assetId,
          sha256: block.sha256,
          width: block.width,
          height: block.height,
          page: anchor.page,
          bytes: await this.assets.read(image, true, signal),
        });
      }
    return { projection: emptyQuestionProjection(q.stem), images };
  }

  async page(
    resource: TeacherResource,
    page: number,
    signal: AbortSignal,
  ): Promise<StructurePageReceipt> {
    let rasterResource = resource,
      layout: PdfLayout;
    if (/\.docx$/i.test(resource.originalFileName)) {
      const { renderWordPdf } = await import("./word-pdf-runtime");
      const converted = await this.words().prepare(
        {
          schemaVersion: "xiaozhi.word-pages.v1",
          resourceId: resource.id,
          version: resource.contentHash,
        },
        renderWordPdf,
        signal,
      );
      if (!converted.pdf) throw Error("source_incomplete");
      rasterResource = converted.pdf;
    }
    if (/\.(png|jpe?g|webp)$/i.test(resource.originalFileName)) {
      const bytes = await this.materials().original(
        resource.id,
        resource.contentHash,
        signal,
      );
      if (bytes.length > 4 * 1048576) throw Error("too_large");
      layout = await recognizeLocalPdfLayout(
        structureImagePdf(bytes),
        1,
        signal,
      );
    } else {
      const result = await readMaterialLayout(
        this.materials(),
        this.cache,
        {
          schemaVersion: MATERIAL_LAYOUT_SCHEMA,
          requestId: randomUUID(),
          resourceId: rasterResource.id,
          version: rasterResource.contentHash,
          page,
          refresh: false,
        },
        signal,
        recognizeLocalPdfLayout,
        layoutPdfFile,
      );
      layout = result.layout;
    }
    const result = await withMaterialPageBlocks(
      this.materials(),
      this.root(),
      { resourceId: resource.id, version: resource.contentHash, layout },
      false,
      signal,
      recognizeLocalPageBlocks,
    );
    const bytes = Buffer.from(layout.png, "base64");
    const image: OriginalImage = {
      schemaVersion: MATERIAL_PREVIEW_SCHEMA,
      ok: true,
      requestId: randomUUID(),
      resourceId: resource.id,
      version: resource.contentHash,
      engine: PDF_PAGE_ENGINE,
      assetId: assetId(layout.rasterSha256),
      page,
      total: layout.total,
      box: [0, 0, 1, 1],
      width: layout.width,
      height: layout.height,
      sha256: layout.rasterSha256,
    };
    await this.assets.put(image, bytes, true, signal);
    let nativeRecovery: NativeGapRecovery | undefined;
    if (/\.(pdf|docx)$/i.test(resource.originalFileName)) {
      const native = await nativePdfText(
        this.materials(),
        rasterResource,
        page,
        signal,
      );
      nativeRecovery = await recoverNativeGaps(
        layout,
        native,
        result.pageBlocks.receipt.blocks,
        signal,
        async (line, variant) => {
          const height = line.box[3] - line.box[1],
            padding = height * 0.25;
          const box: PageBox = [
            Math.max(0, line.box[0] - padding),
            Math.max(0, line.box[1] - padding),
            Math.min(1, line.box[2] + padding),
            Math.min(1, line.box[3] + padding),
          ];
          const x = Math.floor(box[0] * image.width),
            y = Math.floor(box[1] * image.height);
          const cut = nativeImage
            .createFromBuffer(bytes)
            .crop({
              x,
              y,
              width: Math.ceil(box[2] * image.width) - x,
              height: Math.ceil(box[3] * image.height) - y,
            });
          const sourcePng = cut.toPNG({ scaleFactor: 1 }),
            sourceSize = cut.getSize(),
            sourceDigest = sha(sourcePng);
          const originalCrop = {
            ...image,
            box,
            assetId: assetId(sourceDigest),
            sha256: sourceDigest,
            width: sourceSize.width,
            height: sourceSize.height,
          };
          await this.assets.put(originalCrop, sourcePng, true, signal);
          const prepared =
            variant === "vertical-2x" ? normalizeNativeCrop(cut) : cut;
          const png = prepared.toPNG({ scaleFactor: 1 }),
            size = prepared.getSize(),
            digest = sha(png);
          const crop = {
            ...image,
            box,
            assetId: assetId(digest),
            sha256: digest,
            width: size.width,
            height: size.height,
          };
          await this.assets.put(crop, png, true, signal);
          try {
            const ocr = await recognizeLocalImage(png, signal);
            return {
              nativeLineId: line.id,
              variant,
              sourceAssetId: originalCrop.assetId,
              image: {
                assetId: crop.assetId,
                sha256: digest,
                width: size.width,
                height: size.height,
                box,
              },
              ocr,
            };
          } catch (error) {
            signal.throwIfAborted();
            return {
              nativeLineId: line.id,
              variant,
              sourceAssetId: originalCrop.assetId,
              image: {
                assetId: crop.assetId,
                sha256: digest,
                width: size.width,
                height: size.height,
                box,
              },
              error: error instanceof Error ? error.message : "parse_failed",
            };
          }
        },
      );
    }
    return {
      input: {
        resourceId: resource.id,
        version: resource.contentHash,
        page,
        totalPages: layout.total,
        rasterSha256: layout.rasterSha256,
        sourceEngine: layout.engine,
        layoutEngine: result.pageBlocks.receipt.engine,
        rasterSource: {
          resourceId: rasterResource.id,
          version: layout.inputSha256,
        },
        ...(nativeRecovery ? { nativeRecovery } : {}),
        lines: layout.lines,
        regions: result.pageBlocks.receipt.blocks,
      },
      image,
    };
  }

  async document(
    resource: TeacherResource,
    q: StructureQuestion,
    pages: { page: StructurePage; image: OriginalImage }[],
    signal: AbortSignal,
  ): Promise<QuestionDocument> {
    if (pages.length > 8 || q.anchors.length > 256 || q.stem.length > 12000)
      throw Error("question_too_large");
    const blocks: QuestionDocument["blocks"] = [];
    for (const { page, image } of pages) {
      const paragraphs = page.paragraphs.filter(
        (p) =>
          q.paragraphIds.includes(p.id) || q.sharedMaterialIds.includes(p.id),
      );
      for (const column of [...new Set(paragraphs.map((p) => p.column))]) {
        const owned = paragraphs
          .filter((p) => p.column === column)
          .map((p) => p.anchor.box);
        const assets = q.assets
          .filter(
            (a) =>
              a.page === page.page &&
              (column < 0 ||
                ((a.box[0] + a.box[2]) / 2 >= page.columns[column][0] &&
                  (a.box[0] + a.box[2]) / 2 <= page.columns[column][2])),
          )
          .map((a) => a.box);
        const boxes = [...owned, ...assets];
        const box: PageBox = [
          Math.max(0, Math.min(...boxes.map((b) => b[0])) - 0.008),
          Math.max(0, Math.min(...boxes.map((b) => b[1])) - 0.005),
          Math.min(1, Math.max(...boxes.map((b) => b[2])) + 0.008),
          Math.min(1, Math.max(...boxes.map((b) => b[3])) + 0.005),
        ];
        const bytes = await this.assets.read(image, true, signal),
          full = nativeImage.createFromBuffer(bytes);
        const x = Math.floor(box[0] * image.width),
          y = Math.floor(box[1] * image.height);
        const crop = full.crop({
          x,
          y,
          width: Math.ceil(box[2] * image.width) - x,
          height: Math.ceil(box[3] * image.height) - y,
        });
        const png = crop.toPNG({ scaleFactor: 1 }),
          size = crop.getSize(),
          sha256 = sha(png);
        const saved: OriginalImage = {
          ...image,
          assetId: assetId(sha256),
          box,
          width: size.width,
          height: size.height,
          sha256,
        };
        await this.assets.put(saved, png, true, signal);
        blocks.push({
          id: `source_question_${blocks.length + 1}`,
          kind: "image",
          assetId: saved.assetId,
          sha256,
          mime: "image/png",
          width: size.width,
          height: size.height,
          anchors: [{ page: page.page, box }],
        });
      }
    }
    if (!blocks.length) throw Error("structure_document_invalid");
    const anchors = blocks.flatMap((b) => b.anchors);
    blocks.push({ id: "transcription", kind: "text", text: q.stem, anchors });
    const document: QuestionDocument = {
      schemaVersion: QUESTION_DOCUMENT_SCHEMA,
      source: {
        resourceId: resource.id,
        resourceVersion: resource.contentHash,
        parserVersion: pages[0]?.page.engine ?? DOCUMENT_STRUCTURE_ENGINE,
        ocrVersion: pages[0].page.sourceEngine,
      },
      blocks,
      answer: q.answer
        ? { origin: "source", text: q.answer, anchors }
        : { origin: "missing", text: "", anchors: [] },
      analysis: q.analysis
        ? { origin: "source", text: q.analysis, anchors }
        : { origin: "missing", text: "", anchors: [] },
    };
    if (!validQuestionDocument(document))
      throw Error("structure_document_invalid");
    return document;
  }
}

/** Bounded short-line normalization, preserving the untouched crop as the source asset. */
function normalizeNativeCrop(image: Electron.NativeImage) {
  const size = image.getSize();
  const resized = image.resize({
    width: size.width,
    height: size.height * 2,
    quality: "best",
  });
  const dimensions = resized.getSize(),
    padding = 20,
    width = dimensions.width + padding * 2,
    height = dimensions.height + padding * 2;
  if (width * height > 16000000) throw Error("too_large");
  const source = resized.toBitmap(),
    pixels = Buffer.alloc(width * height * 4, 255);
  for (let row = 0; row < dimensions.height; row++)
    source.copy(
      pixels,
      ((row + padding) * width + padding) * 4,
      row * dimensions.width * 4,
      (row + 1) * dimensions.width * 4,
    );
  return nativeImage.createFromBitmap(pixels, { width, height });
}
