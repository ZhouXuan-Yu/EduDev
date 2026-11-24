import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";

function archiveEntryPath(file: string, wheel: boolean) {
  const parts = file.split("/");
  if (parts.at(-1) === "") parts.pop();
  if (!parts.length || parts.some(piece => !piece || piece === "." || piece === ".." ||
      /[\\:\p{C}<>|"*?]|[. ]$/u.test(piece) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(piece))) throw Error("configuration");
  if (wheel && parts[0].endsWith(".data")) {
    if (parts[1] !== "purelib" && parts[1] !== "platlib") return;
    return parts.slice(2);
  }
  return parts;
}

export async function unpackFormulaZip(file: string, folder: string, wheel: boolean, signal: AbortSignal) {
  signal.throwIfAborted();
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.open(file, { lazyEntries: true, strictFileNames: true }, (error, value) => error ? reject(error) : resolve(value!)));
  let count = 0, bytes = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      zip.once("error", reject);
      zip.once("end", resolve);
      zip.on("entry", entry => {
        void (async () => {
          signal.throwIfAborted();
          if (++count > 24_000 || (bytes += entry.uncompressedSize) > 900 * 1024 ** 2 || entry.isEncrypted() ||
              (entry.externalFileAttributes >>> 16 & 0xf000) === 0xa000) throw Error("configuration");
          const parts = archiveEntryPath(entry.fileName, wheel);
          if (parts?.length && !entry.fileName.endsWith("/")) {
            const target = path.resolve(folder, ...parts);
            if (!target.startsWith(path.resolve(folder) + path.sep)) throw Error("configuration");
            await fs.mkdir(path.dirname(target), { recursive: true });
            const input = await new Promise<NodeJS.ReadableStream>((resolve, reject) =>
              zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream!)));
            await pipeline(input, createWriteStream(target, { flags: "wx" }), { signal });
          }
          zip.readEntry();
        })().catch(reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

export async function unpackPinnedTarMember(archive: string, offset: number, bytes: number, target: string, signal: AbortSignal) {
  await pipeline(createReadStream(archive, { start: offset, end: offset + bytes - 1, signal }),
    createWriteStream(target, { flags: "wx" }), { signal });
}
