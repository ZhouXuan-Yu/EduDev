// @ts-nocheck
// Hana v0.450.0 Apache-2.0: exact original screenshot filename functions.
import { createHash } from "crypto";
export function browserScreenshotExt(mimeType) {
  const lower = String(mimeType || "").toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  return "png";
}

export function browserScreenshotFilename({ base64, mimeType }: { base64?: any; mimeType?: any } = {}) {
  if (!base64) throw new Error("browser screenshot base64 is required");
  const hash = createHash("sha256").update(String(base64)).digest("hex").slice(0, 16);
  return `browser-screenshot-${hash}.${browserScreenshotExt(mimeType)}`;
}
