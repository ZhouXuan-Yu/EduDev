import fs from "node:fs/promises";
import path from "node:path";
import type { BigIntStats } from "node:fs";
import { getResolvedPDFJS } from "unpdf";
import {
  NATIVE_TEXT_SCHEMA,
  NATIVE_TEXT_ENGINE,
  NATIVE_TEXT_MAX_READ,
  type NativeTextRequest,
  type NativeTextResult,
  type NativeTextItem,
  type NativeTextLine,
} from "../../shared/material-native-text";
import type { PageBox } from "../../shared/material-page-preview";

const stamp = (stat: BigIntStats) =>
  [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs]
    .map(String)
    .join(":");
const union = (a: PageBox, b: PageBox): PageBox => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
];

export function joinNativeTextItems(items: NativeTextItem[]): NativeTextLine[] {
  const lines: NativeTextLine[] = [];
  for (const item of [...items].sort((a, b) =>
    Math.abs(a.box[1] - b.box[1]) <
    Math.min(a.box[3] - a.box[1], b.box[3] - b.box[1]) * 0.4
      ? a.box[0] - b.box[0]
      : a.box[1] - b.box[1],
  )) {
    const previous = lines.at(-1),
      height = item.box[3] - item.box[1];
    const sameRow =
      previous &&
      Math.abs(previous.box[1] - item.box[1]) < height * 0.35 &&
      item.box[0] >= previous.box[2] - height * 0.1 &&
      item.box[0] - previous.box[2] < height * 1.5;
    if (sameRow) {
      const gap = item.box[0] - previous.box[2];
      previous.text += (gap > height * 0.15 ? " " : "") + item.text;
      previous.box = union(previous.box, item.box);
      previous.itemIds.push(item.id);
    } else
      lines.push({
        id: "native-line-" + (lines.length + 1),
        text: item.text,
        box: [...item.box],
        itemIds: [item.id],
      });
  }
  if (lines.length > 2000) throw Error("too_large");
  return lines;
}

/** Existing PDF.js parser, bounded range transport, one page in a killable utility process. */
export async function readNativePdfText(
  request: NativeTextRequest,
): Promise<NativeTextResult> {
  if (!path.isAbsolute(request.file)) throw Error("invalid_input");
  const file = path.resolve(request.file),
    before = await fs.lstat(file, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    (await fs.realpath(file)).toLowerCase() !== file.toLowerCase() ||
    stamp(before) !== request.stamp
  )
    throw Error("source_changed");
  if (before.size < 5n || before.size > 16n * 1024n ** 3n)
    throw Error("too_large");

  let closed = false,
    readBytes = 0;
  const tasks = new Set<Promise<void>>();
  const pdfjs = await getResolvedPDFJS();
  if (pdfjs.version !== "6.1.200") throw Error("unavailable");
  const { PDFDataRangeTransport } = pdfjs;
  const handle = await fs.open(file, "r");
  let failRead: (error: unknown) => void = () => {};
  const failed = new Promise<never>((_, reject) => {
    failRead = reject;
  });
  // Attach a rejection handler before the parser starts requesting ranges.
  void failed.catch(() => {});
  const read = async (begin: number, end: number) => {
    if (closed) throw Error("cancelled");
    if (
      !Number.isSafeInteger(begin) ||
      !Number.isSafeInteger(end) ||
      begin < 0 ||
      end <= begin ||
      end > Number(before.size) ||
      end - begin > 4 * 1048576 ||
      readBytes + end - begin > NATIVE_TEXT_MAX_READ
    )
      throw Error("too_large");
    readBytes += end - begin;
    const bytes = Buffer.alloc(end - begin);
    let offset = 0;
    while (offset < bytes.length) {
      const part = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        begin + offset,
      );
      if (!part.bytesRead) throw Error("source_changed");
      offset += part.bytesRead;
    }
    return new Uint8Array(bytes);
  };
  let document:
    | Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>
    | undefined;
  let loading: ReturnType<typeof pdfjs.getDocument> | undefined;
  try {
    if (stamp(await handle.stat({ bigint: true })) !== request.stamp)
      throw Error("source_changed");
    const initial = await read(0, Math.min(65536, Number(before.size)));
    if (Buffer.from(initial.subarray(0, 5)).toString("ascii") !== "%PDF-")
      throw Error("invalid_input");
    class Range extends PDFDataRangeTransport {
      requestDataRange(begin: number, end: number) {
        const task = read(begin, end)
          .then((bytes) => {
            if (!closed) this.onDataRange(begin, bytes);
          })
          .catch((error) => failRead(error));
        tasks.add(task);
        void task.finally(() => tasks.delete(task));
      }
      abort() {
        closed = true;
      }
    }
    const range = new Range(Number(before.size), initial, true);
    loading = pdfjs.getDocument({
      range,
      rangeChunkSize: 65536,
      disableAutoFetch: true,
      disableStream: true,
      ...{ isEvalSupported: false },
      useSystemFonts: false,
      disableFontFace: true,
      useWorkerFetch: false,
      verbosity: 0,
    });
    document = await Promise.race([loading.promise, failed]);
    if (request.page > document.numPages || document.numPages > 10000)
      throw Error("invalid_input");
    const page = await document.getPage(request.page),
      viewport = page.getViewport({ scale: 1 });
    const reader = page
      .streamTextContent({ disableNormalization: true })
      .getReader();
    const styles: Record<
      string,
      { ascent?: number; descent?: number; vertical?: boolean }
    > = {};
    const items: NativeTextItem[] = [];
    let chars = 0;
    for (;;) {
      const part = await Promise.race([reader.read(), failed]);
      if (part.done) break;
      Object.assign(styles, part.value.styles);
      for (const item of part.value.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        chars += item.str.length;
        if (chars > 128000 || items.length >= 4000) throw Error("too_large");
        const tx = pdfjs.Util.transform(viewport.transform, item.transform),
          style = styles[item.fontName];
        // Angled and vertical writing remain in the original OCR path.
        if (
          style?.vertical ||
          Math.abs(Math.atan2(tx[1], tx[0])) > 0.08 ||
          item.width <= 0 ||
          item.height <= 0
        )
          continue;
        const height = Math.hypot(tx[2], tx[3]),
          ascent = height * (style?.ascent ?? 0.85),
          descent = height * (style?.descent ?? -0.2);
        const box: PageBox = [
          Math.max(0, tx[4] / viewport.width),
          Math.max(0, (tx[5] - ascent) / viewport.height),
          Math.min(1, (tx[4] + item.width * viewport.scale) / viewport.width),
          Math.min(1, (tx[5] - descent) / viewport.height),
        ];
        if (!box.every(Number.isFinite) || box[0] >= box[2] || box[1] >= box[3])
          continue;
        items.push({
          id: "native-item-" + (items.length + 1),
          text: item.str,
          box,
          transform: [...item.transform],
          width: item.width,
          height: item.height,
        });
      }
    }
    if (
      stamp(await handle.stat({ bigint: true })) !== request.stamp ||
      stamp(await fs.lstat(file, { bigint: true })) !== request.stamp
    )
      throw Error("source_changed");
    return {
      schemaVersion: NATIVE_TEXT_SCHEMA,
      ok: true,
      engine: NATIVE_TEXT_ENGINE,
      version: request.version,
      page: request.page,
      total: document.numPages,
      readBytes,
      items,
      lines: joinNativeTextItems(items),
    };
  } finally {
    closed = true;
    await loading?.destroy().catch(() => {});
    await Promise.allSettled(tasks);
    await handle.close();
  }
}
