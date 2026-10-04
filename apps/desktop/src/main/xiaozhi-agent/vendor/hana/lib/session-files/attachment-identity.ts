// @ts-nocheck
// Hana 0.449.0 Apache-2.0; original function bodies, SQLite authority adapter outside vendor.
import { createHash } from "node:crypto";
export function buildSessionFileSourceKey(namespace, parts = []) {
  const ns = String(namespace || "source")
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]/g, "_")
    .slice(0, 80) || "source";
  const values = Array.isArray(parts) ? parts : [parts];
  const hash = createHash("sha256")
    .update(JSON.stringify(values.map((part) => part == null ? "" : String(part))))
    .digest("hex");
  return `${ns}:${hash}`;
}

function sessionFileOwnerKey(value) {
  if (value && typeof value === "object") {
    const sessionId = typeof value.sessionId === "string" && value.sessionId.trim()
      ? value.sessionId.trim()
      : null;
    if (sessionId) return `id:${sessionId}`;
    const sessionPath = typeof value.sessionPath === "string" && value.sessionPath.trim()
      ? value.sessionPath
      : null;
    if (sessionPath) return `path:${sessionPath}`;
  }
  return `path:${String(value)}`;
}
export { sessionFileOwnerKey };
