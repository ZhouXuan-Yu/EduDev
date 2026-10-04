// @ts-nocheck
// Hana0.449.0 Apache-2.0: original inbound filename fragments; storage/authority adapter remains outside vendor.
import path from "node:path";
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/json": "json",
  "application/pdf": "pdf",
};

function safeFilename(name, mimeType, type) {
  const fallback = `bridge-inbound.${extensionFor(mimeType, type)}`;
  const raw = typeof name === "string" && name.trim() ? name : fallback;
  const base = removeUnsafeFilenameChars(path.basename(raw)).trim() || fallback;
  if (path.extname(base)) return base;
  return `${base}.${extensionFor(mimeType, type)}`;
}

function removeUnsafeFilenameChars(value: string) {
  return Array.from(value, (char: string) => {
    const code = char.charCodeAt(0);
    return code <= 0x1F || char === "/" || char === "\\" ? "" : char;
  }).join("");
}

function extensionFor(mimeType, type) {
  const normalized = String(mimeType || "").toLowerCase();
  if (MIME_EXTENSIONS[normalized]) return MIME_EXTENSIONS[normalized];
  if (type === "image") return "jpg";
  if (type === "video") return "mp4";
  if (type === "audio") return "ogg";
  return "bin";
}
export { safeFilename };
