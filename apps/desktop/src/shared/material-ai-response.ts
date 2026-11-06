import { aiBatchId } from "./material-ai";

export const MATERIAL_AI_RESPONSE_RECEIPT =
  "xiaozhi.material-ai-response-receipt.v1" as const;
export type AiResponsePhase = "first" | "source" | "final";
export type AiResponseFormat =
  "" | "provider-envelope.v1" | "completion-content.v1";
export type AiResponseQuery = {
  schemaVersion: typeof MATERIAL_AI_RESPONSE_RECEIPT;
  batchId: string;
  ordinal: number;
  responseId?: string;
};
export type AiResponseReceipt = {
  id: string;
  phase: AiResponsePhase;
  model: string;
  requestedAt: string;
  receivedAt: string;
  format: AiResponseFormat;
  bytes: number;
  sha256: string;
};
export type AiResponseView = {
  schemaVersion: typeof MATERIAL_AI_RESPONSE_RECEIPT;
  batchId: string;
  ordinal: number;
  receipts: AiResponseReceipt[];
  selected?: { id: string; encoding: "utf8" | "base64"; body: string };
};
export function validAiResponseQuery(value: unknown): value is AiResponseQuery {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 && keys.length !== 4) return false;
  if (
    !keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        ["schemaVersion", "batchId", "ordinal", "responseId"].includes(
          String(key),
        ) &&
        descriptor?.enumerable &&
        "value" in descriptor
      );
    })
  )
    return false;
  const query = value as AiResponseQuery;
  return (
    query.schemaVersion === MATERIAL_AI_RESPONSE_RECEIPT &&
    aiBatchId(query.batchId) &&
    Number.isSafeInteger(query.ordinal) &&
    query.ordinal >= 1 &&
    query.ordinal <= 100 &&
    (keys.length === 3 ||
      (typeof query.responseId === "string" &&
        /^airesponse_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          query.responseId,
        )))
  );
}
