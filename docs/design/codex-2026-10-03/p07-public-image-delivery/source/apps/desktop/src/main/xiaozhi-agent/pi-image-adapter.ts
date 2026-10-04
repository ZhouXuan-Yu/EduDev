// @ts-nocheck
// Exact Hana v0.450.0 Apache-2.0 adapter bodies; Pi1.0.2 original exports.
import {resizeImage as rawResizeImage,formatDimensionNote as rawFormatDimensionNote} from "@earendil-works/pi-coding-agent";
export async function resizeModelImageInput(image, options) {
  const inputBytes = Buffer.from(String(image?.data ?? ""), "base64");
  return rawResizeImage(inputBytes, image?.mimeType, options);
}
export function formatModelImageDimensionNote(result) {
  return rawFormatDimensionNote(result);
}
